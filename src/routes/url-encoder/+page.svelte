<script lang="ts">
	import { Link } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { urlStore } from './core/store.svelte.ts';
	import Workspace from './ui/Workspace.svelte';

	// 输出区文本随输入视图变（编解码结果 / 合成串），「复制」要拿文本，这里同步进 encOutput 字段。
	$effect(() => {
		urlStore.encOutput = urlStore.outputText;
	});
</script>

<ToolShell
	icon={Link}
	name="URL 编解码"
	tagline="URL 编解码 · 查询字符串互转"
	heading="URL 编解码工具"
	description="在线 URL 编解码工具：encodeURIComponent / encodeURI 两种策略、解码带非法字符定位，查询字符串与参数表互转，纯本地运行。"
	keywords="URL编码,URL解码,encodeURIComponent,encodeURI,查询字符串,URLSearchParams,百分号编码,在线工具"
	path="/url-encoder"
	ogDescription="URL 编解码与查询字符串互转，严格 / 整链两种策略，纯本地运行。"
	width="full"
	fill="fill"
>
	<Workspace />
</ToolShell>
