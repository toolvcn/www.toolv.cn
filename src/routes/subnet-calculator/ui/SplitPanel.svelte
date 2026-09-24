<script lang="ts">
	// 子网划分面板：按工具条里选定的目标前缀把当前网段切成等长小段，
	// 逐段列出网络地址 / 可用范围 / 广播地址。行尾复制的是这一段的 CIDR（如 192.168.1.64/26）。
	//
	// 「目标前缀」这个控件放在**工具条**而不是本卡片的标题行：卡片标题行里的下拉是浮层，
	// 会依次踩到两个坑 —— 卡片默认 `overflow-hidden` 把菜单裁掉、表格 `sticky` 表头的 `z-10`
	// 又把菜单压住。站内口径本来就是「工具条放控件、卡片出结果」（见 unit-converter）。
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { DATA_TABLE, FOOTER_BAR, PANEL_HINT, TABLE_TH } from '$lib/ui/styles';
	import { subnetStore } from '../core/store.svelte.ts';
	import { formatIpv4 } from '../core/subnet.ts';

	const rows = $derived(subnetStore.split.rows);
</script>

<Panel
	id="subnet-split-panel"
	headingId="subnet-split-heading"
	heading="子网划分"
	class="relative min-h-0 min-w-0 flex-1"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>
			{subnetStore.target === null ? '按目标前缀切等长小段' : `按 /${subnetStore.target} 切等长小段`}
		</span>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if rows.length === 0}
			<div class="p-4">
				<EmptyState>
					{subnetStore.info === null
						? '填好地址后，这里按选定的目标前缀列出每个子网。'
						: '当前前缀没有可切的下级网段（/32 已经是单个主机地址）。'}
				</EmptyState>
			</div>
		{:else}
			<table class={DATA_TABLE}>
				<thead class="sticky top-0 z-10 bg-white">
					<tr class="border-b border-gray-200">
						<th scope="col" class="{TABLE_TH} w-12">#</th>
						<th scope="col" class={TABLE_TH}>网络地址</th>
						<th scope="col" class={TABLE_TH}>可用范围</th>
						<th scope="col" class={TABLE_TH}>广播地址</th>
						<th scope="col" class="w-10 px-2 py-2"><span class="sr-only">复制</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each rows as row, index (row.network)}
						{@const cidr = `${formatIpv4(row.network)}/${subnetStore.target}`}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-2 text-gray-600 tabular-nums">{index + 1}</td>
							<td class="px-4 py-2 font-mono whitespace-nowrap text-gray-900">{formatIpv4(row.network)}</td>
							<td class="px-4 py-2 font-mono whitespace-nowrap text-gray-700">
								{formatIpv4(row.firstHost)} – {formatIpv4(row.lastHost)}
							</td>
							<td class="px-4 py-2 font-mono whitespace-nowrap text-gray-700">{formatIpv4(row.broadcast)}</td>
							<td class="px-2 py-2 text-right">
								<CopyButton icon text={cidr} ok={`已复制 ${cidr}`} label={`复制 ${cidr}`} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={subnetStore.splitTone} truncate>{subnetStore.splitText}</StatusPill>
		</div>
	{/snippet}
</Panel>
