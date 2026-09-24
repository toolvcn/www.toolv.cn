<script lang="ts">
	import { Network } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Network}
	name="子网掩码计算器"
	tagline="IPv4 子网划分 · CIDR · 可用主机数"
	heading="子网掩码计算器"
	description="在线 IPv4 子网掩码计算器：输入地址或 CIDR（192.168.1.10/24，也支持点分掩码 255.255.255.0），一次给出网络地址、广播地址、子网掩码、反掩码、可用地址范围与可用主机数，并按目标前缀把网段切成等长子网；纯本地计算，不上传任何数据。"
	keywords="子网掩码计算器,子网划分,IP地址计算,CIDR,网络地址,广播地址,可用主机数,反掩码,通配符掩码,IPv4 子网计算,在线工具"
	path="/subnet-calculator"
	ogDescription="IPv4 子网计算与划分：网络地址 / 广播地址 / 掩码 / 反掩码 / 可用范围一次算全，还能按目标前缀切子网。"
	width="wide"
	fill="fill"
	fillFrom="lg"
>
	<Workspace />
</ToolShell>
