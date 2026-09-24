<script lang="ts">
	// 文本工具的主界面：标签条切「文本统计」与「文本清理」两个工作区。
	// `h-full` 是本工具的高度策略（页面是 fill 档），其余骨架走通用 TabShell。
	import { FileText, ListChecks } from '@lucide/svelte';
	import StatsPanel from './StatsPanel.svelte';
	import CleanPanel from './CleanPanel.svelte';
	import { textStore, type ToolTab } from '../core/store.svelte.ts';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	const TABS: { value: ToolTab; label: string; icon?: typeof FileText }[] = [
		{ value: 'stats', label: '文本统计', icon: FileText },
		{ value: 'clean', label: '文本清理', icon: ListChecks }
	];
</script>

<TabShell
	class="h-full"
	aria-label="工具模式"
	options={TABS}
	value={textStore.tab}
	onchange={(v) => textStore.setTab(v)}
>
	{#if textStore.tab === 'stats'}
		<StatsPanel />
	{:else}
		<CleanPanel />
	{/if}
</TabShell>

<Toast />
