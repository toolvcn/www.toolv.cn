// ASCII 码表数据与搜索的单测。
import { describe, expect, it } from 'vitest';
import { asciiCopyText, asciiGroupOf, ASCII_ENTRIES, groupAsciiEntries, hexOf, searchAsciiEntries } from './ascii.ts';

describe('ASCII_ENTRIES 数据完整性', () => {
	it('覆盖 0-127，码位唯一且升序', () => {
		expect(ASCII_ENTRIES).toHaveLength(128);
		const codes = ASCII_ENTRIES.map((entry) => entry.code);
		expect(codes).toEqual([...codes].sort((a, b) => a - b));
		expect(codes[0]).toBe(0);
		expect(codes[127]).toBe(127);
	});

	it('可打印字符带字形，控制字符带缩写', () => {
		const printable = ASCII_ENTRIES.filter((entry) => asciiGroupOf(entry.code) === 'printable');
		const control = ASCII_ENTRIES.filter((entry) => asciiGroupOf(entry.code) === 'control');
		expect(printable).toHaveLength(95);
		expect(control).toHaveLength(33);
		for (const entry of printable) {
			expect(entry.char).toBe(String.fromCharCode(entry.code));
			expect(entry.abbr).toBeNull();
		}
		for (const entry of control) {
			expect(entry.char).toBeNull();
			expect(entry.abbr?.trim()).toBeTruthy();
		}
	});
});

describe('hexOf 与 asciiCopyText', () => {
	it('十六进制两位大写带 0x 前缀', () => {
		expect(hexOf(65)).toBe('0x41');
		expect(hexOf(10)).toBe('0x0A');
		expect(hexOf(0)).toBe('0x00');
	});

	it('可打印字符复制字符本身，空格也是', () => {
		expect(asciiCopyText({ code: 65, char: 'A', abbr: null, escape: null, note: '' })).toBe('A');
		expect(asciiCopyText({ code: 32, char: ' ', abbr: null, escape: null, note: '' })).toBe(' ');
	});

	it('控制字符复制转义写法，没有约定的退回 \\xHH', () => {
		const lf = ASCII_ENTRIES.find((entry) => entry.code === 10)!;
		expect(asciiCopyText(lf)).toBe('\\n');
		const esc = ASCII_ENTRIES.find((entry) => entry.code === 27)!;
		expect(asciiCopyText(esc)).toBe('\\x1B');
		const del = ASCII_ENTRIES.find((entry) => entry.code === 127)!;
		expect(asciiCopyText(del)).toBe('\\x7F');
	});
});

describe('searchAsciiEntries', () => {
	it('空查询返回全量', () => {
		expect(searchAsciiEntries('')).toHaveLength(128);
	});

	it('按十进制、十六进制、说明都能命中', () => {
		expect(searchAsciiEntries('65').map((e) => e.code)).toContain(65);
		expect(searchAsciiEntries('0x41').map((e) => e.code)).toContain(65);
		expect(searchAsciiEntries('换行').map((e) => e.code)).toContain(10);
	});

	it('按缩写命中控制字符', () => {
		expect(searchAsciiEntries('cr').map((e) => e.code)).toContain(13);
	});

	it('无命中返回空数组', () => {
		expect(searchAsciiEntries('不存在的字符zzz')).toEqual([]);
	});
});

describe('groupAsciiEntries', () => {
	it('可打印组在前，两组条数之和等于全量', () => {
		const sections = groupAsciiEntries(ASCII_ENTRIES);
		expect(sections.map((s) => s.group)).toEqual(['printable', 'control']);
		expect(sections.reduce((n, s) => n + s.items.length, 0)).toBe(128);
	});
});
