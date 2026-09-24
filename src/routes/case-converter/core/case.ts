// 命名风格转换的纯函数：分词 + 按目标风格重组。不依赖 DOM，node 环境可直接单测。
import type { CaseStyle } from './types.ts';

function isUpper(ch: string): boolean {
	return ch !== '' && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}
function isLower(ch: string): boolean {
	return ch !== '' && ch === ch.toLowerCase() && ch !== ch.toUpperCase();
}
function isDigit(ch: string): boolean {
	return ch >= '0' && ch <= '9';
}
/** 构词字符：Unicode 字母与数字（含中文）。其余（下划线、短横线、空格、标点）一律当分隔符 */
const WORD_CHAR = /[\p{L}\p{N}]/u;
function isWordChar(ch: string): boolean {
	return WORD_CHAR.test(ch);
}

/**
 * 把任意输入拆成单词序列，规则：
 * 1. 非字母数字（`_` `-` 空格、标点）都是分隔符；
 * 2. 小写/数字 → 大写的边界断词（myVar → my | Var）；
 * 3. 连续大写缩写在「大写 → 大写 + 小写」处断词（HTTPResponse → HTTP | Response）；
 * 4. 字母与数字的交界不断（v2、base64 保持完整）。
 */
export function tokenizeWords(input: string): string[] {
	const chars = Array.from(input);
	const words: string[] = [];
	let current = '';
	const flush = () => {
		if (current !== '') {
			words.push(current);
			current = '';
		}
	};
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i];
		if (!isWordChar(ch)) {
			flush();
			continue;
		}
		if (current !== '' && isUpper(ch)) {
			const prev = chars[i - 1] ?? '';
			const next = chars[i + 1] ?? '';
			const prevBreaks = isLower(prev) || isDigit(prev);
			const abbreviationEnds = isUpper(prev) && (isLower(next) || isDigit(next));
			if (prevBreaks || abbreviationEnds) flush();
		}
		current += ch;
	}
	flush();
	return words;
}

/** 首字母大写、其余小写，用于 Pascal / Title 组词（对中文等无大写形式的字符保持原样） */
function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** 任意输入 → 指定风格。拆不出任何单词时返回空串 */
export function convertCase(input: string, style: CaseStyle): string {
	const words = tokenizeWords(input);
	switch (style) {
		case 'camel':
			return words.map((word, i) => (i === 0 ? word.toLowerCase() : capitalize(word))).join('');
		case 'pascal':
			return words.map(capitalize).join('');
		case 'snake':
			return words.map((word) => word.toLowerCase()).join('_');
		case 'kebab':
			return words.map((word) => word.toLowerCase()).join('-');
		case 'constant':
			return words.map((word) => word.toUpperCase()).join('_');
		case 'title':
			return words.map(capitalize).join(' ');
		case 'lower':
			return words.map((word) => word.toLowerCase()).join(' ');
	}
}
