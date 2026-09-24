// 古典密码：凯撒（整体位移）与维吉尼亚（按密钥逐位位移）。
//
// 两者的口径完全一致：只动 A-Z / a-z，各自循环；数字、标点、空格、中文一律原样穿过，
// **且不消耗密钥位** —— 否则「密钥与第几个字母对齐」这件事就没法预期了。
// 输出的大小写跟着输入（'H' 加密后还是大写）。
import { fail, ok, type Result } from '$lib/utils/result';
import { type Direction } from './types.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const isLetterCode = (code: number): boolean => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/** 单个字母位移 delta 位，大小写保持 */
function shiftLetter(code: number, delta: number): string {
	const base = code >= 97 ? 97 : 65;
	return String.fromCharCode(((((code - base + delta) % 26) + 26) % 26) + base);
}

/** 把位移收敛到 0-25：允许用户填 29 或 -3，等价成 3 / 23 */
export function normalizeShift(shift: number): number {
	if (!Number.isFinite(shift)) return 0;
	return ((Math.trunc(shift) % 26) + 26) % 26;
}

// ---------------------------------------------------------------- 凯撒

export interface CaesarRow {
	from: string;
	to: string;
}

export function caesarShift(text: string, shift: number, direction: Direction): string {
	const delta = normalizeShift(shift) * (direction === 'encrypt' ? 1 : -1);
	let out = '';
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		out += isLetterCode(code) ? shiftLetter(code, delta) : char;
	}
	return out;
}

/** 位移对照表：26 个大写字母在当前位移与方向下各自映射到哪（解密方向是反过来） */
export function caesarTable(shift: number, direction: Direction): CaesarRow[] {
	const delta = normalizeShift(shift) * (direction === 'encrypt' ? 1 : -1);
	return [...LETTERS].map((letter) => ({ from: letter, to: shiftLetter(letter.charCodeAt(0), delta) }));
}

// ---------------------------------------------------------------- 维吉尼亚

/** 密钥去掉非字母并大写：'le mon' → 'LEMON' */
export function cleanVigenereKey(key: string): string {
	return key.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/** 密钥 → 每一位的位移量；一个字母都没有时报错 */
export function vigenereShifts(key: string): Result<number[]> {
	const letters = cleanVigenereKey(key);
	if (letters === '') return fail('密钥里至少要有一个字母（A-Z），其它字符会被忽略');
	return ok([...letters].map((letter) => letter.charCodeAt(0) - 65));
}

export function vigenereShift(text: string, key: string, direction: Direction): Result<string> {
	const shifts = vigenereShifts(key);
	if (!shifts.ok) return fail(shifts.error);

	let index = 0;
	let out = '';
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (!isLetterCode(code)) {
			out += char;
			continue;
		}
		const shift = shifts.value[index % shifts.value.length];
		out += shiftLetter(code, direction === 'encrypt' ? shift : -shift);
		index += 1;
	}
	return ok(out);
}

/**
 * 密钥预览：把密钥按字母位置铺开，与原文逐位对齐（非字母位置保留原字符，
 * 这样一眼能看出密钥是怎么重复的）。密钥不合法时返回空串。
 *
 *   ATTACK AT DAWN
 *   LEMONL EM ONLE
 */
export function vigenereKeyFlow(text: string, key: string): string {
	const letters = cleanVigenereKey(key);
	if (letters === '') return '';

	let index = 0;
	let out = '';
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (!isLetterCode(code)) {
			out += char;
			continue;
		}
		out += letters[index % letters.length];
		index += 1;
	}
	return out;
}
