// tokenizeTypeScript 的单测：关键字 / 类型名 / 字段名 / 原始类型 / 标点的归类与无损性。
import { describe, expect, it } from 'vitest';
import { tokenizeTypeScript, type TsTokenKind } from './highlight.ts';

/** 还原原文本：分词必须无损（渲染出来的代码跟原始 code 逐字一致） */
const text = (source: string) =>
	tokenizeTypeScript(source)
		.map((t) => t.text)
		.join('');

/** 查某个片段被归成哪一类；分词里找不到就返回 undefined */
const kindOf = (source: string, word: string): TsTokenKind | undefined =>
	tokenizeTypeScript(source).find((t) => t.text === word)?.kind;

describe('归类', () => {
	it('声明头部：export / interface 是关键字，接口名是类型名', () => {
		expect(kindOf('export interface Root {', 'export')).toBe('keyword');
		expect(kindOf('export interface Root {', 'interface')).toBe('keyword');
		expect(kindOf('export interface Root {', 'Root')).toBe('type');
		expect(kindOf('export interface Root {', '{')).toBe('punct');
	});

	it('字段名跟 : 或 ?，内置类型按 primitive', () => {
		expect(kindOf('\tid: number;', 'id')).toBe('property');
		expect(kindOf('\tid: number;', 'number')).toBe('primitive');
		expect(kindOf('\temail?: string;', 'email')).toBe('property');
		expect(kindOf('\temail?: string;', 'string')).toBe('primitive');
	});

	it('引用的子接口名是类型名，数组后缀是标点', () => {
		expect(kindOf('\tmembers: RootMembersItem[];', 'members')).toBe('property');
		expect(kindOf('\tmembers: RootMembersItem[];', 'RootMembersItem')).toBe('type');
	});

	it('union 里的每一项各自归类', () => {
		const line = '\tmixed: (number | string | null)[];';
		expect(kindOf(line, 'mixed')).toBe('property');
		expect(kindOf(line, 'number')).toBe('primitive');
		expect(kindOf(line, 'null')).toBe('primitive');
	});

	it('带引号的键名走字符串分支，仍算字段名', () => {
		expect(kindOf('\t"retry-count": number;', '"retry-count"')).toBe('property');
	});

	it('type 别名：别名名与右侧引用都是类型名', () => {
		expect(kindOf('export type Root = RootItem[];', 'type')).toBe('keyword');
		expect(kindOf('export type Root = RootItem[];', 'Root')).toBe('type');
		expect(kindOf('export type Root = RootItem[];', 'RootItem')).toBe('type');
	});

	it('unknown / boolean 按内置类型上色，不是接口名', () => {
		expect(kindOf('export type Root = unknown[];', 'unknown')).toBe('primitive');
		expect(kindOf('\tok: boolean;', 'boolean')).toBe('primitive');
	});

	it('空白归 plain，不在 punct 里', () => {
		expect(kindOf('export interface Root {', ' ')).toBe('plain');
	});
});

describe('无损', () => {
	it('拼回去跟原文逐字一致', () => {
		const code = ['export interface Root {', '\tid: number;', '\t"retry-count"?: string | null;', '}'].join('\n');
		expect(text(code)).toBe(code);
	});

	it('空串返回空数组', () => {
		expect(tokenizeTypeScript('')).toEqual([]);
	});
});
