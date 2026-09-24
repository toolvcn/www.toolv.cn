<script lang="ts">
	// 独立窗口的展示页：整页只有一个时钟，没有导航栏、没有设置面板。
	//
	// **配置只来自地址参数** —— 地址就是这份窗口的唯一真值：不读 localStorage，也不跟着别的窗口变。
	// 这样一份地址自带一份配置：可以同时开好几个窗口各显示各的（一个时钟 + 一个倒计时），
	// 地址能收藏、能发给别人、能直接粘进 OBS 的浏览器源（那边是另一个浏览器 profile，
	// 本来就够不着本站的存储），换个浏览器或换台机器也显示成同一个样子。
	//
	// 没写的项一律用默认值（store 的初始值，即 config.ts 里那几个默认常量），
	// 所以裸地址 `/clock/display` 就是一个默认样式的时钟。
	//
	// 与画中画的关键差别：这里**不搬 DOM**，是自己渲染一份；搬节点那套只服务画中画。
	// 所以这一页可以正常用 Tailwind class，不受「样式必须内联」那条约束。
	import { untrack } from 'svelte';
	import { TICK_MS } from '../config.ts';
	import { parseDisplayParams } from '../core/params.ts';
	import { clockStore } from '../core/store.svelte.ts';
	import ClockStage from '../ui/ClockStage.svelte';

	// 启动：应用地址参数 → 取一次系统时间 → 开新一轮，然后起走时定时器。
	//
	// ⚠️ 三件事一起裹 `untrack` 是**必须**的，否则整页会冻在预渲染的那一帧上
	// （现象是「时钟不走」，很像 JS 没执行）。原因：`applyOverrides` 对每个字段都是「先读再写回」
	// （`this.style = { ...this.style, ...patch }`），effect 读到的依赖被自己写变了，
	// 跑完立刻又得重跑，无限自触发，Svelte 跑满上限后停止更新。
	//
	// 顺带：计时进度不落盘，所以独立窗口每次打开（含刷新）都是一轮新的倒计时 / 秒表。
	$effect(() => {
		untrack(() => {
			clockStore.applyOverrides(parseDisplayParams(window.location.search));
			clockStore.now = Date.now();
			clockStore.startNewRound();
		});
		// 走时：每次重新读系统时间，而不是在上一秒上加一 —— 标签页被节流时也不会走偏
		const timer = setInterval(() => (clockStore.now = Date.now()), TICK_MS);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>时钟 · 独立窗口 | www.toolv.cn</title>
	<!-- 展示页与工具页内容重复，不要被搜索引擎各收一份 -->
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- 铺满视口：用 fixed inset-0 而不是去给 html / body 定高，免得动全局样式 -->
<div style="position: fixed; inset: 0;">
	<ClockStage />
</div>
