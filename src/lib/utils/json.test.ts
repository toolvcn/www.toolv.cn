// $lib/utils/json 的单测：解析助手 + 全站共用的 JSON 高亮分词。
//
// 分词原先在四处各写一份并各测一次（json-formatter / jwt-decoder / http / websocket），
// 现在实现收成一份，测试也收成一份；四个工具里跟分词有关的用例都已移到这里。
import { describe, expect, it } from 'vitest';
import { isJson, isPlainObject, describeParseError, tokenizeJson, tokenizeSource } from './json.ts';

describe('isPlainObject', () => {
	it('只认对象，排除 null 与数组', () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject('x')).toBe(false);
	});
});

describe('isJson', () => {
	it('合法与非法一目了然', () => {
		expect(isJson('{"a":1}')).toBe(true);
		expect(isJson('')).toBe(false);
		expect(isJson('hello')).toBe(false);
	});
});

describe('describeParseError', () => {
	it('带 position 时换算成行列', () => {
		const message = 'Unexpected token } in JSON at position 5';
		expect(describeParseError('{"a":1\n}', new Error(message))).toContain('第 1 行');
	});

	it('没有 position 时原样返回', () => {
		expect(describeParseError('x', new Error('boom'))).toBe('boom');
	});
});

describe('tokenizeSource（保留原始排版）', () => {
	it('按类型切开并保留空白', () => {
		const tokens = tokenizeSource('{\n  "a": 1,\n  "b": true\n}');
		expect(tokens.map((token) => [token.text, token.kind])).toEqual([
			['{', 'punct'],
			['\n  ', 'plain'],
			['"a"', 'key'],
			[':', 'punct'],
			[' ', 'plain'],
			['1', 'number'],
			[',', 'punct'],
			['\n  ', 'plain'],
			['"b"', 'key'],
			[':', 'punct'],
			[' ', 'plain'],
			['true', 'literal'],
			['\n', 'plain'],
			['}', 'punct']
		]);
	});

	it('嵌套结构、字符串值、空值都分得对', () => {
		const tokens = tokenizeSource('{"a":[1,{"b":null}],"c":"x"}');
		const kinds = tokens.map((token) => token.kind);
		expect(kinds).toContain('number');
		expect(kinds).toContain('literal');
		expect(kinds).toContain('string');
		expect(kinds).toContain('key');
		expect(kinds).toContain('punct');
		// null 被分进 literal，不能当成字符串
		expect(tokens.filter((token) => token.text === 'null')[0]?.kind).toBe('literal');
	});

	it('转义引号里的内容不会被截断成两个字符串', () => {
		const tokens = tokenizeSource('{"a":"say \\"hi\\" now"}');
		const strings = tokens.filter((token) => token.kind === 'string');
		expect(strings).toHaveLength(1);
		expect(strings[0].text).toBe('"say \\"hi\\" now"');
	});

	it('相邻同类型片段会合并，省 <span> 数量', () => {
		const tokens = tokenizeSource('{"a":\n  1\n}');
		const plains = tokens.filter((token) => token.kind === 'plain');
		expect(plains.some((token) => token.text === '\n  ')).toBe(true);
		expect(plains.some((token) => token.text === '\n')).toBe(true);
	});

	it('数字边界：负数、小数、科学计数法', () => {
		const tokens = tokenizeSource('[-1,-0.5,1e10,2.5e-3]');
		const numbers = tokens.filter((token) => token.kind === 'number').map((token) => token.text);
		expect(numbers).toEqual(['-1', '-0.5', '1e10', '2.5e-3']);
	});

	it('原文一字不落：拼接回去等于输入', () => {
		const source = '{\n  "a": [1, 2],\n  "b": null\n}';
		expect(
			tokenizeSource(source)
				.map((token) => token.text)
				.join('')
		).toBe(source);
	});
});

describe('tokenizeJson（先美化再分词）', () => {
	const sample = '{"type":"ping","count":2,"ok":true}';

	it('标注键、字符串、数字与字面量', () => {
		const tokens = tokenizeJson(sample);
		expect(tokens).not.toBeNull();
		const kindOf = (text: string) => tokens?.find((token) => token.text === text)?.kind;
		expect(kindOf('"type"')).toBe('key');
		expect(kindOf('"ping"')).toBe('string');
		expect(kindOf('2')).toBe('number');
		expect(kindOf('true')).toBe('literal');
	});

	it('紧凑 JSON 重排成 2 空格，拼接后与格式化原文一致', () => {
		const tokens = tokenizeJson(sample);
		expect(tokens?.map((token) => token.text).join('')).toBe(JSON.stringify(JSON.parse(sample), null, 2));
	});

	it('非 JSON 返回 null', () => {
		expect(tokenizeJson('hello')).toBeNull();
		expect(tokenizeJson('<html>not json</html>')).toBeNull();
		expect(tokenizeJson('{"a":')).toBeNull();
	});
});
