<script lang="ts">
	import { onMount } from 'svelte';
	import { Activity } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import Composer from './ui/Composer.svelte';
	import ConnectionBar from './ui/ConnectionBar.svelte';
	import ConnectionList from './ui/ConnectionList.svelte';
	import LogPanel from './ui/LogPanel.svelte';
	import { ws } from './core/websocket.svelte.ts';

	// 全局副作用：Svelte 5 的 $effect 只能在组件实例上下文里用，
	// 而这个页面就是唯一的入口，所以直接放在这里，不再单开一个不渲染 DOM 的组件。
	// 写本地存储只有一处：预设，而且由用户点「保存到本地」触发（见 ws.savePresets）。
	// 定时发送的间隔这类随手改的值不做持久化，避免留下没人记得清的隐藏状态。

	// 每秒推进 ws.now，驱动连接时长显示；没有已连接连接时不写状态，避免空转触发重渲染
	$effect(() => {
		const timer = setInterval(() => {
			if (ws.connections.connectedCount > 0) ws.now = Date.now();
		}, 1000);
		return () => clearInterval(timer);
	});

	// 离开页面时收掉连接与定时任务，不等浏览器回收
	$effect(() => {
		const cleanup = () => ws.connections.disconnectAll();
		window.addEventListener('pagehide', cleanup);
		return () => window.removeEventListener('pagehide', cleanup);
	});

	// 预设：进页面时读一次本地存储。存不存由消息面板的「保存到本地」按钮决定，不自动写盘
	onMount(() => ws.loadPresets());

	// 定时任务：逐条同步定时器（按需建 / 撤，不动其它连接的相位）
	$effect(() => ws.connections.syncAllScheduled());

	// 路由跳走时收掉全部连接与定时器：pagehide 那条只覆盖整页卸载
	$effect(() => {
		return () => ws.connections.disposeAll();
	});
</script>

<!-- 自绘栅格：连接栏通栏、连接列表跨两行、消息与日志并排，默认的纵向 flex 排不出来。
     保留 mainClass 还为了把外边距钉在 p-4：默认 main 是 p-4 sm:p-6，≥640 会松到 24px。
     不再写 lg:overflow-hidden —— 外壳在 fillFrom 断点上已经有了，实测删掉面板矩形不变 -->
<ToolShell
	icon={Activity}
	name="WebSocket 在线测试工具"
	tagline="专业多连接调试 · 实时消息监控"
	description="专业的 WebSocket 在线测试工具，支持多连接管理、消息收发、定时发送、自动发送、日志监控与导出，适用于 API 调试与实时通信测试。"
	keywords="WebSocket,在线测试,调试工具,实时通信,WS测试,WSS测试"
	ogDescription="支持多连接管理、消息收发、定时发送、日志监控的专业 WebSocket 调试工具。"
	path="/websocket"
	width="full"
	fill="fill"
	fillFrom="lg"
	docUrl="https://www.runoob.com/html/html5-websocket.html"
	docLabel="WebSocket 教程"
	mainClass="relative grid grid-cols-1 gap-4 p-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-rows-[auto_minmax(0,1fr)]"
>
	<div class="lg:col-span-full">
		<ConnectionBar />
	</div>
	<!-- 移动端只有一个滚动上下文：整页滚动，面板高度自适应内容（不套内部滚动条）；
		     lg 起高度交回栅格行，改由面板内部滚动，xl 起三列并排 -->
	<div class="lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:h-auto xl:row-span-1">
		<ConnectionList />
	</div>
	<div class="lg:col-start-2 lg:row-start-2">
		<Composer />
	</div>
	<div class="lg:col-start-2 lg:row-start-3 lg:h-auto xl:col-start-3 xl:row-start-2">
		<LogPanel />
	</div>

	<!-- Toast 是 fixed 定位，放在 main 里不影响栅格，但能落进 landmark 内。
	     底部是消息输入区，所以提示挂顶（落在 h-14 导航栏下面），不压住输入框 -->
	<Toast position="top" />
</ToolShell>
