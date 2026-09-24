// 进制转换的纯函数：全程 BigInt 运算，任意大整数都能精确互转，不碰浮点。
// 数字字母表复用 types.ts 的 RADIX_DIGITS。node 环境可直接单测。
import { RADIX_DIGITS, type SourceBase } from './types.ts';

/**
 * 任意进制文本 → BigInt；非法文本返回 null。
 * 允许前导正负号、字母大小写混用；空白与下划线忽略（常见分隔习惯，如 1_000_000）。
 */
export function parseRadix(text: string, base: SourceBase): bigint | null {
	let body = text.trim().toLowerCase();
	if (body === '') return null;
	let negative = false;
	if (body.startsWith('-')) {
		negative = true;
		body = body.slice(1);
	} else if (body.startsWith('+')) {
		body = body.slice(1);
	}
	if (body === '') return null;
	let value = 0n;
	for (const char of body) {
		if (char === '_' || char === ' ') continue;
		const digit = RADIX_DIGITS.indexOf(char);
		if (digit === -1 || digit >= base) return null;
		value = value * BigInt(base) + BigInt(digit);
	}
	return negative ? -value : value;
}

/** BigInt → 任意进制文本（小写）。负数带负号。 */
export function formatRadix(value: bigint, base: SourceBase): string {
	if (value === 0n) return '0';
	const negative = value < 0n;
	let n = negative ? -value : value;
	let out = '';
	while (n > 0n) {
		out = RADIX_DIGITS[Number(n % BigInt(base))] + out;
		n /= BigInt(base);
	}
	return negative ? `-${out}` : out;
}

/** 十进制整数的文本直接解析：快捷入口，避免各处重复写 try/catch */
export function parseDecimal(text: string): bigint | null {
	return parseRadix(text, 10);
}

/** 二进制/十六进制常见 0b / 0x 前缀一并接受 */
export function autoDetect(text: string): { text: string; base: SourceBase } {
	const trimmed = text.trim();
	if (/^0[xX]/.test(trimmed)) return { text: trimmed.slice(2), base: 16 };
	if (/^0[bB]/.test(trimmed)) return { text: trimmed.slice(2), base: 2 };
	if (/^0[oO]/.test(trimmed)) return { text: trimmed.slice(2), base: 8 };
	return { text: trimmed, base: 10 };
}
