<script lang="ts">
	// 速查表主面板：九张表的标签切换外壳。
	// 前两张（MIME 类型 / ASCII 码表）各有专属形态的组件，后七张走通用 ReferenceTable。
	// 九个标签一行放不下，靠共享 `Tabs` 的横向滚动兜住（`$lib/ui/styles` 的 TAB_BAR / TAB_BTN 是一对）。
	import { Binary, FileCode, Globe, Landmark, Monitor, Network, ScrollText, Smartphone, Type } from '@lucide/svelte';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import type { ReferenceTableId } from '../core/reference.ts';
	import { cheatsheetStore, type Tab } from '../core/store.svelte.ts';
	import { REFERENCE_TABLES, referenceTable } from '../core/tables.ts';
	import AsciiTable from './AsciiTable.svelte';
	import MimeTable from './MimeTable.svelte';
	import ReferenceTable from './ReferenceTable.svelte';

	/** 通用表的图标：数据在 core/ 里不带图标（那边是纯数据），图标在这一层配 */
	const REFERENCE_ICONS: Record<ReferenceTableId, typeof FileCode> = {
		ports: Network,
		'http-headers': ScrollText,
		'user-agents': Monitor,
		symbols: Type,
		'android-permissions': Smartphone,
		'calling-codes': Globe,
		dynasties: Landmark
	};

	const TABS: { value: Tab; label: string; icon?: typeof FileCode }[] = [
		{ value: 'mime', label: 'MIME 类型', icon: FileCode },
		{ value: 'ascii', label: 'ASCII 码表', icon: Binary },
		...REFERENCE_TABLES.map((table) => ({
			value: table.id,
			label: table.label,
			icon: REFERENCE_ICONS[table.id]
		}))
	];
</script>

<TabShell
	variant="flat"
	aria-label="速查表类型"
	options={TABS}
	value={cheatsheetStore.tab}
	onchange={(v) => cheatsheetStore.setTab(v)}
>
	{#if cheatsheetStore.tab === 'mime'}
		<MimeTable />
	{:else if cheatsheetStore.tab === 'ascii'}
		<AsciiTable />
	{:else}
		<ReferenceTable table={referenceTable(cheatsheetStore.tab)} />
	{/if}
</TabShell>

<Toast />
