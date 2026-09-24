<script lang="ts">
	// 日期加减工作区：基准日期 + 加减方向 + 数量 + 单位（天 / 周 / 月 / 年），
	// 「跳过周末」只在「天」单位下生效；结果给目标日期与星期几。
	import { Copy, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { dateStore } from '../core/store.svelte.ts';
	import { UNIT_OPTIONS } from '../core/types.ts';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { LABEL } from './styles.ts';

	/** 加减方向：store 里是 addMinus 布尔，这里换成显式的两个值给分段组件 */
	const DIRECTION_OPTIONS = [
		{ value: 'add', label: '加' },
		{ value: 'minus', label: '减' }
	] as const;

	const result = $derived(dateStore.add);
	const hasResult = $derived(result !== null);
	const businessDisabled = $derived(dateStore.businessDisabled);
</script>

<!-- 加减条件 -->
<Panel id="date-add-input" headingId="date-add-input-heading" heading="日期加减" class="shrink-0">
	{#snippet actions()}
		<Button label="恢复默认示例" size="xs" onclick={() => dateStore.loadExample()}>
			<Lightbulb class="size-3.5" />示例
		</Button>
	{/snippet}
	<div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
		<div>
			<label for="date-add-base" class={LABEL}>基准日期</label>
			<div class="flex items-center gap-2">
				<Input id="date-add-base" type="date" bind:value={dateStore.addBase} class="min-w-0 flex-1" />
				<Button label="把基准日期填成本地今天" size="sm" class="shrink-0" onclick={() => dateStore.fillAddToday()}
					>今天</Button
				>
			</div>
		</div>
		<div>
			<label for="date-add-amount" class={LABEL}>数量</label>
			<Input
				id="date-add-amount"
				type="number"
				inputmode="numeric"
				autocomplete="off"
				step="1"
				bind:value={dateStore.addAmountText}
				placeholder="如 30"
			/>
		</div>
		<div>
			<span class={LABEL} id="date-add-direction-label">方向</span>
			<SegmentedControl
				edge="dark"
				class="w-fit"
				aria-labelledby="date-add-direction-label"
				options={DIRECTION_OPTIONS}
				value={dateStore.addMinus ? 'minus' : 'add'}
				onchange={(v) => (dateStore.addMinus = v === 'minus')}
			/>
		</div>
		<div>
			<span class={LABEL}>单位</span>
			<Dropdown
				label="时间单位"
				options={UNIT_OPTIONS}
				value={dateStore.addUnit}
				onSelect={(value) => dateStore.setUnit(value)}
			/>
		</div>
		<div class="sm:col-span-2">
			<Checkbox
				bind:checked={dateStore.addBusinessOnly}
				disabled={businessDisabled}
				title={businessDisabled
					? '跳过周末只对「天」单位有意义，切回「天」可勾选'
					: '加减时跳过周六周日，只按工作日推进'}
			>
				跳过周末（只算工作日）
			</Checkbox>
		</div>
	</div>
</Panel>

<!-- 结果：空态 / 结果两态切换，容器常驻渲染保证读屏播报不断 -->
<Panel id="date-add-result" headingId="date-add-result-heading" heading="结果日期" class="shrink-0">
	{#snippet actions()}
		<Button
			label="复制结果日期"
			size="xs"
			variant="primary"
			disabled={!hasResult}
			onclick={() => void dateStore.copyAdd()}
		>
			<Copy class="size-3.5" />复制
		</Button>
	{/snippet}
	<div class="p-4">
		<div role="status" aria-live="polite">
			{#if !hasResult}
				<p class="text-sm text-gray-600">填好基准日期与数量，这里实时显示目标日期。</p>
			{:else}
				<p class="text-xl font-semibold text-gray-900">{result!.formatted}（{result!.weekday}）</p>
				<p class="mt-1 text-xs text-gray-600">{result!.summary}</p>
			{/if}
		</div>
	</div>
</Panel>
