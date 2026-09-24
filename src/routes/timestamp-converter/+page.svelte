<script lang="ts">
	import { onMount } from 'svelte';
	import { Clock3 } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { tsStore } from './core/store.svelte.ts';
	import Panel from './ui/Panel.svelte';

	// 默认值在挂载后才换成「此刻」：页面是预渲染的（+page.ts 的 prerender），
	// 让 SSR 输出示例时间戳 → 挂载时再换成当前时间戳，构建时刻的值才不会被烘进 HTML。
	onMount(() => {
		tsStore.fillNow();
		tsStore.initCompare();
	});
</script>

<ToolShell
	icon={Clock3}
	name="时间戳转换"
	tagline="时间戳互转 · 双时间戳对比 · 世界时钟"
	heading="时间戳转换工具"
	description="在线时间戳与时间互转工具：打开即填入当前时间戳，自动识别秒/毫秒、支持 1970 年前负数，UTC 与本地时间对照；可填两个时间戳对比差值（天/时/分/秒/毫秒，按 B − A），附世界时钟多时区展示，纯本地运行。"
	keywords="时间戳,时间戳转换,Unix时间戳,时间戳对比,时间差计算,UTC,时区,世界时钟,datetime,在线工具"
	path="/timestamp-converter"
	ogDescription="秒 / 毫秒时间戳与本地时间互转，默认当前时间，可对比两个时间戳的差值，附多时区世界时钟。"
	width="full"
>
	<Panel />
</ToolShell>
