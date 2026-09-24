<script lang="ts">
	// 工作日统计工作区：起止日期区间内的工作日 / 周末日 / 总天数。
	// 口径是纯数学的「周一到周五」，不含法定节假日调休，页面上注明。
	import { Copy, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { dateStore } from '../core/store.svelte.ts';
	import { LABEL, STAT_CARD } from './styles.ts';

	const stats = $derived(dateStore.business);
	const hasResult = $derived(stats !== null);
	// 区间反了要给明确提示，不能静默显示 0
	const rangeReversed = $derived(dateStore.bizRangeReversed);
	const emptyText = $derived(
		rangeReversed ? '结束日期早于起始日期，调换一下再统计。' : '填好起止日期，这里实时显示区间内的工作日统计。'
	);
	const emptyTextClass = $derived(rangeReversed ? 'text-sm text-red-700' : 'text-sm text-gray-600');
</script>

<!-- 日期区间 -->
<Panel id="date-biz-input" headingId="date-biz-input-heading" heading="日期区间" class="shrink-0">
	{#snippet actions()}
		<Button label="恢复默认示例日期" size="xs" onclick={() => dateStore.loadExample()}>
			<Lightbulb class="size-3.5" />示例
		</Button>
	{/snippet}
	<div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
		<div>
			<label for="date-biz-start" class={LABEL}>起始日期</label>
			<div class="flex items-center gap-2">
				<Input id="date-biz-start" type="date" bind:value={dateStore.bizStart} class="min-w-0 flex-1" />
				<Button
					label="把起始日期填成本地今天"
					size="sm"
					class="shrink-0"
					onclick={() => dateStore.fillBizToday('start')}>今天</Button
				>
			</div>
		</div>
		<div>
			<label for="date-biz-end" class={LABEL}>结束日期</label>
			<div class="flex items-center gap-2">
				<Input id="date-biz-end" type="date" bind:value={dateStore.bizEnd} class="min-w-0 flex-1" />
				<Button label="把结束日期填成本地今天" size="sm" class="shrink-0" onclick={() => dateStore.fillBizToday('end')}
					>今天</Button
				>
			</div>
		</div>
	</div>
</Panel>

<!-- 统计结果：空态 / 结果两态切换，容器常驻渲染保证读屏播报不断 -->
<Panel id="date-biz-result" headingId="date-biz-result-heading" heading="统计结果" class="shrink-0">
	{#snippet actions()}
		<Button
			label="复制工作日统计摘要"
			size="xs"
			variant="primary"
			disabled={!hasResult}
			onclick={() => void dateStore.copyBusiness()}
		>
			<Copy class="size-3.5" />复制
		</Button>
	{/snippet}
	<div class="p-4">
		<div role="status" aria-live="polite">
			{#if !hasResult}
				<p class={emptyTextClass}>{emptyText}</p>
			{:else}
				<div class="grid grid-cols-3 gap-2">
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-blue-700 tabular-nums">{stats!.businessDays} 天</p>
						<p class="mt-0.5 text-xs text-gray-600">工作日</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{stats!.weekendDays} 天</p>
						<p class="mt-0.5 text-xs text-gray-600">周六周日</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{stats!.totalDays} 天</p>
						<p class="mt-0.5 text-xs text-gray-600">总天数（含头尾）</p>
					</div>
				</div>
				<p class="mt-3 text-xs text-gray-600">口径：周一到周五算工作日，不含法定节假日与调休。</p>
			{/if}
		</div>
	</div>
</Panel>
