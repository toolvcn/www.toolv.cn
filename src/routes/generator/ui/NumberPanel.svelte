<script lang="ts">
	// 随机数工作区：工具条放范围 / 数量 / 小数位 / 选项 / 生成，下方逐行结果。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy } from '@lucide/svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { generatorStore } from '../core/store.svelte.ts';
	import { COUNT_MAX, QUICK_COUNTS } from '../config.ts';
	import { RESULT_TEXT } from './styles.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';

	const lines = $derived(generatorStore.numLines);
	const hasLines = $derived(lines.length > 0);
	const minInvalid = $derived(generatorStore.numMinInvalid);
	const maxInvalid = $derived(generatorStore.numMaxInvalid);
	const countInvalid = $derived(generatorStore.numCountInvalid);
	const decimalsInvalid = $derived(generatorStore.numDecimalsInvalid);
	// 任意输入非法即禁用生成
	const invalid = $derived(minInvalid || maxInvalid || countInvalid || decimalsInvalid);
	const hintText = $derived(
		generatorStore.numError !== ''
			? generatorStore.numError
			: invalid
				? `数量要是 1-${COUNT_MAX} 的整数；小数位 0-6。`
				: '整数走拒绝采样消模偏差；小数位 > 0 时不去重。'
	);

	/** 快捷数量按钮样式 */
	const quickBtn =
		'inline-flex h-7 shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：四个数值 + 选项在左，操作 md:ml-auto 靠右 -->
	<div id="number-toolbar" role="group" aria-label="随机数生成操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="num-min">最小值</label>
			<div class="w-28">
				<Input
					id="num-min"
					mono
					size="sm"
					inputmode="numeric"
					bind:value={generatorStore.numMinText}
					invalid={minInvalid}
				/>
			</div>
		</div>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="num-max">最大值</label>
			<div class="w-28">
				<Input
					id="num-max"
					mono
					size="sm"
					inputmode="numeric"
					bind:value={generatorStore.numMaxText}
					invalid={maxInvalid}
				/>
			</div>
		</div>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="num-count">数量</label>
			<div class="flex flex-wrap items-center gap-1.5">
				<div class="w-24">
					<Input
						id="num-count"
						mono
						size="sm"
						inputmode="numeric"
						bind:value={generatorStore.numCountText}
						invalid={countInvalid}
					/>
				</div>
				{#each QUICK_COUNTS as n (n)}
					<button
						type="button"
						class={quickBtn}
						onclick={() => generatorStore.setNumCount(n)}
						aria-label={`一键填入数量 ${n}`}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="num-decimals">小数位（0-6）</label>
			<div class="w-24">
				<Input
					id="num-decimals"
					mono
					size="sm"
					inputmode="numeric"
					bind:value={generatorStore.numDecimalsText}
					invalid={decimalsInvalid}
				/>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>选项</span>
			<div class="flex h-8 flex-wrap items-center gap-3">
				<Checkbox
					bind:checked={generatorStore.numUnique}
					disabled={generatorStore.numUniqueDisabled}
					title={generatorStore.numUniqueDisabled ? '小数模式不去重' : '整数互不相同'}
				>
					去重
				</Checkbox>
				<Checkbox bind:checked={generatorStore.numSorted} title="结果从小到大排">排序</Checkbox>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button
				label="复制全部随机数"
				title="复制全部"
				size="sm"
				disabled={!hasLines}
				onclick={() => void generatorStore.copyAllLines(lines)}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制全部
			</Button>
			<Button
				variant="primary"
				label="生成随机数"
				title="生成"
				size="sm"
				disabled={invalid}
				onclick={() => void generatorStore.generateNumbers()}
			>
				生成
			</Button>
		</div>
	</div>

	<Panel id="number-panel" headingId="number-panel-heading" heading="随机数" class="relative min-h-0 flex-1">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>{hasLines ? `${lines.length} 个` : '待生成'}</span>
		{/snippet}

		{#if hasLines}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<ul class="divide-y divide-gray-200">
					{#each lines as line, index (index)}
						<ResultRow>
							<span class={RESULT_TEXT}>{line}</span>
							<CopyButton icon text={line} ok="已复制这个随机数" label="复制第 {index + 1} 个随机数" />
						</ResultRow>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<EmptyState class="max-w-72">设好范围点「生成」，支持负数与小数。</EmptyState>
			</div>
		{/if}

		<div class={FOOTER_BAR}>
			<StatusPill tone={generatorStore.numError !== '' || invalid ? 'error' : 'neutral'} truncate>{hintText}</StatusPill
			>
		</div>
	</Panel>
</div>
