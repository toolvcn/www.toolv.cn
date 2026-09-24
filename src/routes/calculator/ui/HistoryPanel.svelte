<script lang="ts">
	// 历史面板：最近算过的 20 条，点一条把算式填回输入框，行尾叉掉这一条。
	//
	// 只存 localStorage，不上传（与全站「数据本地处理」一致）；条目按时间倒序，
	// 同一个算式连算两次不会堆出两行（去重在 store 里做）。
	import { X } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { calcStore } from '../core/store.svelte.ts';

	const ROW = 'flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 last:border-b-0 hover:bg-gray-50';
</script>

<Panel id="calc-history-panel" headingId="calc-history-heading" heading="历史" class="relative min-h-0 min-w-0 flex-1">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>只存在这台设备的浏览器里</span>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if calcStore.history.length === 0}
			<div class="p-4">
				<EmptyState>算过之后这里按时间倒序列出算式与结果，点一条就填回上面的输入框。</EmptyState>
			</div>
		{:else}
			<ul>
				{#each calcStore.history as entry (entry.id)}
					<li class={ROW}>
						<button
							type="button"
							class="min-w-0 flex-1 cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
							onclick={() => calcStore.apply(entry.id)}
						>
							<span class="block truncate text-xs text-gray-600">{entry.expr}</span>
							<span class="block truncate font-mono text-sm text-gray-900 tabular-nums">= {entry.result}</span>
						</button>
						<Button icon label={`删除这条历史：${entry.expr}`} title="删除" onclick={() => calcStore.remove(entry.id)}>
							<X class="size-3.5" aria-hidden="true" />
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone="neutral" truncate>{calcStore.historyText}</StatusPill>
			{#if calcStore.history.length > 0}
				<Button
					size="xs"
					label="清空历史"
					title="清空全部历史（只删本机记录）"
					onclick={() => calcStore.clearHistory()}
				>
					清空历史
				</Button>
			{/if}
		</div>
	{/snippet}
</Panel>
