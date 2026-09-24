<script lang="ts">
	// 正则图解标签页：把当前表达式解析成 AST 后递归画成树状图。
	// 解析失败（暂不支持的写法）给出原因；移动端图解区封顶滚动，桌面交回栅格行。
	import { regexStore } from '../core/store.svelte.ts';
	import { TAB_TOOLBAR } from '$lib/ui/styles';
	import DiagramNode from './DiagramNode.svelte';

	const parsed = $derived(regexStore.parsed);
	const statusText = $derived(
		parsed.ok ? '从左到右阅读；组盒标了组号与环视记号，右上角 ×n 表示重复次数。' : '这种写法暂时不支持图解。'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class={TAB_TOOLBAR}>
		<span class="text-xs text-gray-600" role="status" aria-live="polite">{statusText}</span>
	</div>

	<!-- 图解是横向可滚的（长表达式会超出），可滚动区需可聚焦才能用键盘滚动
	     （axe scrollable-region-focusable）；svelte 的静态规则不认识 role="region"，这里放行 -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="min-h-0 flex-1 overflow-auto p-4 max-lg:max-h-[60vh]" tabindex="0" role="region" aria-label="正则图解">
		{#if parsed.ok}
			<div class="flex">
				<DiagramNode node={parsed.node} />
			</div>
		{:else}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
				暂不支持图解：{parsed.reason}
				<br />
				试试去掉内联修饰符（如 (?i)）、原子组 (?&gt;…) 或条件组这类写法。
			</div>
		{/if}
	</div>
</div>
