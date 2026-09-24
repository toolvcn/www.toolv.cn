<script lang="ts">
	// 主面板：UUID / 密码 / 随机数 / 假文四个工作区的切换外壳。
	// 标签条 + 内容区的骨架走通用的 `TabShell`（UI-STYLE §8.2），这里只给标签元数据与分支。
	import { Dices, FingerprintPattern, Hash, Type } from '@lucide/svelte';
	import { generatorStore, type Tab } from '../core/store.svelte.ts';
	import LoremPanel from './LoremPanel.svelte';
	import NumberPanel from './NumberPanel.svelte';
	import PasswordPanel from './PasswordPanel.svelte';
	import UuidPanel from './UuidPanel.svelte';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	const TABS: { value: Tab; label: string; icon?: typeof FingerprintPattern }[] = [
		{ value: 'uuid', label: 'UUID', icon: FingerprintPattern },
		{ value: 'password', label: '密码', icon: Hash },
		{ value: 'number', label: '随机数', icon: Dices },
		{ value: 'lorem', label: '假文', icon: Type }
	];
</script>

<TabShell aria-label="生成器类型" options={TABS} value={generatorStore.tab} onchange={(v) => generatorStore.setTab(v)}>
	{#if generatorStore.tab === 'uuid'}
		<UuidPanel />
	{:else if generatorStore.tab === 'password'}
		<PasswordPanel />
	{:else if generatorStore.tab === 'number'}
		<NumberPanel />
	{:else}
		<LoremPanel />
	{/if}
</TabShell>

<Toast />
