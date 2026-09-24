<script lang="ts">
	// 「悬浮时钟 · 计时器」页面：外壳 + 本页的两个全局副作用（走时定时器、读写 localStorage）。
	//
	// 为什么副作用写在这里而不是 Workspace：STRUCTURE §2 B 规定全局副作用只在页面这一层，
	// 而且页面是这个工具唯一的入口，定时器、读盘、写盘都属于「页面活着期间一直要跑」的事。
	import { untrack } from 'svelte';
	import { Clock } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { copyToClipboard } from '$lib/ui/copy';
	import { toast } from '$lib/ui/toast.svelte';
	import { TICK_MS, WINDOW_SIZES } from './config.ts';
	import { buildDisplayQuery } from './core/params.ts';
	import { clockStore } from './core/store.svelte.ts';
	import type { ClockMode } from './core/types.ts';
	import Workspace from './ui/Workspace.svelte';
	import { openPipWindow, openStandaloneWindow, standaloneUrl } from './ui/window.ts';

	/** 会被搬进小窗的那个节点，由 ClockStage 交上来 */
	let stage = $state<HTMLElement | null>(null);
	/** 预览容器，全屏时对它调 requestFullscreen */
	let frame = $state<HTMLElement | null>(null);
	/** 预览容器是否已全屏：用来把固定高度换成铺满视口 */
	let fullscreen = $state(false);

	/** 关窗函数由开窗函数交出；用户直接关掉窗口时也会走 onWindowClosed，这里同步清空 */
	let closeCurrent: (() => void) | null = null;

	/** 当前选中的窗口尺寸档 */
	function currentSize(): { width: number; height: number } {
		return WINDOW_SIZES.find((item) => item.id === clockStore.windowSize) ?? WINDOW_SIZES[1];
	}

	/** 窗口关掉时把页面状态收回来。用户手动关、以及我们点「关闭窗口」，都会走到这里 */
	function onWindowClosed(): void {
		clockStore.windowKind = 'closed';
		closeCurrent = null;
	}

	/** 打开置顶悬浮窗（画中画）。不支持或被拒时改开独立窗口，别让用户白点一下 */
	async function openPip(): Promise<void> {
		if (!stage) return;
		// 注意：openPipWindow 内部第一个 await 就是 requestWindow ——
		// 它必须落在用户手势的同一个 tick 里，所以这之前不能出现别的 await。
		const result = await openPipWindow(stage, currentSize(), onWindowClosed);
		if (!result.ok) {
			toast.show(`${result.reason}，改为打开独立窗口`, true);
			openStandalone(clockStore.mode);
			return;
		}
		closeCurrent = result.close;
		clockStore.windowKind = result.kind;
	}

	/**
	 * 当前配置整份编成地址参数（口径见 core/params.ts）：独立窗口与「复制地址」都用它。
	 *
	 * `mode` 默认取当前模式；「按模式打开」那组按钮会传别的模式 —— 四个模式的配置本来就都在 store 里，
	 * 所以想开一个倒计时窗口，不必先切到倒计时标签。
	 */
	function displayQuery(mode: ClockMode = clockStore.mode): string {
		return buildDisplayQuery({
			mode,
			style: clockStore.style,
			clockOptions: clockStore.clockOptions,
			countdownOptions: clockStore.countdownOptions,
			stopwatchOptions: clockStore.stopwatchOptions,
			textOptions: clockStore.textOptions
		});
	}

	function openStandalone(mode: ClockMode): void {
		// key 按模式区分：否则「再开一个倒计时窗口」会把正在放时钟的那个窗口顶掉
		const result = openStandaloneWindow({ ...currentSize(), query: displayQuery(mode), key: mode }, onWindowClosed);
		if (!result.ok) {
			toast.show(result.reason, true);
			return;
		}
		closeCurrent = result.close;
		clockStore.windowKind = result.kind;
	}

	async function copyStandaloneUrl(): Promise<void> {
		await copyToClipboard(standaloneUrl(displayQuery()), {
			ok: '已复制独立窗口地址',
			fail: '复制失败，请手动选中地址复制'
		});
	}

	function closeWindow(): void {
		closeCurrent?.();
	}

	async function toggleFullscreen(): Promise<void> {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
			return;
		}
		if (!frame) return;
		try {
			await frame.requestFullscreen();
		} catch {
			toast.show('全屏失败，可以试试按 F11', true);
		}
	}

	// 启动：读盘 → 取一次系统时间 → 开新一轮，然后起走时定时器。只在客户端跑（SSR 不执行 effect）。
	//
	// 顺序不能乱：`startNewRound` 要用刚读出来的设定时长，也得先有 now 才算得出目标时刻。
	// 三件事一起裹进 untrack 是必须的 —— 它们都是「读一遍状态再写回去」，
	// 在 effect 里同步读会建立依赖、写又改掉依赖，于是无限自触发（页面冻住，看着像 JS 没跑）。
	//
	// 计时进度不落盘（见 store 的 PersistedData），所以这里开的就是全新一轮：
	// **刷新页面 = 重新开始倒计时 / 秒表**，不会接着上次的进度走。
	$effect(() => {
		untrack(() => {
			clockStore.hydrate();
			clockStore.now = Date.now();
			clockStore.startNewRound();
		});
		// 走时：每次重新读系统时间，而不是在上一秒上加一 —— 标签页被节流时也不会走偏
		const timer = setInterval(() => (clockStore.now = Date.now()), TICK_MS);
		return () => clearInterval(timer);
	});

	// 写盘：persist 函数体读到的每个状态都是本 effect 的依赖，任一处变了就整体存一次
	$effect(() => {
		clockStore.persist();
	});

	$effect(() => {
		const onChange = (): void => {
			fullscreen = document.fullscreenElement !== null;
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});
</script>

<ToolShell
	icon={Clock}
	name="悬浮时钟 · 计时器"
	tagline="时钟 · 倒计时 · 秒表 · 文字"
	heading="悬浮时钟与计时器"
	description="在线悬浮时钟：大字号数字时钟可自定义背景色与透明度、文字颜色、字体与描边，画面支持 0/90/180/270 度与任意角度旋转、水平翻转，支持画中画置顶小窗与全屏摆放；内置倒计时（倒一段时长，或倒数到每天某个时刻）与秒表，网页背景可设为全透明用于录屏叠加，全部本地运行。"
	keywords="悬浮时钟,桌面时钟,在线时钟,网页时钟,旋转时钟,横屏时钟,倒计时,计时器,秒表,画中画,置顶窗口,透明背景时钟,OBS 时钟,全屏时钟"
	path="/clock"
	ogDescription="大字号悬浮时钟 + 倒计时 + 秒表：颜色与透明度可调，画面可旋转到任意角度，背景可全透明，支持画中画置顶小窗。"
	fill="fill"
	fillFrom="lg"
	mainClass="relative mx-auto flex w-full flex-1 flex-col p-4 md:px-6 lg:min-h-0"
>
	<Workspace
		bind:stage
		bind:frame
		{fullscreen}
		onpip={openPip}
		onstandalone={openStandalone}
		oncopyurl={copyStandaloneUrl}
		onclose={closeWindow}
		onfullscreen={toggleFullscreen}
	/>
</ToolShell>
