<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={CalendarDays}
	name="日期计算"
	tagline="日期差 · 加减 · 工作日统计"
	description="在线日期计算工具：两个日期相差天数与周月年换算、日期加减天周月年（可跳过周末只算工作日）、区间工作日统计，纯本地运行。"
	keywords="日期计算,日期相差天数,日期加减计算器,工作日统计,在线工具"
	path="/date-calculator"
	ogDescription="日期差、日期加减、工作日统计三合一，纯本地运行。"
	width="full"
>
	<Workspace />
</ToolShell>
