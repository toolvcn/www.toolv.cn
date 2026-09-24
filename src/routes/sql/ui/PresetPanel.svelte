<script lang="ts">
	// 参数预设面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel，这里只把 store 与四处文案接上。
	//
	// 一条预设 = 一组变量值（表名 / 字段 / 条件…），点条目回填到变量条，所有语句跟着变。
	// localStorage 持久化在 +page.svelte（全站唯一的副作用处），键与片段分开。
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import type { CheatsheetPreset } from '$lib/utils/command-cheatsheet';
	import { sqlStore } from '../core/store.svelte.ts';

	/** 主要变量（常驻工具条那个，就是表名）—— 建工具时第一个定义即为它 */
	const primaryKey = sqlStore.varDefs.find((def) => !def.secondary)?.key ?? '';

	/**
	 * 徽章放主要变量的值，一眼看出这条预设是给哪张表用的；没存它就标「示例」——
	 * 预设至少填了一个变量，但填的不一定是主要那个（比如只填了索引名）。
	 */
	function badgeText(preset: CheatsheetPreset): string {
		return preset.vars[primaryKey] || '示例';
	}

	/** 摘要按变量定义顺序列「标签: 值」：比一串裸值好认，也看得出这条存了哪几个参数 */
	function summaryText(preset: CheatsheetPreset): string {
		const parts: string[] = [];
		for (const def of sqlStore.varDefs) {
			const value = preset.vars[def.key];
			if (value) parts.push(`${def.label}: ${value}`);
		}
		return parts.join(' · ');
	}
</script>

<PresetPanel
	idPrefix="sql"
	presets={sqlStore.presets}
	bind:name={sqlStore.presetName}
	exportFileName="sql-presets.json"
	exportText={sqlStore.presetsText}
	onsave={() => sqlStore.savePreset()}
	onapply={(id) => sqlStore.applyPreset(id)}
	ondelete={(id) => sqlStore.deletePreset(id)}
	onimport={(text) => sqlStore.importPresetsText(text)}
	{badgeText}
	{summaryText}
	emptyHint="还没有预设：在变量条里填好表名 / 字段 / 条件等参数，起个名字点「保存」，下次一键回填；也可导出 / 导入 JSON 备份。"
/>
