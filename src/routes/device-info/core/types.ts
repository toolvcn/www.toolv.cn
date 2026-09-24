// 浏览器信息页的类型与静态元数据。
//
// 字段定义放在这里而不是采集函数里，是为了让 SSR 也能渲染出完整骨架：
// 预渲染阶段还没有浏览器可读，但分组标题与字段名是静态的，
// 值一律显示占位符 —— curl 回来的 HTML 里能看到「浏览器 / 版本 / 渲染引擎 …」这些行名，
// 客户端采集完再把占位符换成真值， hydration 前后结构一致。

/** 占位符：没采集到、或浏览器不支持该字段时统一显示它，复制按钮同时禁用 */
export const PLACEHOLDER = '—';

/** 全部字段的键。分组定义里的 key 必须落在这个联合里 */
export type FieldKey =
	// 浏览器
	| 'browserName'
	| 'browserVersion'
	| 'engine'
	| 'uaBrands'
	| 'uaPlatformVersion'
	| 'uaFullVersion'
	| 'language'
	| 'languages'
	| 'cookie'
	| 'online'
	// 系统与设备
	| 'os'
	| 'osVersion'
	| 'deviceType'
	| 'cpu'
	| 'memory'
	| 'touch'
	| 'pointer'
	| 'hover'
	// 屏幕与显示
	| 'viewport'
	| 'screen'
	| 'avail'
	| 'dpr'
	| 'colorDepth'
	| 'orientation'
	| 'colorScheme'
	| 'reducedMotion'
	| 'rootFont'
	// 网络与地区
	| 'timezone'
	| 'utcOffset'
	| 'connection'
	| 'downlink'
	| 'rtt'
	| 'saveData'
	| 'downlinkMax'
	// 存储
	| 'localStorage'
	| 'sessionStorage'
	| 'quota'
	| 'usage'
	// 硬件与传感器
	| 'batteryState'
	| 'batteryLevel'
	| 'batteryCharging'
	| 'batteryDischarging'
	| 'gamepadCount'
	| 'gamepadList'
	| 'keyboardLayout'
	| 'canvasFingerprint'
	// 设备方向与运动
	| 'deviceOrientation'
	| 'acceleration'
	| 'rotationRate'
	| 'ambientLight'
	// 多媒体设备
	| 'cameraCount'
	| 'micCount'
	| 'speakerCount'
	| 'mediaLabels'
	// 性能与渲染
	| 'perfTtfb'
	| 'perfDomReady'
	| 'perfLoad'
	| 'perfFp'
	| 'perfFcp'
	| 'perfLcp'
	| 'perfResources'
	// 权限状态
	| 'permGeolocation'
	| 'permNotification'
	| 'permCamera'
	| 'permMicrophone'
	| 'permClipboard';

/** 一个信息字段 */
export interface FieldDef {
	key: FieldKey;
	/** 行名，中文 */
	label: string;
	/** 悬浮说明：只写字段名看不出在测什么的补一句 */
	hint?: string;
	/**
	 * 实验性规范：只有个别浏览器实现，且随时可能改。
	 * 光靠空值 `—` 说明不了「是这台设备没有，还是规范没人实现」，所以行名后带一个「实验」标记。
	 */
	experimental?: boolean;
}

export type GroupId =
	'browser' | 'system' | 'display' | 'network' | 'storage' | 'hardware' | 'motion' | 'media' | 'perf' | 'permission';

/** 一张分组卡 */
export interface GroupDef {
	id: GroupId;
	heading: string;
	fields: FieldDef[];
}

/**
 * 分组标题右侧的操作按钮。
 *
 * 只有「拿到结果会让浏览器弹权限框」的分组才需要它 —— 其余字段要么是同步读出来的、
 * 要么（存储配额、Client Hints）不弹框，一律随刷新自己补。
 * 做成数据而不是直接塞 Button 组件进来，是为了让 types.ts 不依赖界面层。
 */
export interface GroupAction {
	label: string;
	/** 按钮的 aria-label，说清要点的是哪一类权限 */
	hint: string;
	disabled: boolean;
	onclick: () => void;
}

/** 能力探测的一项：只有支持 / 不支持两态，用徽章呈现 */
export interface Capability {
	key: string;
	label: string;
	ok: boolean;
	/** 补充信息（如 WebGL 的渲染器名），没有则空串 */
	detail: string;
}

/** 分组与字段的静态定义：顺序即渲染顺序 */
export const GROUP_DEFS: GroupDef[] = [
	{
		id: 'browser',
		heading: '浏览器',
		fields: [
			{ key: 'browserName', label: '浏览器' },
			{ key: 'browserVersion', label: '版本' },
			{ key: 'engine', label: '渲染引擎', hint: '页面排版与绘制用的内核；Chromium 系都是 Blink' },
			{ key: 'uaBrands', label: 'UA 品牌', hint: 'User-Agent Client Hints 里的 brand 列表，Chromium 系才有' },
			{
				key: 'uaPlatformVersion',
				label: '系统版本（高精度）',
				hint: '点工具条上的「读取高精度版本」才取，属于额外信息'
			},
			{ key: 'uaFullVersion', label: '完整版本（高精度）' },
			{ key: 'language', label: '界面语言' },
			{ key: 'languages', label: '语言优先顺序' },
			{ key: 'cookie', label: 'Cookie' },
			{ key: 'online', label: '联网状态' }
		]
	},
	{
		id: 'system',
		heading: '系统与设备',
		fields: [
			{ key: 'os', label: '操作系统' },
			{ key: 'osVersion', label: '系统版本' },
			{ key: 'deviceType', label: '设备类型' },
			{ key: 'cpu', label: '逻辑处理器', hint: 'navigator.hardwareConcurrency，可并行线程数的参考值' },
			{ key: 'memory', label: '设备内存', hint: 'Device Memory API 给出的近似值，只有部分浏览器有' },
			{ key: 'touch', label: '最大触摸点数', hint: '大于 0 说明支持触屏；iPad 冒充 Mac 也靠它识破' },
			{ key: 'pointer', label: '指针精度' },
			{ key: 'hover', label: '悬浮支持' }
		]
	},
	{
		id: 'display',
		heading: '屏幕与显示',
		fields: [
			{ key: 'viewport', label: '视口尺寸', hint: '浏览器内容区的宽高，随窗口变化' },
			{ key: 'screen', label: '屏幕分辨率' },
			{ key: 'avail', label: '可用区域', hint: '去掉任务栏 / 系统栏后剩下的部分' },
			{ key: 'dpr', label: '设备像素比', hint: '一个 CSS 像素对应几个物理像素，Retina 屏常见 2' },
			{ key: 'colorDepth', label: '色深' },
			{ key: 'orientation', label: '屏幕方向' },
			{ key: 'colorScheme', label: '主题偏好' },
			{ key: 'reducedMotion', label: '减少动效' },
			{ key: 'rootFont', label: '根字号', hint: 'html 的 font-size，1rem 等于多少 px 由它决定' }
		]
	},
	{
		id: 'network',
		heading: '网络与地区',
		fields: [
			{ key: 'timezone', label: '时区' },
			{ key: 'utcOffset', label: 'UTC 偏移' },
			{ key: 'connection', label: '连接类型', hint: 'Network Information API，只有部分浏览器有' },
			{ key: 'downlink', label: '下行带宽' },
			{ key: 'rtt', label: '往返时延' },
			{ key: 'saveData', label: '省流量模式' },
			{
				key: 'downlinkMax',
				label: '下行上限',
				hint: 'Network Information API 给的理论最大下行带宽，只有部分浏览器有'
			}
		]
	},
	{
		id: 'storage',
		heading: '存储',
		fields: [
			{ key: 'localStorage', label: 'localStorage' },
			{ key: 'sessionStorage', label: 'sessionStorage' },
			{ key: 'quota', label: '存储配额', hint: '浏览器给当前站点分配的存储上限（异步估算）' },
			{ key: 'usage', label: '已用空间' }
		]
	},
	{
		id: 'hardware',
		heading: '硬件与传感器',
		fields: [
			{ key: 'batteryState', label: '电池状态', hint: 'Battery Status API，只有部分浏览器有' },
			{ key: 'batteryLevel', label: '电量', hint: '剩余电量百分比' },
			{ key: 'batteryCharging', label: '充满还需', hint: '接上电源时的预估剩余充电时间；一直没接就是未知' },
			{ key: 'batteryDischarging', label: '可用还剩', hint: '用电池时的预估续航；一直插着电源就是未知' },
			{
				key: 'gamepadCount',
				label: '已连接手柄',
				hint: 'Gamepad API：要先按一下手柄上的任意键，浏览器才认这个设备'
			},
			{ key: 'gamepadList', label: '手柄型号', hint: '手柄 ID 与按键 / 摇杆轴数' },
			{
				key: 'keyboardLayout',
				label: '键盘布局',
				hint: 'Keyboard API 的物理按键映射表，实验性规范，只有 Chromium 系实现',
				experimental: true
			},
			{
				key: 'canvasFingerprint',
				label: 'Canvas 指纹',
				hint: '同一段画布绘制结果的哈希值，属于设备指纹信息，默认不读'
			}
		]
	},
	{
		id: 'motion',
		heading: '设备方向与运动',
		fields: [
			{
				key: 'deviceOrientation',
				label: '设备方向',
				hint: 'α / β / γ 三个欧拉角；iOS 13+ 要授权，桌面端多数没有传感器。点一次读一次快照，不是实时仪表'
			},
			{ key: 'acceleration', label: '加速度', hint: '含重力的加速度（m/s²），三个轴；单次快照' },
			{ key: 'rotationRate', label: '旋转速率', hint: '绕三轴的角速度（°/s）；单次快照' },
			{
				key: 'ambientLight',
				label: '环境光',
				hint: 'AmbientLightSensor：实验性规范，主流桌面浏览器基本都不实现',
				experimental: true
			}
		]
	},
	{
		id: 'media',
		heading: '多媒体设备',
		fields: [
			{ key: 'cameraCount', label: '摄像头' },
			{ key: 'micCount', label: '麦克风' },
			{ key: 'speakerCount', label: '扬声器', hint: 'audiooutput 类型的设备数，部分浏览器不暴露' },
			{
				key: 'mediaLabels',
				label: '设备名称',
				hint: '没授权前浏览器只给数量不给名字，点了右上角的按钮才会弹权限框'
			}
		]
	},
	{
		id: 'perf',
		heading: '性能与渲染',
		fields: [
			{ key: 'perfTtfb', label: '首字节 TTFB', hint: '从发起导航到拿到第一个响应字节' },
			{ key: 'perfDomReady', label: 'DOM 就绪', hint: 'DOMContentLoaded 完成的时间点' },
			{ key: 'perfLoad', label: '加载完成', hint: 'load 事件完成的时间点' },
			{ key: 'perfFp', label: '首次绘制 FP', hint: '第一次把像素画到屏幕上的时刻' },
			{ key: 'perfFcp', label: '首次内容绘制 FCP', hint: '第一块文字 / 图片出现的时刻' },
			{
				key: 'perfLcp',
				label: '最大内容绘制 LCP',
				hint: '核心 Web 指标之一，滚动或交互后还会更新'
			},
			{
				key: 'perfResources',
				label: '资源加载',
				hint: '已加载的子资源数与压缩后体积；跨域资源没带 Timing-Allow-Origin 时体积记不到'
			}
		]
	},
	{
		id: 'permission',
		heading: '权限状态',
		fields: [
			{ key: 'permGeolocation', label: '地理位置' },
			{ key: 'permNotification', label: '通知' },
			{ key: 'permCamera', label: '摄像头' },
			{ key: 'permMicrophone', label: '麦克风' },
			{ key: 'permClipboard', label: '剪贴板读取', hint: 'clipboard-read，只有部分浏览器把它列进 Permissions API' }
		]
	}
];
