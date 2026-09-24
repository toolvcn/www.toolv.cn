<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={FileText}
	name="文本统计与清理"
	tagline="字符 · 字数 · 行数 · 一键清理"
	description="在线文本统计与清理工具：字符数、字数、行数、段落数、UTF-8 字节多口径统计，支持去重、去空行、排序等行级清理，纯本地运行。"
	keywords="字数统计,字符统计,文本清理,文本去重,删除空行,文本排序,UTF-8字节,在线工具"
	path="/text-tools"
	ogDescription="文本多口径统计与行级清理，去重去空行排序一键完成，纯本地运行。"
	width="full"
	fill="fill"
>
	<Workspace />
</ToolShell>
