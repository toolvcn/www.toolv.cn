<script lang="ts">
	// 换算卡：工具条一行输入（值 + 源单位），其余单位全部实时换算，逐行复制。
	// CSS 分类多一个「根字号」输入，rem 的换算跟着它走。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { unitStore } from '../core/store.svelte.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';

	const amountText = $derived(unitStore.inputs[unitStore.category]);
	const stateText = $derived(
		amountText.trim() === ''
			? '输入数值，这里实时换算成其余单位。'
			: unitStore.invalid
				? '认不出这个数值，试试 12、-0.5 或 1e3。'
				: `换算基准：${unitStore.categoryDef.baseLabel}；结果最多保留 6 位有效数字。`
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：数值 / 源单位（CSS 分类加根字号）在左，操作 md:ml-auto 靠右 -->
	<div id="unit-toolbar" role="group" aria-label="单位换算操作" class={TOOLBAR}>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<label class={TOOLBAR_LABEL} for="unit-amount">要换算的数值</label>
			<Input
				id="unit-amount"
				mono
				size="sm"
				inputmode="decimal"
				bind:value={unitStore.inputs[unitStore.category]}
				invalid={unitStore.invalid}
				autocomplete="off"
				placeholder="输入数值，如 12 / -0.5 / 1e3"
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>源单位</span>
			<Dropdown
				label="源单位"
				size="sm"
				options={unitStore.unitOptions}
				value={unitStore.fromUnit.id}
				onSelect={(id) => unitStore.setFrom(id)}
			/>
		</div>

		{#if unitStore.category === 'css'}
			<div class={TOOLBAR_GROUP}>
				<label class={TOOLBAR_LABEL} for="unit-root">根字号（1rem）px</label>
				<div class="w-24">
					<Input
						id="unit-root"
						mono
						size="sm"
						inputmode="numeric"
						bind:value={unitStore.cssRootText}
						invalid={unitStore.cssRootInvalid}
					/>
				</div>
			</div>
		{/if}

		<div class={TOOLBAR_ACTIONS}>
			{#if unitStore.category === 'css'}
				<Button label="把根字号恢复为 16px" title="根字号复位" onclick={() => unitStore.resetRoot()}>根字号复位</Button>
			{/if}
			<Button label="清空输入框" title="清空" onclick={() => unitStore.clearInput()}>清空</Button>
		</div>
	</div>

	<!-- 结果列表：全部单位一次列出，源单位行标注「输入」 -->
	<Panel id="unit-convert" headingId="unit-convert-heading" heading="换算结果" class="relative min-h-0 flex-1">
		<ul class="divide-y divide-gray-200 overflow-y-auto max-lg:max-h-[60vh] lg:min-h-0 lg:flex-1">
			{#each unitStore.rows as row (row.unitId)}
				<ResultRow>
					<span class="w-28 min-w-0 shrink-0 truncate text-xs text-gray-600 sm:w-36" title={row.label}>
						{row.label}
					</span>
					<span class="min-w-0 flex-1 truncate text-right font-mono text-sm text-gray-900" title={row.valueText}>
						{row.valueText === '' ? '—' : row.valueText}
					</span>
					{#if row.source}
						<Badge size="sm" tone="info">输入</Badge>
					{:else}
						<!-- 占位撑住宽度：非源单位时也要空出同样位置，否则各行结果宽度会跳 -->
						<span class="inline-flex size-6 shrink-0 items-center justify-center"> </span>
					{/if}
					<CopyButton
						icon
						text={row.valueText}
						ok={`已复制 ${row.label} 的结果`}
						label="复制 {row.label} 的换算结果"
						disabled={row.valueText === ''}
					/>
				</ResultRow>
			{/each}
		</ul>

		<!-- 固定高度脚注：换算状态与错误都在这里，不会把卡片撑高 -->
		<div class={FOOTER_BAR}>
			<StatusPill tone={unitStore.invalid ? 'error' : 'neutral'} truncate>{stateText}</StatusPill>
		</div>
	</Panel>
</div>
