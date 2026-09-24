<script lang="ts">
	// 参数预设面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel，这里只把 store 与四处文案接上。
	//
	// 一条预设 = 一组变量值（容器名 / 镜像 / 端口…），点条目回填到变量条，下面所有命令跟着变。
	// localStorage 持久化在 +page.svelte（全站唯一的副作用处）。
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import type { CheatsheetPreset } from '$lib/utils/command-cheatsheet';
	import { dockerStore } from '../core/store.svelte.ts';

	/** 主要变量（常驻工具条那个，就是容器 ID / 名称）—— 建工具时第一个定义即为它 */
	const primaryKey = dockerStore.varDefs.find((def) => !def.secondary)?.key ?? '';

	/**
	 * 徽章放主要变量的值，一眼看出这条是给哪个容器用的；没存它就标「示例」——
	 * 预设至少填了一个变量，但填的不一定是主要那个（比如只填了镜像）。
	 */
	function badgeText(preset: CheatsheetPreset): string {
		return preset.vars[primaryKey] || '示例';
	}

	/** 摘要按变量定义顺序列「标签: 值」：比一串裸值好认，也看得出这条存了哪几个参数 */
	function summaryText(preset: CheatsheetPreset): string {
		const parts: string[] = [];
		for (const def of dockerStore.varDefs) {
			const value = preset.vars[def.key];
			if (value) parts.push(`${def.label}: ${value}`);
		}
		return parts.join(' · ');
	}
</script>

<PresetPanel
	idPrefix="docker"
	presets={dockerStore.presets}
	bind:name={dockerStore.presetName}
	exportFileName="docker-presets.json"
	exportText={dockerStore.presetsText}
	onsave={() => dockerStore.savePreset()}
	onapply={(id) => dockerStore.applyPreset(id)}
	ondelete={(id) => dockerStore.deletePreset(id)}
	onimport={(text) => dockerStore.importPresetsText(text)}
	{badgeText}
	{summaryText}
	emptyHint="还没有预设：在变量条里填好容器名 / 镜像等参数，起个名字点「保存」，下次一键回填；也可导出 / 导入 JSON 备份。"
/>
