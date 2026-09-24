<script lang="ts">
	// ASCII 码表：搜索框 + 可打印 / 控制两组条目，行尾一键复制。
	// 可打印条目复制字符本身，控制字符复制转义写法（`\n` 这类），没有约定写法的退回 `\xHH`。
	import { Search } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, SEARCH_ICON } from '$lib/ui/styles';
	import { asciiCopyText, groupAsciiEntries, hexOf } from '../core/ascii.ts';
	import type { AsciiEntry } from '../core/ascii.ts';
	import { cheatsheetStore } from '../core/store.svelte.ts';
	import { CELL_MAIN, CELL_NOTE, CHAR_BOX, GROUP_TITLE } from './styles.ts';
	import { SEARCH_INPUT, SEARCH_ROW } from '$lib/ui/styles';

	const results = $derived(cheatsheetStore.asciiResults);
	const sections = $derived(groupAsciiEntries(results));
	const countText = $derived(results.length === 0 ? '无结果' : `${results.length} 条`);

	/** 字符预览块里显示什么：空格没有字形，用 SP 代替；控制字符显示缩写 */
	function displayOf(entry: AsciiEntry): string {
		if (entry.abbr !== null) return entry.abbr;
		return entry.code === 32 ? 'SP' : (entry.char ?? '');
	}

	/** 十六进制与转义写法拼成一串（`0x0A · \n`） */
	function metaOf(entry: AsciiEntry): string {
		return entry.escape === null ? hexOf(entry.code) : `${hexOf(entry.code)} · ${entry.escape}`;
	}

	function copyLabel(entry: AsciiEntry): string {
		if (entry.char !== null) return entry.code === 32 ? '复制空格字符' : `复制字符 ${entry.char}`;
		return `复制 ${entry.abbr} 的转义写法`;
	}
</script>

<Panel id="ascii-panel" headingId="ascii-heading" heading="ASCII 码表">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>十进制 / 十六进制 / 转义</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="ascii-search">搜索字符、码位或转义写法</label>
			<input
				id="ascii-search"
				type="search"
				bind:value={cheatsheetStore.asciiQuery}
				placeholder="搜索：65 / 0x41 / A / 换行"
				class={SEARCH_INPUT}
			/>
		</div>
		<Button
			label="清空 ASCII 搜索词"
			title="清空"
			disabled={cheatsheetStore.asciiQuery === ''}
			onclick={() => cheatsheetStore.clearAsciiQuery()}
		>
			清空
		</Button>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="max-h-[60vh] min-h-0 overflow-y-auto" tabindex="0" role="region" aria-label="ASCII 码表">
		{#if results.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的字符，换个码位或关键词试试。</EmptyState>
			</div>
		{:else}
			{#each sections as section (section.group)}
				<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="ascii-group-{section.group}">
					<h3 id="ascii-group-{section.group}" class={GROUP_TITLE}>{section.name}（{section.items.length}）</h3>
					<ul class="divide-y divide-gray-100">
						{#each section.items as entry (entry.code)}
							<ResultRow>
								<Badge mono size="sm" class="min-w-11" tone="neutral">{entry.code}</Badge>
								<span class={CHAR_BOX}>{displayOf(entry)}</span>
								<div class="min-w-0 flex-1">
									<p class={CELL_MAIN}>{metaOf(entry)}</p>
									<p class={CELL_NOTE}>{entry.note}</p>
								</div>
								<CopyButton icon text={asciiCopyText(entry)} ok="已复制" label={copyLabel(entry)} />
							</ResultRow>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">点行尾按钮复制；控制字符复制的是转义写法（如 \n）。</p>
		</div>
	{/snippet}
</Panel>
