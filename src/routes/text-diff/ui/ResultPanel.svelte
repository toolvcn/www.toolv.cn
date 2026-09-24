<script lang="ts">
	// 对比结果面板：并排（左右两格）/ 合并（一列）两种渲染，脚注一条状态胶囊。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { diffStore } from '../core/store.svelte.ts';
	import type { DiffKind, DiffLine } from '../core/diff.ts';

	// 行底色与字色：新增绿、删除红、未变不上色（口径见 UI-STYLE §1）
	const TONE: Record<DiffKind, string> = {
		equal: 'text-gray-900',
		add: 'bg-emerald-50 text-emerald-700',
		del: 'bg-red-50 text-red-700'
	};
	const CELL = 'relative flex gap-2 px-3 py-0.5 font-mono text-xs leading-5 sm:text-sm sm:leading-6';
	const MARKER = 'w-3 shrink-0 select-none';
	const GUTTER = 'w-8 shrink-0 text-right tabular-nums text-gray-600 select-none sm:w-10';
	/** 一侧没有对应行时的空占位：占住一行的高度，两栏行序才对得上 */
	const EMPTY_CELL = 'min-h-5 bg-gray-50 sm:min-h-6';
	/** 可滚动的行区：自身可聚焦才能用键盘滚动（axe scrollable-region-focusable） */
	const SCROLLER = 'min-h-0 flex-1 overflow-auto max-lg:max-h-[60vh]';

	const marker = (kind: DiffKind): string => (kind === 'add' ? '+' : kind === 'del' ? '-' : ' ');
	const rowNo = (line: DiffLine): string => String(line.leftNo ?? line.rightNo ?? '');
</script>

<Panel id="text-diff-result" headingId="text-diff-result-heading" heading="对比结果" class="min-h-0 md:flex-[3]">
	{#snippet headingExtra()}
		{#if diffStore.hasInput}
			<span class={PANEL_HINT}>
				新增 {diffStore.stats.added} · 删除 {diffStore.stats.removed} · 未变 {diffStore.stats.equal}
			</span>
		{/if}
	{/snippet}

	{#if diffStore.hasInput}
		{#if diffStore.view === 'unified'}
			<!-- 合并：一列，长行不拆行 —— 整块横向滚动（ul 用 w-fit 撑到最长行） -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div id="text-diff-rows" class={SCROLLER} tabindex="0" role="region" aria-label="合并对比结果">
				<ul class="w-fit min-w-full py-1 font-mono text-xs leading-5 sm:text-sm sm:leading-6">
					{#each diffStore.visibleLines as line, index (index)}
						<li class="{CELL} {TONE[line.kind]}">
							{#if line.kind !== 'equal'}
								<span class="sr-only">{line.kind === 'add' ? '新增：' : '删除：'}</span>
							{/if}
							<span class={MARKER} aria-hidden="true">{marker(line.kind)}</span>
							<span class={GUTTER}>{rowNo(line)}</span>
							<span class="whitespace-pre">{line.text}</span>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<!-- 并排：小屏一行拆成上下两块，md 起左右分栏 -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div id="text-diff-rows" class={SCROLLER} tabindex="0" role="region" aria-label="并排对比结果">
				<ul class="font-mono text-xs leading-5 sm:text-sm sm:leading-6">
					{#each diffStore.visibleSplitRows as row, index (index)}
						<li
							class="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0 md:divide-gray-200"
						>
							{#if row.left}
								{@render cell(row.left)}
							{:else}
								<div class={EMPTY_CELL}></div>
							{/if}
							{#if row.right}
								{@render cell(row.right)}
							{:else}
								<div class={EMPTY_CELL}></div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else}
		<div class="flex min-h-0 flex-1 items-center justify-center p-4">
			<EmptyState>左右两栏各粘贴一段文本，这里实时显示行级差异</EmptyState>
		</div>
	{/if}

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={diffStore.statusTone} truncate>{diffStore.statusText}</StatusPill>
		</div>
	{/snippet}
</Panel>

{#snippet cell(line: DiffLine)}
	<!-- 并排的格子：长行换行而不是横向滚动 —— 一屏要塞下两栏，每栏本就不宽 -->
	<div class="{CELL} {TONE[line.kind]}">
		{#if line.kind !== 'equal'}
			<span class="sr-only">{line.kind === 'add' ? '新增：' : '删除：'}</span>
		{/if}
		<span class={MARKER} aria-hidden="true">{marker(line.kind)}</span>
		<span class={GUTTER}>{rowNo(line)}</span>
		<span class="min-w-0 flex-1 break-all whitespace-pre-wrap">{line.text}</span>
	</div>
{/snippet}
