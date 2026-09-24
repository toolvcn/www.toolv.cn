// 命令速查表的编排层（通用）：变量表、分组筛选、搜索词、每条命令选中的备选写法、参数预设。
//
// 三个命令速查工具（docker / git / linux）共用这一个类，各自在 `core/store.svelte.ts` 里
// 拿自己的数据 new 一个实例并导出单例 —— 状态收在一处（与 STRUCTURE §0「共享状态写成类、
// 模块顶层导出实例」同一口径），但每个工具仍有自己的 store 文件，读代码时知道去哪找。
//
// 参数预设（`presets` 及其方法）**三个工具都挂了面板**：它存的就是这里的 `vars`，
// 读写只能由持有它的这个类做，所以逻辑留在这里、面板由各工具页自己绑定（见各工具的 `ui/PresetPanel`）。
import { toast } from '$lib/ui/toast.svelte';
import {
	collectFilledVars,
	filterCommands,
	groupCommands,
	parseCheatsheetPresets,
	resolveVars,
	serializeCheatsheetPresets
} from '$lib/utils/command-cheatsheet';
import type {
	CheatsheetCommand,
	CheatsheetFilter,
	CheatsheetGroup,
	CheatsheetPreset,
	CheatsheetSection,
	CheatsheetVarDef
} from '$lib/utils/command-cheatsheet';

export class CheatsheetStore {
	/** 本工具的命令表与分组（构造时注入） */
	readonly commands: CheatsheetCommand[];
	readonly groups: CheatsheetGroup[];
	readonly varDefs: CheatsheetVarDef[];

	/**
	 * 分组筛选。默认「全部」—— 整张表都在 SSR 的 HTML 里（利于 SEO 与首屏），
	 * 想只看高频命令再点「常用」。
	 */
	filter = $state<CheatsheetFilter>('all');
	query = $state('');
	/** 用户填的占位符值；留空即回落示例值（回落逻辑在 resolveVars） */
	vars = $state<Record<string, string>>({});
	/** 每条命令选中的备选写法下标，key 是命令 id。0 = 主模板，`i + 1` = `variants[i]` */
	variantIndex = $state<Record<string, number>>({});
	/** 「更多变量」是否展开 */
	showMoreVars = $state(false);
	/**
	 * 参数预设：保存下来的变量值。预设面板是各工具页自己决定挂不挂的（见各工具的 `ui/PresetPanel`），
	 * 没挂面板的工具这份状态一直空着。
	 */
	presets = $state<CheatsheetPreset[]>([]);
	/** 预设名称输入框的值 */
	presetName = $state('');
	/** 预设自增 id（keyed each 的 key；导入 / 恢复时重新分配） */
	#presetSeq = 0;

	/**
	 * 派生值一律用 **getter 而不是 `$derived` 字段**：`commands` / `groups` / `varDefs` 是构造参数，
	 * 在构造体里才赋值，而 `$derived` 字段的初始化早于构造体执行 —— 写成字段会报
	 * 「used before its initialization」。getter 是惰性的，取值时数据已就位；
	 * 里面读的 `$state` 字段在模板 / `$derived` 中被读取时照常被追踪。
	 */

	/** 补全后的变量表：每个键都有值，复制出来的命令不会残留 `{{...}}` */
	get effectiveVars(): Record<string, string> {
		return resolveVars(this.vars, this.varDefs);
	}

	/**
	 * 用户**填了值的**变量（键 → 去空白后的值；留空的会回落示例值，不算）。
	 * 两处共用：命令列表靠它给「你填的那几个值」加底色（不这样分，用户分不清哪些是自己填的），
	 * 保存预设靠它只存填过的键。口径只有一份，在 `collectFilledVars`。
	 */
	get filledVars(): Record<string, string> {
		return collectFilledVars(this.vars, this.varDefs);
	}

	get sections(): CheatsheetSection[] {
		return groupCommands(filterCommands(this.commands, this.query, this.filter, this.groups), this.filter, this.groups);
	}

	get total(): number {
		return this.sections.reduce((sum, section) => sum + section.items.length, 0);
	}

	constructor(commands: CheatsheetCommand[], groups: CheatsheetGroup[], varDefs: CheatsheetVarDef[]) {
		this.commands = commands;
		this.groups = groups;
		this.varDefs = varDefs;
		// 初值全留空：输入框显示 placeholder（就是示例值），命令则回落到同一份示例值
		this.vars = Object.fromEntries(varDefs.map((def) => [def.key, '']));
	}

	setFilter(filter: CheatsheetFilter): void {
		this.filter = filter;
	}

	setQuery(query: string): void {
		this.query = query;
	}

	clearQuery(): void {
		this.query = '';
	}

	setVar(key: string, value: string): void {
		this.vars[key] = value;
	}

	/** 清空所有输入框（命令随即回落到示例值） */
	resetVars(): void {
		for (const def of this.varDefs) this.vars[def.key] = '';
	}

	toggleMoreVars(): void {
		this.showMoreVars = !this.showMoreVars;
	}

	setVariant(id: string, index: number): void {
		this.variantIndex[id] = index;
	}

	/**
	 * 当前生效的模板。下标约定：**0 = 主模板**，`i + 1` = `variants[i]` ——
	 * 这样 chips 的第一个「默认」不用在数据里再抄一份主模板。
	 */
	templateOf(cmd: CheatsheetCommand): string {
		const index = this.variantIndex[cmd.id] ?? 0;
		if (index === 0) return cmd.template;
		return cmd.variants?.[index - 1]?.template ?? cmd.template;
	}

	variantIndexOf(cmd: CheatsheetCommand): number {
		return this.variantIndex[cmd.id] ?? 0;
	}

	// ---------------------------------------------------------------- 参数预设

	/** 把当前变量存成一条预设；名称必填，且至少要填一个变量 */
	savePreset(): void {
		const name = this.presetName.trim();
		if (name === '') {
			toast.show('请先填写预设名称', true);
			return;
		}
		const vars = this.filledVars;
		if (Object.keys(vars).length === 0) {
			toast.show('还没填任何变量，存下来跟示例值一样', true);
			return;
		}
		this.presets = [...this.presets, { id: ++this.#presetSeq, name, vars }];
		this.presetName = '';
		toast.show(`已保存参数预设「${name}」`);
	}

	deletePreset(id: number): void {
		this.presets = this.presets.filter((preset) => preset.id !== id);
		toast.show('已删除预设');
	}

	/** 把预设回填到变量条：没存过的变量一律清空 —— 预设是完整快照，不是往当前输入上叠 */
	applyPreset(id: number): void {
		const preset = this.presets.find((item) => item.id === id);
		if (!preset) return;
		for (const def of this.varDefs) this.vars[def.key] = preset.vars[def.key] ?? '';
		toast.show(`已应用预设「${preset.name}」`);
	}

	/** 预设导出文本（JSON），供下载 */
	get presetsText(): string {
		return serializeCheatsheetPresets(this.presets);
	}

	/** 导入预设文本：校验通过则合并进列表，失败用 toast 告知原因 */
	importPresetsText(text: string): void {
		const parsed = parseCheatsheetPresets(text);
		if (!parsed.ok) {
			toast.show(`导入失败：${parsed.error}`, true);
			return;
		}
		this.presets = [...this.presets, ...parsed.presets.map((preset) => ({ ...preset, id: ++this.#presetSeq }))];
		toast.show(`已导入 ${parsed.presets.length} 条预设`);
	}

	/** 从 localStorage 恢复预设（`+page.svelte` 在挂载时调用）；id 重新分配 */
	restorePresets(presets: CheatsheetPreset[]): void {
		this.presets = presets.map((preset) => ({ ...preset, id: ++this.#presetSeq }));
	}
}
