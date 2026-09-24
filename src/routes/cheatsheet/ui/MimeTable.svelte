<script lang="ts">
	// MIME 类型速查：搜索框 + 按类别分组的条目，行尾一键复制 MIME 串。
	// 扩展名与 MIME 都能当关键词（`png` 与 `image/png` 命中同一条），筛选只影响渲染不改数据。
	import { Search } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, SEARCH_ICON } from '$lib/ui/styles';
	import { groupMimeEntries } from '../core/mime.ts';
	import type { MimeEntry } from '../core/mime.ts';
	import { cheatsheetStore } from '../core/store.svelte.ts';
	import { CELL_MAIN, CELL_NOTE, GROUP_TITLE } from './styles.ts';
	import { SEARCH_INPUT, SEARCH_ROW } from '$lib/ui/styles';

	const results = $derived(cheatsheetStore.mimeResults);
	const sections = $derived(groupMimeEntries(results));
	const countText = $derived(results.length === 0 ? '无结果' : `${results.length} 条`);

	/** 副文本：用途 + 别名（别名拼成字符串，避免条件渲染把空格吃掉） */
	function noteOf(item: MimeEntry): string {
		return item.alias ? `${item.note}（${item.alias.join(' ')}）` : item.note;
	}

	/** 行尾复制按钮的无障碍名称：指明复制的是哪一条 */
	function copyLabel(item: MimeEntry): string {
		return item.ext === '' ? `复制 ${item.mime}` : `复制 ${item.ext} 的 MIME 类型`;
	}
</script>

<Panel id="mime-panel" headingId="mime-heading" heading="MIME 类型速查">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>扩展名 ↔ MIME 双向搜索</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="mime-search">搜索扩展名或 MIME 类型</label>
			<input
				id="mime-search"
				type="search"
				bind:value={cheatsheetStore.mimeQuery}
				placeholder="搜索：png / image/png / 压缩"
				class={SEARCH_INPUT}
			/>
		</div>
		<!-- 常驻渲染：按钮随搜索词显隐会让搜索条里的控件位置跳变 -->
		<Button
			label="清空 MIME 搜索词"
			title="清空"
			disabled={cheatsheetStore.mimeQuery === ''}
			onclick={() => cheatsheetStore.clearMimeQuery()}
		>
			清空
		</Button>
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行（与 http 状态码速查同款） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="max-h-[60vh] min-h-0 overflow-y-auto" tabindex="0" role="region" aria-label="MIME 类型列表">
		{#if results.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的 MIME 类型，换个扩展名或关键词试试。</EmptyState>
			</div>
		{:else}
			{#each sections as section (section.group)}
				<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="mime-group-{section.group}">
					<h3 id="mime-group-{section.group}" class={GROUP_TITLE}>{section.name}（{section.items.length}）</h3>
					<ul class="divide-y divide-gray-100">
						{#each section.items as item (item.ext + item.mime)}
							<ResultRow>
								<!-- 表单那几条没有扩展名，用「—」占位 -->
								<Badge mono size="sm" class="min-w-14" tone="info">{item.ext === '' ? '—' : item.ext}</Badge>
								<div class="min-w-0 flex-1">
									<p class={CELL_MAIN}>{item.mime}</p>
									<p class={CELL_NOTE}>{noteOf(item)}</p>
								</div>
								<CopyButton icon text={item.mime} ok="已复制 MIME 类型" label={copyLabel(item)} />
							</ResultRow>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">点行尾按钮复制 MIME 串；扩展名、MIME、用途都能当关键词。</p>
		</div>
	{/snippet}
</Panel>
