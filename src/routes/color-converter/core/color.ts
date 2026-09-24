// 颜色解析 / 互转 / WCAG 对比度的纯函数集，不依赖任何 DOM。
// 只认三种写法：HEX、rgb()/rgba()、hsl()/hsla()；逗号与现代空格分隔都支持，
// 百分比分量与 deg 单位照收，其余一律判非法 —— 非法返回 null，交给界面提示。
import type { Hsl, Rgb, WcagCheck } from './types.ts';
import { WCAG_THRESHOLDS } from '../config.ts';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** rgb 分量按 0.5 四舍五入成整数 —— CSS 里 rgb() 本来就写整数 */
const round255 = (value: number): number => Math.round(value);

/** 保留一位小数（h / s / l 的输出精度） */
const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * 解析颜色字符串，返回 RGB 表示；非法返回 null。
 * 支持：
 * - HEX：#abc / #abcd / #aabbcc / #aabbccdd（# 可省，大小写不限）
 * - rgb() / rgba()：逗号或空格分隔，分量可用百分比，透明度支持 ` / 0.5` 斜杠写法
 * - hsl() / hsla()：同上，h 可带 deg
 */
export function parseColor(input: string): Rgb | null {
	const text = input.trim().toLowerCase();
	if (text === '') return null;

	// ---- HEX：3 / 4 / 6 / 8 位，其余长度都算非法
	const hex = /^#?([0-9a-f]+)$/.exec(text);
	if (hex) {
		const digits = hex[1]!;
		if (![3, 4, 6, 8].includes(digits.length)) return null;
		// 3/4 位短写法按 CSS 规则把每位重复一次展开
		const expanded = digits.length <= 4 ? [...digits].map((c) => c + c).join('') : digits;
		return {
			r: parseInt(expanded.slice(0, 2), 16),
			g: parseInt(expanded.slice(2, 4), 16),
			b: parseInt(expanded.slice(4, 6), 16),
			a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
		};
	}

	// ---- 函数形式
	const fn = /^([a-z]+)\(([^)]*)\)$/.exec(text);
	if (!fn) return null;
	const name = fn[1]!;
	// 逗号 / 空格 / 斜杠统一当分隔符（现代写法 alpha 用 ` / 0.5`）
	const parts = fn[2]!.split(/[\s,/]+/).filter(Boolean);
	if (parts.length !== 3 && parts.length !== 4) return null;
	const alpha = parts[3] === undefined ? 1 : parseAlpha(parts[3]!);
	if (alpha === null) return null;

	if (name === 'rgb' || name === 'rgba') {
		const channels = parts.slice(0, 3).map((part) => parseChannel255(part));
		if (channels.some((c) => c === null)) return null;
		return { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: alpha };
	}
	if (name === 'hsl' || name === 'hsla') {
		const channels = parseHslChannels(parts.slice(0, 3));
		if (!channels) return null;
		return hslToRgb({ ...channels, a: alpha });
	}
	return null;
}

/** 单个 rgb 分量：整数或百分比（100% = 255），越界钳制 */
function parseChannel255(part: string): number | null {
	const value = part.endsWith('%') ? Number(part.slice(0, -1)) * 2.55 : Number(part);
	if (!Number.isFinite(value)) return null;
	return clamp(round255(value), 0, 255);
}

/** 透明度：小数（.5）或百分比（50%），越界钳制到 [0, 1] */
function parseAlpha(part: string): number | null {
	const value = part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part);
	return Number.isFinite(value) ? clamp(value, 0, 1) : null;
}

/** hsl 的三个分量：h 可带 deg（范围归一到 0-360），s / l 必须是百分比 */
function parseHslChannels(parts: string[]): Omit<Hsl, 'a'> | null {
	const [hPart, sPart, lPart] = parts;
	if (!hPart || !sPart || !lPart) return null;
	const h = Number(hPart.replace(/deg$/, ''));
	if (!Number.isFinite(h)) return null;
	const s = parsePercent(sPart);
	const l = parsePercent(lPart);
	if (s === null || l === null) return null;
	return { h: ((h % 360) + 360) % 360, s, l };
}

function parsePercent(part: string): number | null {
	if (!part.endsWith('%')) return null;
	const value = Number(part.slice(0, -1));
	return Number.isFinite(value) ? clamp(value, 0, 100) : null;
}

/** RGB → HEX：alpha 为 1 输出 6 位，否则输出 8 位（末两位是 alpha） */
export function rgbToHex(color: Rgb): string {
	const to2 = (value: number) => clamp(round255(value), 0, 255).toString(16).padStart(2, '0');
	const base = `#${to2(color.r)}${to2(color.g)}${to2(color.b)}`;
	if (color.a >= 1) return base;
	const alpha = Math.round(clamp(color.a, 0, 1) * 255);
	return base + alpha.toString(16).padStart(2, '0');
}

/** RGB → HSL（标准公式），h / s / l 各保留一位小数 */
export function rgbToHsl(color: Rgb): Hsl {
	const r = color.r / 255;
	const g = color.g / 255;
	const b = color.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			default:
				h = (r - g) / d + 4;
		}
		h *= 60;
	}
	return { h: round1(h), s: round1(s * 100), l: round1(l * 100), a: color.a };
}

/** HSL → RGB（rgbToHsl 的逆运算） */
export function hslToRgb(color: Hsl): Rgb {
	const h = (((color.h % 360) + 360) % 360) / 360;
	const s = clamp(color.s, 0, 100) / 100;
	const l = clamp(color.l, 0, 100) / 100;
	if (s === 0) {
		const gray = round255(l * 255);
		return { r: gray, g: gray, b: gray, a: color.a };
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	// 色相换算成 0-1 环上的一段，三通道各取不同相位
	const channel = (t: number): number => {
		let x = t;
		if (x < 0) x += 1;
		if (x > 1) x -= 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return {
		r: round255(channel(h + 1 / 3) * 255),
		g: round255(channel(h) * 255),
		b: round255(channel(h - 1 / 3) * 255),
		a: color.a
	};
}

/** rgb() / rgba()：alpha 为 1 输出 rgb()，否则输出 rgba() */
export function formatRgb(color: Rgb): string {
	const channels = `${clamp(round255(color.r), 0, 255)}, ${clamp(round255(color.g), 0, 255)}, ${clamp(
		round255(color.b),
		0,
		255
	)}`;
	return color.a >= 1 ? `rgb(${channels})` : `rgba(${channels}, ${formatAlpha(color.a)})`;
}

/** hsl() / hsla()：alpha 为 1 输出 hsl()，否则输出 hsla() */
export function formatHsl(color: Hsl): string {
	const body = `${round1(color.h)}, ${round1(color.s)}%, ${round1(color.l)}%`;
	return color.a >= 1 ? `hsl(${body})` : `hsla(${body}, ${formatAlpha(color.a)})`;
}

/** 透明度数字：最多两位小数并去掉尾零（0.5 → "0.5"，1 / 3 → "0.33"） */
function formatAlpha(alpha: number): string {
	return String(Math.round(clamp(alpha, 0, 1) * 100) / 100);
}

/**
 * WCAG 2.x 相对亮度：先把 sRGB 分量线性化，再按人眼敏感度加权。
 * 传入的应为不透明颜色；半透明前景先经 blend() 混合。
 */
export function relativeLuminance(color: Rgb): number {
	const linear = (value: number): number => {
		const c = clamp(value, 0, 255) / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/**
 * 半透明前景按 alpha 合成到背景上 —— 对比度要看的是屏幕上实际呈现的颜色。
 * 返回不透明颜色（a = 1）。
 */
export function blend(foreground: Rgb, background: Rgb): Rgb {
	const a = clamp(foreground.a, 0, 1);
	const mix = (f: number, b: number): number => round255(f * a + b * (1 - a));
	return {
		r: mix(foreground.r, background.r),
		g: mix(foreground.g, background.g),
		b: mix(foreground.b, background.b),
		a: 1
	};
}

/** 对比度 = (较亮 + 0.05) / (较暗 + 0.05)，范围 [1, 21] */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [light, dark] = la >= lb ? [la, lb] : [lb, la];
	return (light + 0.05) / (dark + 0.05);
}

/** WCAG 2.x 四档达标判定。大字 = ≥18pt（约 24px）或 ≥14pt（约 18.66px）粗体 */
export function wcagPass(ratio: number): WcagCheck {
	return {
		aaNormal: ratio >= WCAG_THRESHOLDS.aaNormal,
		aaLarge: ratio >= WCAG_THRESHOLDS.aaLarge,
		aaaNormal: ratio >= WCAG_THRESHOLDS.aaaNormal,
		aaaLarge: ratio >= WCAG_THRESHOLDS.aaaLarge
	};
}

/** 比值显示：最多两位小数并去掉尾零（21.00 → "21"，4.543 → "4.54"） */
export function formatRatio(ratio: number): string {
	return String(Math.round(ratio * 100) / 100);
}
