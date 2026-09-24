// 查询参数 URL ↔ 行 双向转换的单测。
import { describe, expect, it } from 'vitest';
import { applyParams, parseParams } from './params.ts';

describe('parseParams', () => {
	it('没有查询串时返回空数组（`#fragment` 不算查询串）', () => {
		expect(parseParams('https://api.example.com/items')).toEqual([]);
		expect(parseParams('https://api.example.com/items#top')).toEqual([]);
	});

	it('按顺序解析，保留重复键与空值', () => {
		expect(parseParams('https://a.com/x?a=1&a=2&b=')).toEqual([
			{ name: 'a', value: '1' },
			{ name: 'a', value: '2' },
			{ name: 'b', value: '' }
		]);
	});

	it('解码百分号编码，`+` 按空格处理', () => {
		expect(parseParams('https://a.com/x?q=a%20b&r=c+d')).toEqual([
			{ name: 'q', value: 'a b' },
			{ name: 'r', value: 'c d' }
		]);
	});
});

describe('applyParams', () => {
	it('只写启用的行，并整体重建查询串', () => {
		expect(
			applyParams('https://a.com/x?old=1', [
				{ name: 'a', value: '1' },
				{ name: 'b', value: '2', enabled: false }
			])
		).toBe('https://a.com/x?a=1');
	});

	it('一行都不剩时连问号一起去掉', () => {
		expect(applyParams('https://a.com/x?a=1', [])).toBe('https://a.com/x');
	});

	it('`#fragment` 留在最后', () => {
		expect(applyParams('https://a.com/x?a=1#top', [{ name: 'b', value: '2' }])).toBe('https://a.com/x?b=2#top');
	});

	it('键名为空的行不写进去', () => {
		expect(applyParams('https://a.com/x', [{ name: '  ', value: '1' }])).toBe('https://a.com/x');
	});

	it('与 parseParams 往返稳定（空格会规范成 `+`，两者等价）', () => {
		const url = 'https://a.com/x?q=a%20b&n=1';
		expect(applyParams(url, parseParams(url))).toBe('https://a.com/x?q=a+b&n=1');
	});
});
