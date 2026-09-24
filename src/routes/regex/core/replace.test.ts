// 文本替换核心的单测：替换串各写法、计数、非法正则与零宽推进。
import { describe, expect, it } from 'vitest';
import { replaceAll } from './replace.ts';

describe('替换执行', () => {
	it('无 g 修饰符也强制全局替换', () => {
		const result = replaceAll('\\d+', '', 'a1 b22 c333', 'X');
		expect(result.error).toBeNull();
		expect(result.output).toBe('aX bX cX');
		expect(result.count).toBe(3);
	});

	it('$1 引用第 1 组', () => {
		const result = replaceAll('(\\d{4})-(\\d{2})', 'g', '2026-09 与 2026-10', '$1年$2月');
		expect(result.output).toBe('2026年09月 与 2026年10月');
	});

	it('$<name> 引用命名组', () => {
		const result = replaceAll('(?<year>\\d{4})', 'g', '2026', '$<year>年');
		expect(result.output).toBe('2026年');
	});

	it('$& 引用整段匹配', () => {
		const result = replaceAll('\\d+', 'g', 'a1', '[$&]');
		expect(result.output).toBe('a[1]');
	});

	it('replacement 为空串也算替换次数', () => {
		const result = replaceAll('\\d', 'g', 'a1b2', '');
		expect(result.output).toBe('ab');
		expect(result.count).toBe(2);
	});
});

describe('边界', () => {
	it('非法 pattern 返回 error', () => {
		const result = replaceAll('([a', 'g', 'abc', 'X');
		expect(result.error).not.toBeNull();
		expect(result.output).toBe('');
		expect(result.count).toBe(0);
	});

	it('零宽匹配会推进，不死循环', () => {
		const result = replaceAll('a*', 'g', 'bab', 'x');
		expect(result.error).toBeNull();
		expect(result.count).toBeGreaterThan(0);
	});

	it('没匹配上时原样返回', () => {
		const result = replaceAll('\\d', 'g', 'abc', 'X');
		expect(result.output).toBe('abc');
		expect(result.count).toBe(0);
	});
});
