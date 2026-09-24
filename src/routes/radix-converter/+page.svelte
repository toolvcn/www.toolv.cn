<script lang="ts">
	import { Binary } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Panel from './ui/Panel.svelte';
</script>

<ToolShell
	icon={Binary}
	name="进制转换"
	tagline="2 / 8 / 10 / 16 / 36 进制互转"
	heading="进制转换工具"
	description="在线进制转换工具：二进制 / 八进制 / 十进制 / 十六进制 / 三十六进制互转，BigInt 运算支持任意大整数，纯本地运行。"
	keywords="进制转换,二进制,八进制,十六进制,BigInt,2进制转10进制,在线工具"
	path="/radix-converter"
	ogDescription="2 / 8 / 10 / 16 / 36 进制互转，BigInt 精确运算支持任意大整数。"
	width="full"
>
	<Panel />
</ToolShell>
