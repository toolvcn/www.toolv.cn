// 正则解析器单测：结构、量词、组、转义、交替，以及不支持写法的兜底。
import { describe, expect, it } from 'vitest';
import { parsePattern } from './parse.ts';

/** 断言解析成功并返回节点 */
function parse(source: string): Extract<ReturnType<typeof parsePattern>, { ok: true }> {
	const result = parsePattern(source);
	if (!result.ok) {
		throw new Error(`预期解析成功但失败：${result.reason}`);
	}
	return result;
}

describe('基础结构', () => {
	it('字面量序列', () => {
		const { node } = parse('ab');
		expect(node.type).toBe('sequence');
		if (node.type === 'sequence') {
			expect(node.items).toHaveLength(2);
			expect(node.items[0]).toMatchObject({ type: 'literal', value: 'a' });
		}
	});

	it('单个字面量不包 sequence', () => {
		const { node } = parse('a');
		expect(node).toMatchObject({ type: 'literal', value: 'a' });
	});

	it('交替拆成多个分支', () => {
		const { node } = parse('a|b');
		expect(node.type).toBe('alternation');
		if (node.type === 'alternation') expect(node.branches).toHaveLength(2);
	});

	it('锚点 ^ $ 与点号', () => {
		const { node } = parse('^.$');
		expect(node.type).toBe('sequence');
		if (node.type === 'sequence') {
			expect(node.items[0]).toMatchObject({ type: 'anchor', token: '^' });
			expect(node.items[1]).toMatchObject({ type: 'dot' });
			expect(node.items[2]).toMatchObject({ type: 'anchor', token: '$' });
		}
	});
});

describe('量词', () => {
	it('* + ? 与惰性', () => {
		expect(parse('a*').node).toMatchObject({ type: 'quantified', min: 0, max: Infinity, lazy: false });
		expect(parse('a+').node).toMatchObject({ type: 'quantified', min: 1, max: Infinity });
		expect(parse('a?').node).toMatchObject({ type: 'quantified', min: 0, max: 1 });
		expect(parse('a*?').node).toMatchObject({ type: 'quantified', lazy: true });
	});

	it('花括号量词', () => {
		expect(parse('a{2}').node).toMatchObject({ type: 'quantified', min: 2, max: 2 });
		expect(parse('a{2,}').node).toMatchObject({ type: 'quantified', min: 2, max: Infinity });
		expect(parse('a{2,4}').node).toMatchObject({ type: 'quantified', min: 2, max: 4 });
	});

	it('非法的 { 按字面量处理', () => {
		const { node } = parse('a{foo');
		expect(node.type).toBe('sequence');
		if (node.type === 'sequence') {
			expect(node.items[1]).toMatchObject({ type: 'literal', value: '{' });
		}
	});
});

describe('分组', () => {
	it('捕获组带编号', () => {
		const { node } = parse('(ab)');
		expect(node).toMatchObject({ type: 'group', kind: 'capture', number: 1 });
	});

	it('命名组', () => {
		const { node } = parse('(?<year>\\d{4})');
		expect(node).toMatchObject({ type: 'group', kind: 'named', name: 'year', number: 1 });
	});

	it('非捕获组与环视', () => {
		expect(parse('(?:a)').node).toMatchObject({ type: 'group', kind: 'nonCapture' });
		expect(parse('(?=a)').node).toMatchObject({ type: 'group', kind: 'lookahead' });
		expect(parse('(?!a)').node).toMatchObject({ type: 'group', kind: 'negativeLookahead' });
		expect(parse('(?<=a)').node).toMatchObject({ type: 'group', kind: 'lookbehind' });
		expect(parse('(?<!a)').node).toMatchObject({ type: 'group', kind: 'negativeLookbehind' });
	});

	it('多个捕获组编号递增', () => {
		const { node } = parse('(a)(b)');
		expect(node.type).toBe('sequence');
		if (node.type === 'sequence') {
			expect(node.items[0]).toMatchObject({ type: 'group', number: 1 });
			expect(node.items[1]).toMatchObject({ type: 'group', number: 2 });
		}
	});
});

describe('字符类与转义', () => {
	it('字符类与排除', () => {
		expect(parse('[a-z]').node).toMatchObject({ type: 'charClass', negated: false, token: '[a-z]' });
		expect(parse('[^a]').node).toMatchObject({ type: 'charClass', negated: true });
	});

	it('常用转义带说明', () => {
		expect(parse('\\d').node).toMatchObject({ type: 'escape', token: '\\d', label: '数字' });
		expect(parse('\\b').node).toMatchObject({ type: 'escape', token: '\\b', label: '单词边界' });
		expect(parse('\\p{L}').node).toMatchObject({ type: 'escape', token: '\\p{L}', label: 'Unicode 属性' });
	});

	it('反向引用与命名组引用', () => {
		expect(parse('\\1').node).toMatchObject({ type: 'backref', token: '\\1' });
		expect(parse('\\k<x>').node).toMatchObject({ type: 'backref', token: '\\k<x>' });
	});
});

describe('不支持与错误', () => {
	it('内联修饰符不支持', () => {
		expect(parsePattern('(?i)abc').ok).toBe(false);
	});

	it('未闭合的括号报错', () => {
		expect(parsePattern('(abc').ok).toBe(false);
	});

	it('未闭合的字符类报错', () => {
		expect(parsePattern('[abc').ok).toBe(false);
	});

	it('结尾反斜杠报错', () => {
		expect(parsePattern('abc\\').ok).toBe(false);
	});
});
