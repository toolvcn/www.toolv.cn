// jsonToTypeScript 的单测：类型映射、数组合并、可选键、命名与冲突、错误定位。
import { describe, expect, it } from 'vitest';
import { jsonToTypeScript } from './json-to-ts.ts';
import { EXAMPLE_JSON } from '../config.ts';

const gen = (input: string, rootName = 'Root', exportKeyword = true) =>
	jsonToTypeScript(input, { rootName, exportKeyword });

/** 断言成功并返回代码，省得每个用例都写收窄 */
const codeOf = (input: string, rootName = 'Root', exportKeyword = true) => {
	const r = gen(input, rootName, exportKeyword);
	if (!r.ok) throw new Error(`期望生成成功，实际失败：${r.error}`);
	return r.code;
};

describe('标量与数组', () => {
	it('根是标量时输出 type 别名', () => {
		expect(codeOf('42')).toBe('export type Root = number;');
		expect(codeOf('"hi"')).toBe('export type Root = string;');
		expect(codeOf('true')).toBe('export type Root = boolean;');
		expect(codeOf('null')).toBe('export type Root = null;');
	});

	it('同型标量数组与空数组', () => {
		expect(codeOf('[1, 2, 3]')).toBe('export type Root = number[];');
		expect(codeOf('[]')).toBe('export type Root = unknown[];');
	});

	it('混合数组输出 union，null 参与且去重', () => {
		expect(codeOf('[1, "two", null, 3]')).toBe('export type Root = (number | string | null)[];');
	});

	it('true 与 false 合并成 boolean', () => {
		expect(codeOf('[true, false]')).toBe('export type Root = boolean[];');
	});
});

describe('对象与嵌套', () => {
	it('扁平对象生成 interface，键序保持原样', () => {
		expect(codeOf('{"id": 1, "name": "a", "ok": false}')).toBe(
			['export interface Root {', '\tid: number;', '\tname: string;', '\tok: boolean;', '}'].join('\n')
		);
	});

	it('嵌套对象：子接口名 = 父名 + 字段，父接口在前', () => {
		expect(codeOf('{"owner": {"id": 1}}')).toBe(
			[
				'export interface Root {',
				'\towner: RootOwner;',
				'}',
				'',
				'export interface RootOwner {',
				'\tid: number;',
				'}'
			].join('\n')
		);
	});

	it('空对象生成空 interface', () => {
		const code = codeOf('{"meta": {}}');
		expect(code).toContain('export interface RootMeta {');
		expect(code).toContain('}');
	});

	it('不合法键名加引号', () => {
		const code = codeOf('{"retry-count": 3, "2fa": true}');
		expect(code).toContain('\t"retry-count": number;');
		expect(code).toContain('\t"2fa": boolean;');
	});
});

describe('对象数组合并', () => {
	it('缺失键标可选，出现的键保持必有', () => {
		expect(codeOf('{"members": [{"id": 1, "email": "a"}, {"id": 2}]}')).toBe(
			[
				'export interface Root {',
				'\tmembers: RootMembersItem[];',
				'}',
				'',
				'export interface RootMembersItem {',
				'\tid: number;',
				'\temail?: string;',
				'}'
			].join('\n')
		);
	});

	it('同键类型不同合并成 union', () => {
		expect(codeOf('[{"v": 1}, {"v": "s"}]')).toContain('v: number | string;');
	});

	it('对象与标量混合的数组：对象合并 + union', () => {
		const code = codeOf('[{"a": 1}, "x", {"b": 2}]');
		expect(code).toContain('export type Root = (RootItem | string)[];');
		// 两个对象元素各缺一键，合并后 a、b 都只在部分元素出现 → 都可选
		expect(code).toContain('\ta?: number;');
		expect(code).toContain('\tb?: number;');
	});

	it('根是对象数组时别名在前', () => {
		expect(codeOf('[{"a": 1}]', 'Root').startsWith('export type Root = RootItem[];')).toBe(true);
	});
});

describe('命名与选项', () => {
	it('根类型名净化：非法字符转 PascalCase', () => {
		expect(codeOf('{"a": 1}', 'my api')).toContain('export interface MyApi {');
	});

	it('同名子接口冲突时加后缀', () => {
		// owner 与 owner_x 都净化成 RootOwner 之类：直接构造两个同字段路径不同写法
		const code = codeOf('{"data": {"a": 1}, "data2": {"b": 2}}', 'Root');
		expect(code).toContain('export interface RootData {');
		expect(code).toContain('export interface RootData2 {');
	});

	it('export 开关关闭后无 export 前缀', () => {
		const code = codeOf('{"a": 1}', 'Root', false);
		expect(code.startsWith('interface Root {')).toBe(true);
		expect(code).not.toContain('export');
	});
});

describe('错误处理', () => {
	it('非法 JSON 给出行列', () => {
		const r = gen('{\n  "a": 1,\n}');
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.error).toMatch(/第 \d+ 行第 \d+ 列/);
	});

	it('错误消息包含原始原因', () => {
		const r = gen('not json');
		expect(r.ok).toBe(false);
	});
});

describe('示例与统计', () => {
	it('内置示例可生成，声明数与代码行数合理', () => {
		const r = gen(EXAMPLE_JSON);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.declarations).toBe(3); // Root + RootOwner + RootMembersItem
		expect(r.code).toContain('members: RootMembersItem[];');
		expect(r.code).toContain('mixed: (number | string | null)[];');
		expect(r.code).toContain('"retry-count": number;');
	});
});
