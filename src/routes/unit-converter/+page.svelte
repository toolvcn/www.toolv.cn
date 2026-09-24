<script lang="ts">
	import { Ruler } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Ruler}
	name="单位换算"
	tagline="十五类单位 · 一次全出结果"
	description="在线单位换算工具：长度 / 面积 / 体积 / 重量 / 温度 / 速度 / 时间 / 角度 / 力 / 压力 / 功率 / 密度 / 能量 / 数据大小 / CSS 长度共十五类实时互转；数据大小并列 KB 与 KiB 两种口径，rem 跟随根字号，输入一次全部单位同时出结果，纯本地运行。"
	keywords="单位换算,长度单位换算,面积换算,体积换算,重量换算,温度换算,速度换算,时间换算,角度换算,压力换算,功率换算,密度换算,能量换算,数据大小换算,rem 转 px,在线单位转换器"
	path="/unit-converter"
	ogDescription="十五类单位实时互转：长度 / 面积 / 体积 / 重量 / 温度 / 速度 / 时间 / 角度 / 力 / 压力 / 功率 / 密度 / 能量 / 数据大小 / CSS 长度，纯本地运行。"
	width="full"
>
	<Workspace />
</ToolShell>
