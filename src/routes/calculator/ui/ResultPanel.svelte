<script lang="ts">
	// 结果面板：跟着输入框实时算，永远是「当前表达式」的结果。
	//
	// 算式不对时显示「—」并把原因交给状态条：不在结果区再写一遍错误，
	// 免得同一句红字在两处出现（状态条是本站统一的报错位置）。
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { calcStore } from '../core/store.svelte.ts';
</script>

<Panel
	id="calc-result-panel"
	headingId="calc-result-heading"
	heading="计算结果"
	class="relative min-h-0 min-w-0 flex-1"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>实时计算 · 回车或点「计算」记进历史</span>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if calcStore.expr.trim() === ''}
			<div class="p-4">
				<EmptyState>
					写一个算式（比如 `(12 + 8) * 3 / 2^2`），这里实时给出结果；支持括号、幂、三角函数与 pi / e。
				</EmptyState>
			</div>
		{:else}
			<div class="flex flex-col gap-2 p-4">
				<div class="flex items-start gap-2">
					<span class="min-w-0 flex-1 font-mono text-2xl break-all text-gray-900 tabular-nums">
						{calcStore.resultText}
					</span>
					<CopyButton icon text={calcStore.resultText} ok="已复制结果" label="复制计算结果" />
				</div>
				<p class="min-w-0 text-xs break-all text-gray-600">= {calcStore.expr}</p>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={calcStore.resultTone} truncate>{calcStore.resultStatus}</StatusPill>
		</div>
	{/snippet}
</Panel>
