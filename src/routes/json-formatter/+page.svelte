<script lang="ts">
	import { Braces } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { jsonStore } from './core/store.svelte.ts';
	import Panel from './ui/Panel.svelte';

	// 输出是派生值（只能读），而「复制」要拿到完整结果文本，
	// 所以这里把它同步进 store 的 output 字段（不含截断）。
	$effect(() => {
		jsonStore.output = jsonStore.value;
	});
</script>

<ToolShell
	icon={Braces}
	name="JSON 格式化"
	tagline="格式化 · 压缩 · 校验 · 语法高亮"
	heading="JSON 格式化工具"
	description="在线 JSON 格式化与压缩工具：语法高亮、实时校验、错误行列定位，纯本地运行，不上传数据。"
	keywords="JSON,格式化,压缩,校验,语法高亮,错误定位,在线工具"
	path="/json-formatter"
	ogDescription="格式化 / 压缩 / 校验 JSON，语法高亮与错误行列定位，纯本地运行。"
	width="full"
	fill="fill"
	docUrl="https://www.runoob.com/json/json-tutorial.html"
	docLabel="JSON 教程"
>
	<Panel />
</ToolShell>
