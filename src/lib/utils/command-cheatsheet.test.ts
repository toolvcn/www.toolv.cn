import { describe, expect, it } from 'vitest';
import {
	collectFilledVars,
	filterCommands,
	groupCommands,
	parseCheatsheetPresets,
	renderCommand,
	resolveVars,
	serializeCheatsheetPresets,
	tokenizeCommand,
	validateCheatsheetData
} from './command-cheatsheet.ts';
import type { CheatsheetCommand, CheatsheetGroup, CheatsheetPreset, CheatsheetVarDef } from './command-cheatsheet.ts';

const VARS_DEFS: CheatsheetVarDef[] = [
	{ key: 'container', label: '容器', sample: 'my-nginx' },
	{ key: 'image', label: '镜像', sample: 'nginx:1.27', secondary: true }
];

const GROUPS: CheatsheetGroup[] = [
	{ id: 'container', name: '容器' },
	{ id: 'clean', name: '清理' }
];

const COMMANDS: CheatsheetCommand[] = [
	{
		id: 'c-exec',
		group: 'container',
		template: 'docker exec -it {{container}} /bin/bash',
		desc: '进入容器开 shell',
		keywords: ['进入容器', 'exec', 'bash'],
		featured: true,
		variants: [{ label: '/bin/sh', template: 'docker exec -it {{container}} /bin/sh' }]
	},
	{
		id: 'c-run',
		group: 'container',
		template: 'docker run -d {{image}}',
		desc: '后台跑一个容器',
		keywords: ['启动', 'run', '后台'],
		featured: true
	},
	{
		id: 'k-prune',
		group: 'clean',
		template: 'docker system prune -f',
		desc: '清理已停止的容器与悬空镜像',
		keywords: ['清理', 'prune', '释放空间'],
		danger: 'warn',
		note: '默认不动卷'
	}
];

const VARS = { container: 'my-nginx', image: 'nginx:1.27' };

describe('resolveVars', () => {
	it('留空（或只有空白）的键回落到示例值', () => {
		expect(resolveVars({ container: '   ' }, VARS_DEFS).container).toBe('my-nginx');
	});

	it('填了就用填的值，去掉首尾空白', () => {
		expect(resolveVars({ container: '  web-1  ' }, VARS_DEFS).container).toBe('web-1');
	});

	it('每个定义的键都有值，不会留下 undefined', () => {
		const resolved = resolveVars({}, VARS_DEFS);
		expect(VARS_DEFS.filter((def) => typeof resolved[def.key] !== 'string')).toEqual([]);
	});
});

describe('collectFilledVars', () => {
	it('留空 / 只有空白 / 没定义的键都不收，值去首尾空白', () => {
		expect(collectFilledVars({ container: '  web-1  ', image: '   ', nope: 'x' }, VARS_DEFS)).toEqual({
			container: 'web-1'
		});
	});

	it('全留空时是空对象', () => {
		expect(collectFilledVars({}, VARS_DEFS)).toEqual({});
	});
});

describe('renderCommand', () => {
	it('替换认得的占位符', () => {
		expect(renderCommand('docker exec -it {{container}} /bin/bash', VARS)).toBe('docker exec -it my-nginx /bin/bash');
	});

	it('占位符两侧带空格也认', () => {
		expect(renderCommand('docker stop {{ container }}', VARS)).toBe('docker stop my-nginx');
	});

	it('不认识的键整段原样保留（Go 模板那种）', () => {
		expect(renderCommand("docker inspect -f '{{.State.Status}}' {{container}}", VARS)).toBe(
			"docker inspect -f '{{.State.Status}}' my-nginx"
		);
	});

	it('同一占位符出现多次都会替换', () => {
		expect(renderCommand('cp {{container}}:/a {{container}}:/b # {{container}}', VARS)).toBe(
			'cp my-nginx:/a my-nginx:/b # my-nginx'
		);
	});
});

describe('tokenizeCommand', () => {
	it('变量值单独成段，供渲染时上色', () => {
		expect(tokenizeCommand('docker stop {{container}}', VARS)).toEqual([
			{ text: 'docker stop ', varKey: null, filled: false },
			{ text: 'my-nginx', varKey: 'container', filled: false }
		]);
	});

	it('不认识的花括号并入纯文本段，不产生变量段', () => {
		expect(tokenizeCommand("inspect -f '{{.State.ExitCode}}'", VARS)).toEqual([
			{ text: "inspect -f '{{.State.ExitCode}}'", varKey: null, filled: false }
		]);
	});

	it('传了 filledVars 的变量段标成「用户填的」，其余仍是示例值', () => {
		const segments = tokenizeCommand('docker run {{container}} {{image}}', VARS, { container: 'my-nginx' });
		expect(segments.filter((segment) => segment.varKey !== null)).toEqual([
			{ text: 'my-nginx', varKey: 'container', filled: true },
			{ text: 'nginx:1.27', varKey: 'image', filled: false }
		]);
	});

	it('各段拼回去等于 renderCommand 的结果', () => {
		const template = 'cp {{container}}:/a ./ # {{.Id}}';
		const joined = tokenizeCommand(template, VARS)
			.map((segment) => segment.text)
			.join('');
		expect(joined).toBe(renderCommand(template, VARS));
	});
});

describe('filterCommands', () => {
	it('按分组筛选只返回该组', () => {
		const items = filterCommands(COMMANDS, '', 'container', GROUPS);
		expect(items.map((cmd) => cmd.id)).toEqual(['c-exec', 'c-run']);
	});

	it('常用档只返回带 featured 的命令', () => {
		const items = filterCommands(COMMANDS, '', 'featured', GROUPS);
		expect(items.every((cmd) => cmd.featured === true)).toBe(true);
	});

	it('搜索命中说明、别名与分组名', () => {
		const ids = (query: string) => filterCommands(COMMANDS, query, 'all', GROUPS).map((cmd) => cmd.id);
		expect(ids('进入容器')).toEqual(['c-exec']);
		expect(ids('prune')).toEqual(['k-prune']);
		expect(ids('清理')).toEqual(['k-prune']);
		expect(ids('zzz-没有这条')).toEqual([]);
	});

	it('筛选与搜索是「与」的关系', () => {
		expect(filterCommands(COMMANDS, 'prune', 'container', GROUPS)).toEqual([]);
		expect(filterCommands(COMMANDS, 'prune', 'clean', GROUPS).map((cmd) => cmd.id)).toEqual(['k-prune']);
	});
});

describe('groupCommands', () => {
	it('「全部」档按分组顺序切节，不返回空节', () => {
		const sections = groupCommands(filterCommands(COMMANDS, 'prune', 'all', GROUPS), 'all', GROUPS);
		expect(sections.map((section) => section.id)).toEqual(['clean']);
	});

	it('「全部」档的节顺序与分组表一致', () => {
		const sections = groupCommands(COMMANDS, 'all', GROUPS);
		expect(sections.map((section) => section.id)).toEqual(['container', 'clean']);
	});

	it('「常用」档只有一节「常用命令」', () => {
		const sections = groupCommands(filterCommands(COMMANDS, '', 'featured', GROUPS), 'featured', GROUPS);
		expect(sections).toHaveLength(1);
		expect(sections[0].name).toBe('常用命令');
	});
});

describe('validateCheatsheetData', () => {
	it('自洽的数据没有问题', () => {
		expect(validateCheatsheetData(COMMANDS, VARS_DEFS, GROUPS)).toEqual([]);
	});

	it('抓出 id 重复、分组拼错、未定义占位符、危险命令缺 note、空分组', () => {
		const broken: CheatsheetCommand[] = [
			{ id: 'dup', group: 'container', template: 'echo {{nope}}', desc: '占位符没定义', keywords: ['x'] },
			{ id: 'dup', group: 'container', template: 'echo 1', desc: 'id 撞车', keywords: ['x'] },
			{ id: 'bad-group', group: 'nope', template: 'echo {{container}}', desc: '分组拼错', keywords: ['x'] },
			{
				id: 'no-note',
				group: 'container',
				template: 'echo {{container}}',
				desc: '危险但没 note',
				keywords: ['x'],
				danger: 'warn'
			}
		];
		const problems = validateCheatsheetData(broken, VARS_DEFS, GROUPS);
		expect(problems).toContain('id 重复：dup');
		expect(problems).toContain('bad-group 的分组未在分组表里：nope');
		expect(problems).toContain('dup 用了未定义的占位符：{{nope}}');
		expect(problems).toContain('no-note 是危险命令但没写 note（危险命令必须说明代价）');
		expect(problems).toContain('分组下没有任何命令：clean');
		expect(problems).toContain('占位符定义了但没人用：{{image}}');
	});
});

describe('serializeCheatsheetPresets / parseCheatsheetPresets', () => {
	const PRESETS: CheatsheetPreset[] = [
		{ id: 7, name: '生产 web', vars: { container: 'web-prod', image: 'nginx:1.27' } },
		{ id: 8, name: '本地测试', vars: { container: 'web-dev' } }
	];

	it('导出文本不含本地 id，且能原样解析回来', () => {
		const text = serializeCheatsheetPresets(PRESETS);
		expect(text).not.toContain('"id"');
		expect(parseCheatsheetPresets(text)).toEqual({
			ok: true,
			presets: [
				{ id: 0, name: '生产 web', vars: { container: 'web-prod', image: 'nginx:1.27' } },
				{ id: 0, name: '本地测试', vars: { container: 'web-dev' } }
			]
		});
	});

	it('名称去首尾空白（导出与导入两侧都去）', () => {
		const parsed = parseCheatsheetPresets('[{"name":"  带空格  ","vars":{"container":"web"}}]');
		expect(parsed.ok && parsed.presets[0].name).toBe('带空格');
	});

	it('非 JSON、非数组、空名称、变量不是键值对象都整份拒绝', () => {
		expect(parseCheatsheetPresets('不是 JSON').ok).toBe(false);
		expect(parseCheatsheetPresets('{}').ok).toBe(false);
		expect(parseCheatsheetPresets('[{"name":"  ","vars":{}}]').ok).toBe(false);
		expect(parseCheatsheetPresets('[{"name":"a","vars":["x"]}]').ok).toBe(false);
	});

	it('变量值只保留字符串，其余键丢掉而不拒绝整份', () => {
		expect(parseCheatsheetPresets('[{"name":"a","vars":{"container":"web","n":3,"ok":true}}]')).toEqual({
			ok: true,
			presets: [{ id: 0, name: 'a', vars: { container: 'web' } }]
		});
	});
});
