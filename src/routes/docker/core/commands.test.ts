// Docker 命令表的体检 + 搜索 / 分组的口径冒烟。共用逻辑本身在 $lib 那份单测里，
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
import { DOCKER_COMMANDS, DOCKER_GROUPS } from './commands.ts';

describe('Docker 命令数据', () => {
	it('自洽：id 不重复、分组都存在、占位符都有定义、危险命令都写了 note', () => {
		expect(validateCheatsheetData(DOCKER_COMMANDS, VAR_DEFS, DOCKER_GROUPS)).toEqual([]);
	});

	it('命令量与「常用」档都有一定规模', () => {
		expect(DOCKER_COMMANDS.length).toBeGreaterThanOrEqual(50);
		expect(DOCKER_COMMANDS.filter((cmd) => cmd.featured).length).toBeGreaterThanOrEqual(12);
	});

	it('按原样默认值渲染后，残留 `{{` 的只可能是 Go 模板那两条', () => {
		// 判据用「渲染后还剩没剩 `{{`」而不是「模板里有没有 `{{.`」：
		// `{{json .State.Health}}` 的键名是 `json`，不含 `{{.`，按字面量筛会漏掉它。
		const vars = resolveVars({}, VAR_DEFS);
		const leftovers = new Set<string>();
		for (const cmd of DOCKER_COMMANDS) {
			for (const template of [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)]) {
				if (renderCommand(template, vars).includes('{{')) leftovers.add(cmd.id);
			}
		}
		// 这两条是**故意**保留的（见 core/commands.ts 头部注释）
		expect([...leftovers].sort()).toEqual(['l-exit-code', 'l-health']);
	});

	it('搜索能命中中文动作词、英文子命令与分组名', () => {
		const ids = (query: string) => filterCommands(DOCKER_COMMANDS, query, 'all', DOCKER_GROUPS).map((cmd) => cmd.id);
		expect(ids('进入容器')).toContain('c-exec-shell');
		expect(ids('exec')).toContain('c-exec-shell');
		expect(ids('磁盘占用')).toContain('r-system-df');
		expect(ids('zzz-没有这条')).toEqual([]);
	});

	it('「全部」档的分节顺序与分组表一致，且不返回空节', () => {
		const sections = groupCommands(DOCKER_COMMANDS, 'all', DOCKER_GROUPS);
		expect(sections.map((section) => section.id)).toEqual(DOCKER_GROUPS.map((group) => group.id));
	});

	it('「常用」档只有一节「常用命令」', () => {
		const sections = groupCommands(
			filterCommands(DOCKER_COMMANDS, '', 'featured', DOCKER_GROUPS),
			'featured',
			DOCKER_GROUPS
		);
		expect(sections).toHaveLength(1);
		expect(sections[0].items.every((cmd) => cmd.featured === true)).toBe(true);
	});
});
