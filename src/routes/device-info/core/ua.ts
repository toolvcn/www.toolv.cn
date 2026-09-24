// User-Agent 解析：纯字符串进、结构化出，不碰任何浏览器 API，可在 node 里单测。
//
// 为什么自己写：UA 的「真实」信息全靠约定，没有标准格式，
// 而且各家为了兼容都往里塞别人的标识（Chrome 的 UA 里有 Safari、Edge 的 UA 里有 Chrome、
// iOS 上所有浏览器都用 WebKit 的壳）。所以解析**顺序敏感**：
// 先认宿主 App（微信 / QQ / WebView），再认浏览器，最后才轮到系统。
//
// 判定结论一律是启发式的：UA 可以随便改，也可能被浏览器冻结（UA reduction）。
// 页面上要如实说明这一点，别让人拿它当准绳。

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface UaInfo {
	browser: { name: string; version: string };
	engine: { name: string; version: string };
	os: { name: string; version: string };
	device: { type: DeviceType; label: string };
	/** 宿主 App（微信 / QQ / 支付宝 / WebView …），独立浏览器时为空串 */
	app: string;
	/** 原始 UA，原样带回方便对照 */
	raw: string;
}

const UNKNOWN = '未知';
/** 无头浏览器 / 爬虫 / curl 这类「不是人在用」的 UA */
const BOT_NAME = '爬虫 / 机器人';

/** 浏览器规则：按顺序试，命中即止。顺序就是正确性 */
const BROWSER_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
	// 无头与爬虫放最前：它们的 UA 里也带 Chrome / Safari
	{ name: '无头 Chrome', re: /HeadlessChrome\/([\d.]+)/ },
	{ name: 'Edge', re: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
	{ name: 'Opera', re: /(?:OPR|OPiOS)\/([\d.]+)/ },
	{ name: '三星浏览器', re: /SamsungBrowser\/([\d.]+)/ },
	{ name: 'UC 浏览器', re: /UCBrowser\/([\d.]+)/ },
	{ name: '夸克浏览器', re: /Quark\/([\d.]+)/ },
	{ name: '小米浏览器', re: /MiuiBrowser\/([\d.]+)/ },
	{ name: '华为浏览器', re: /HuaweiBrowser\/([\d.]+)/ },
	{ name: 'QQ 浏览器', re: /(?:QQBrowser|MQQBrowser)\/([\d.]+)/ },
	{ name: 'Chrome', re: /(?:CriOS|Chrome)\/([\d.]+)/ },
	{ name: 'Firefox', re: /(?:FxiOS|Firefox)\/([\d.]+)/ },
	{ name: 'Chromium', re: /Chromium\/([\d.]+)/ },
	// Safari 的版本号在 Version/ 上，Safari/ 后面那个是 WebKit 的版本
	{ name: 'Safari', re: /Version\/([\d.]+)/ },
	{ name: 'IE', re: /(?:MSIE |rv:)([\d.]+)/ }
];

/** 机器人 / 爬虫：UA 里留了名字的 */
const BOT_RE = /bot|crawl|spider|slurp|curl|wget|python-requests|headless|httpie/i;

/** 宿主 App：内置浏览器，优先级高于浏览器本身 */
const APP_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
	{ name: '微信内置', re: /MicroMessenger\/([\d.]*)/ },
	{ name: 'QQ 内置', re: /\sQQ\/([\d.]*)/ },
	{ name: '支付宝内置', re: /AlipayClient\/([\d.]*)/ },
	{ name: '钉钉内置', re: /DingTalk\/([\d.]*)/ },
	{ name: '微博内置', re: /Weibo/ },
	{ name: '飞书内置', re: /Lark(?:Client)?\/([\d.]*)/ },
	{ name: 'Android WebView', re: /; wv\)?/ }
];

/** Windows NT 的版本号 → 市场名 */
const WINDOWS_VERSIONS: Record<string, string> = {
	'10.0': '10 / 11',
	'6.3': '8.1',
	'6.2': '8',
	'6.1': '7',
	'6.0': 'Vista',
	'5.2': 'XP / Server 2003',
	'5.1': 'XP'
};

/** 取正则第一个捕获组，没命中返回空串 */
function group1(ua: string, re: RegExp): string {
	return re.exec(ua)?.[1] ?? '';
}

/** 版本号里的下划线换成点：iOS 的 UA 写 17_0 */
function normalizeVersion(version: string): string {
	return version.replace(/_/g, '.');
}

/** 去掉末尾的点：UA 里常见 `MicroMessenger/8.0.` 这种 */
function trimDots(version: string): string {
	return version.replace(/\.+$/, '');
}

function detectApp(ua: string): string {
	for (const rule of APP_RULES) {
		const match = rule.re.exec(ua);
		if (!match) continue;
		// 无捕获组的规则（如微博）只认名字，有捕获组的带上版本号
		const version = trimDots(match[1] ?? '');
		return version === '' ? rule.name : `${rule.name} ${version}`;
	}
	return '';
}

function detectBrowser(ua: string): { name: string; version: string } {
	if (BOT_RE.test(ua)) return { name: BOT_NAME, version: '' };
	for (const rule of BROWSER_RULES) {
		const version = group1(ua, rule.re);
		if (version !== '') return { name: rule.name, version };
	}
	// 有 Safari/ 但没有 Version/：老 Safari 或残缺 UA
	const safari = group1(ua, /Safari\/([\d.]+)/);
	if (safari !== '') return { name: 'Safari', version: safari };
	return { name: UNKNOWN, version: '' };
}

function detectEngine(ua: string, browserVersion: string): { name: string; version: string } {
	if (/Trident\//.test(ua)) return { name: 'Trident', version: group1(ua, /Trident\/([\d.]+)/) };
	if (/Presto\//.test(ua)) return { name: 'Presto', version: group1(ua, /Presto\/([\d.]+)/) };
	// Blink 从 WebKit 分出来后 UA 里仍写 AppleWebKit，所以要先认 Blink 系
	const blinkRe = /(?:Chrome|Chromium|CriOS|Edg|OPR|HeadlessChrome)\/([\d.]+)/;
	const blink = group1(ua, blinkRe);
	if (blink !== '') return { name: 'Blink', version: blink };
	// Firefox 的版本在 rv: 上，Firefox/ 后面那个可能是别的
	const gecko = group1(ua, /rv:([\d.]+)/);
	if (/Gecko\//.test(ua) || /Firefox\//.test(ua)) return { name: 'Gecko', version: gecko || browserVersion };
	const webkit = group1(ua, /AppleWebKit\/([\d.]+)/);
	if (webkit !== '') return { name: 'WebKit', version: webkit };
	return { name: UNKNOWN, version: '' };
}

function detectOs(ua: string): { name: string; version: string } {
	if (/Windows Phone|Windows Mobile/.test(ua)) {
		return { name: 'Windows Phone', version: group1(ua, /Windows Phone (?:OS )?([\d.]+)/) };
	}
	if (/HarmonyOS/.test(ua)) return { name: 'HarmonyOS', version: trimDots(group1(ua, /HarmonyOS[ /]?([\d.]*)/)) };
	if (/OpenHarmony/.test(ua)) return { name: 'OpenHarmony', version: trimDots(group1(ua, /OpenHarmony[ /]?([\d.]*)/)) };
	const windows = group1(ua, /Windows NT ([\d.]+)/);
	if (windows !== '') return { name: 'Windows', version: WINDOWS_VERSIONS[windows] ?? windows };
	const android = group1(ua, /Android ([\d.]+)/);
	if (android !== '') return { name: 'Android', version: android };
	const ios = group1(ua, /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/);
	if (ios !== '') return { name: /iPad/.test(ua) ? 'iPadOS' : 'iOS', version: normalizeVersion(ios) };
	if (/CrOS/.test(ua)) return { name: 'ChromeOS', version: group1(ua, /CrOS \S+ ([\d.]+)/) };
	const mac = group1(ua, /Mac OS X ([\d_.]+)/);
	if (mac !== '') return { name: 'macOS', version: normalizeVersion(mac) };
	if (/Macintosh/.test(ua)) return { name: 'macOS', version: '' };
	if (/(Linux|X11)/.test(ua)) return { name: 'Linux', version: '' };
	return { name: UNKNOWN, version: '' };
}

const DEVICE_LABEL: Record<DeviceType, string> = {
	desktop: '桌面',
	mobile: '手机',
	tablet: '平板',
	unknown: UNKNOWN
};

function detectDevice(ua: string, os: string, touchPoints: number): { type: DeviceType; label: string } {
	let type: DeviceType = 'desktop';
	if (/iPad|Tablet/.test(ua)) type = 'tablet';
	else if (/iPhone|iPod|Mobile|Windows Phone/.test(ua)) type = 'mobile';
	else if (/Android/.test(ua)) type = /Mobile/.test(ua) ? 'mobile' : 'tablet';
	else if (ua.trim() === '') type = 'unknown';

	// iPad 的桌面模式（Safari 默认「请求桌面网站」）会把 UA 报成 Mac OS X，
	// 只有触摸点数能把它认出来；反之真 Mac 接了触摸屏也不该被判成平板，
	// 所以只在 os 是 macOS 且触摸点数大于 1 时纠正。
	if (type === 'desktop' && os === 'macOS' && touchPoints > 1) type = 'tablet';

	return { type, label: DEVICE_LABEL[type] };
}

/**
 * 解析一段 User-Agent。
 * @param ua 原始 UA 字符串（可以是自己浏览器的，也可以是别人发来的）
 * @param touchPoints 最大触摸点数，用于纠正 iPad 冒充 Mac 的情况；解析别人的 UA 时不传
 */
export function parseUserAgent(ua: string, touchPoints = 0): UaInfo {
	const raw = ua.trim();
	if (raw === '') {
		return {
			browser: { name: UNKNOWN, version: '' },
			engine: { name: UNKNOWN, version: '' },
			os: { name: UNKNOWN, version: '' },
			device: { type: 'unknown', label: DEVICE_LABEL.unknown },
			app: '',
			raw: ''
		};
	}
	const browser = detectBrowser(raw);
	const os = detectOs(raw);
	return {
		browser,
		engine: detectEngine(raw, browser.version),
		os,
		// 爬虫没有「设备」可言，别把 curl 判成桌面浏览器
		device:
			browser.name === BOT_NAME
				? { type: 'unknown' as DeviceType, label: UNKNOWN }
				: detectDevice(raw, os.name, touchPoints),
		app: detectApp(raw),
		raw
	};
}

/** 拼成一行展示文案：「Chrome 138」，没有版本时只出名字 */
export function formatNameVersion(name: string, version: string): string {
	if (name === UNKNOWN && version === '') return UNKNOWN;
	return version === '' ? name : `${name} ${version}`;
}

/** 解析结果的一行展示，供 UA 面板（当前浏览器 / 自定义 UA）两处共用 */
export interface UaRow {
	label: string;
	value: string;
}

export function uaRows(info: UaInfo | null): UaRow[] {
	if (!info) {
		return ['浏览器', '渲染引擎', '操作系统', '设备类型', '内置 App'].map((label) => ({
			label,
			value: UNKNOWN
		}));
	}
	return [
		{ label: '浏览器', value: formatNameVersion(info.browser.name, info.browser.version) },
		{ label: '渲染引擎', value: formatNameVersion(info.engine.name, info.engine.version) },
		{ label: '操作系统', value: formatNameVersion(info.os.name, info.os.version) },
		{ label: '设备类型', value: info.device.label },
		{ label: '内置 App', value: info.app === '' ? '独立浏览器' : info.app }
	];
}
