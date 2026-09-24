// 「悬浮时钟 · 计时器」的可配置业务参数：默认样式、配色预设、字体栈、字号与内边距档位、
// 小窗尺寸档、存储键与走时间隔。要调这一页的行为，改这里就够了。
//
// 边界（与 color-converter 那份同一个口径，免得文件越长越杂）：
//   - 只放**业务数值与开关**。类型在 `core/types.ts`、组件里的提示文案在 `ui/*.svelte`、
//     拼出来的显示字符串在 `core/format.ts`、描边的 CSS 值在 `ui/ClockStage.svelte`
//     —— 都不进这里。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找。

import type {
	ClockOptions,
	ClockStyle,
	CountdownOptions,
	FontKey,
	StopwatchOptions,
	TextOptions
} from './core/types.ts';

/** 存储键：样式 + 三个模式的选项与计时状态，整体存在这一条里 */
export const STORAGE_KEY = 'toolv:clock';

/**
 * 走时刷新间隔（ms）。
 * 100ms 是权衡后的值：秒档跳得足够准（最多晚 100ms），十分之一秒档也跟得上，
 * 又不会像 16ms 那样每帧 setState。刷新时一律重新读系统时间、不做累加，所以间隔大小不代表精度。
 */
export const TICK_MS = 100;

// ---------------------------------------------------------------- 默认样式与档位

/** 初始样式：深色半透明卡片 + 亮数字，放在任何画面上都不出戏 */
export const DEFAULT_STYLE: ClockStyle = {
	bg: '#111827',
	bgAlpha: 85,
	fg: '#f9fafb',
	sizeMode: 'auto',
	fontSize: 96,
	padding: 4,
	font: 'mono',
	weight: 700,
	outline: 'none',
	angle: 0,
	mirror: false
};

/** 角度预设档：横屏竖屏各一个方向，加上倒置与归零 —— 自定义角度另有滑杆 */
export const ANGLE_PRESETS = [0, 90, 180, 270] as const;

/** 自定义角度的取值范围（度）。359 而不是 360：360 与 0 是同一件事，不占两格 */
export const ANGLE_RANGE = { min: 0, max: 359, step: 1 } as const;

/** 字体栈：只用系统字体，不引外部字体文件（首屏、离线、OBS 内嵌都不受影响） */
export const FONT_STACKS: Record<FontKey, string> = {
	mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
	sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
	serif: "ui-serif, Georgia, Cambria, 'Times New Roman', 'Songti SC', SimSun, serif"
};

/** 字重档位（SegmentedControl 的选项） */
export const WEIGHT_STEPS = [400, 500, 600, 700, 800] as const;

/** 手动档字号的取值范围（px） */
export const FONT_SIZE_RANGE = { min: 24, max: 360, step: 8 } as const;

/** 内边距档位：容器短边的百分比（cqmin） */
export const PADDING_STEPS = [0, 2, 4, 6, 8] as const;

/** 描边档位 */
export const OUTLINE_LEVELS = ['none', 'soft', 'strong'] as const;

// ---------------------------------------------------------------- 配色预设

/** 一套预设只覆盖颜色与字体相关的字段，其余沿用当前设置（应用时做合并） */
export interface StylePreset {
	id: string;
	name: string;
	style: Partial<ClockStyle>;
}

/** 预设配色：覆盖「深色摆件 / 白底投屏 / 透明叠加 / 复古终端」几类常见场景 */
export const STYLE_PRESETS: readonly StylePreset[] = [
	{ id: 'dark', name: '深色卡片', style: { bg: '#111827', bgAlpha: 85, fg: '#f9fafb', outline: 'none' } },
	{ id: 'paper', name: '白底黑字', style: { bg: '#ffffff', bgAlpha: 100, fg: '#111827', outline: 'none' } },
	{ id: 'glass', name: '半透明白字', style: { bg: '#000000', bgAlpha: 35, fg: '#ffffff', outline: 'soft' } },
	{ id: 'ghost', name: '全透明白字', style: { bg: '#000000', bgAlpha: 0, fg: '#ffffff', outline: 'strong' } },
	{ id: 'amber', name: '琥珀发光', style: { bg: '#000000', bgAlpha: 0, fg: '#fbbf24', outline: 'strong' } },
	{ id: 'terminal', name: '终端绿字', style: { bg: '#000000', bgAlpha: 100, fg: '#22c55e', outline: 'none' } }
];

// ---------------------------------------------------------------- 小窗

/** 小窗尺寸预设（画中画窗口的初始尺寸，弹窗降级时也用这一组） */
export const WINDOW_SIZES = [
	{ id: 's', label: '小', width: 320, height: 120 },
	{ id: 'm', label: '中', width: 480, height: 180 },
	{ id: 'l', label: '大', width: 640, height: 240 }
] as const;

/** 独立窗口的窗口名：同名窗口会被复用，连点不会开出一堆 */
export const WINDOW_NAME = 'toolv-clock';

/**
 * 独立窗口打开的页面路径。
 * 这个地址是可以独立使用的：直接粘到浏览器里就是一个纯时钟页，能收藏、能刷新、能拖到副屏。
 */
export const STANDALONE_PATH = '/clock/display';

// ---------------------------------------------------------------- 倒计时与秒表

/** 倒计时时长型的各字段上限 */
export const DURATION_RANGE = { hours: 99, minutes: 59, seconds: 59 } as const;

/** 时长型的快捷档：点一下直接设成这么多分钟，不用去填三个框 */
export const QUICK_MINUTES = [5, 10, 15, 25, 30, 45, 60] as const;

/** 倒计时时刻型的默认目标（本地时间 20:00）与各字段上限 */
export const DAILY_DEFAULT = { hour: 20, minute: 0, second: 0 } as const;
export const DAILY_RANGE = { hour: 23, minute: 59, second: 59 } as const;

/** 倒计时初始时长：30 分钟 */
export const DEFAULT_DURATION_MS = 30 * 60 * 1000;

/** 秒表精度档位 */
export const PRECISION_LEVELS = ['second', 'tenth', 'millisecond'] as const;

/** 前缀文案的长度上限（主数字上方那行字） */
export const PREFIX_MAX_LENGTH = 12;

// ---------------------------------------------------------------- 模式清单与初始选项

/**
 * 四个模式的标签页元数据：工具页顶部的标签条、以及「按模式打开独立窗口」那一组按钮共用这一份。
 * 顺序即标签顺序。放这里是因为它同时被 `Workspace` 与 `WindowPanel` 读，散两处迟早对不上。
 */
export const MODE_TABS = [
	{ value: 'clock', label: '时钟' },
	{ value: 'countdown', label: '倒计时' },
	{ value: 'stopwatch', label: '秒表' },
	{ value: 'text', label: '文字' }
] as const;

/** 时钟：24 小时制 + 带秒 + ISO 日期 + 星期；时区标注与冒号闪烁默认关（多数场景用不上） */
export const DEFAULT_CLOCK_OPTIONS: ClockOptions = {
	hourSystem: '24',
	showSeconds: true,
	dateFormat: 'iso',
	showWeekday: true,
	showTimezone: false,
	blinkColon: false
};

/** 倒计时：默认走时长型（30 分钟），到点停住不自动累计超时 */
export const DEFAULT_COUNTDOWN_OPTIONS: CountdownOptions = {
	kind: 'duration',
	durationMs: DEFAULT_DURATION_MS,
	dailyHour: DAILY_DEFAULT.hour,
	dailyMinute: DAILY_DEFAULT.minute,
	dailySecond: DAILY_DEFAULT.second,
	overtime: false,
	prefix: ''
};

/** 秒表：默认显示到秒（跳得安静），需要时再切到十分之一秒或毫秒 */
export const DEFAULT_STOPWATCH_OPTIONS: StopwatchOptions = {
	precision: 'second',
	prefix: ''
};

/** 文字模式的初始内容：给两行，顺便把「可以换行」这件事演示出来 */
export const DEFAULT_TEXT_OPTIONS: TextOptions = {
	content: '会议中\n请勿打扰',
	align: 'center'
};

/** 文字内容长度上限 */
export const TEXT_MAX_LENGTH = 200;
