<script lang="ts">
	import { Hash } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { hashStore } from './core/store.svelte.ts';
	import Panel from './ui/Panel.svelte';

	// 摘要计算是异步的：input 一变就重算（refresh 内部有竞态序号兜底，晚到的旧结果会作废）。
	$effect(() => {
		void hashStore.refresh();
	});
</script>

<ToolShell
	icon={Hash}
	name="哈希计算"
	tagline="MD5 / SHA-1 / 256 / 384 / 512 · 纯本地"
	heading="哈希计算工具"
	description="在线哈希计算工具：MD5、SHA-1、SHA-256、SHA-384、SHA-512，输入即算、结果实时同步；MD5 为本地自实现（WebCrypto 不提供），MD5 与 SHA-1 两行标出「已不安全」，其余走 WebCrypto，全部纯本地运行。"
	keywords="哈希,MD5,MD5在线计算,SHA-1,SHA-256,SHA-384,SHA-512,摘要,校验和,在线工具"
	path="/hash-calculator"
	ogDescription="MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 一键计算，全部在浏览器本地完成。"
	width="full"
	fill="fill"
>
	<Panel />
</ToolShell>
