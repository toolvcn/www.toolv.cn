<script lang="ts">
	// 网段信息面板：把 describeSubnet 的结果摊成一行一项（标签是界面文案，所以拼在这一层，不进 core/）。
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { subnetStore } from '../core/store.svelte.ts';
	import { formatIpv4, toBinaryText } from '../core/subnet.ts';

	interface InfoRow {
		label: string;
		value: string;
	}

	const rows = $derived.by((): InfoRow[] => {
		const info = subnetStore.info;
		if (info === null) return [];
		return [
			{ label: '输入地址', value: formatIpv4(info.ip) },
			{ label: '前缀长度', value: `/${info.prefix}` },
			{ label: '网络地址', value: formatIpv4(info.network) },
			{ label: '广播地址', value: formatIpv4(info.broadcast) },
			{ label: '子网掩码', value: formatIpv4(info.mask) },
			{ label: '反掩码', value: formatIpv4(info.wildcard) },
			{ label: '可用范围', value: `${formatIpv4(info.firstHost)} – ${formatIpv4(info.lastHost)}` },
			{ label: '可用地址数', value: String(info.usable) },
			{ label: '地址总数', value: String(info.total) },
			{ label: '地址段', value: info.scope },
			{ label: 'IP 类别', value: info.ipClass },
			{ label: '整数形式', value: String(info.ip) },
			{ label: '二进制', value: toBinaryText(info.ip) }
		];
	});
</script>

<Panel
	id="subnet-info-panel"
	headingId="subnet-info-heading"
	heading="网段信息"
	class="relative min-h-0 min-w-0 flex-1"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}
			>{subnetStore.info === null ? '网络 / 广播 / 掩码 / 可用范围' : `/${subnetStore.info.prefix}`}</span
		>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if subnetStore.info === null}
			<div class="p-4">
				<EmptyState>
					{subnetStore.error === ''
						? '在上面填一个 IPv4 地址或 CIDR，这里给出网络地址、广播地址、掩码与可用范围。'
						: '地址改对之后，这里会重新给出网段信息。'}
				</EmptyState>
			</div>
		{:else}
			<ul class="divide-y divide-gray-200">
				{#each rows as row (row.label)}
					<ResultRow>
						<span class="w-20 shrink-0 text-xs text-gray-600 sm:w-24">{row.label}</span>
						<span class="min-w-0 flex-1 font-mono text-xs break-all text-gray-900">{row.value}</span>
						<CopyButton icon text={row.value} ok={`已复制${row.label}`} label={`复制${row.label}：${row.value}`} />
					</ResultRow>
				{/each}
			</ul>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={subnetStore.infoTone} truncate>{subnetStore.infoText}</StatusPill>
		</div>
	{/snippet}
</Panel>
