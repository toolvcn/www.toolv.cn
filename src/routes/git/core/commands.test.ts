// Git 命令表的体检 + 搜索 / 分组的口径冒烟。共用逻辑本身在 $lib 那份单测里，
// 这里只关心「本工具的数据是不是自洽」——手写的大表格最容易出 id 撞车、分组拼错、占位符写错。
import { describe, expect, it } from 'vitest';
import {
	filterCommands,
	groupCommands,
	renderCommand,
	resolveVars,
	validateCheatsheetData
} from '$lib/utils/command-cheatsheet';
import { VAR_DEFS } from '../config.ts';
import { GIT_COMMANDS, GIT_GROUPS } from './commands.ts';

describe('Git 命令数据', () => {
	it('自洽：id 不重复、分组都存在、占位符都有定义、危险命令都写了 note', () => {
		expect(validateCheatsheetData(GIT_COMMANDS, VAR_DEFS, GIT_GROUPS)).toEqual([]);
	});

	it('命令量与「常用」档都有一定规模', () => {
		expect(GIT_COMMANDS.length).toBeGreaterThanOrEqual(50);
		expect(GIT_COMMANDS.filter((cmd) => cmd.featured).length).toBeGreaterThanOrEqual(12);
	});

	it('危险命令成组存在，且都标了 warn / destructive', () => {
		const dangers = GIT_COMMANDS.filter((cmd) => cmd.danger);
		expect(dangers.length).toBeGreaterThanOrEqual(8);
		expect(dangers.every((cmd) => cmd.danger === 'warn' || cmd.danger === 'destructive')).toBe(true);
	});

	it('按默认示例值渲染后不残留任何占位符（保证复制即用）', () => {
		const vars = resolveVars({}, VAR_DEFS);
		const leftovers = new Set<string>();
		for (const cmd of GIT_COMMANDS) {
			for (const template of [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)]) {
				if (renderCommand(template, vars).includes('{{')) leftovers.add(cmd.id);
			}
		}
		expect([...leftovers]).toEqual([]);
	});

	it('搜索能命中中文动作词、英文子命令与分组名', () => {
		const ids = (query: string) => filterCommands(GIT_COMMANDS, query, 'all', GIT_GROUPS).map((cmd) => cmd.id);
		expect(ids('变基')).toContain('b-rebase');
		expect(ids('rebase')).toContain('b-rebase');
		expect(ids('找回提交')).toContain('h-reflog');
		expect(ids('zzz-没有这条')).toEqual([]);
	});

	it('「全部」档的分节顺序与分组表一致，且不返回空节', () => {
		const sections = groupCommands(GIT_COMMANDS, 'all', GIT_GROUPS);
		expect(sections.map((section) => section.id)).toEqual(GIT_GROUPS.map((group) => group.id));
	});

	it('「常用」档只有一节「常用命令」', () => {
		const sections = groupCommands(filterCommands(GIT_COMMANDS, '', 'featured', GIT_GROUPS), 'featured', GIT_GROUPS);
		expect(sections).toHaveLength(1);
		expect(sections[0].items.every((cmd) => cmd.featured === true)).toBe(true);
	});
});
