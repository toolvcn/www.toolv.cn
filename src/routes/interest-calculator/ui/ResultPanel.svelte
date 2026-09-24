<script lang="ts">
	// 计算结果面板：把派生出来的结论摊成一行一项（标签是界面文案，所以拼在这一层，不进 core/）。
	//
	// 贷款那一栏最后一行是**另一种还款方式的利息差**：两种方式各算一遍再比，
	// 这是贷款计算里最常被追问的一句（「等额本金到底省多少」），而它只是两个数相减。
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { formatMoney, formatPercent } from '../core/format.ts';
	import { interestStore } from '../core/store.svelte.ts';

	interface ResultItem {
		label: string;
		value: string;
	}

	const rows = $derived.by((): ResultItem[] => {
		if (interestStore.mode === 'loan') {
			const loan = interestStore.loan;
			if (loan === null) return [];
			const installment = interestStore.method === 'equal-installment';
			const items: ResultItem[] = [
				{ label: installment ? '每月月供' : '首月月供', value: formatMoney(loan.firstPayment) }
			];
			if (!installment) {
				items.push({ label: '末月月供', value: formatMoney(loan.lastPayment) });
				items.push({ label: '每月递减', value: formatMoney(loan.monthlyStep) });
			}
			items.push({ label: '还款期数', value: `${loan.months} 期` });
			items.push({ label: '支付利息', value: formatMoney(loan.totalInterest) });
			items.push({ label: '本息合计', value: formatMoney(loan.totalPayment) });

			const alt = interestStore.altLoan;
			if (alt !== null) {
				const diff = alt.totalInterest - loan.totalInterest;
				const altName = installment ? '等额本金' : '等额本息';
				items.push({
					label: `换成${altName}`,
					value: diff === 0 ? '两种方式利息一样' : `利息${diff > 0 ? '多' : '少'}付 ${formatMoney(Math.abs(diff))} 元`
				});
			}
			return items;
		}

		const deposit = interestStore.deposit;
		if (deposit === null) return [];
		return [
			{ label: '到期利息', value: formatMoney(deposit.totalInterest) },
			{ label: '到期本息', value: formatMoney(deposit.total) },
			{ label: '实际年化', value: formatPercent(deposit.effectiveRate) },
			{ label: '存期', value: interestStore.years.ok ? `${interestStore.years.value} 年` : '—' }
		];
	});
</script>

<Panel
	id="interest-result-panel"
	headingId="interest-result-heading"
	heading="计算结果"
	class="relative min-h-0 min-w-0 flex-1"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>{interestStore.mode === 'loan' ? '月供 / 总利息 / 本息合计' : '到期本息 / 实际年化'}</span>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if rows.length === 0}
			<div class="p-4">
				<EmptyState>
					{interestStore.error === ''
						? '在上面填金额、年利率与期限，这里给出月供、总利息与两种还款方式的差额。'
						: '把标红的那一格改对，这里会重新算一遍。'}
				</EmptyState>
			</div>
		{:else}
			<ul class="divide-y divide-gray-200">
				{#each rows as row (row.label)}
					<ResultRow>
						<span class="w-24 shrink-0 text-xs text-gray-600">{row.label}</span>
						<span class="min-w-0 flex-1 font-mono text-sm break-all text-gray-900 tabular-nums">{row.value}</span>
						<CopyButton icon text={row.value} ok={`已复制${row.label}`} label={`复制${row.label}：${row.value}`} />
					</ResultRow>
				{/each}
			</ul>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={interestStore.resultTone} truncate>{interestStore.resultText}</StatusPill>
		</div>
	{/snippet}
</Panel>
