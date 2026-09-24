<script lang="ts">
	// 明细表：贷款按月（月供 / 本金 / 利息 / 剩余本金），存款按年（年初 / 当年利息 / 年末）。
	//
	// 360 期**全部算好、但不一次全渲染**：先给两年（SCHEDULE_STEP），剩下的靠底部按钮追加。
	// 这不是截断计算 —— 合计与结论始终按全部期数算，表里少显示的只是行。
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TABLE_TH } from '$lib/ui/styles';
	import { SCHEDULE_STEP } from '../core/interest.ts';
	import { interestStore } from '../core/store.svelte.ts';

	type ColumnKey = 'period' | 'payment' | 'principal' | 'interest' | 'balance';

	interface Column {
		key: ColumnKey;
		label: string;
	}

	/** 贷款与存款的列不同：拿同一份 DetailRow，换一套表头与取列顺序 */
	const columns = $derived.by((): Column[] => {
		if (interestStore.mode === 'loan') {
			return [
				{ key: 'period', label: '期数' },
				{ key: 'payment', label: '月供' },
				{ key: 'principal', label: '本金' },
				{ key: 'interest', label: '利息' },
				{ key: 'balance', label: '剩余本金' }
			];
		}
		return [
			{ key: 'period', label: '年份' },
			{ key: 'principal', label: '年初余额' },
			{ key: 'interest', label: '当年利息' },
			{ key: 'balance', label: '年末余额' }
		];
	});

	const rows = $derived(interestStore.visibleRows);
	const cellClass = 'px-4 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap text-gray-700';
</script>

<Panel
	id="interest-schedule-panel"
	headingId="interest-schedule-heading"
	heading={interestStore.mode === 'loan' ? '还款计划' : '逐年明细'}
	class="relative min-h-0 min-w-0 flex-1"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>
			{interestStore.mode === 'loan' ? '逐期对账：本金越还越多' : '逐年滚存：利息也计入下一年的本金'}
		</span>
	{/snippet}

	<div class="max-h-[60vh] min-h-0 lg:max-h-none lg:min-h-0 lg:flex-1">
		{#if rows.length === 0}
			<div class="p-4">
				<EmptyState>
					{interestStore.mode === 'loan'
						? '填好金额、年利率与期限，这里按顺序列出每一期的月供构成。'
						: '填好金额、年利率与期限，这里按年列出利息与余额。'}
				</EmptyState>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="h-full overflow-auto" tabindex="0" role="region" aria-label="明细表">
				<table class="w-full min-w-[28rem] border-collapse text-left text-xs">
					<thead class="sticky top-0 z-10 bg-white">
						<tr class="border-b border-gray-200">
							{#each columns as column (column.key)}
								<th scope="col" class={TABLE_TH}>
									{column.label}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each rows as row (row.key)}
							<tr class="hover:bg-gray-50">
								{#each columns as column, index (column.key)}
									{#if index === 0}
										<td class="px-4 py-2 text-gray-600 tabular-nums">{row[column.key]}</td>
									{:else}
										<td class={cellClass}>{row[column.key]}</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={interestStore.detailTone} truncate>{interestStore.detailText}</StatusPill>
			{#if interestStore.remainingRows > 0}
				<Button
					size="xs"
					label={`再显示 ${Math.min(SCHEDULE_STEP, interestStore.remainingRows)} ${interestStore.mode === 'loan' ? '期' : '年'}`}
					onclick={() => interestStore.showMore()}
				>
					再显示 {Math.min(SCHEDULE_STEP, interestStore.remainingRows)}
					{interestStore.mode === 'loan' ? '期' : '年'}
				</Button>
			{/if}
		</div>
	{/snippet}
</Panel>
