// 「悬浮时钟 · 计时器」的类型定义。
// 只放类型与联合，**不含任何数值** —— 可调的业务参数一律在工具根目录的 config.ts。

/** 四个模式：看当前时间 / 往零倒数 / 从零往上数 / 只显示一段文字 */
export type ClockMode = 'clock' | 'countdown' | 'stopwatch' | 'text';

/** 小时制 */
export type HourSystem = '24' | '12';

/** 日期行的显示格式 */
export type DateFormat = 'none' | 'iso' | 'cn';

/** 字体族档位，具体字体栈在 config.ts */
export type FontKey = 'mono' | 'sans' | 'serif';

/** 描边强度：透明背景叠在亮画面上时，纯色数字会糊掉，靠这层兜底 */
export type OutlineLevel = 'none' | 'soft' | 'strong';

/** 倒计时口径：倒一段时长 / 倒数到每天某个时刻 */
export type CountdownKind = 'duration' | 'daily';

/** 计时精度：秒 / 十分之一秒 / 毫秒 */
export type Precision = 'second' | 'tenth' | 'millisecond';

/**
 * 计时状态机：未开始 / 运行中 / 已暂停。
 * **刻意没有 `finished`** —— 「到点」是能从「目标时刻 vs 现在」直接推出来的派生值，
 * 再存一个状态字段就得在两处维护同一件事，迟早对不上（判断见 store 的 countdownFinished）。
 */
export type RunState = 'idle' | 'running' | 'paused';

/**
 * 显示样式：三个模式**共用同一份**，整体存 localStorage。
 * 舞台组件把它逐项翻成 inline style —— 见 ui/ClockStage.svelte 顶部注释。
 */
export interface ClockStyle {
	/** 背景色 `#rrggbb`；透不透出来看 bgAlpha */
	bg: string;
	/** 背景不透明度 0-100，0 即全透明（给录屏 / 直播软件叠加用） */
	bgAlpha: number;
	/** 文字色 `#rrggbb` */
	fg: string;
	/** auto = 字号随容器缩放填满；manual = 用手动档的 fontSize */
	sizeMode: 'auto' | 'manual';
	/** manual 档的字号（px） */
	fontSize: number;
	/** 内边距档位：容器短边的百分比，即数字离边缘的距离 */
	padding: number;
	font: FontKey;
	weight: number;
	outline: OutlineLevel;
	/**
	 * 显示角度（度，0-359）：整块画面绕中心转这么多度。
	 * 90 / 270 会自动把画面的长宽对调，正好把竖着的窗口填满；其它角度整体缩一点保证不裁切
	 * （几何算法见 core/format.ts 的 rotateLayout）。
	 */
	angle: number;
	/** 水平翻转（镜像）：给「画面要镜像」的录屏 / 直播场景用，与角度互不干扰 */
	mirror: boolean;
}

/** 时钟模式的可调项 */
export interface ClockOptions {
	hourSystem: HourSystem;
	showSeconds: boolean;
	dateFormat: DateFormat;
	showWeekday: boolean;
	showTimezone: boolean;
	blinkColon: boolean;
}

/** 倒计时模式的可调项 */
export interface CountdownOptions {
	kind: CountdownKind;
	/** 时长型的设定值（毫秒） */
	durationMs: number;
	/** 时刻型的目标时 / 分 / 秒（本地时区），过点自动滚到明天 */
	dailyHour: number;
	dailyMinute: number;
	dailySecond: number;
	/** 到点后是否继续正计时，显示成「超时 00:00:12」 */
	overtime: boolean;
	/** 主数字上方的说明文字，如「距开播」 */
	prefix: string;
}

/** 秒表模式的可调项 */
export interface StopwatchOptions {
	precision: Precision;
	/** 主数字上方的说明文字 */
	prefix: string;
}

/**
 * 文字模式的可调项：整块显示一段自定义文字，当电子告示牌用
 * （「会议中，请勿打扰」这类）。
 *
 * 它没有任何专属的外观设置 —— 颜色、字体、描边、透明背景全部沿用共用的那一份 `ClockStyle`，
 * 所以这个模式几乎是白拿的。
 */
export interface TextOptions {
	/** 要显示的文字，`\n` 换行 */
	content: string;
	/** 多行时每行的对齐；单行居中的场合选 center */
	align: 'center' | 'left';
}

/**
 * 落盘的计时状态。**只存「起点 + 累计」，不存每秒算出来的显示值** ——
 * 后者会在标签页被节流时走偏，前者任何时候读出来都对（口径见 core/store.svelte.ts）。
 *
 * 两个模式共用同一个结构，字段含义按模式解释：
 *   - 倒计时：anchorMs 是目标时刻，frozenMs 是暂停时冻住的剩余
 *   - 秒表：  anchorMs 是本轮的起点，frozenMs 是本轮之前已累计的里程
 */
export interface TimerState {
	state: RunState;
	anchorMs: number | null;
	frozenMs: number;
}

/**
 * 独立窗口 URL 参数的解析结果：**只含地址里真的写了的字段**。
 *
 * 逐项覆盖是刻意的语义（见 core/params.ts 的文件头）：
 * 地址里没写的项沿用 localStorage 的配置，写了的项以地址为准。
 * 于是裸地址 `/clock/display` 完全跟随工具页，带全量参数的地址是一份固定快照。
 */
export interface DisplayOverrides {
	mode?: ClockMode;
	style: Partial<ClockStyle>;
	clockOptions: Partial<ClockOptions>;
	countdownOptions: Partial<CountdownOptions>;
	stopwatchOptions: Partial<StopwatchOptions>;
	textOptions: Partial<TextOptions>;
}
