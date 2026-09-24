// 结果区行号槽的单测：行数口径（文本 / token 流两条路）与行号文本。
import { describe, expect, it } from 'vitest';
import type { JsonToken } from '$lib/utils/json';
import { lineCountOfText, lineCountOfTokens, lineNumbers } from './line-numbers.ts';

describe('lineCountOfText', () => {
	it('按换行数算，空文本算一行', () => {
		expect(lineCountOfText('')).toBe(1);
		expect(lineCountOfText('abc')).toBe(1);
		expect(lineCountOfText('a\nb')).toBe(2);
		expect(lineCountOfText('a\nb\nc')).toBe(3);
	});

	it('末尾的换行也算出一行（`a\\n` 是两行）', () => {
		expect(lineCountOfText('a\n')).toBe(2);
	});

	it('连续换行各有各的行', () => {
		expect(lineCountOfText('a\n\n\nb')).toBe(4);
	});
});

describe('lineCountOfTokens', () => {
	it('数的是 token 文本里的换行（美化后重排出来的行）', () => {
		const tokens: JsonToken[] = [
			{ text: '{\n', kind: 'punct' },
			{ text: '  "a": 1', kind: 'key' },
			{ text: '\n', kind: 'plain' },
			{ text: '}', kind: 'punct' }
		];
		expect(lineCountOfTokens(tokens)).toBe(3);
	});

	it('空 token 流算一行；一条 token 里跨多行也算得对', () => {
		expect(lineCountOfTokens([])).toBe(1);
		expect(lineCountOfTokens([{ text: 'a\nb\nc', kind: 'plain' }])).toBe(3);
	});

	it('与文本口径一致：同一段内容的两种喂法行数相同', () => {
		expect(lineCountOfTokens([{ text: 'a\nb', kind: 'plain' }])).toBe(lineCountOfText('a\nb'));
	});
});

describe('lineNumbers', () => {
	it('从 1 开始逐行拼出来', () => {
		expect(lineNumbers(1)).toBe('1');
		expect(lineNumbers(3)).toBe('1\n2\n3');
		expect(lineNumbers(10)).toBe('1\n2\n3\n4\n5\n6\n7\n8\n9\n10');
	});

	it('行数非法时不产出（0 / 负数都当空）', () => {
		expect(lineNumbers(0)).toBe('');
		expect(lineNumbers(-1)).toBe('');
	});
});
