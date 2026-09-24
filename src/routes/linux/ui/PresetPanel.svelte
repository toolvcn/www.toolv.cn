<script lang="ts">
	// 参数预设面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel，这里只把 store 与四处文案接上。
	//
	// 一条预设 = 一组变量值（目标路径 / 文件名 / 服务名…），点条目回填到变量条，所有命令跟着变。
	// localStorage 持久化在 +page.svelte（全站唯一的副作用处）。
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import type { CheatsheetPreset } from '$lib/utils/command-cheatsheet';
	import { linuxStore } from '../core/store.svelte.ts';

	/** 主要变量（常驻工具条那个，就是目标路径）—— 建工具时第一个定义即为它 */
	const primaryKey = linuxStore.varDefs.find((def) => !def.secondary)?.key ?? '';

	/**
	 * 徽章放主要变量的值，一眼看出这条是给哪个路径用的；没存它就标「示例」——
	 * 预设至少填了一个变量，但填的不一定是主要那个（比如只填了服务名）。
	 */
	function badgeText(preset: CheatsheetPreset): string {
		return preset.vars[primaryKey] || '示例';
	}

	/** 摘要按变量定义顺序列「标签: 值」：比一串裸值好认，也看得出这条存了哪几个参数 */
	function summaryText(preset: CheatsheetPreset): string {
		const parts: string[] = [];
		for (const def of linuxStore.varDefs) {
			const value = preset.vars[def.key];
			if (value) parts.push(`${def.label}: ${value}`);
		}
		return parts.join(' · ');
	}
</script>

<PresetPanel
	idPrefix="linux"
	presets={linuxStore.presets}
	bind:name={linuxStore.presetName}
	exportFileName="linux-presets.json"
	exportText={linuxStore.presetsText}
	onsave={() => linuxStore.savePreset()}
	onapply={(id) => linuxStore.applyPreset(id)}
	ondelete={(id) => linuxStore.deletePreset(id)}
	onimport={(text) => linuxStore.importPresetsText(text)}
	{badgeText}
	{summaryText}
	emptyHint="还没有预设：在变量条里填好路径 / 文件名 / 服务名等参数，起个名字点「保存」，下次一键回填；也可导出 / 导入 JSON 备份。"
/>
