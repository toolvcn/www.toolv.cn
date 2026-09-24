<script lang="ts">
	import { FileCode } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Panel from './ui/Panel.svelte';
</script>

<ToolShell
	icon={FileCode}
	name="JSON 转 TypeScript"
	tagline="样例生成 interface · 缺失键标可选"
	description="在线 JSON 转 TypeScript 工具：粘贴样例自动生成 interface / type 定义，对象数组合并去重、缺失键标可选、嵌套命名可读，根类型名与 export 可调，纯本地运行。"
	keywords="JSON转TypeScript,JSON生成interface,JSON to TS,TypeScript类型生成,类型定义,在线工具"
	path="/json-to-ts"
	ogDescription="粘贴 JSON 样例自动生成 interface / type，缺失键标可选，纯本地运行。"
	width="full"
	fill="fill"
>
	<Panel />
</ToolShell>
