<script lang="ts">
	// 参数预设面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel（跟 http 请求调试共用一件）。
	// 一条预设是整组快照（口径 + 两套输入 + 目标净利率），点条目一键回填；
	// localStorage 持久化在 +page.svelte。
	//
	// **除 JSON 备份外这里还挂一个 CSV 下拉**：JSON 是「原样存回」的备份，
	// CSV 是「拿去横向对比」的 —— 一行一条预设、列里带算出来的结果与利润明细。
	// 整盘与单件的参数集合不同，混一张表会有半数列是空的，所以**口径由用户在下拉里选**，
	// 导出 / 导入都只处理选中的那一种。
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import { presetDetail, presetSummary } from '../core/presets.ts';
	import { roiStore } from '../core/store.svelte.ts';
	import type { RoiMode } from '../core/types.ts';

	/**
	 * CSV 那四项。下拉里**不是「当前值」而是四个动作**（点一下就执行），
	 * 所以 `value` 恒为空串 —— 触发器因此一直显示 `triggerLabel`，菜单里也不会有打勾的项。
	 */
	const CSV_MENU = [
		{
			value: 'export-batch',
			label: '导出整盘预设',
			description: '每行一条整盘预设：参数 + 结果与利润明细'
		},
		{
			value: 'export-unit',
			label: '导出单件预设',
			description: '每行一条单件预设：参数 + 结果与利润明细'
		},
		{
			value: 'import-batch',
			label: '导入整盘预设',
			description: '按整盘口径读参数列，逐条追加为预设'
		},
		{
			value: 'import-unit',
			label: '导入单件预设',
			description: '按单件口径读参数列，逐条追加为预设'
		}
	] as const;

	let csvFile = $state<HTMLInputElement | null>(null);
	/** 导入按哪种口径读列：由菜单里点的是「导入整盘」还是「导入单件」决定 */
	let importMode = $state<RoiMode>('batch');

	function onMenu(value: string): void {
		if (value === 'export-batch') {
			roiStore.exportPresetCsv('batch');
			return;
		}
		if (value === 'export-unit') {
			roiStore.exportPresetCsv('unit');
			return;
		}
		importMode = value === 'import-unit' ? 'unit' : 'batch';
		csvFile?.click();
	}

	function onCsvFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// 清空 value，否则连着选同一个文件不会再触发 change
		input.value = '';
		if (!file) return;
		void file.text().then((text) => roiStore.importPresetCsvText(importMode, text));
	}
</script>

<PresetPanel
	idPrefix="roi"
	presets={roiStore.presets}
	bind:name={roiStore.presetName}
	exportFileName="ecommerce-roi-presets.json"
	exportText={roiStore.presetsText}
	onsave={() => roiStore.savePreset()}
	onapply={(id) => roiStore.applyPreset(id)}
	ondelete={(id) => roiStore.deletePreset(id)}
	onreorder={(dragId, targetId) => roiStore.movePreset(dragId, targetId)}
	onmove={(id, delta) => roiStore.movePresetBy(id, delta)}
	onimport={(text) => void roiStore.importPresetsText(text)}
	badgeText={(preset) => (preset.mode === 'batch' ? '整盘' : '单件')}
	summaryText={(preset) => presetSummary(preset)}
	detailGroups={(preset) => presetDetail(preset)}
	clip={false}
	emptyHint="还没有预设：填好参数后在顶部填个名称点「保存」，整组参数（含口径与目标净利率）就存在本地；也可导出 / 导入文件 —— JSON 是原样备份，CSV 一行一条、带算出来的结果，方便横向对比。"
>
	{#snippet extraActions()}
		<Dropdown
			label="CSV 导出与导入：一行一条预设，含参数与算出来的结果"
			triggerLabel="CSV"
			options={CSV_MENU}
			value=""
			size="xs"
			onSelect={onMenu}
		/>
		<input bind:this={csvFile} type="file" accept=".csv,text/csv" class="hidden" onchange={onCsvFileChange} />
	{/snippet}
</PresetPanel>
