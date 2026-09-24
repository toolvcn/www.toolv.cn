<script lang="ts">
	// 加解密工具箱的主面板：五个工作区的标签切换外壳。
	// 标签条下方紧跟卡片（工具条与参数卡片），所以走 `variant="flat"`（两层阴影叠着显脏）。
	import { KeyRound, KeySquare, Lock, RotateCw, ShieldCheck } from '@lucide/svelte';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { cryptoStore } from '../core/store.svelte.ts';
	import type { CryptoTab } from '../core/types.ts';
	import AesPanel from './AesPanel.svelte';
	import CaesarPanel from './CaesarPanel.svelte';
	import HmacPanel from './HmacPanel.svelte';
	import RsaPanel from './RsaPanel.svelte';
	import VigenerePanel from './VigenerePanel.svelte';

	// 五个标签 = README 里的 ID 45-49，全在一页里切换（功能相近合并成一页的约定）
	const TABS: { value: CryptoTab; label: string; icon?: typeof Lock }[] = [
		{ value: 'aes', label: 'AES', icon: Lock },
		{ value: 'rsa', label: 'RSA', icon: KeyRound },
		{ value: 'hmac', label: 'HMAC', icon: ShieldCheck },
		{ value: 'caesar', label: '凯撒', icon: RotateCw },
		{ value: 'vigenere', label: '维吉尼亚', icon: KeySquare }
	];
</script>

<TabShell
	variant="flat"
	aria-label="加解密工作区"
	options={TABS}
	value={cryptoStore.tab}
	onchange={(v) => cryptoStore.setTab(v)}
>
	{#if cryptoStore.tab === 'aes'}
		<AesPanel />
	{:else if cryptoStore.tab === 'rsa'}
		<RsaPanel />
	{:else if cryptoStore.tab === 'hmac'}
		<HmacPanel />
	{:else if cryptoStore.tab === 'caesar'}
		<CaesarPanel />
	{:else}
		<VigenerePanel />
	{/if}
</TabShell>

<Toast />
