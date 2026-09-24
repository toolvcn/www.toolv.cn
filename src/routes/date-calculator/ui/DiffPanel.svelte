<script lang="ts">
	// 日期差工作区：起止两个日期，实时给出天数 / 含头含尾 / 周月年换算。
	// 固定日期输入 + 结果展示分两张卡，跟人民币大写的「输入 → 输出」结构一致。
	import { Copy, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { dateStore } from '../core/store.svelte.ts';
	import { LABEL, STAT_CARD } from './styles.ts';

	const diff = $derived(dateStore.diff);
	const hasResult = $derived(diff !== null);
	const swappedHint = $derived(diff?.swapped === true);
	// 结果大卡的动词：结束早于开始时按绝对值展示，措辞跟着换
	const headline = $derived(diff ? `${diff.swapped ? '约合' : '相差'} ${diff.days} 天` : '');
</script>

<!-- 日期区间 -->
<Panel id="date-diff-input" headingId="date-diff-input-heading" heading="日期区间" class="shrink-0">
	{#snippet actions()}
		<Button label="恢复默认示例日期" size="xs" onclick={() => dateStore.loadExample()}>
			<Lightbulb class="size-3.5" />示例
		</Button>
	{/snippet}
	<div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
		<div>
			<label for="date-diff-start" class={LABEL}>起始日期</label>
			<div class="flex items-center gap-2">
				<Input id="date-diff-start" type="date" bind:value={dateStore.diffStart} class="min-w-0 flex-1" />
				<Button
					label="把起始日期填成本地今天"
					size="sm"
					class="shrink-0"
					onclick={() => dateStore.fillDiffToday('start')}>今天</Button
				>
			</div>
		</div>
		<div>
			<label for="date-diff-end" class={LABEL}>结束日期</label>
			<div class="flex items-center gap-2">
				<Input id="date-diff-end" type="date" bind:value={dateStore.diffEnd} class="min-w-0 flex-1" />
				<Button label="把结束日期填成本地今天" size="sm" class="shrink-0" onclick={() => dateStore.fillDiffToday('end')}
					>今天</Button
				>
			</div>
		</div>
	</div>
</Panel>

<!-- 相差结果：空态 / 结果两态切换，容器常驻渲染保证读屏播报不断 -->
<Panel id="date-diff-result" headingId="date-diff-result-heading" heading="相差结果" class="shrink-0">
	{#snippet actions()}
		<Button
			label="复制相差结果摘要"
			size="xs"
			variant="primary"
			disabled={!hasResult}
			onclick={() => void dateStore.copyDiff()}
		>
			<Copy class="size-3.5" />复制
		</Button>
	{/snippet}
	<div class="p-4">
		<div role="status" aria-live="polite">
			{#if !hasResult}
				<p class="text-sm text-gray-600">填好起止两个日期，这里实时显示相差天数与周月年换算。</p>
			{:else}
				<p class="text-xl font-semibold text-gray-900">{headline}</p>
				{#if swappedHint}
					<p class="mt-1 text-xs text-amber-700">结束日期早于起始日期，已按绝对值展示。</p>
				{/if}
				<div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{diff!.inclusiveDays} 天</p>
						<p class="mt-0.5 text-xs text-gray-600">含头含尾</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{diff!.weeks} 周</p>
						<p class="mt-0.5 text-xs text-gray-600">约合周数</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{diff!.months} 个月</p>
						<p class="mt-0.5 text-xs text-gray-600">满月数</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900 tabular-nums">{diff!.years} 年</p>
						<p class="mt-0.5 text-xs text-gray-600">满年数</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900">{diff!.startWeekday}</p>
						<p class="mt-0.5 text-xs text-gray-600">起始日是</p>
					</div>
					<div class={STAT_CARD}>
						<p class="text-lg font-semibold text-gray-900">{diff!.endWeekday}</p>
						<p class="mt-0.5 text-xs text-gray-600">结束日是</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</Panel>
