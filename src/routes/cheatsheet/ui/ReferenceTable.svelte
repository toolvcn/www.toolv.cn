<script lang="ts">
	// 通用速查表：搜索框 + 表头 + 若干行 + 行尾复制。
	// 七张表共用这一份（常见端口 / HTTP 请求头 / User-Agent / 特殊符号 / Android 权限 / 世界区号 / 历史朝代），
	// 各自只提供纯数据（`core/<topic>.ts`）—— 加一张表只改数据与 `core/tables.ts` 的注册。
	//
	// 版式取舍：表格用真 `<table>`（表头 + 行），滚动时表头 `sticky` 钉住；
	// 窄屏不做「一列一卡片」的改写 —— 速查表的价值就在横向对照，给横向滚动比拆成卡片更好用
	// （与标签条同一条思路：放不下就滚，不挤）。
	import { Search } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { DATA_TABLE, FOOTER_BAR, PANEL_HINT, SEARCH_ICON, SEARCH_INPUT, SEARCH_ROW, TABLE_TH } from '$lib/ui/styles';
	import { filterReferenceRows, type ReferenceTable } from '../core/reference.ts';
	import { cheatsheetStore } from '../core/store.svelte.ts';

	let { table }: { table: ReferenceTable } = $props();

	const query = $derived(cheatsheetStore.referenceQueries[table.id]);
	const rows = $derived(filterReferenceRows(table, query));
	const countText = $derived(rows.length === 0 ? '无结果' : `${rows.length} 条`);
	const searchId = $derived(`reference-search-${table.id}`);

	/**
	 * 单元格样式：第一列是「查什么」的键（等宽 + 不折行，免得 `X-Forwarded-For` 从中间断开），
	 * 最后一列放说明（用更浅的灰、给一个最小宽度避免被挤成一列字），中间列常规。
	 */
	function cellClass(index: number): string {
		if (index === 0) return 'px-4 py-2 align-top font-mono whitespace-nowrap text-gray-900';
		if (index === table.columns.length - 1) return 'min-w-[12rem] px-4 py-2 align-top text-gray-600';
		return 'px-4 py-2 align-top text-gray-700';
	}
</script>

<Panel id="reference-panel-{table.id}" headingId="reference-heading-{table.id}" heading={table.label}>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>{table.hint}</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for={searchId}>搜索{table.label}</label>
			<input
				id={searchId}
				type="search"
				value={query}
				oninput={(event) => cheatsheetStore.setReferenceQuery(table.id, event.currentTarget.value)}
				placeholder={table.searchHint}
				class={SEARCH_INPUT}
			/>
		</div>
		<!-- 常驻渲染：按钮随搜索词显隐会让搜索条里的控件位置跳变 -->
		<Button
			label="清空{table.label}的搜索词"
			title="清空"
			disabled={query === ''}
			onclick={() => cheatsheetStore.clearReferenceQuery(table.id)}
		>
			清空
		</Button>
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="max-h-[60vh] min-h-0 overflow-auto" tabindex="0" role="region" aria-label="{table.label}列表">
		{#if rows.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的条目，换个关键词试试。</EmptyState>
			</div>
		{:else}
			<table class={DATA_TABLE}>
				<thead class="sticky top-0 z-10 bg-white">
					<tr class="border-b border-gray-200">
						{#each table.columns as column (column)}
							<th scope="col" class={TABLE_TH}>
								{column}
							</th>
						{/each}
						<th scope="col" class="w-10 px-2 py-2"><span class="sr-only">复制</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each rows as row (row[0])}
						<tr class="hover:bg-gray-50">
							{#each row as cell, index (table.columns[index])}
								<td class={cellClass(index)}>{cell}</td>
							{/each}
							<td class="px-2 py-2 text-right align-top">
								<CopyButton icon text={row[0] ?? ''} ok={`已复制 ${row[0] ?? ''}`} label={`复制 ${row[0] ?? ''}`} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">
				行尾按钮复制的是最左边那一列；搜索支持空格分隔的多个关键词（都要命中）。
			</p>
		</div>
	{/snippet}
</Panel>
