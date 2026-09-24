<script lang="ts">
	// 摩斯码速查：搜索框 + 按 字母 / 数字 / 标点 分组的码表。
	// 点一行按当前方向把内容插进输入框（编码插字符、解码插摩斯码），行尾一键复制摩斯码。
	// 字符与摩斯码都能当关键词（`s` 与 `...` 命中同一条），筛选只影响渲染、不改数据。
	import { Search } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import {
		FOCUS_RING,
		FOOTER_BAR,
		LIST_HEADING,
		PANEL_HINT,
		SEARCH_ICON,
		SEARCH_INPUT,
		SEARCH_ROW
	} from '$lib/ui/styles';
	import { toast } from '$lib/ui/toast.svelte';
	import { groupMorseEntries, type MorseEntry } from '../core/morse.ts';
	import { morseStore } from '../core/store.svelte.ts';

	/** 输入框（Converter 里的 textarea）的 id：跨组件拿它的光标位置，只能用 id */
	const INPUT_AREA_ID = 'morse-input-area';

	const sections = $derived(groupMorseEntries(morseStore.tableResults));
	const countText = $derived(morseStore.tableResults.length === 0 ? '无结果' : `${morseStore.tableResults.length} 条`);

	/** 点一行 → 按当前方向插到输入框的光标处（还没碰过输入框时光标在末尾，等于追加） */
	function insertEntry(item: MorseEntry): void {
		const el = document.getElementById(INPUT_AREA_ID);
		const area = el instanceof HTMLTextAreaElement ? el : null;
		const start = area?.selectionStart ?? morseStore.input.length;
		const end = area?.selectionEnd ?? start;
		const caret = morseStore.insertEntry(item, start, end);
		if (caret === null) return;
		if (area !== null) {
			// 值由 Svelte 更新，等这一帧渲染完再把光标放回插入内容之后（同正则速查表的做法）
			requestAnimationFrame(() => area.setSelectionRange(caret, caret));
		}
		toast.show(`已插入 ${morseStore.entryInsertText(item)}`);
	}
</script>

<!-- 外壳撑满剩余高度（工具页是 fill 版式），所以正文里的滚动区用 flex-1 而不是移动端定高。
     lg 起它是右侧定宽栏（"速查常驻、不切标签"），窄屏则与编解码上下各占一半高度 -->
<Panel
	id="morse-table-panel"
	headingId="morse-table-heading"
	heading="摩斯码速查表"
	class="min-h-0 flex-1 lg:w-88 lg:flex-none"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>字符与摩斯码都能搜</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="morse-search">搜索字符或摩斯码</label>
			<input
				id="morse-search"
				type="search"
				bind:value={morseStore.query}
				placeholder="搜索：s / ... / 数字"
				class={SEARCH_INPUT}
			/>
		</div>
		<!-- 常驻渲染：按钮随搜索词显隐会让搜索条里的控件位置跳变 -->
		<Button
			label="清空摩斯码搜索词"
			title="清空"
			disabled={morseStore.query === ''}
			onclick={() => morseStore.clearQuery()}
		>
			清空
		</Button>
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行（与 MIME 速查同款） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="min-h-0 flex-1 overflow-y-auto" tabindex="0" role="region" aria-label="摩斯码速查表">
		{#if sections.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的字符或摩斯码，换个关键词试试。</EmptyState>
			</div>
		{:else}
			{#each sections as section (section.id)}
				<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="morse-group-{section.id}">
					<h3 id="morse-group-{section.id}" class={LIST_HEADING}>
						{section.name}（{section.items.length}）
					</h3>
					<ul class="divide-y divide-gray-100">
						{#each section.items as item (item.char)}
							<!-- group：行尾复制按钮悬浮 / 键盘聚焦时才显形（触屏没有 hover，常显） -->
							<ResultRow class="group">
								<!-- 行内主区就是一个真按钮（点击插入到输入框）。不写成「整行 onclick + role=button」：
								     那样会把行尾的复制按钮套进另一个可交互元素里，键盘路径也要自己补 -->
								<button
									type="button"
									class="flex min-w-0 flex-1 items-center gap-3 rounded text-left select-none {FOCUS_RING}"
									aria-label="插入 {morseStore.entryInsertText(item)} 到输入框"
									title="点一下插入到输入框"
									onclick={() => insertEntry(item)}
								>
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded bg-gray-100 font-mono text-xs text-gray-900"
									>
										{item.char}
									</span>
									<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{item.code}</span>
								</button>
								<CopyButton
									icon
									text={item.code}
									ok="已复制摩斯码"
									label="复制 {item.char} 的摩斯码"
									class="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
								/>
							</ResultRow>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">点行按方向插入输入框，行尾可复制摩斯码。</p>
		</div>
	{/snippet}
</Panel>
