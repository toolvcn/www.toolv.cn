// 浏览器信息的采集层。
//
// 本工具的「输入」就是浏览器自身，所以这一层会读 navigator / window / screen ——
// 这是 core/ 里少见的例外（websocket 的 core 里也有 WebSocket 连接），
// 边界仍然是：只做「读出来、格式化成字符串」，不碰 DOM 结构、不写样式，渲染全在 ui/。
// 纯字符串解析单独放在 ua.ts，那一半可以在 node 里单测。
//
// 另一条边界：**所有浏览器 API 的访问都在函数体里**，模块顶层一行都不碰 ——
// 这个模块会被 SSR 引入，顶层读 navigator 会在构建时直接炸。

import { formatNameVersion, parseUserAgent, type UaInfo } from './ua.ts';
import { GROUP_DEFS, type Capability, type FieldKey } from './types.ts';

/** 采集到的一组字段值；缺的键就是浏览器不支持，UI 显示占位符 */
export type FieldValues = Partial<Record<FieldKey, string>>;

/** User-Agent Client Hints 的高熵值（点按钮才取） */
export interface HighEntropyValues {
	platformVersion: string;
	uaFullVersion: string;
}

// 三个还没进 TS 标准库、但主流浏览器已经有的 API，按用到的字段最小声明，避免 any
interface NetworkInformation {
	effectiveType?: string;
	downlink?: number;
	downlinkMax?: number;
	rtt?: number;
	saveData?: boolean;
}
interface UADataBrand {
	brand: string;
	version: string;
}
interface NavigatorUAData {
	brands: UADataBrand[];
	mobile: boolean;
	platform: string;
	getHighEntropyValues(hints: string[]): Promise<Record<string, string>>;
}
interface NavigatorExtras {
	userAgentData?: NavigatorUAData;
	connection?: NetworkInformation;
	deviceMemory?: number;
}

/** 还没进 TS 标准库（或各家实现不一致）的几个 API，按用到的字段最小声明 */
interface BatteryManager {
	charging: boolean;
	level: number;
	chargingTime: number;
	dischargingTime: number;
}

interface NavigatorBattery {
	getBattery?: () => Promise<BatteryManager>;
}

interface NavigatorKeyboard {
	keyboard?: { getLayoutMap(): Promise<Map<string, string>> };
}

/** AmbientLightSensor：实验性 API，只有带传感器的设备在 HTTPS 下才给实例化 */
interface AmbientLightSensorLike extends EventTarget {
	illuminance?: number;
	start(): void;
	stop(): void;
}

type AmbientLightSensorCtor = new (options?: { frequency?: number }) => AmbientLightSensorLike;

/** 传感器授权的入口：iOS 13+ 把它挂在 DeviceOrientationEvent / DeviceMotionEvent 构造器上 */
interface PermissionRequestable {
	requestPermission?: () => Promise<string>;
}

/**
 * Permissions API：`query` 的权限名各家支持的不一样（camera / microphone / clipboard-read
 * 都不是所有浏览器都认），名字对不上会直接抛 TypeError，所以描述符用宽类型、逐个 try/catch。
 */
interface PermissionStatusLike {
	state?: string;
}
interface PermissionsLike {
	query(descriptor: { name: string }): Promise<PermissionStatusLike>;
}

/** 设备枚举：没授权时 label 是空串，只有数量可看 */
interface MediaDeviceLike {
	kind?: string;
	label?: string;
}
interface MediaDevicesLike {
	enumerateDevices(): Promise<MediaDeviceLike[]>;
	getUserMedia(constraints: { audio?: boolean; video?: boolean }): Promise<MediaStream>;
}

/** 带扩展字段的 navigator；只在函数体里取 */
function nav(): Navigator & NavigatorExtras {
	return navigator as Navigator & NavigatorExtras;
}

/** 下面几个扩展接口都按「可能压根没有」取，调用方一律先判空 */
function permissionsApi(): PermissionsLike | undefined {
	return (navigator as Navigator & { permissions?: PermissionsLike }).permissions;
}

function mediaDevicesApi(): MediaDevicesLike | undefined {
	return (navigator as Navigator & { mediaDevices?: MediaDevicesLike }).mediaDevices;
}

function batteryApi(): NavigatorBattery['getBattery'] {
	return (navigator as Navigator & NavigatorBattery).getBattery;
}

function keyboardApi(): NavigatorKeyboard['keyboard'] {
	return (navigator as Navigator & NavigatorKeyboard).keyboard;
}

/** 挂在 window 上的实验性构造器，名字不在标准库里，只能按字符串取 */
function globalCtor<T>(name: string): T | undefined {
	return (window as unknown as Record<string, T | undefined>)[name];
}

/** 媒体查询：不支持该查询时返回 null，别让整次采集挂掉 */
function queryMatches(query: string): boolean | null {
	try {
		return window.matchMedia(query).matches;
	} catch {
		return null;
	}
}

/** 三态文案：不支持时返回 undefined，让调用方不写这个字段 */
function yesNo(value: boolean | null, yes: string, no: string): string | undefined {
	if (value === null) return undefined;
	return value ? yes : no;
}

/** 字节数格式化：站点内统一 1024 系 */
function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined || !Number.isFinite(bytes)) return '';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const text = unit === 0 ? String(value) : value.toFixed(value < 10 ? 2 : 1);
	return `${text} ${units[unit]}`;
}

/** 当前时区相对 UTC 的偏移，如 UTC+08:00 */
function utcOffsetLabel(): string {
	const minutes = -new Date().getTimezoneOffset();
	const sign = minutes < 0 ? '-' : '+';
	const abs = Math.abs(minutes);
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function orientationLabel(type: string): string {
	if (type.startsWith('portrait')) return '竖屏';
	if (type.startsWith('landscape')) return '横屏';
	return type;
}

/** 毫秒时长：不到 1 秒按毫秒给，超过就换算成秒 —— 性能指标两种量级都会出现 */
export function formatDuration(ms: number | undefined): string | undefined {
	if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined;
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * 电池时间：按秒给，`Infinity` 表示「按当前状态估不出来」（没接电源时的充满时间之类），
 * 不拿它冒充数字；0 的含义由调用方给（充满是 0，耗尽也是 0，两种含义不一样）。
 */
export function formatBatterySeconds(seconds: number | undefined, zeroLabel: string): string | undefined {
	if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
	if (seconds <= 0) return zeroLabel;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} 分钟`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}

/**
 * FNV-1a 32 位哈希：只用来把 Canvas 绘制结果压成一段短指纹，不做任何安全承诺。
 * 走位运算而不是 `crypto.subtle.digest`（那个是异步的，这里只想要一个稳定的短串）。
 */
export function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/** 按 kind 数设备：videoinput / audioinput / audiooutput */
export function countByKind(devices: MediaDeviceLike[], kind: string): number {
	return devices.filter((device) => device.kind === kind).length;
}

/** Permissions API 的三态：认不出的状态返回 undefined，不写这一行 */
export function permissionStateLabel(state: string | undefined): string | undefined {
	if (state === 'granted') return '已授权';
	if (state === 'denied') return '已拒绝';
	if (state === 'prompt') return '未决定';
	return undefined;
}

/** 传感器读数保留一位小数；空值返回空串（拼进文案里就是「没测到这一轴」） */
function round1(value: number | null | undefined): string {
	return value === null || value === undefined ? '' : value.toFixed(1);
}

/** 探测能否编码某个图片格式：canvas 转不出来就是不支持 */
function supportsImage(mime: string): boolean {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;
		return canvas.toDataURL(mime).startsWith(`data:${mime}`);
	} catch {
		return false;
	}
}

/** 读显卡渲染器名；属于硬件指纹信息，默认不读 */
function readWebglRenderer(): string {
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
		if (!gl) return '';
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		if (!ext) return '';
		const renderer: unknown = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
		return typeof renderer === 'string' ? renderer : '';
	} catch {
		return '';
	}
}

/** 探测一个 Web Storage 能不能用：隐私模式下 setItem 会抛 */
function probeWebStorage(kind: 'localStorage' | 'sessionStorage'): string {
	try {
		const store = window[kind];
		const probe = '__toolv_probe__';
		store.setItem(probe, '1');
		store.removeItem(probe);
		return `可用 · ${store.length} 条`;
	} catch {
		return '不可用（可能被浏览器禁用）';
	}
}

/** 采集全部字段。调用方保证在浏览器里跑 */
export function collectFields(includeWebgl: boolean): FieldValues {
	const n = nav();
	const ua = parseUserAgent(n.userAgent, n.maxTouchPoints ?? 0);
	const values: FieldValues = {};
	const set = (key: FieldKey, value: string | undefined): void => {
		if (value !== undefined && value !== '') values[key] = value;
	};

	// ------------------------------------------------------------ 浏览器
	set('browserName', ua.browser.name);
	set('browserVersion', ua.browser.version);
	set('engine', ua.engine.version === '' ? ua.engine.name : `${ua.engine.name} ${ua.engine.version}`);
	set('uaBrands', n.userAgentData?.brands?.map((brand) => `${brand.brand} ${brand.version}`).join('、'));
	set('language', n.language);
	set('languages', n.languages?.length ? n.languages.join('、') : undefined);
	set('cookie', n.cookieEnabled ? '允许' : '已禁用');
	set('online', n.onLine ? '在线' : '离线');

	// ------------------------------------------------------------ 系统与设备
	set('os', ua.os.name);
	set('osVersion', ua.os.version);
	set('deviceType', ua.device.label);
	set('cpu', n.hardwareConcurrency ? `${n.hardwareConcurrency} 线程` : undefined);
	set('memory', n.deviceMemory ? `约 ${n.deviceMemory} GB` : undefined);
	set('touch', `${n.maxTouchPoints ?? 0} 点`);
	set(
		'pointer',
		queryMatches('(pointer: coarse)')
			? '粗（触屏）'
			: yesNo(queryMatches('(pointer: fine)'), '精细（鼠标 / 触控板）', '无')
	);
	set('hover', yesNo(queryMatches('(hover: hover)'), '支持', '不支持'));

	// ------------------------------------------------------------ 屏幕与显示
	set('viewport', `${window.innerWidth} × ${window.innerHeight}`);
	set('screen', `${window.screen.width} × ${window.screen.height}`);
	set('avail', `${window.screen.availWidth} × ${window.screen.availHeight}`);
	set('dpr', String(window.devicePixelRatio));
	set('colorDepth', `${window.screen.colorDepth} 位`);
	set('orientation', orientationLabel(window.screen.orientation?.type ?? ''));
	set('colorScheme', yesNo(queryMatches('(prefers-color-scheme: dark)'), '深色', '浅色'));
	set('reducedMotion', yesNo(queryMatches('(prefers-reduced-motion: reduce)'), '已开启', '未开启'));
	set('rootFont', getComputedStyle(document.documentElement).fontSize);

	// ------------------------------------------------------------ 网络与地区
	try {
		set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
	} catch {
		/* 拿不到时区就不写这一行 */
	}
	set('utcOffset', utcOffsetLabel());
	set('connection', n.connection?.effectiveType?.toUpperCase());
	set('downlink', n.connection?.downlink !== undefined ? `${n.connection.downlink} Mb/s` : undefined);
	set('rtt', n.connection?.rtt !== undefined ? `${n.connection.rtt} ms` : undefined);
	set('saveData', n.connection ? yesNo(n.connection.saveData ?? false, '已开启', '未开启') : undefined);
	set('downlinkMax', n.connection?.downlinkMax !== undefined ? `${n.connection.downlinkMax} Mb/s` : undefined);

	// ------------------------------------------------------------ 外设
	// Gamepad API 是同步的，但浏览器要等手柄上按过一个键才会把它登记进来
	const pads = n.getGamepads().filter((pad): pad is Gamepad => pad !== null);
	set('gamepadCount', pads.length === 0 ? '未连接' : `${pads.length} 个`);
	set(
		'gamepadList',
		pads.length === 0
			? undefined
			: pads.map((pad) => `${pad.id}（${pad.buttons.length} 键 / ${pad.axes.length} 轴）`).join('、')
	);

	// ------------------------------------------------------------ 存储
	set('localStorage', probeWebStorage('localStorage'));
	set('sessionStorage', probeWebStorage('sessionStorage'));

	// WebGL 渲染器不进这张字段表：它是能力探测那一栏的事（见 collectCapabilities）。
	// 这里保留 includeWebgl 只是为了开关一变就重采一次，两栏才同步。
	void includeWebgl;

	return values;
}

/**
 * 能力探测：只回答支持 / 不支持，用徽章呈现。
 * WebGL 那一项在开关打开时额外带上渲染器名。
 */
export function collectCapabilities(includeWebgl: boolean): Capability[] {
	const n = nav();
	const renderer = includeWebgl ? readWebglRenderer() : '';
	const list: Capability[] = [
		{ key: 'webp', label: 'WebP', ok: supportsImage('image/webp'), detail: '' },
		{ key: 'avif', label: 'AVIF', ok: supportsImage('image/avif'), detail: '' },
		{ key: 'wasm', label: 'WebAssembly', ok: typeof WebAssembly === 'object', detail: '' },
		{ key: 'sw', label: 'Service Worker', ok: 'serviceWorker' in n, detail: '' },
		{ key: 'clipboard', label: '剪贴板 API', ok: !!n.clipboard, detail: '' },
		{ key: 'notification', label: '通知', ok: 'Notification' in window, detail: '' },
		{ key: 'geolocation', label: '地理定位', ok: 'geolocation' in n, detail: '' },
		{ key: 'eyedropper', label: 'EyeDropper', ok: 'EyeDropper' in window, detail: 'Chromium 系才有' },
		{
			key: 'barcode',
			label: 'BarcodeDetector',
			ok: 'BarcodeDetector' in window,
			detail: 'Chromium 系才有'
		},
		{
			key: 'offscreen',
			label: 'OffscreenCanvas',
			ok: typeof OffscreenCanvas !== 'undefined',
			detail: ''
		},
		{
			key: 'touch',
			label: '触摸事件',
			ok: 'ontouchstart' in window || (n.maxTouchPoints ?? 0) > 0,
			detail: ''
		},
		{
			key: 'webgl',
			label: 'WebGL',
			ok: renderer !== '' || hasWebgl(),
			detail: renderer === '' ? '' : `渲染器：${renderer}`
		},
		{ key: 'bluetooth', label: 'Web Bluetooth', ok: 'bluetooth' in n, detail: '' },
		{ key: 'usb', label: 'WebUSB', ok: 'usb' in n, detail: '需 HTTPS' },
		{ key: 'serial', label: 'Web Serial', ok: 'serial' in n, detail: '需 HTTPS' },
		{ key: 'hid', label: 'WebHID', ok: 'hid' in n, detail: '需 HTTPS' },
		{
			key: 'webauthn',
			label: 'WebAuthn',
			ok: typeof window.PublicKeyCredential !== 'undefined',
			detail: ''
		},
		{
			key: 'pdf',
			label: '内置 PDF 查看',
			ok: nav().pdfViewerEnabled === true,
			detail: '浏览器自己能不能打开 PDF'
		}
	];
	return list;
}

/** 只判断 WebGL 上下文能不能建（不读渲染器名） */
function hasWebgl(): boolean {
	try {
		const canvas = document.createElement('canvas');
		return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	} catch {
		return false;
	}
}

/** 当前浏览器的 UA 解析结果 */
export function collectUaInfo(): UaInfo {
	return parseUserAgent(nav().userAgent, nav().maxTouchPoints ?? 0);
}

/** 是否支持 User-Agent Client Hints（决定「读取高精度版本」按钮要不要出现） */
export function uaDataSupported(): boolean {
	return !!nav().userAgentData;
}

/** 读高熵 Client Hints：异步、且只有 Chromium 系有 */
export async function readHighEntropy(): Promise<HighEntropyValues | null> {
	const data = nav().userAgentData;
	if (!data) return null;
	try {
		const values = await data.getHighEntropyValues(['platformVersion', 'uaFullVersion']);
		return {
			platformVersion: values['platformVersion'] ?? '',
			uaFullVersion: values['uaFullVersion'] ?? ''
		};
	} catch {
		return null;
	}
}

/**
 * 复制 / 导出的 JSON：按分组嵌套，键是英文字段名，值是页面上的展示文案。
 * 拿去贴到 issue 里不用再翻译一遍，是这个格式唯一的用处。
 */
export function buildExport(
	values: FieldValues,
	capabilities: Capability[],
	ua: UaInfo | null,
	collectedAt: string
): string {
	const groups: Record<string, Record<string, string>> = {};
	for (const group of GROUP_DEFS) {
		const fields: Record<string, string> = {};
		for (const field of group.fields) fields[field.key] = values[field.key] ?? '';
		groups[group.id] = fields;
	}
	const caps: Record<string, boolean> = {};
	for (const cap of capabilities) caps[cap.key] = cap.ok;
	return JSON.stringify(
		{
			collectedAt,
			userAgent: {
				raw: ua?.raw ?? '',
				browser: ua ? formatNameVersion(ua.browser.name, ua.browser.version) : '',
				engine: ua ? formatNameVersion(ua.engine.name, ua.engine.version) : '',
				os: ua ? formatNameVersion(ua.os.name, ua.os.version) : '',
				device: ua?.device.label ?? '',
				app: ua?.app ?? ''
			},
			groups,
			capabilities: caps
		},
		null,
		2
	);
}

/** 存储配额估算：异步，可能整个 API 都没有 */
export async function readQuota(): Promise<{ quota: string; usage: string } | null> {
	try {
		const manager = nav().storage;
		if (!manager?.estimate) return null;
		const estimate = await manager.estimate();
		return { quota: formatBytes(estimate.quota), usage: formatBytes(estimate.usage) };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------- 性能与渲染

/** 本次导航的性能指标。同步读得到，随 refresh 一起补 */
export function readPerformance(): FieldValues {
	const values: FieldValues = {};
	try {
		const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
		if (navigation) {
			// 这几个值本身就是「相对导航开始的毫秒数」，直接当耗时用
			values.perfTtfb = formatDuration(navigation.responseStart - navigation.startTime);
			values.perfDomReady = formatDuration(navigation.domContentLoadedEventEnd);
			// 还在加载时 loadEventEnd 是 0，这时候写上去反而是骗人
			if (navigation.loadEventEnd > 0) values.perfLoad = formatDuration(navigation.loadEventEnd);
		}

		for (const entry of performance.getEntriesByType('paint')) {
			if (entry.name === 'first-paint') values.perfFp = formatDuration(entry.startTime);
			if (entry.name === 'first-contentful-paint') values.perfFcp = formatDuration(entry.startTime);
		}

		// LCP 主要靠观察器（见 observeLcp），这里先搭上已经攒下的那一条
		const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
		const lcp = lcpEntries[lcpEntries.length - 1];
		if (lcp) values.perfLcp = formatDuration(lcp.startTime);

		const resources = performance.getEntriesByType('resource');
		const bytes = resources.reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize || 0), 0);
		// 跨域资源没带 Timing-Allow-Origin 时 transferSize 记成 0，这时只说个数
		values.perfResources =
			bytes > 0 ? `${resources.length} 个 · ${formatBytes(bytes)}` : `${resources.length} 个（体积记不到）`;

		for (const key of Object.keys(values) as FieldKey[]) if (values[key] === undefined) delete values[key];
	} catch {
		/* 拿不到就整组留空 */
	}
	return values;
}

/**
 * LCP 观察器：最大内容绘制随页面继续加载还会更新，得挂着才拿得到最新值，
 * 所以返回清理函数 —— 由 +page.svelte 的 $effect 注册与卸载（全局副作用的唯一位置）。
 */
export function observeLcp(onChange: (text: string) => void): () => void {
	if (typeof PerformanceObserver !== 'function') return () => {};
	try {
		const observer = new PerformanceObserver((list) => {
			const entries = list.getEntries();
			const last = entries[entries.length - 1];
			const text = last ? formatDuration(last.startTime) : undefined;
			if (text) onChange(text);
		});
		// buffered：注册之前已经发生过的那一条也补回来
		observer.observe({ type: 'largest-contentful-paint', buffered: true });
		return () => observer.disconnect();
	} catch {
		return () => {};
	}
}

// ---------------------------------------------------------------- 硬件与传感器

/** 电池状态：Battery Status API，只有部分浏览器有 */
export async function readBattery(): Promise<FieldValues | null> {
	const getBattery = batteryApi();
	if (typeof getBattery !== 'function') return null;
	try {
		const battery = await getBattery.call(navigator);
		const values: FieldValues = {};
		values.batteryState = battery.charging ? '充电中' : '使用电池';
		values.batteryLevel = `${Math.round(battery.level * 100)}%`;
		// chargingTime / dischargingTime 给 Infinity 表示「按当前状态估不出来」，不是 0
		const charging = formatBatterySeconds(battery.chargingTime, '已充满');
		if (charging) values.batteryCharging = charging;
		const discharging = formatBatterySeconds(battery.dischargingTime, '即将耗尽');
		if (discharging) values.batteryDischarging = discharging;
		return values;
	} catch {
		return null;
	}
}

/** 键盘布局：物理按键 → 字符的映射表，Chromium 系才有 */
export async function readKeyboardLayout(): Promise<string | null> {
	const keyboard = keyboardApi();
	if (!keyboard?.getLayoutMap) return null;
	try {
		const map = await keyboard.getLayoutMap();
		if (map.size === 0) return null;
		const sample = Array.from(map.entries())
			.slice(0, 6)
			.map(([code, key]) => `${code} → ${key}`);
		return `共 ${map.size} 个键位：${sample.join('、')}`;
	} catch {
		return null;
	}
}

/** Canvas 指纹：同一段绘制结果的短哈希。属于设备指纹信息，只有点了按钮才读 */
export function readCanvasFingerprint(): string | null {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = 240;
		canvas.height = 60;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.textBaseline = 'top';
		ctx.font = '14px "Arial"';
		ctx.fillStyle = '#f60';
		ctx.fillRect(0, 0, 100, 20);
		ctx.fillStyle = '#069';
		ctx.fillText('toolv.cn 设备指纹', 2, 15);
		ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)';
		ctx.arc(50, 40, 18, 0, Math.PI * 2);
		ctx.stroke();
		return fnv1a(canvas.toDataURL());
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------- 设备方向与运动

/** 一次传感器读数；某一项没测到就不写那个键 */
export interface MotionSample {
	orientation?: string;
	acceleration?: string;
	rotationRate?: string;
}

/**
 * 申请传感器权限。iOS 13+ 要求 `requestPermission` 必须在用户手势里调用，
 * 所以这个函数只能从按钮的 onclick 进来；不需要授权的平台（多数 Android 与桌面）直接放行。
 */
export async function requestMotionPermission(): Promise<boolean> {
	const ctor = globalCtor<PermissionRequestable>('DeviceOrientationEvent');
	if (!ctor) return false;
	if (typeof ctor.requestPermission !== 'function') return true;
	try {
		return (await ctor.requestPermission()) === 'granted';
	} catch {
		return false;
	}
}

/**
 * 等一次方向与运动读数。两个事件各来一次就收工；等不到（桌面端多数没有传感器）就超时。
 * 监听器是一次性的，拿到结果或超时都立刻摘掉，不留常驻回调。
 */
export function waitForMotion(timeoutMs = 1500): Promise<MotionSample> {
	return new Promise((resolve) => {
		const sample: MotionSample = {};
		// timer 与两个 handler 都在下面才初始化，但 stop / finish 只会在事件或超时之后被调到，
		// 那时全都就位了 —— 所以这里可以按「先声明用到的函数、再起表」的顺序写，timer 保持 const。
		const stop = (): void => {
			window.removeEventListener('deviceorientation', onOrientation);
			window.removeEventListener('devicemotion', onMotion);
			clearTimeout(timer);
		};
		const finish = (): void => {
			stop();
			resolve(sample);
		};
		// 方向与运动来自两个接口，都到齐才算完整
		const maybeFinish = (): void => {
			if (sample.orientation !== undefined && sample.acceleration !== undefined) finish();
		};
		const onOrientation = (event: DeviceOrientationEvent): void => {
			sample.orientation = `α ${round1(event.alpha)}° · β ${round1(event.beta)}° · γ ${round1(event.gamma)}°`;
			maybeFinish();
		};
		const onMotion = (event: DeviceMotionEvent): void => {
			const acc = event.accelerationIncludingGravity;
			sample.acceleration = `x ${round1(acc?.x)} · y ${round1(acc?.y)} · z ${round1(acc?.z)} m/s²`;
			const rate = event.rotationRate;
			sample.rotationRate = `α ${round1(rate?.alpha)} · β ${round1(rate?.beta)} · γ ${round1(rate?.gamma)} °/s`;
			maybeFinish();
		};
		const timer = setTimeout(finish, timeoutMs);
		window.addEventListener('deviceorientation', onOrientation);
		window.addEventListener('devicemotion', onMotion);
	});
}

/** 环境光：实验性 API，桌面浏览器基本不给用；拿不到就返回 null */
export async function readAmbientLight(timeoutMs = 1200): Promise<string | null> {
	const Ctor = globalCtor<AmbientLightSensorCtor>('AmbientLightSensor');
	if (!Ctor) return null;
	try {
		const sensor = new Ctor({ frequency: 1 });
		// stop() 对没启动或已停的传感器会抛 InvalidStateError，两条出口都别让它把结果吞掉
		const release = (): void => {
			try {
				sensor.stop();
			} catch {
				/* 已经停了 */
			}
		};
		return await new Promise<string | null>((resolve) => {
			const timer = setTimeout(() => {
				release();
				resolve(null);
			}, timeoutMs);
			sensor.addEventListener('reading', () => {
				clearTimeout(timer);
				const value = sensor.illuminance;
				release();
				resolve(value === undefined ? null : `${value.toFixed(0)} lux`);
			});
			sensor.start();
		});
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------- 多媒体设备

/**
 * 申请一次摄像头 / 麦克风权限，拿到就立刻把轨道关掉 —— 只是为了换来设备名称，
 * 不采画面也不采声音。被拒绝就当作没授权，下面照样给出不带名字的数量。
 */
async function requestMediaPermission(): Promise<void> {
	const media = mediaDevicesApi();
	if (!media?.getUserMedia) return;
	try {
		const stream = await media.getUserMedia({ audio: true, video: true });
		for (const track of stream.getTracks()) track.stop();
	} catch {
		/* 拒绝或没有设备：继续拿数量 */
	}
}

/** 设备数量；withLabels 为 true 时会先弹一次权限框，换来设备名称 */
export async function readMediaDevices(withLabels: boolean): Promise<FieldValues | null> {
	const media = mediaDevicesApi();
	if (!media?.enumerateDevices) return null;
	try {
		if (withLabels) await requestMediaPermission();
		const devices = await media.enumerateDevices();
		const values: FieldValues = {
			cameraCount: `${countByKind(devices, 'videoinput')} 个`,
			micCount: `${countByKind(devices, 'audioinput')} 个`,
			speakerCount: `${countByKind(devices, 'audiooutput')} 个`
		};
		const labels = devices.map((device) => device.label).filter((label): label is string => !!label);
		if (labels.length > 0) values.mediaLabels = `${labels.length} 个已命名：${labels.join('、')}`;
		return values;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------- 权限状态

/** 权限名 → 字段。名称认不全的浏览器会让 query 抛错，那一行就不写 */
const PERMISSION_FIELDS: { key: FieldKey; name: string }[] = [
	{ key: 'permGeolocation', name: 'geolocation' },
	{ key: 'permNotification', name: 'notifications' },
	{ key: 'permCamera', name: 'camera' },
	{ key: 'permMicrophone', name: 'microphone' },
	{ key: 'permClipboard', name: 'clipboard-read' }
];

/** 逐个查权限状态。这是只读查询，不会弹权限框 */
export async function readPermissions(): Promise<FieldValues | null> {
	const api = permissionsApi();
	if (!api?.query) return null;
	const values: FieldValues = {};
	await Promise.all(
		PERMISSION_FIELDS.map(async ({ key, name }) => {
			try {
				const label = permissionStateLabel((await api.query({ name })).state);
				if (label) values[key] = label;
			} catch {
				/* 这个浏览器不认这个权限名，跳过 */
			}
		})
	);
	return Object.keys(values).length > 0 ? values : null;
}
