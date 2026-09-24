<script lang="ts">
	import { ListChecks } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={ListChecks}
	name="速查表"
	tagline="九张表一页切换"
	heading="速查表"
	description="在线速查表大全：MIME 类型与扩展名双向查询、ASCII 码表（十进制 / 十六进制 / 转义写法）、HTTP 请求头、常见端口、User-Agent 片段、特殊符号（Unicode 码点与 HTML 实体）、Android 权限、世界区号、中国历史朝代，共九张表一页切换；每张表都能搜索、点行尾一键复制，纯本地运行不上传任何数据。"
	keywords="速查表,MIME 类型,Content-Type,文件扩展名,ASCII 码表,HTTP 请求头,常见端口,端口对照表,User-Agent,特殊符号,HTML 实体,Unicode 码点,Android 权限,世界区号,国家区号,中国历史朝代,在线速查"
	path="/cheatsheet"
	ogDescription="九张速查表一页切换：MIME 类型 / ASCII 码表 / HTTP 请求头 / 常见端口 / User-Agent / 特殊符号 / Android 权限 / 世界区号 / 历史朝代，搜索即筛、点选即复制。"
	width="wide"
>
	<Workspace />
</ToolShell>
