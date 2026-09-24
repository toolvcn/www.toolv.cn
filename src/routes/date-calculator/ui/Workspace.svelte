<script lang="ts">
	// 日期计算主界面：标签条切「日期差 / 日期加减 / 工作日统计」三个工作区。
	import { CalendarCheck, CalendarDays, CalendarPlus } from '@lucide/svelte';
	import DiffPanel from './DiffPanel.svelte';
	import AddPanel from './AddPanel.svelte';
	import BusinessPanel from './BusinessPanel.svelte';
	import { dateStore } from '../core/store.svelte.ts';
	import type { DateTab } from '../core/types.ts';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	const TABS: { value: DateTab; label: string; icon?: typeof CalendarDays }[] = [
		{ value: 'diff', label: '日期差', icon: CalendarDays },
		{ value: 'add', label: '日期加减', icon: CalendarPlus },
		{ value: 'business', label: '工作日统计', icon: CalendarCheck }
	];
</script>

<TabShell aria-label="工具模式" options={TABS} value={dateStore.tab} onchange={(v) => dateStore.setTab(v)}>
	{#if dateStore.tab === 'diff'}
		<DiffPanel />
	{:else if dateStore.tab === 'add'}
		<AddPanel />
	{:else}
		<BusinessPanel />
	{/if}
</TabShell>

<Toast />
