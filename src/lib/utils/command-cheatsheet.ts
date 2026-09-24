// 命令速查表的通用纯逻辑：占位符替换 / 分词高亮 / 搜索 / 分组 / 参数预设序列化 / 数据体检。
//
// 被 docker / git / linux 三个命令速查工具共用（STRUCTURE §2 C 的「两个以上工具共用才提升」），
// 所以放在 `$lib/utils/` 而不是某个工具的 `core/` 里。**不依赖 DOM、不 import 界面层**，可在 node 端单测。
//
// 每个工具只负责提供三样数据：分组元数据（CheatsheetGroup）、命令表（CheatsheetCommand）、
// 占位符定义（CheatsheetVarDef）；其余（替换、搜索、分组、渲染用的分词）全在这里。

// ------------------------------------------------------------------ 数据形状

/** 可替换的占位符：模板里写 `{{key}}` */
export interface CheatsheetVarDef {
	/** 占位符键名 */
	key: string;
	/** 输入框前的可见标签 */
	label: string;
	/**
	 * 默认示例值。输入框留空时**回落到它** —— 保证每条命令随时可复制即用，
	 * 不会在命令里露出 `{{xxx}}` 这种没被替换的原文。
	 */
	sample: string;
	/** 悬浮说明（值该从哪来） */
	hint?: string;
	/** true = 收在「更多变量」里，首屏只留主要的那个 */
	secondary?: boolean;
}

/** 一条命令的备选写法（如 `/bin/bash` ↔ `/bin/sh`）：行内小 chips 切换 */
export interface CheatsheetCommandVariant {
	/** chip 上显示的字 */
	label: string;
	/** 换用的模板，占位符写法与主模板一致 */
	template: string;
}

/**
 * 危险等级。两条都只是**标记 + 提示**，不做弹窗确认 ——
 * 这里复制的是命令文本，真正执行发生在用户自己的终端里，拦在复制这一步没有意义。
 */
export type CheatsheetDanger = 'warn' | 'destructive';

export interface CheatsheetCommand {
	/** 稳定 id，作 keyed each 的 key（**不能用命令文本** —— 文本会随变量变） */
	id: string;
	/** 分组 id，必须在 CheatsheetGroup 里出现过 */
	group: string;
	/** 命令模板，占位符写 `{{变量名}}`；键名不认识的（如 Go 模板 `{{.State.Status}}`）原样保留 */
	template: string;
	/** 一句话说明这条命令干什么 */
	desc: string;
	/** 搜索别名：中文动作词 + 英文子命令 + 常见说法 */
	keywords: string[];
	variants?: CheatsheetCommandVariant[];
	/** 「常用」标记：「常用」那一档筛的就是它 */
	featured?: boolean;
	danger?: CheatsheetDanger;
	/** 坑与平台差异 */
	note?: string;
}

export interface CheatsheetGroup {
	id: string;
	name: string;
}

/**
 * 筛选值：两个虚拟档 + 各工具自己的分组 id（分组 id 是各工具的字面量联合，这里放成 string）。
 * `'all'` 全部、`'featured'` 常用，其余按分组 id 精确匹配。
 */
export type CheatsheetFilter = string;

// ------------------------------------------------------------------ 占位符替换

/** 占位符：`{{` + 纯单词字符 + `}}`，两侧允许空格 */
const PLACEHOLDER = '\\{\\{\\s*([A-Za-z0-9_]+)\\s*\\}\\}';

/** 一段渲染后的命令文本；`varKey` 非空表示它来自某个占位符，渲染时要上色 */
export interface CommandSegment {
	text: string;
	varKey: string | null;
	/**
	 * 这个变量值是不是**用户自己填的**（false = 输入框留空、用的是回落的示例值）。
	 *
	 * 存在的意义：默认状态下所有占位符都会被替换成示例值，两者如果长得一样，
	 * 用户就分不清「哪几个是我填的」。渲染时给 `filled` 的加淡底、回落的只有绿字。
	 */
	filled: boolean;
}

/**
 * 把变量表补全成「每个键都有值」的完整表：输入框留空（或只有空白）时**回落到示例值**。
 *
 * 为什么要回落而不是留空：留空会让命令里露出 `{{container}}` 这种原文，
 * 复制到终端只会报错；回落到示例值则保证任何一条命令随时可复制即用。
 */
export function resolveVars(raw: Record<string, string>, defs: CheatsheetVarDef[]): Record<string, string> {
	const resolved: Record<string, string> = {};
	for (const def of defs) {
		const value = (raw[def.key] ?? '').trim();
		resolved[def.key] = value === '' ? def.sample : value;
	}
	return resolved;
}

/**
 * 用户**填了值的**变量：键 → 去首尾空白后的值（留空 / 只有空白的不收）。
 *
 * 两个用途共用这一份口径：① 保存预设时只存这些键；② 命令列表靠它把「你填的」标得更重。
 * 返回的是普通对象而不是 `Set` —— 成员判断用 `Object.hasOwn` 就够，
 * 而在 `.svelte.ts` 里 `new Set(...)` 会触发 `svelte/prefer-svelte-reactivity`
 * （Svelte 的响应式不追踪原生 Set 的增删），这里本来也不需要响应式集合。
 */
export function collectFilledVars(vars: Record<string, string>, defs: CheatsheetVarDef[]): Record<string, string> {
	const filled: Record<string, string> = {};
	for (const def of defs) {
		const value = (vars[def.key] ?? '').trim();
		if (value !== '') filled[def.key] = value;
	}
	return filled;
}

/**
 * 把模板切成「纯文本」与「变量值」两种片段，供渲染成 `<span>` 上色。
 * **不做 `{@html}`** —— 变量值是用户自己填的，拼 HTML 有注入风险。
 *
 * `filledVars` 是「用户填了值的变量」（见 `collectFilledVars`），进来只为给片段打
 * `filled` 标（见 `CommandSegment`）；不传就全是 `filled: false`（等价于「没填过任何东西」）。
 */
export function tokenizeCommand(
	template: string,
	vars: Record<string, string>,
	filledVars: Record<string, string> = {}
): CommandSegment[] {
	const segments: CommandSegment[] = [];
	const pattern = new RegExp(PLACEHOLDER, 'g');
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(template)) !== null) {
		const key = match[1];
		// 不认识的键（Go 模板等）整段跳过，交给最后那段纯文本一起带走
		if (!Object.hasOwn(vars, key)) continue;
		if (match.index > cursor) segments.push({ text: template.slice(cursor, match.index), varKey: null, filled: false });
		segments.push({ text: vars[key], varKey: key, filled: Object.hasOwn(filledVars, key) });
		cursor = match.index + match[0].length;
	}

	if (cursor < template.length) segments.push({ text: template.slice(cursor), varKey: null, filled: false });
	return segments;
}

/** 渲染成最终命令文本（复制走的就是它） */
export function renderCommand(template: string, vars: Record<string, string>): string {
	return tokenizeCommand(template, vars)
		.map((segment) => segment.text)
		.join('');
}

// ------------------------------------------------------------------ 搜索与分组

/** 拼检索串：命令本体、说明、别名、分组名都参与匹配 */
function haystack(cmd: CheatsheetCommand, groupNames: Map<string, string>): string {
	return [cmd.template, cmd.desc, cmd.keywords.join(' '), groupNames.get(cmd.group) ?? ''].join(' ').toLowerCase();
}

/** 分组 id → 名称 */
export function groupNameMap(groups: CheatsheetGroup[]): Map<string, string> {
	return new Map(groups.map((group) => [group.id, group.name]));
}

/** 小写包含匹配；空查询返回该档全量。筛选与搜索是「与」的关系（先按分组筛，再按词搜） */
export function filterCommands(
	commands: CheatsheetCommand[],
	query: string,
	filter: CheatsheetFilter,
	groups: CheatsheetGroup[]
): CheatsheetCommand[] {
	const q = query.trim().toLowerCase();
	const names = groupNameMap(groups);
	return commands.filter((cmd) => {
		if (filter === 'featured') {
			if (!cmd.featured) return false;
		} else if (filter !== 'all' && cmd.group !== filter) {
			return false;
		}
		return q === '' || haystack(cmd, names).includes(q);
	});
}

export interface CheatsheetSection {
	id: string;
	name: string;
	items: CheatsheetCommand[];
}

/**
 * 切成渲染用的分节。`featured` 档只有一节「常用命令」，其余按分组顺序分节，
 * 空节不返回（搜索后某些组会整组落空）。
 */
export function groupCommands(
	items: CheatsheetCommand[],
	filter: CheatsheetFilter,
	groups: CheatsheetGroup[]
): CheatsheetSection[] {
	if (filter === 'featured') return [{ id: 'featured', name: '常用命令', items }];
	return groups
		.map((group) => ({ id: group.id, name: group.name, items: items.filter((item) => item.group === group.id) }))
		.filter((section) => section.items.length > 0);
}

// ------------------------------------------------------------------ 数据体检

/**
 * 检查一份命令数据是否自洽，返回问题清单（空数组 = 没问题）。
 *
 * 存在的意义：命令表是**手写的大表格**，最容易出的错就是 id 撞车（keyed each 的 key 重复）、
 * 分组拼错、模板里写了一个没定义的占位符（渲染出来是原样的 `{{xxx}}`）。
 * 这三类错类型系统都看不出来，所以每个工具的单测都拿它断言一次。
 */
export function validateCheatsheetData(
	commands: CheatsheetCommand[],
	varDefs: CheatsheetVarDef[],
	groups: CheatsheetGroup[]
): string[] {
	const problems: string[] = [];
	const varKeys = new Set(varDefs.map((def) => def.key));
	const groupIds = new Set(groups.map((group) => group.id));
	const seenIds = new Set<string>();
	const seenGroups = new Set<string>();

	for (const cmd of commands) {
		if (seenIds.has(cmd.id)) problems.push(`id 重复：${cmd.id}`);
		seenIds.add(cmd.id);
		seenGroups.add(cmd.group);

		if (!groupIds.has(cmd.group)) problems.push(`${cmd.id} 的分组未在分组表里：${cmd.group}`);
		if (cmd.desc.trim() === '') problems.push(`${cmd.id} 缺少说明`);
		if (cmd.keywords.length === 0) problems.push(`${cmd.id} 缺少搜索别名`);
		if (cmd.danger !== undefined && cmd.note === undefined) {
			problems.push(`${cmd.id} 是危险命令但没写 note（危险命令必须说明代价）`);
		}

		for (const template of [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)]) {
			for (const match of template.matchAll(new RegExp(PLACEHOLDER, 'g'))) {
				if (!varKeys.has(match[1])) problems.push(`${cmd.id} 用了未定义的占位符：{{${match[1]}}}`);
			}
		}
	}

	for (const group of groups) {
		if (!seenGroups.has(group.id)) problems.push(`分组下没有任何命令：${group.id}`);
	}
	for (const key of varKeys) {
		if (!commands.some((cmd) => templatesOf(cmd).some((template) => template.includes(`{{${key}}}`)))) {
			problems.push(`占位符定义了但没人用：{{${key}}}`);
		}
	}

	return problems;
}

/** 一条命令的全部模板：主模板 + 备选写法 */
function templatesOf(cmd: CheatsheetCommand): string[] {
	return [cmd.template, ...(cmd.variants ?? []).map((variant) => variant.template)];
}

// ------------------------------------------------------------------ 参数预设

/**
 * 一条参数预设：一组变量值 + 名字。
 *
 * **只存变量值**，不存分组筛选 / 搜索词 / 备选写法（那些是「当前在看什么」，不是「这套参数」）。
 * `id` 只用于列表渲染的 key，不进导出文件 —— 导入 / 恢复时由 store 重新分配。
 */
export interface CheatsheetPreset {
	/** 自增 id，仅用于列表渲染 key */
	id: number;
	name: string;
	/** 填了值的变量（键名同 `CheatsheetVarDef.key`）；留空的变量不在这里，应用时回落到空串 */
	vars: Record<string, string>;
}

/**
 * 预设导出文本：JSON 美化输出，可直接下载成文件；**不含 id**（它是本地的渲染标记）。
 */
export function serializeCheatsheetPresets(presets: CheatsheetPreset[]): string {
	const file = presets.map(({ name, vars }) => ({ name, vars }));
	return JSON.stringify(file, null, 2);
}

/**
 * 解析导入 / 恢复用的预设文本。
 *
 * 与命令数据同样从严：名称缺失、变量不是键值对象都算「文件坏了」，整份拒绝
 * （不把半套数据交出去）。**变量值只收字符串** —— 非字符串的键直接丢掉，
 * 而不是拒绝整份：多出来的怪键多半是别的工具导出的文件里夹带的，与「键名不认识就跳过」同一口径。
 */
export function parseCheatsheetPresets(
	text: string
): { ok: true; presets: CheatsheetPreset[] } | { ok: false; error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: '文件不是合法的 JSON' };
	}
	if (!Array.isArray(raw)) return { ok: false, error: '文件内容应为预设数组' };

	const out: CheatsheetPreset[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) return { ok: false, error: '存在非对象的预设条目' };
		const preset = item as { name?: unknown; vars?: unknown };
		if (typeof preset.name !== 'string' || preset.name.trim() === '') {
			return { ok: false, error: '存在没有名称的预设' };
		}
		if (typeof preset.vars !== 'object' || preset.vars === null || Array.isArray(preset.vars)) {
			return { ok: false, error: `预设「${preset.name.trim()}」的变量不是键值对象` };
		}
		const vars: Record<string, string> = {};
		for (const [key, value] of Object.entries(preset.vars)) {
			if (typeof value === 'string') vars[key] = value;
		}
		out.push({ id: 0, name: preset.name.trim(), vars });
	}
	return { ok: true, presets: out };
}
