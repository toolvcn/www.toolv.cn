// JS 字面量解析器的单测：宽容度与「只认字面量」的边界。
import { describe, expect, it } from 'vitest';
import { parseJsValue, skipJsTrivia } from './js-literal.ts';

describe('parseJsValue', () => {
	it('解析对象、数组、数字、布尔与 null', () => {
		const result = parseJsValue('{"a":1,"b":[true,null,-2.5],"c":"x"}');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({ a: 1, b: [true, null, -2.5], c: 'x' });
	});

	it('宽容：键不带引号、单引号、反引号字符串、尾随逗号、注释', () => {
		const source = `{
			// 注释
			method: 'POST',   /* 块注释 */
			headers: { 'X-Token': \`abc\` },
			body: '{"a":1}',
		}`;
		const result = parseJsValue(source);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({ method: 'POST', headers: { 'X-Token': 'abc' }, body: '{"a":1}' });
	});

	it('处理转义与 \\u 编码', () => {
		const result = parseJsValue('"a\\"b\\\\c\\nd\\u4e2d"');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toBe('a"b\\c\nd中');
	});

	it('end 指向字面量之后（供调用方继续解析下一个参数）', () => {
		const source = '"url", 1';
		const result = parseJsValue(source);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(source.slice(result.end)).toBe(', 1');
	});

	it('变量 / 函数调用 / 模板插值都报错，并说清是什么写法', () => {
		const variable = parseJsValue('requestOptions');
		expect(variable.ok).toBe(false);
		if (variable.ok) return;
		expect(variable.error).toContain('requestOptions');

		const call = parseJsValue('JSON.stringify({a:1})');
		expect(call.ok).toBe(false);

		const template = parseJsValue('`${x}`');
		expect(template.ok).toBe(false);
		if (template.ok) return;
		expect(template.error).toContain('插值');
	});

	it('结构没闭合时报错而不是静默截断', () => {
		expect(parseJsValue('{"a":1').ok).toBe(false);
		expect(parseJsValue('["a"').ok).toBe(false);
		expect(parseJsValue("'abc").ok).toBe(false);
		expect(parseJsValue('{a 1}').ok).toBe(false);
	});

	it('展开运算符与计算属性名不当成字面量', () => {
		expect(parseJsValue('{...base}').ok).toBe(false);
		expect(parseJsValue('{[key]: 1}').ok).toBe(false);
	});
});

describe('skipJsTrivia', () => {
	it('跳过空白与注释，返回下一个有效字符的下标', () => {
		const source = '   /* x */ ,1';
		expect(source[skipJsTrivia(source, 0)]).toBe(',');
	});
});
