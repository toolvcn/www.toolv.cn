<script lang="ts">
	import { Code } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { entityStore } from './core/store.svelte.ts';
	import Converter from './ui/Converter.svelte';

	// 输出是派生值（只能读），「复制」要拿文本，这里同步进 outputMirror 字段。
	$effect(() => {
		entityStore.outputMirror = entityStore.output;
	});
</script>

<ToolShell
	icon={Code}
	name="HTML 实体编解码"
	tagline="命名实体 · 数字实体 · 转义范围可调"
	description="在线 HTML 实体编解码工具：&amp; 等命名实体与 &#38; 数字实体互转，转义范围与实体形式可调，解码宽容处理坏实体，纯本地运行。"
	keywords="HTML实体,实体编解码,HTML转义,数字实体,命名实体,&amp;amp;,在线工具"
	path="/html-entity"
	ogDescription="HTML 命名实体与数字实体互转，转义范围与形式可调，纯本地运行。"
	width="full"
	fill="fill"
>
	<Converter />
</ToolShell>
