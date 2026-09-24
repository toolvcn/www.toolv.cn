<script lang="ts">
	import { Binary } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { base64 } from './core/store.svelte.ts';
	import Panel from './ui/Panel.svelte';

	// processedOutput 是派生值（只能读），而「互换」「复制」要拿到当前结果文本，
	// 所以这里把它同步进 store 的 output 字段。
	// 这个 effect 只读派生值、只写 output，output 不参与 processedOutput 的计算，不会自激。
	$effect(() => {
		base64.output = base64.processedOutput;
	});
</script>

<ToolShell
	icon={Binary}
	name="Base64 编解码"
	tagline="文本互转 · URL-safe · 图片预览"
	heading="Base64 编解码工具"
	description="在线 Base64 编解码工具，支持文本互转、URL-safe 模式与图片转 Data URL 预览，一键切换方向、复制结果，纯本地运行，不上传数据。"
	keywords="Base64,编解码,在线工具,URL-safe,图片转Base64,DataURL,文本编码,Base64编码,Base64解码"
	path="/base64"
	ogDescription="文本与 Base64 互转，支持 URL-safe 模式与图片转 Data URL 预览，纯本地运行。"
	width="full"
	fill="fill"
	docUrl="https://www.runoob.com/jsref/met-win-btoa.html"
	docLabel="Base64 教程"
>
	<Panel />
</ToolShell>
