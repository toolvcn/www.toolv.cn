<script lang="ts">
	import { Table } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Panel from './ui/Panel.svelte';
</script>

<ToolShell
	icon={Table}
	name="CSV ↔ JSON 转换"
	tagline="双向互转 · 引号转义 · 类型推断"
	heading="CSV 与 JSON 互转"
	description="在线 CSV 与 JSON 互转工具：RFC 4180 引号转义完整支持，分隔符可换，值类型可推断，对象数组键并集补空，纯本地运行。"
	keywords="CSV转JSON,JSON转CSV,CSV JSON 互转,表格转换,在线工具"
	path="/csv-json"
	ogDescription="CSV 与 JSON 双向互转，引号转义与类型推断完整支持，纯本地运行。"
	width="full"
	fill="fill"
>
	<Panel />
</ToolShell>
