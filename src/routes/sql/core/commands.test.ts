// SQL 语句表的体检 + 搜索 / 分组的口径冒烟。共用逻辑本身在 $lib 那份单测里，
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
import { SQL_COMMANDS, SQL_GROUPS } from './commands.ts';

describe('SQL 语句数据', () => {
	it('自洽：id 不重复、分组都存在、占位符都有定义且都被用到、危险语句都写了 note', () => {
		expect(validateCheatsheetData(SQL_COMMANDS, VAR_DEFS, SQL_GROUPS)).toEqual([]);
	});

	it('语句量与「常用」档都有一定规模', () => {
		expect(SQL_COMMANDS.length).toBeGreaterThanOrEqual(50);
		expect(SQL_COMMANDS.filter((cmd) => cmd.featured).length).toBeGreaterThanOrEqual(12);
	});

	it('九类分组每组都有语句', () => {
		expect(SQL_GROUPS).toHaveLength(9);
		const used = new Set(SQL_COMMANDS.map((cmd) => cmd.group));
		expect(SQL_GROUPS.every((group) => used.has(group.id))).toBe(true);
	});

	it('危险语句成组存在（删表 / 清空 / 删列 / 递归 CTE / 锁行 / 杀会话）', () => {
		const dangers = SQL_COMMANDS.filter((cmd) => cmd.danger).map((cmd) => cmd.id);
		expect(dangers).toEqual(
			expect.arrayContaining(['d-drop', 'd-truncate', 'd-alter-drop', 'q-recursive', 't-lock-row', 'p-kill'])
		);
		expect(SQL_COMMANDS.filter((cmd) => cmd.danger === 'destructive').every((cmd) => (cmd.note ?? '') !== '')).toBe(
			true
		);
	});

	it('按默认示例值渲染后不残留任何占位符', () => {
		const vars = resolveVars({}, VAR_DEFS);
		const leftovers = new Set<string>();
		for (const cmd of SQL_COMMANDS) {
			for (const template of [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)]) {
				if (renderCommand(template, vars).includes('{{')) leftovers.add(cmd.id);
			}
		}
		expect([...leftovers]).toEqual([]);
	});

	it('搜索能命中中文动作词、英文关键字与分组名', () => {
		const ids = (query: string) => filterCommands(SQL_COMMANDS, query, 'all', SQL_GROUPS).map((cmd) => cmd.id);
		expect(ids('慢查询')).toContain('p-slow');
		expect(ids('join')).toContain('j-inner');
		expect(ids('删表')).toContain('d-drop');
		expect(ids('zzz-没有这条')).toEqual([]);
	});

	it('「全部」档的分节顺序与分组表一致；「常用」档只有一节', () => {
		expect(groupCommands(SQL_COMMANDS, 'all', SQL_GROUPS).map((section) => section.id)).toEqual(
			SQL_GROUPS.map((group) => group.id)
		);
		const featured = groupCommands(filterCommands(SQL_COMMANDS, '', 'featured', SQL_GROUPS), 'featured', SQL_GROUPS);
		expect(featured).toHaveLength(1);
	});
});
