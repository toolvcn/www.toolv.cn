<script lang="ts">
	// 参数速查表：按 重写与跳转 / 响应头 / 目录 / 访问控制 / 标记 / 变量 分组，内容跟着「方向」切换。
	// 点一行按条目自己的插入方式落进输入框（指令另起一行、标记与变量插在光标处），行尾一键复制写法。
	//
	// 为什么不给「查另一侧」的格式开关：插入必须和输入框同格式，把 nginx 写法插进 .htaccess 只会得到废配置。
	// 口径与数据在 ../core/cheatsheet.ts。
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
	import { snippetPreview, type CheatsheetEntry } from '../core/cheatsheet.ts';
	import { htaccessStore } from '../core/store.svelte.ts';

	/** 输入框（Panel 里的 textarea）的 id：跨组件拿它的光标位置，只能用 id */
	const INPUT_AREA_ID = 'htaccess-input-area';

	const groups = $derived(htaccessStore.cheatsheetSections);
	const total = $derived(groups.reduce((sum, group) => sum + group.items.length, 0));
	const countText = $derived(total === 0 ? '无结果' : `${total} 条`);
	const formatHint = $derived(htaccessStore.direction === 'toNginx' ? '列 .htaccess 写法' : '列 nginx 写法');

	/** 点一行 → 按条目自己的方式插到输入框（拿不到光标就落在末尾，等于追加一行） */
	function insertEntry(entry: CheatsheetEntry): void {
		const el = document.getElementById(INPUT_AREA_ID);
		const area = el instanceof HTMLTextAreaElement ? el : null;
		const start = area?.selectionStart ?? htaccessStore.input.length;
		const end = area?.selectionEnd ?? start;
		const caret = htaccessStore.insertEntry(entry, start, end);
		if (area !== null) {
			// 值由 Svelte 更新，等这一帧渲染完再把光标放回插入内容之后（同摩斯速查表的做法）
			requestAnimationFrame(() => area.setSelectionRange(caret, caret));
		}
		toast.show(`已插入 ${entry.snippet.split('\n')[0]}${entry.snippet.includes('\n') ? ' …' : ''}`);
	}

	// 行按钮不给 aria-label：行里的名字、写法、介绍本来就是可见文本，让它照念就行。
	// 硬塞一个 aria-label 反而会把这三段盖掉（读屏只会听见 aria-label 那一句）。
</script>

<!-- 外壳撑满剩余高度（工具页是 fill 版式），所以正文里的滚动区用 flex-1 而不是移动端定高。
     xl 起是右侧定宽栏（比摩斯速查的 w-88 宽一档：这里是「名字 + 写法」两列，更吃宽度）；
     xl 以下落到输入 / 输出下方的一条带子，定高 320px —— 不要用 flex-1，三块面板平分会把编辑框压到不可用 -->
<Panel
	id="htaccess-cheatsheet"
	headingId="htaccess-cheatsheet-heading"
	heading="参数速查表"
	tag="aside"
	class="min-w-0 flex-none max-xl:h-80 xl:w-96"
>
	{#snippet headingExtra()}
		<span class="{PANEL_HINT} truncate">{formatHint}</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="htaccess-cheatsheet-search">搜索指令、标记或变量</label>
			<input
				id="htaccess-cheatsheet-search"
				type="search"
				bind:value={htaccessStore.query}
				placeholder="搜索：RewriteCond / [L] / HTTPS"
				class={SEARCH_INPUT}
			/>
		</div>
		<!-- 常驻渲染：按钮随搜索词显隐会让搜索条里的控件位置跳变 -->
		<Button
			label="清空速查表搜索词"
			title="清空"
			disabled={htaccessStore.query === ''}
			onclick={() => htaccessStore.clearQuery()}
		>
			清空
		</Button>
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行（与摩斯速查同款） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="min-h-0 flex-1 overflow-y-auto" tabindex="0" role="region" aria-label="参数速查表">
		{#if total === 0}
			<div class="p-4">
				<EmptyState>没有匹配的指令、标记或变量，换个关键词试试。</EmptyState>
			</div>
		{:else}
			<!-- 窄屏单列；sm 起两列（这时这块是下方通栏的带子，放得下）；xl 起回到右侧窄栏 -->
			<div class="grid grid-cols-1 gap-x-2 sm:grid-cols-2 xl:grid-cols-1">
				{#each groups as group (group.id)}
					<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="htaccess-cheat-{group.id}">
						<h3 id="htaccess-cheat-{group.id}" class={LIST_HEADING}>
							{group.name}（{group.items.length}）
						</h3>
						<ul class="divide-y divide-gray-100">
							{#each group.items as item (item.id)}
								<!-- group：行尾复制按钮悬浮 / 键盘聚焦时才显形（触屏没有 hover，常显） -->
								<ResultRow class="group">
									<!-- 行内主区就是一个真按钮（点击插入到输入框）。不写成「整行 onclick + role=button」：
									     那样会把行尾的复制按钮套进另一个可交互元素里，键盘路径也要自己补 -->
									<button
										type="button"
										class="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5 text-left select-none {FOCUS_RING}"
										title={item.snippet}
										onclick={() => insertEntry(item)}
									>
										<span class="flex min-w-0 items-center gap-2">
											<span class="w-24 shrink-0 truncate text-xs text-gray-600" title={item.label}>{item.label}</span>
											<!-- pre-line 才认 snippet 里的换行：不写它，多行片段（if 块那类）会挤成一行，
											     那 snippetPreview 取「前两行」就白取了。长行断在哪儿都不影响辨认，两行以上才省略 -->
											<span
												class="line-clamp-2 min-w-0 flex-1 font-mono text-xs leading-4 break-all whitespace-pre-line text-gray-900"
											>
												{snippetPreview(item.snippet)}
											</span>
										</span>
										<!-- 介绍行内就给（这是速查表最值钱的一格，藏进 tooltip 等于没写）：
										     缩进对齐到写法列，一眼看清「名字 → 怎么写 → 干什么用的」 -->
										<span class="pl-[6.5rem] text-xs leading-4 text-gray-600">{item.note}</span>
									</button>
									<CopyButton
										icon
										text={item.snippet}
										ok="已复制写法"
										label="复制 {item.label} 的写法"
										class="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
									/>
								</ResultRow>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">点一行插进输入框（指令另起一行，标记与变量插在光标处）</p>
		</div>
	{/snippet}
</Panel>
