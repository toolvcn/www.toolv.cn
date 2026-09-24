<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Confirm from '$lib/ui/Confirm/Confirm.svelte';
	import { favorites } from '$lib/ui/favorites.svelte';
	import { theme } from '$lib/ui/theme.svelte';

	let { children } = $props();

	// 主题与收藏都是站点级副作用，读存储只在浏览器里跑一次（SSR 阶段不碰 window）——
	// 这是全局副作用唯一该待的位置，两个 store 都不用自己碰生命周期。
	// 主题的首帧深浅已经由 app.html 里的内联脚本定好，这里只接手之后的切换与系统主题变化；
	// 收藏的入口在 ToolMenu 抽屉里，抽屉只能在 hydration 之后打开，所以晚一步读存储不影响。
	onMount(() => {
		theme.init();
		favorites.init();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
<!--
	全站唯一的二次确认框：挂在布局层而不是每个工具页 —— 它没有视觉占位
	（关着的时候就是一个 display:none 的 `<dialog>`），多挂一次反而会多出一个实例，
	`confirm.ask()` 只认得自己那一个。放置位置与 Toast 不同：那个每个工具页挂一次是因为
	它要按页面决定 top / bottom，这个没有页面差异。
-->
<Confirm />
