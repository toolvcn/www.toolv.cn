// Linux 命令表的体检 + 搜索 / 分组的口径冒烟。共用逻辑本身在 $lib 那份单测里，
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
import { LINUX_COMMANDS, LINUX_GROUPS } from './commands.ts';

describe('Linux 命令数据', () => {
	it('自洽：id 不重复、分组都存在、占位符都有定义、危险命令都写了 note', () => {
		expect(validateCheatsheetData(LINUX_COMMANDS, VAR_DEFS, LINUX_GROUPS)).toEqual([]);
	});

	it('命令量与「常用」档都有一定规模', () => {
		expect(LINUX_COMMANDS.length).toBeGreaterThanOrEqual(50);
		expect(LINUX_COMMANDS.filter((cmd) => cmd.featured).length).toBeGreaterThanOrEqual(12);
	});

	it('危险命令成组存在（rm / find -delete / sed -i / pkill）', () => {
		const dangers = LINUX_COMMANDS.filter((cmd) => cmd.danger).map((cmd) => cmd.id);
		expect(dangers).toEqual(expect.arrayContaining(['f-rm', 'q-find-delete', 'x-sed-replace', 'o-pkill']));
	});

	it('按默认示例值渲染后不残留任何占位符（`%{http_code}`、`date +%s` 这类不算变量）', () => {
		const vars = resolveVars({}, VAR_DEFS);
		const leftovers = new Set<string>();
		for (const cmd of LINUX_COMMANDS) {
			for (const template of [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)]) {
				if (renderCommand(template, vars).includes('{{')) leftovers.add(cmd.id);
			}
		}
		expect([...leftovers]).toEqual([]);
	});

	it('搜索能命中中文动作词、英文子命令与分组名', () => {
		const ids = (query: string) => filterCommands(LINUX_COMMANDS, query, 'all', LINUX_GROUPS).map((cmd) => cmd.id);
		expect(ids('端口占用')).toContain('o-lsof');
		expect(ids('grep')).toContain('q-grep');
		expect(ids('解压')).toContain('z-tar-x');
		expect(ids('zzz-没有这条')).toEqual([]);
	});

	it('「全部」档的分节顺序与分组表一致，且不返回空节', () => {
		const sections = groupCommands(LINUX_COMMANDS, 'all', LINUX_GROUPS);
		expect(sections.map((section) => section.id)).toEqual(LINUX_GROUPS.map((group) => group.id));
	});

	it('「常用」档只有一节「常用命令」', () => {
		const sections = groupCommands(
			filterCommands(LINUX_COMMANDS, '', 'featured', LINUX_GROUPS),
			'featured',
			LINUX_GROUPS
		);
		expect(sections).toHaveLength(1);
		expect(sections[0].items.every((cmd) => cmd.featured === true)).toBe(true);
	});
});
