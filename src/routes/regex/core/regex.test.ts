// 正则测试核心的单测：编译报错、全局 / 单次匹配、零宽推进、限量截断、捕获组与分词。
import { describe, expect, it } from 'vitest';
import { testRegex } from './regex.ts';
import { MAX_MATCHES } from '../config.ts';

describe('编译校验', () => {
	it('非法 pattern 返回 error，不抛异常', () => {
		const result = testRegex('([a', 'g', 'abc');
		expect(result.error).not.toBeNull();
		expect(result.matches).toEqual([]);
	});

	it('非法 flags 返回 error', () => {
		expect(testRegex('a', 'x', 'abc').error).not.toBeNull();
	});

	it('空 pattern 合法（匹配空串）', () => {
		expect(testRegex('', 'g', 'ab').error).toBeNull();
	});
});

describe('匹配执行', () => {
	it('无 g 只找第一个匹配', () => {
		const result = testRegex('\\d+', '', 'a1 b22 c333');
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]).toMatchObject({ index: 1, text: '1' });
	});

	it('有 g 找出全部匹配', () => {
		const result = testRegex('\\d+', 'g', 'a1 b22 c333');
		expect(result.matches.map((m) => m.text)).toEqual(['1', '22', '333']);
		expect(result.truncated).toBe(false);
	});

	it('零宽匹配会推进，不死循环', () => {
		const result = testRegex('a*', 'g', 'bab');
		// b|a|b|（末尾空匹配）—— 至少不会挂死，且空匹配也被记录
		expect(result.error).toBeNull();
		const total = result.matches.reduce((sum, m) => sum + m.text.length, 0);
		expect(total).toBeLessThanOrEqual(3);
		expect(result.matches.length).toBeGreaterThan(0);
	});

	it('命中上限即停并标 truncated', () => {
		const result = testRegex('a', 'g', 'a'.repeat(MAX_MATCHES + 100));
		expect(result.matches).toHaveLength(MAX_MATCHES);
		expect(result.truncated).toBe(true);
	});

	it('y 粘性旗标从头开始逐位匹配', () => {
		const result = testRegex('\\d', 'y', '12a');
		expect(result.matches.map((m) => m.text)).toEqual(['1', '2']);
	});
});

describe('捕获组', () => {
	it('编号组按顺序列出', () => {
		const result = testRegex('(\\d{4})-(\\d{2})', 'g', '2026-09-05');
		expect(result.matches[0]!.groups).toEqual([
			{ name: '1', value: '2026', empty: false },
			{ name: '2', value: '09', empty: false }
		]);
	});

	it('命名组跟在编号组后面', () => {
		const result = testRegex('(?<year>\\d{4})', 'g', '2026');
		expect(result.matches[0]!.groups).toEqual([
			{ name: '1', value: '2026', empty: false },
			{ name: 'year', value: '2026', empty: false }
		]);
	});

	it('未参与匹配的组标 empty', () => {
		const result = testRegex('(a)?(b)', 'g', 'b');
		expect(result.matches[0]!.groups[0]).toEqual({ name: '1', value: '', empty: true });
		expect(result.matches[0]!.groups[1]).toEqual({ name: '2', value: 'b', empty: false });
	});

	it('反向引用可用（重复单词）', () => {
		const result = testRegex('\\b(\\w+)\\s+\\1\\b', 'g', 'hello hello world');
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]!.text).toBe('hello hello');
	});
});

describe('高亮分词', () => {
	it('未匹配文本与匹配段交替切分', () => {
		const result = testRegex('\\d+', 'g', 'a1 b22');
		expect(result.tokens).toEqual([
			{ text: 'a', matchIndex: null },
			{ text: '1', matchIndex: 0 },
			{ text: ' b', matchIndex: null },
			{ text: '22', matchIndex: 1 }
		]);
	});

	it('文本开头就是匹配时没有前置空段', () => {
		const result = testRegex('^a', 'g', 'ab');
		expect(result.tokens[0]).toEqual({ text: 'a', matchIndex: 0 });
	});

	it('截断后剩余文本并入末尾普通段', () => {
		const result = testRegex('a', 'g', 'a'.repeat(MAX_MATCHES + 10));
		const last = result.tokens.at(-1)!;
		expect(last.matchIndex).toBeNull();
		expect(last.text).toBe('a'.repeat(10));
	});
});
