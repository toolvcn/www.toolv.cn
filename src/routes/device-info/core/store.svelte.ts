// 浏览器信息页的编排层：一次采集填满全部字段，刷新与监听由 +page.svelte 驱动。
//
// 首屏（SSR / 预渲染）时所有字段是空的、ready 为 false，UI 显示占位符 ——
// 骨架在 HTML 里就可读，采集只发生在客户端，两边结构一致不会 hydration 抖动。
// 模块级单例，跟其余 20 个工具一个写法。
import { copyToClipboard } from '$lib/ui/copy';
import { toast } from '$lib/ui/toast.svelte';
import { downloadText } from '$lib/utils/browser';
import {
	buildExport,
	collectCapabilities,
	collectFields,
	collectUaInfo,
	observeLcp,
	readAmbientLight,
	readBattery,
	readCanvasFingerprint,
	readHighEntropy,
	readKeyboardLayout,
	readMediaDevices,
	readPerformance,
	readPermissions,
	readQuota,
	requestMotionPermission,
	uaDataSupported,
	waitForMotion,
	type FieldValues,
	type HighEntropyValues
} from './collect.ts';
import { GROUP_DEFS, PLACEHOLDER, type Capability, type FieldKey, type GroupAction, type GroupId } from './types.ts';
import { parseUserAgent, type UaInfo } from './ua.ts';

/** 高精度版本的读取状态 */
export type HighEntropyState = 'idle' | 'loading' | 'done' | 'unsupported' | 'error';

/** 传感器读取的状态：没读过 / 读中 / 读过 / 权限被拒 / 没有这套 API */
export type MotionState = 'idle' | 'loading' | 'done' | 'denied' | 'unsupported';

function formatClock(date: Date): string {
	return date.toLocaleTimeString('zh-CN', { hour12: false });
}

class DeviceInfoStore {
	/** 采集到的字段；SSR 与首帧是空对象，UI 取不到就显示占位符 */
	fields = $state<FieldValues>({});
	capabilities = $state<Capability[]>([]);
	ua = $state<UaInfo | null>(null);
	collectedAt = $state('');
	/** 是否已采集过 */
	ready = $state(false);

	/** 是否读取 WebGL 渲染器：能指到具体显卡，属于硬件指纹信息，默认关 */
	includeWebgl = $state(false);
	/** 「解析任意 UA」的输入框 */
	customUa = $state('');
	highEntropy = $state<HighEntropyValues | null>(null);
	highEntropyState = $state<HighEntropyState>('idle');

	/**
	 * 点了按钮才读到的字段（Canvas 指纹 / 传感器 / 设备名称）。
	 * 与 `fields` 分开存：那些值是用户主动换来的，不能被 resize 重采冲掉。
	 */
	extraFields = $state<FieldValues>({});
	/** 设备名称读取中（要弹权限框，给按钮一个进行态） */
	mediaLabelsBusy = $state(false);
	motionState = $state<MotionState>('idle');
	/**
	 * 异步那批（refreshAsync）是否已经回来。
	 * 状态行要靠它区分「还没读到」与「这个浏览器根本没有」—— 否则预渲染出的 HTML 里
	 * 就会写着「此浏览器不暴露设备列表」，首屏直接是错的。
	 */
	asyncLoaded = $state(false);

	/** 自定义 UA 的解析结果；空输入不解析 */
	readonly customUaResult = $derived(this.customUa.trim() === '' ? null : parseUserAgent(this.customUa.trim()));

	/** 复制 / 导出的 JSON：手动读到的字段优先级更高，与页面显示一致 */
	readonly json = $derived(
		buildExport({ ...this.fields, ...this.extraFields }, this.capabilities, this.ua, this.collectedAt)
	);

	/** 字段总数，给底部那行说明用 */
	readonly fieldCount = $derived(GROUP_DEFS.reduce((count, group) => count + group.fields.length, 0));

	/** 高精度版本按钮的文案 */
	readonly highEntropyLabel = $derived(
		this.highEntropyState === 'loading'
			? '读取中…'
			: this.highEntropyState === 'done'
				? '已读取高精度版本'
				: '读取高精度版本'
	);

	/** 某个字段的展示值：手动读到的优先，其次同步采到的，都没有就给占位符 */
	valueOf(key: FieldKey): string {
		return this.extraFields[key] ?? this.fields[key] ?? PLACEHOLDER;
	}

	/** 合并一批字段：null 表示整组没读到，直接不改 */
	private merge(values: FieldValues | null): void {
		if (!values) return;
		this.fields = { ...this.fields, ...values };
	}

	private mergeExtra(values: FieldValues | null): void {
		if (!values) return;
		this.extraFields = { ...this.extraFields, ...values };
	}

	/**
	 * 同步部分：浏览器 / 系统 / 屏幕 / 网络 / 存储 / 性能，一次读齐。
	 * resize 这类高频重采只走它；要弹权限框或耗时的（电池、设备枚举）都在 refreshAsync。
	 */
	refresh(): void {
		this.fields = { ...collectFields(this.includeWebgl), ...readPerformance() };
		this.capabilities = collectCapabilities(this.includeWebgl);
		this.ua = collectUaInfo();
		this.collectedAt = formatClock(new Date());
		this.ready = true;
		void this.loadQuota();
	}

	/**
	 * 异步部分：电池、键盘布局、设备数量、环境光、权限状态。
	 * 全都是只读或不弹框的调用，所以跟着刷新自己补，不用点按钮。
	 */
	async refreshAsync(): Promise<void> {
		const [battery, keyboardLayout, devices, ambientLight, permissions] = await Promise.all([
			readBattery(),
			readKeyboardLayout(),
			readMediaDevices(false),
			readAmbientLight(),
			readPermissions()
		]);
		this.merge(battery);
		this.merge(devices);
		this.merge(permissions);
		if (keyboardLayout) this.merge({ keyboardLayout });
		if (ambientLight) this.merge({ ambientLight });
		this.asyncLoaded = true;
	}

	/** 全量重采：首次挂载与「刷新」按钮走它 */
	reload(): void {
		this.refresh();
		void this.refreshAsync();
	}

	/** 注册 LCP 观察器；返回清理函数，由 +page.svelte 的 $effect 负责调用 */
	watchLcp(): () => void {
		return observeLcp((text) => {
			this.fields = { ...this.fields, perfLcp: text };
		});
	}

	async loadQuota(): Promise<void> {
		const quota = await readQuota();
		if (!quota) return;
		this.fields = { ...this.fields, quota: quota.quota, usage: quota.usage };
	}

	async loadPermissions(): Promise<void> {
		this.merge(await readPermissions());
	}

	/** Canvas 指纹：属于设备指纹信息，点了按钮才读，读完留着不被重采冲掉 */
	loadFingerprint(): void {
		const hash = readCanvasFingerprint();
		if (!hash) {
			toast.show('这个浏览器读不到 Canvas 指纹', true);
			return;
		}
		this.mergeExtra({ canvasFingerprint: hash });
		toast.show('已读取 Canvas 指纹');
	}

	/** 这台设备有没有方向 / 运动这两套 API */
	private motionSupported(): boolean {
		return 'DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window;
	}

	/** 传感器：申请权限后等一次读数，两个事件都到齐或超时才收工 */
	async loadMotion(): Promise<void> {
		if (this.motionState === 'loading') return;
		if (!this.motionSupported()) {
			this.motionState = 'unsupported';
			toast.show('这个浏览器没有设备方向 / 运动 API', true);
			return;
		}
		this.motionState = 'loading';
		const granted = await requestMotionPermission();
		if (!granted) {
			this.motionState = 'denied';
			toast.show('没有拿到传感器权限', true);
			return;
		}
		const sample = await waitForMotion();
		const values: FieldValues = {};
		if (sample.orientation) values.deviceOrientation = sample.orientation;
		if (sample.acceleration) values.acceleration = sample.acceleration;
		if (sample.rotationRate) values.rotationRate = sample.rotationRate;
		this.motionState = 'done';
		if (Object.keys(values).length === 0) {
			toast.show('没等到传感器数据，这台设备可能没有对应硬件', true);
			return;
		}
		this.mergeExtra(values);
		toast.show('已读取设备方向与运动');
	}

	/** 设备名称：先申请一次摄像头 / 麦克风权限，拿到就立刻关掉轨道，不采画面与声音 */
	async loadMediaLabels(): Promise<void> {
		if (this.mediaLabelsBusy) return;
		this.mediaLabelsBusy = true;
		const values = await readMediaDevices(true);
		this.mediaLabelsBusy = false;
		if (!values?.mediaLabels) {
			toast.show('没拿到设备名称，可能是权限被拒绝', true);
			return;
		}
		this.merge(values);
		toast.show('已读取设备名称');
		// 这次授权会改掉摄像头 / 麦克风的状态，顺手把权限那一组也重查一遍
		void this.loadPermissions();
	}

	/**
	 * 分组标题行左侧的状态说明。只有「结果取决于用户点不点」的两个分组需要它 ——
	 * 点了没拿到结果时，光靠 toast 一闪留不下痕迹，用户会反复点同一个按钮。
	 * 空串表示这个分组不需要状态行。
	 */
	hintFor(groupId: GroupId): string {
		if (groupId === 'motion') {
			if (this.motionState === 'loading') return '读取中…';
			if (this.motionState === 'done') {
				return this.extraFields.deviceOrientation ? '已读取快照' : '没等到传感器数据';
			}
			if (this.motionState === 'denied') return '权限被拒，可重试';
			if (this.motionState === 'unsupported') return '此浏览器无相关 API';
			return '点右侧按钮读一次快照';
		}
		if (groupId === 'media') {
			if (this.mediaLabelsBusy) return '读取中…';
			// 异步还没回来：数量与名称都还是空的，这时候任何结论都是错的
			if (!this.asyncLoaded) return '';
			if (this.fields.mediaLabels) return '已读取设备名称';
			// 数量也是空的，说明整个设备枚举都用不了，别说成「未授权」
			if (this.fields.cameraCount === undefined && this.fields.micCount === undefined) {
				return '此浏览器不暴露设备列表';
			}
			return '未授权，只有数量';
		}
		return '';
	}

	/**
	 * 分组标题行右侧的动作按钮。
	 * 只有「要弹权限框」或「默认不读的指纹信息」两种分组才给 —— 其余字段随刷新自己补。
	 */
	actionsFor(groupId: GroupId): GroupAction[] {
		if (groupId === 'hardware') {
			return [
				{
					label: this.extraFields.canvasFingerprint ? '重新读取指纹' : '读取指纹',
					hint: '读取 Canvas 指纹哈希（属于设备指纹信息，默认不读）',
					disabled: false,
					onclick: () => this.loadFingerprint()
				}
			];
		}
		if (groupId === 'motion') {
			const denied = this.motionState === 'denied';
			return [
				{
					// 没有这套 API 时按钮置灰，理由由标题行左侧的状态说明给出
					label: this.motionState === 'loading' ? '读取中…' : denied ? '重新申请' : '读取传感器',
					hint: '申请传感器权限并读一次设备方向与运动数据（iOS 13+ 会弹权限框）',
					disabled: this.motionState === 'loading' || this.motionState === 'unsupported',
					onclick: () => void this.loadMotion()
				}
			];
		}
		if (groupId === 'media') {
			return [
				{
					label: this.mediaLabelsBusy ? '读取中…' : this.fields.mediaLabels ? '重新读取' : '读取设备名称',
					hint: '申请摄像头与麦克风权限以读取设备名称，授权后立刻关闭，不采集画面与声音',
					disabled: this.mediaLabelsBusy,
					onclick: () => void this.loadMediaLabels()
				}
			];
		}
		return [];
	}

	/** 读高熵 Client Hints：要用户点一下才取，不进首屏 */
	async loadHighEntropy(): Promise<void> {
		if (!uaDataSupported()) {
			this.highEntropyState = 'unsupported';
			toast.show('当前浏览器不支持 User-Agent Client Hints', true);
			return;
		}
		this.highEntropyState = 'loading';
		const values = await readHighEntropy();
		if (!values) {
			this.highEntropyState = 'error';
			toast.show('高精度版本读取失败', true);
			return;
		}
		this.highEntropy = values;
		this.fields = {
			...this.fields,
			uaPlatformVersion: values.platformVersion,
			uaFullVersion: values.uaFullVersion
		};
		this.highEntropyState = 'done';
		toast.show('已读取高精度版本');
	}

	async copyAll(): Promise<void> {
		if (!this.ready) {
			toast.show('还没采集到信息，等页面加载完再试', true);
			return;
		}
		await copyToClipboard(this.json, {
			ok: '已复制全部信息（JSON）',
			fail: '复制失败，请手动选中复制'
		});
	}

	exportJson(): void {
		if (!this.ready) {
			toast.show('还没采集到信息，等页面加载完再试', true);
			return;
		}
		downloadText(`device-info-${Date.now()}.json`, this.json, 'application/json;charset=utf-8');
		toast.show('已导出 JSON 文件');
	}

	/** 把当前浏览器的 UA 填进解析框 */
	useCurrentUa(): void {
		const raw = this.ua?.raw ?? '';
		if (raw === '') {
			toast.show('还没有可用的 UA', true);
			return;
		}
		this.customUa = raw;
	}

	clearCustomUa(): void {
		this.customUa = '';
	}
}

export const deviceStore = new DeviceInfoStore();
