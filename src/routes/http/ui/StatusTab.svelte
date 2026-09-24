<script lang="ts">
	// 状态码速查（响应面板的第三个标签，与「响应体 / 响应头」并列）：
	// 搜索框 + 按分类分组的条目列表，筛选只影响渲染不改数据。
	//
	// 原本常驻在右栏，占掉 18rem 把请求 / 响应挤到不足 700px；现在挂在响应区里，位置也更合理 ——
	// 它是「这个状态码什么意思」的参考手册，问的正是刚收到响应的那一刻。
	// 收到响应（httpStore.focusedStatus 变化）后切到本标签时组件才挂载，$effect 带着 focusedStatus
	// 跑第一次，自动滚动定位与高亮照旧成立。
	//
	// 本组件只出「标签里的内容」：卡片外壳、标题行与标签条归 ResponseView 的 Panel，
	// 所以这里没有 Panel 包裹也没有 `class` prop。
	import { onMount } from 'svelte';
	import { Search } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import { categoryOf, searchStatusCodes, statusGroupName } from '../core/status-codes.ts';
	import type { StatusCategory } from '../core/status-codes.ts';
	import { httpStore } from '../core/store.svelte.ts';
	import type { BadgeTone } from '$lib/ui/styles';
	import { LIST_HEADING, PANEL_SCROLL, SEARCH_ICON, SEARCH_INPUT, SEARCH_ROW } from '$lib/ui/styles';

	/** 分类 → 语义色：1xx 灰 / 2xx 绿 / 3xx 蓝 / 4xx 琥珀 / 5xx 红 */
	const CATEGORY_TONE: Record<StatusCategory, BadgeTone> = {
		'1xx': 'neutral',
		'2xx': 'ok',
		'3xx': 'info',
		'4xx': 'warn',
		'5xx': 'error'
	};

	const CATEGORIES: StatusCategory[] = ['1xx', '2xx', '3xx', '4xx', '5xx'];

	let query = $state('');
	let highlighted = $state<number | null>(null);
	let highlightTimer: ReturnType<typeof setTimeout> | null = null;

	const results = $derived(searchStatusCodes(query));
	const countText = $derived(results.length === 0 ? '无结果' : `${results.length} 条`);

	function rowClass(code: number): string {
		return code === highlighted ? 'bg-blue-50/70 transition-colors' : 'transition-colors';
	}

	onMount(() => {
		return () => {
			if (highlightTimer) clearTimeout(highlightTimer);
		};
	});

	// 只追踪 focusedStatus：收到新响应后切到本标签时滚动定位。query 的读取写在 rAF 回调里，
	// 不会被追踪，用户手动改搜索词不会触发热回滚。清空搜索后要等下一帧列表渲染完再滚动。
	$effect(() => {
		const code = httpStore.focusedStatus;
		if (code === null) return;
		requestAnimationFrame(() => {
			if (!searchStatusCodes(query).some((item) => item.code === code)) query = '';
			requestAnimationFrame(() => {
				const el = document.getElementById(`http-status-${code}`);
				if (!el) return;
				el.scrollIntoView({ block: 'nearest' });
				highlighted = code;
				if (highlightTimer) clearTimeout(highlightTimer);
				highlightTimer = setTimeout(() => {
					if (highlighted === code) highlighted = null;
				}, 2000);
			});
		});
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="http-status-search">搜索状态码</label>
			<input
				id="http-status-search"
				type="search"
				bind:value={query}
				placeholder="搜索：404 / 未找到 / 限流 / Unauthorized"
				class={SEARCH_INPUT}
			/>
		</div>
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行（与响应体那一块同款）。
	     小屏封顶：本标签在移动端是页面流里的一段，不封顶会把整页撑到几千 px -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class={PANEL_SCROLL} tabindex="0" role="region" aria-label="状态码列表">
		{#if results.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的状态码，换个关键词试试。</EmptyState>
			</div>
		{:else}
			{#each CATEGORIES as category (category)}
				{@const items = results.filter((item) => categoryOf(item.code) === category)}
				{#if items.length > 0}
					<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="http-status-group-{category}">
						<h3 id="http-status-group-{category}" class={LIST_HEADING}>
							{statusGroupName(category)}（{items.length}）
						</h3>
						<ul>
							{#each items as item (item.code)}
								<li id="http-status-{item.code}" class="px-4 py-2 {rowClass(item.code)}">
									<div class="flex items-start gap-3">
										<Badge mono class="min-w-11" tone={CATEGORY_TONE[category]} title={item.name}>
											{item.code}
										</Badge>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
												<h4 class="text-xs font-semibold text-gray-900">{item.name}</h4>
												<span class="text-xs text-gray-600">{item.zhName}</span>
											</div>
											<p class="mt-0.5 text-xs leading-5 text-gray-600">{item.meaning}</p>
											<p class="mt-0.5 text-[11px] leading-4 text-gray-600">场景：{item.scenario}</p>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		{/if}
	</div>
</div>
