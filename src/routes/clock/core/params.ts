// 独立窗口的 URL 参数：解析（展示页那侧读）与序列化（工具页那侧生成）。
//
// 为什么用 URL 参数：光靠「共用 localStorage + storage 事件同步」，一个浏览器只有**一份**配置，
// 开两个窗口也只能显示同一个模式。把配置写进地址之后，**每份地址自带一份配置** ——
// 于是可以同时开好几个窗口各显示各的（一个时钟 + 一个倒计时），
// 地址还能收藏、能发给别人、能丢进 OBS 的浏览器源（那条路读不到本站的 localStorage，只能靠地址）。
//
// 逐项覆盖的语义（刻意如此，别改成「有参数就整份忽略 localStorage」）：
//   · 地址里**没写**的项，一律沿用当前位置的 localStorage 配置；
//   · 地址里**写了**的项以地址为准，且不会被 storage 事件冲掉。
//   所以裸地址 `/clock/display` 完全跟随工具页，带全量参数的地址则是一份固定快照 —— 两种都成立。
//
// 参数表（全是不带 # 的六位色值，布尔一律写 0 / 1）：
//   mode   clock | countdown | stopwatch      模式
//   bg     111827    背景色          alpha  0-100   背景不透明度
//   fg     f9fafb    文字色          size   auto|24-360   字号
//   pad    0|2|4|6|8 内边距档        font   mono|sans|serif
//   weight 400-800   字重            outline none|soft|strong
//   h12    0|1       12 小时制       sec   0|1   显示秒
//   date   none|iso|cn               week  0|1   显示星期
//   tz     0|1       显示时区        blink 0|1   冒号闪烁
//   cd     duration|daily            倒计时口径
//   dur    秒数（也认 30m / 1h30m）  倒计时时长
//   at     20:00[:30]                倒计时每日目标
//   over   0|1       超时正计时       prec sec|tenth|ms   秒表精度
//   prefix 文本                      前置文案（按 mode 落到倒计时或秒表那份上）
//   rot    0-359     显示角度（度）   flip  0|1          水平翻转（镜像）
//
// 全是不碰 DOM 的纯函数（只吃字符串、只吐对象），能直接在 node 环境里单测。

import { ANGLE_RANGE, PREFIX_MAX_LENGTH, TEXT_MAX_LENGTH } from '../config.ts';
import { pad2 } from './format.ts';
import type {
	ClockMode,
	ClockOptions,
	ClockStyle,
	CountdownOptions,
	DisplayOverrides,
	Precision,
	StopwatchOptions,
	TextOptions
} from './types.ts';

const HEX = /^[0-9a-f]{6}$/i;
const DURATION_SHORTHAND = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

const MODES = ['clock', 'countdown', 'stopwatch', 'text'] as const;
const FONTS = ['mono', 'sans', 'serif'] as const;
const OUTLINES = ['none', 'soft', 'strong'] as const;
const DATE_FORMATS = ['none', 'iso', 'cn'] as const;
const COUNTDOWN_KINDS = ['duration', 'daily'] as const;
const ALIGNMENTS = ['center', 'left'] as const;

/** 地址里用一个词表达精度，比 full 名短 */
const PRECISION_TO_PARAM: Record<Precision, string> = { second: 'sec', tenth: 'tenth', millisecond: 'ms' };
const PARAM_TO_PRECISION: Record<string, Precision> = {
	sec: 'second',
	second: 'second',
	tenth: 'tenth',
	ms: 'millisecond',
	millisecond: 'millisecond'
};

function readHex(value: string | null): string | undefined {
	if (value === null) return undefined;
	const hex = value.replace('#', '').trim();
	return HEX.test(hex) ? `#${hex.toLowerCase()}` : undefined;
}

function readNumber(value: string | null, min: number, max: number): number | undefined {
	if (value === null || value.trim() === '') return undefined;
	const num = Number(value);
	return Number.isFinite(num) && num >= min && num <= max ? num : undefined;
}

function readBool(value: string | null): boolean | undefined {
	if (value === null) return undefined;
	const text = value.trim().toLowerCase();
	if (text === '1' || text === 'true') return true;
	if (text === '0' || text === 'false') return false;
	return undefined;
}

/** 从候选里挑一个合法值。非法给 undefined，**不要退回第一个** —— 那会把写错的参数静默纠正成别的东西 */
function readEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
	return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** `dur`：纯数字按秒算，也认 `30m` / `1h30m` / `90s` 这种写法（手写地址时更好读） */
export function parseDurationParam(value: string): number | null {
	const text = value.trim().toLowerCase();
	if (/^\d+$/.test(text)) return Number(text) * 1000;
	const match = DURATION_SHORTHAND.exec(text);
	if (!match || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) return null;
	const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
	return (minutes * 60 + Number(match[3] ?? 0)) * 1000;
}

/** `at`：`20:00` 或 `20:00:30`（本地时间） */
export function parseClockParam(value: string): { hour: number; minute: number; second: number } | null {
	const parts = value.trim().split(':');
	if (parts.length < 2 || parts.length > 3) return null;
	if (parts.some((part) => !/^\d{1,2}$/.test(part))) return null;
	const [hour, minute, second = 0] = parts.map(Number) as [number, number, number];
	if (hour > 23 || minute > 59 || second > 59) return null;
	return { hour, minute, second };
}

/** 解析查询串（带不带 `?` 都行）。没写、或写得认不出来的项一律不出现，由调用方沿用原配置 */
export function parseDisplayParams(search: string): DisplayOverrides {
	const params = new URLSearchParams(search);
	const overrides: DisplayOverrides = {
		style: {},
		clockOptions: {},
		countdownOptions: {},
		stopwatchOptions: {},
		textOptions: {}
	};

	const mode = readEnum(params.get('mode'), MODES);
	if (mode) overrides.mode = mode;

	// ---- 样式
	const bg = readHex(params.get('bg'));
	if (bg) overrides.style.bg = bg;
	const fg = readHex(params.get('fg'));
	if (fg) overrides.style.fg = fg;
	const alpha = readNumber(params.get('alpha'), 0, 100);
	if (alpha !== undefined) overrides.style.bgAlpha = alpha;
	const size = params.get('size');
	if (size === 'auto') overrides.style.sizeMode = 'auto';
	else {
		const fontSize = readNumber(size, 24, 360);
		if (fontSize !== undefined) {
			overrides.style.sizeMode = 'manual';
			overrides.style.fontSize = fontSize;
		}
	}
	const padding = readNumber(params.get('pad'), 0, 8);
	if (padding !== undefined) overrides.style.padding = padding;
	const font = readEnum(params.get('font'), FONTS);
	if (font) overrides.style.font = font;
	const weight = readNumber(params.get('weight'), 100, 900);
	if (weight !== undefined) overrides.style.weight = weight;
	const outline = readEnum(params.get('outline'), OUTLINES);
	if (outline) overrides.style.outline = outline;
	// 角度与翻转：裸地址不带这两项即 0° / 不翻转，与工具页的默认样式一致
	const angle = readNumber(params.get('rot'), ANGLE_RANGE.min, ANGLE_RANGE.max);
	if (angle !== undefined) overrides.style.angle = angle;
	const mirror = readBool(params.get('flip'));
	if (mirror !== undefined) overrides.style.mirror = mirror;

	// ---- 时钟
	const hour12 = readBool(params.get('h12'));
	if (hour12 !== undefined) overrides.clockOptions.hourSystem = hour12 ? '12' : '24';
	const showSeconds = readBool(params.get('sec'));
	if (showSeconds !== undefined) overrides.clockOptions.showSeconds = showSeconds;
	const dateFormat = readEnum(params.get('date'), DATE_FORMATS);
	if (dateFormat) overrides.clockOptions.dateFormat = dateFormat;
	const showWeekday = readBool(params.get('week'));
	if (showWeekday !== undefined) overrides.clockOptions.showWeekday = showWeekday;
	const showTimezone = readBool(params.get('tz'));
	if (showTimezone !== undefined) overrides.clockOptions.showTimezone = showTimezone;
	const blinkColon = readBool(params.get('blink'));
	if (blinkColon !== undefined) overrides.clockOptions.blinkColon = blinkColon;

	// ---- 倒计时
	const kind = readEnum(params.get('cd'), COUNTDOWN_KINDS);
	if (kind) overrides.countdownOptions.kind = kind;
	const durationParam = params.get('dur');
	if (durationParam !== null) {
		const duration = parseDurationParam(durationParam);
		if (duration !== null) overrides.countdownOptions.durationMs = duration;
	}
	const at = params.get('at');
	const target = at === null ? null : parseClockParam(at);
	if (target) {
		overrides.countdownOptions.dailyHour = target.hour;
		overrides.countdownOptions.dailyMinute = target.minute;
		overrides.countdownOptions.dailySecond = target.second;
	}
	const overtime = readBool(params.get('over'));
	if (overtime !== undefined) overrides.countdownOptions.overtime = overtime;

	// ---- 秒表
	const precision = PARAM_TO_PRECISION[params.get('prec') ?? ''];
	if (precision) overrides.stopwatchOptions.precision = precision;

	// ---- 文字模式
	const content = params.get('text');
	if (content !== null) overrides.textOptions.content = content.slice(0, TEXT_MAX_LENGTH);
	const align = readEnum(params.get('align'), ALIGNMENTS);
	if (align) overrides.textOptions.align = align;

	// ---- 前置文案：只有一份参数，按模式落到对应那个字段上（文字模式没有前置文案，忽略掉）
	const prefix = params.get('prefix');
	if (prefix !== null) {
		const value = prefix.slice(0, PREFIX_MAX_LENGTH);
		const target = mode ?? 'clock';
		if (target === 'stopwatch') overrides.stopwatchOptions.prefix = value;
		else if (target === 'countdown') overrides.countdownOptions.prefix = value;
	}

	return overrides;
}

/** 工具页生成地址时用的输入：把要落进地址的那几块状态一次带过来 */
export interface DisplaySource {
	mode: ClockMode;
	style: ClockStyle;
	clockOptions: ClockOptions;
	countdownOptions: CountdownOptions;
	stopwatchOptions: StopwatchOptions;
	textOptions: TextOptions;
}

/**
 * 把当前配置整份编成查询串（不含前导 `?`）。
 *
 * **故意全量写**：地址要能独立成立 —— 换个浏览器、换台设备、丢进 OBS 都该显示成同一个样子。
 * 只写「与默认值不同的项」会短一些，但那就要求对方也有同一份默认值，等于把地址变成了半成品。
 */
export function buildDisplayQuery(source: DisplaySource): string {
	const params = new URLSearchParams();
	const flag = (value: boolean): string => (value ? '1' : '0');

	params.set('mode', source.mode);

	const { style } = source;
	params.set('bg', style.bg.replace('#', ''));
	params.set('alpha', String(style.bgAlpha));
	params.set('fg', style.fg.replace('#', ''));
	params.set('size', style.sizeMode === 'auto' ? 'auto' : String(style.fontSize));
	params.set('pad', String(style.padding));
	params.set('font', style.font);
	params.set('weight', String(style.weight));
	params.set('outline', style.outline);
	params.set('rot', String(style.angle));
	params.set('flip', flag(style.mirror));

	const clock = source.clockOptions;
	params.set('h12', flag(clock.hourSystem === '12'));
	params.set('sec', flag(clock.showSeconds));
	params.set('date', clock.dateFormat);
	params.set('week', flag(clock.showWeekday));
	params.set('tz', flag(clock.showTimezone));
	params.set('blink', flag(clock.blinkColon));

	const countdown = source.countdownOptions;
	params.set('cd', countdown.kind);
	params.set('dur', String(Math.round(countdown.durationMs / 1000)));
	params.set('at', `${pad2(countdown.dailyHour)}:${pad2(countdown.dailyMinute)}:${pad2(countdown.dailySecond)}`);
	params.set('over', flag(countdown.overtime));

	params.set('prec', PRECISION_TO_PARAM[source.stopwatchOptions.precision]);

	const prefix = source.mode === 'stopwatch' ? source.stopwatchOptions.prefix : countdown.prefix;
	if (prefix.trim() !== '') params.set('prefix', prefix.trim());

	// 文字内容也整份写进来：地址要能独立成立，不能指望对方本地也存着同一段字
	params.set('align', source.textOptions.align);
	params.set('text', source.textOptions.content);

	return params.toString();
}
