<script lang="ts">
	// UUID v4 工作区：工具条放数量 / 选项 / 生成，下方逐行结果。
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

	const lines = $derived(generatorStore.uuidLines);
	const hasLines = $derived(lines.length > 0);
	const countInvalid = $derived(generatorStore.uuidCountInvalid);

	/** 快捷数量按钮样式 */
	const quickBtn =
		'inline-flex h-7 shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：数量与选项在左，操作 md:ml-auto 靠右 -->
	<div id="uuid-toolbar" role="group" aria-label="UUID 生成操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="uuid-count">数量</label>
			<div class="flex flex-wrap items-center gap-1.5">
				<div class="w-28">
					<Input
						id="uuid-count"
						mono
						size="sm"
						inputmode="numeric"
						bind:value={generatorStore.uuidCountText}
						invalid={countInvalid}
					/>
				</div>
				{#each QUICK_COUNTS as n (n)}
					<button
						type="button"
						class={quickBtn}
						onclick={() => generatorStore.setUuidCount(n)}
						aria-label={`一键填入数量 ${n}`}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>选项</span>
			<div class="flex h-8 flex-wrap items-center gap-3">
				<Checkbox bind:checked={generatorStore.uuidUpper} title="输出全大写">大写</Checkbox>
				<Checkbox bind:checked={generatorStore.uuidNoDashes} title="去掉中间的连字符">去连字符</Checkbox>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button
				label="复制全部 UUID"
				title="复制全部"
				disabled={!hasLines}
				onclick={() => void generatorStore.copyAllLines(lines)}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制全部
			</Button>
			<Button
				variant="primary"
				label="生成 UUID"
				title="生成"
				disabled={countInvalid}
				onclick={() => void generatorStore.generateUuids()}
			>
				生成
			</Button>
		</div>
	</div>

	<Panel id="uuid-panel" headingId="uuid-panel-heading" heading="UUID v4" class="relative min-h-0 flex-1">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>{hasLines ? `${lines.length} 条` : '待生成'}</span>
		{/snippet}

		{#if hasLines}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<ul class="divide-y divide-gray-200">
					{#each lines as line, index (index)}
						<ResultRow>
							<span class={RESULT_TEXT}>{line}</span>
							<CopyButton icon text={line} ok="已复制这条 UUID" label="复制第 {index + 1} 条 UUID" />
						</ResultRow>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<EmptyState class="max-w-72">点「生成」批量产出 UUID v4，逐行可复制。</EmptyState>
			</div>
		{/if}

		<div class={FOOTER_BAR}>
			<StatusPill tone={countInvalid ? 'error' : 'neutral'} truncate
				>{countInvalid ? `数量要是 1-${COUNT_MAX} 的整数。` : '浏览器 crypto.randomUUID 本地生成，不联网。'}</StatusPill
			>
		</div>
	</Panel>
</div>
