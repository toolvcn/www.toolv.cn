// 时间的解析与格式化：全是不碰 DOM 的纯函数，能直接在 node 环境里单测。
//
// 三条约定（踩过的坑都写在这里，改之前先读）：
//   ① 倒计时与秒表都不做「每秒加一」，只做「当前时刻 - 起点」的换算；本文件只负责把算好的
//      毫秒数变成字符串，不持有任何时间来源。
//   ② 倒计时的剩余要**向上取整**：30 分钟开局应当显示 30:00，用向下取整会立刻变成 29:59。
//      秒表反过来向下取整：走过 5.9 秒显示 00:05 才对。
//   ③ 小时位只在真的超过一小时时出现 —— 倒计时 30 分钟显示 30:00，不是 00:30:00。

import type { DateFormat, HourSystem, Precision } from './types.ts';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

/** 两位补零 */
export function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

/** 精度档对应的毫秒粒度 */
const PRECISION_UNIT: Record<Precision, number> = { second: 1000, tenth: 100, millisecond: 1 };

/**
 * 把毫秒数对齐到精度档：`up` 用于倒计时剩余（见约定 ②），`down` 用于秒表里程。
 * 负数一律先夹到 0，免得 Math.ceil(-1.5) 这种负方向取整把结果显示成 `-0:01`。
 */
export function alignToPrecision(ms: number, precision: Precision, dir: 'up' | 'down'): number {
	const safe = Math.max(0, ms);
	const unit = PRECISION_UNIT[precision];
	return (dir === 'up' ? Math.ceil(safe / unit) : Math.floor(safe / unit)) * unit;
}

/** 时长 → `29:59` / `01:29:59` / `00:05.3`（是否带小数位由精度档决定） */
export function formatDuration(ms: number, precision: Precision): string {
	const safe = Math.max(0, ms);
	const totalSeconds = Math.floor(safe / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	let tail = '';
	if (precision === 'tenth') tail = `.${Math.floor((safe % 1000) / 100)}`;
	else if (precision === 'millisecond') tail = `.${String(Math.floor(safe % 1000)).padStart(3, '0')}`;

	// 约定 ③：不足一小时不占小时位
	const head = hours > 0 ? `${pad2(hours)}:` : '';
	return `${head}${pad2(minutes)}:${pad2(seconds)}${tail}`;
}

/** 时钟模式的主数字：`14:30:25` / `02:30:25`，12 小时制另外给出 AM / PM 后缀 */
export function formatClock(
	epochMs: number,
	hourSystem: HourSystem,
	showSeconds: boolean
): { time: string; meridiem: string } {
	const date = new Date(epochMs);
	const hour24 = date.getHours();
	const hour = hourSystem === '12' ? hour24 % 12 || 12 : hour24;
	const parts = [pad2(hour), pad2(date.getMinutes())];
	if (showSeconds) parts.push(pad2(date.getSeconds()));
	return {
		time: parts.join(':'),
		meridiem: hourSystem === '12' ? (hour24 < 12 ? 'AM' : 'PM') : ''
	};
}

/** 日期行：`2026-09-20` / `2026年9月20日` / 关了给空串 */
export function formatDate(epochMs: number, format: DateFormat): string {
	if (format === 'none') return '';
	const date = new Date(epochMs);
	if (format === 'iso') return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
	return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 星期：`星期日` */
export function weekdayLabel(epochMs: number): string {
	return WEEKDAYS[new Date(epochMs).getDay()];
}

/** 本地时区标注：`UTC+8` / `UTC-5` / `UTC+5:30`（半小时时区） */
export function timezoneLabel(epochMs: number): string {
	// getTimezoneOffset 的符号跟 UTC 偏移相反（东八区返回 -480），所以先取负
	const offsetMinutes = -new Date(epochMs).getTimezoneOffset();
	const sign = offsetMinutes < 0 ? '-' : '+';
	const abs = Math.abs(offsetMinutes);
	const hours = Math.floor(abs / 60);
	const minutes = abs % 60;
	return `UTC${sign}${hours}${minutes > 0 ? `:${pad2(minutes)}` : ''}`;
}

/**
 * 时刻型倒计时的下一个目标时刻：今天的 h:m:s，已过（或正好等于 from）就滚到明天。
 * 用本地时间的 setHours / setDate 推进，跨月跨年交给 Date 自己处理。
 */
export function nextDailyTarget(fromMs: number, hour: number, minute: number, second: number): number {
	const target = new Date(fromMs);
	target.setHours(hour, minute, second, 0);
	if (target.getTime() <= fromMs) target.setDate(target.getDate() + 1);
	return target.getTime();
}

/** 时 / 分 / 秒三个输入框拼成毫秒数 */
export function durationFromParts(hours: number, minutes: number, seconds: number): number {
	return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

/** 毫秒数拆回时 / 分 / 秒，供输入框回填与「设为 X 分钟」这类快捷操作 */
export function splitDuration(ms: number): { hours: number; minutes: number; seconds: number } {
	const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
	return {
		hours: Math.floor(totalSeconds / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60
	};
}

/**
 * 解析时长输入框的文本：空串当 0，纯数字且不超过上限才算合法，其余一律 null。
 * 返回 null 时由调用方保留上一份合法值 —— 不要在这里猜测用户想填什么。
 */
export function parseUnitText(text: string, max: number): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return 0;
	if (!/^\d+$/.test(trimmed)) return null;
	const value = Number(trimmed);
	return value <= max ? value : null;
}

/** 十六进制颜色的相对亮度是否偏亮（sRGB → 线性 → 加权，跟 WCAG 同一套系数） */
export function isLightColor(hex: string): boolean {
	const raw = hex.replace('#', '').trim().toLowerCase();
	// 3 位简写先展开成 6 位（`#abc` = `#aabbcc`）：直接按长度判「认不出」会把浅色判成深色，
	// 描边就会取成白的，浅字配白边等于没有边。
	const normalized = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
	if (normalized.length !== 6) return false;
	const channels = [0, 2, 4].map((i) => {
		const value = Number.parseInt(normalized.slice(i, i + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	const [r, g, b] = channels as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

/**
 * 描边颜色：**自动取文字色的反色**。
 * 白字配深描边、黑字配浅描边 —— 这样不管叠在什么底上，数字边缘都还在。
 */
export function outlineColor(fgHex: string): string {
	return isLightColor(fgHex) ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)';
}

/** 全角字符（中日韩、全角标点等）占一个 em，其余大致占半个多 em */
function isFullWidth(char: string): boolean {
	const code = char.codePointAt(0) ?? 0;
	return (
		(code >= 0x1100 && code <= 0x115f) || // 谚文字母
		(code >= 0x2e80 && code <= 0xa4cf) || // 中日韩及偏旁、假名
		(code >= 0xac00 && code <= 0xd7a3) || // 谚文音节
		(code >= 0xf900 && code <= 0xfaff) || // 兼容表意文字
		(code >= 0xfe30 && code <= 0xfe6f) || // 竖排与全角标点
		(code >= 0xff00 && code <= 0xff60) || // 全角 ASCII
		(code >= 0xffe0 && code <= 0xffe6)
	);
}

/** 旋转层的摆放结果，直接喂给 ClockStage 的内联样式 */
export interface RotateLayout {
	/** 旋转层的长宽是否对调（90 / 270 时，横过来的内容正好填满竖着的窗口） */
	swap: boolean;
	/** 旋转之后还要再缩多少才不出界；1 表示不用缩 */
	scale: number;
	/** 完整的 transform（含居中平移、角度、翻转与缩放） */
	transform: string;
}

/**
 * 整块画面绕中心转 `angle` 度之后怎么摆。
 *
 * 为什么还要算缩放：转过任意角度后，内容的外接框比容器大一圈（45° 约 1.41 倍），
 * 不缩就会裁掉角。90 / 270 靠「长宽对调」正好填满、不用缩；
 * 其余角度在「对调 / 不对调」两种摆法里取更划算的一种，再按外接框缩到放得下。
 *
 * `w` / `h` 是容器的像素尺寸 —— 这个比例纯 CSS 算不出来（calc 不能拿长度除长度），
 * 所以由组件量出来传进来。量不到（w 或 h 为 0，如 SSR 首帧）就按「不缩」处理：0 度本来也不需要缩。
 */
export function rotateLayout(angle: number, mirror: boolean, w: number, h: number): RotateLayout {
	const deg = ((Math.round(angle) % 360) + 360) % 360;
	const flip = mirror ? 'scaleX(-1)' : 'scaleX(1)';
	const transform = (scale: number): string => `translate(-50%, -50%) rotate(${deg}deg) ${flip} scale(${scale})`;

	if (w <= 0 || h <= 0) return { swap: false, scale: 1, transform: transform(1) };

	const rad = (deg * Math.PI) / 180;
	const cos = Math.abs(Math.cos(rad));
	const sin = Math.abs(Math.sin(rad));
	/** 内容框 cw × ch 转过之后的外接框，在 w × h 的容器里还剩多少余量（≤1） */
	const fit = (cw: number, ch: number): number => {
		const boxW = cw * cos + ch * sin;
		const boxH = cw * sin + ch * cos;
		if (boxW <= 0 || boxH <= 0) return 1;
		return Math.min(1, w / boxW, h / boxH);
	};

	/**
	 * 缩放值只留 4 位小数，且**只能向下取整** —— 四舍五入会把比例调大一点点，
	 * 转完就顶出容器（45° 时 0.38569460 被进位成 0.3857，外接框高度溢出 0.0025px）。
	 *
	 * 但也不能直接 floor：`Math.cos(90°)` 不是精确的 0，0° / 90° 这类正好放得下的角度
	 * 会算成 0.9999999999999999，floor 之后掉到 0.9999，等于白缩一点。
	 * 所以先把「几乎就是 1」收敛回 1，其余一律向下取整。
	 */
	const bounded = (value: number): number => (value >= 1 - 1e-9 ? 1 : Math.floor(value * 10000) / 10000);

	const plain = fit(w, h);
	const swapped = fit(h, w);
	const swap = swapped > plain;
	const scale = bounded(swap ? swapped : plain);
	return { swap, scale, transform: transform(scale) };
}

/**
 * 估算一串文字占多少 em，供自动字号算「这行有多宽」。
 *
 * 全角按 1em、半角按传入的比例（等宽 0.6 / 无衬线 0.56 / 衬线 0.5）——
 * 中文标语和英文数字混排时，统一按一个比例算会差出两三倍。
 * 只是估算，宁可估宽一点：字号小一点能看，顶出边界就废了。
 */
export function textWidthEm(text: string, halfWidth: number): number {
	let total = 0;
	for (const char of text) total += isFullWidth(char) ? 1 : halfWidth;
	return total;
}
