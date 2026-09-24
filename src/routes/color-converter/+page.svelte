<script lang="ts">
	import { Palette } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Converter from './ui/Converter.svelte';
</script>

<ToolShell
	icon={Palette}
	name="颜色转换"
	tagline="HEX / RGB / HSL · WCAG 对比度"
	description="在线颜色转换工具：HEX / RGB / HSL 互转，支持透明度写法，内置 WCAG 对比度检查（AA / AAA 四档判定），纯本地运行。"
	keywords="颜色转换,HEX转RGB,HSL,WCAG对比度,颜色对照,在线工具"
	path="/color-converter"
	ogDescription="HEX / RGB / HSL 互转 + WCAG 对比度检查，纯本地运行。"
	width="full"
>
	<Converter />
</ToolShell>
