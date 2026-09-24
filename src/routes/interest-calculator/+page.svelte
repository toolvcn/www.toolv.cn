<script lang="ts">
	import { Percent } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Percent}
	name="利率计算器"
	tagline="房贷月供 · 等额本息 / 等额本金 · 存款利息"
	heading="利率计算器"
	description="在线利率计算器：房贷 / 车贷按等额本息或等额本金算月供、总利息与逐期还款计划，两种还款方式直接比出利息差；存款按单利或复利（按年 / 按季 / 按月）算到期本息与实际年化。纯浏览器本地计算，不上传任何数据。"
	keywords="利率计算器,房贷计算器,月供计算,等额本息,等额本金,还款计划表,贷款利息,存款利息,复利计算,单利,实际年化,在线工具"
	path="/interest-calculator"
	ogDescription="房贷月供与总利息一次算清，等额本息与等额本金直接比差额；存款按单利 / 复利算到期本息与实际年化。"
	width="wide"
	fill="fill"
	fillFrom="lg"
>
	<Workspace />
</ToolShell>
