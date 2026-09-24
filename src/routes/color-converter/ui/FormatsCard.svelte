<script lang="ts">
	// 各格式输出卡：HEX / RGB / HSL 三行，逐行复制。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { colorStore } from '../core/store.svelte.ts';

	const hasRows = $derived(colorStore.rows.length > 0);
</script>

<Panel id="color-formats" headingId="color-formats-heading" heading="各格式" class="shrink-0">
	{#snippet actions()}
		<span class="text-xs text-gray-600">点行尾按钮复制</span>
	{/snippet}
	<!-- role="status" 让解析结果的变化即时播报给读屏 -->
	<div role="status" aria-live="polite" class="p-2">
		{#if !hasRows}
			<p class="px-2 py-3 text-sm text-gray-600">输入合法颜色后，这里逐行列出 HEX / RGB / HSL。</p>
		{:else}
			<ul class="divide-y divide-gray-100">
				{#each colorStore.rows as row (row.label)}
					<ResultRow density="sm">
						<span class="w-10 shrink-0 text-xs font-semibold text-gray-600">{row.label}</span>
						<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900" title={row.value}>
							{row.value}
						</span>
						<CopyButton icon text={row.value} ok={`已复制 ${row.label}`} label="复制 {row.label} 格式" />
					</ResultRow>
				{/each}
			</ul>
		{/if}
	</div>
</Panel>
