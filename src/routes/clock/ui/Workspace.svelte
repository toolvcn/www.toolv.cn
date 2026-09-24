<script lang="ts">
	// 工作区：三栏（左 = 当前模式的设置 / 中 = 预览 / 右 = 外观与窗口）的组装。
	//
	// 为什么分三栏：**预览要在正中间**。页面铺满宽度之后，两栏布局会让预览明显偏左，
	// 而这一页的主角就是那块预览。左右两栏按「跟不跟模式走」分：
	// 左栏是当前模式的设置（切模式整栏换内容），右栏是跟模式无关的外观与窗口。
	//
	// **模式标签条不单独占一行**，而是并进预览卡片的头部：单独一行会把下面三栏的整体感切开，
	// 而它切的本来就是「预览里显示什么」，语义上也属于这一块。
	//
	// 桌面端钉住视口、三栏各自滚动（fill 由页面外壳给），所以整页不出现滚动条；
	// 小屏退回普通页面流并纵向堆叠，堆叠时用 order 把预览提到最前 ——
	// 打开这一页先看到的应该是时钟，而不是一排设置。
	//
	// 生命周期相关的东西**不在这里**：走时定时器、读写 localStorage、开窗 / 全屏都写在 +page.svelte
	// （全局副作用统一放页面，见 STRUCTURE §2 B）。本组件只负责把舞台节点交上去、组装版式、调用回调。
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { MODE_TABS } from '../config.ts';
	import { clockStore } from '../core/store.svelte.ts';
	import type { ClockMode, RunState } from '../core/types.ts';
	import AppearancePanel from './AppearancePanel.svelte';
	import ClockSettings from './ClockSettings.svelte';
	import ClockStage from './ClockStage.svelte';
	import CountdownSettings from './CountdownSettings.svelte';
	import StopwatchSettings from './StopwatchSettings.svelte';
	import TextSettings from './TextSettings.svelte';
	import WindowPanel from './WindowPanel.svelte';

	let {
		stage = $bindable(null),
		frame = $bindable(null),
		fullscreen = false,
		onpip,
		onstandalone,
		oncopyurl,
		onclose,
		onfullscreen
	}: {
		stage?: HTMLElement | null;
		frame?: HTMLElement | null;
		fullscreen?: boolean;
		/** 打开置顶悬浮窗（画中画）；不支持时由页面层改开独立窗口 */
		onpip: () => void;
		/** 打开独立窗口 /clock/display；带 mode 可以开**别的**模式（「按模式打开」那组按钮用） */
		onstandalone: (mode: ClockMode) => void;
		/** 复制带完整参数的独立窗口地址 */
		oncopyurl: () => void;
		onclose: () => void;
		onfullscreen: () => void;
	} = $props();

	const STATUS_TEXT: Record<RunState, string> = { idle: '未开始', running: '进行中', paused: '已暂停' };

	/**
	 * 预览面板头部那个快捷下拉：抬手就能开一个新窗口，不必滚到下面那块「窗口」面板。
	 * 它是**动作型菜单**（点一下就执行、没有「当前值」），所以 value 传空串、
	 * 用 triggerLabel 给按钮上那句短字（UI-STYLE §9 的动作型菜单口径）。
	 */
	const WINDOW_ACTIONS = [
		{ value: 'pip', label: '打开悬浮窗', description: '始终置顶、可拖拽缩放；关掉本页它也关' },
		{ value: 'standalone', label: '打开独立窗口', description: '配置写进地址；关掉本页也照样显示' },
		{ value: 'copy', label: '复制窗口地址', description: '可收藏、可粘到 OBS 的浏览器源' },
		{ value: 'fullscreen', label: '本页全屏', description: '在这一页铺满显示' }
	];

	/** 窗口开着时多一项「关闭」—— 否则还得先滚到下面那个面板才能关掉它 */
	const windowActions = $derived(
		clockStore.windowKind === 'closed'
			? WINDOW_ACTIONS
			: [...WINDOW_ACTIONS, { value: 'close', label: '关闭窗口', description: '关掉已经打开的那个窗口' }]
	);

	function handleWindowAction(action: string): void {
		if (action === 'pip') onpip();
		else if (action === 'standalone') onstandalone(clockStore.mode);
		else if (action === 'copy') oncopyurl();
		else if (action === 'fullscreen') onfullscreen();
		else if (action === 'close') onclose();
	}

	/** 透明区域的棋盘格：预览区里用它表示「这块是透明的」，跟图片编辑软件一个口径 */
	const CHECKER =
		'background-image: repeating-conic-gradient(#e5e7eb 0deg 90deg, #ffffff 90deg 180deg); background-size: 16px 16px;';

	/** 桌面端三栏各自滚动，容器钉住视口高度；小屏是普通页面流，别加 overflow */
	const COLUMN = 'flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto';
	/** 小屏堆叠时预览要排在第一位，所以左右两栏各给一个 order（组合串在脚本里拼好，不进模板） */
	const LEFT_COLUMN = `${COLUMN} max-lg:order-2`;
	const RIGHT_COLUMN = `${COLUMN} max-lg:order-3`;

	/** 计时控制条只对「时长型倒计时」和「秒表」有意义：时钟没有计时，时刻型也不需要人为开始 */
	const showControls = $derived(
		clockStore.mode === 'stopwatch' || (clockStore.mode === 'countdown' && clockStore.countdownRunnable)
	);

	const running = $derived(
		clockStore.mode === 'stopwatch'
			? clockStore.stopwatch.state === 'running'
			: clockStore.countdown.state === 'running'
	);

	const paused = $derived(
		clockStore.mode === 'stopwatch' ? clockStore.stopwatch.state === 'paused' : clockStore.countdown.state === 'paused'
	);

	const primaryLabel = $derived(running ? '暂停' : paused ? '继续' : '开始');

	const statusText = $derived.by(() => {
		if (clockStore.mode === 'clock') return '';
		if (clockStore.mode === 'countdown' && !clockStore.countdownRunnable) return '每天循环，无需操作';
		const state = clockStore.mode === 'stopwatch' ? clockStore.stopwatch.state : clockStore.countdown.state;
		return STATUS_TEXT[state];
	});

	// 全屏时按视口尺寸铺满（h-dvh，不能用 h-full —— 全屏元素的父级高度是 auto）；
	// 桌面端在同栏里撑满剩余高度；小屏给一个接近窗口比例的高度，让棋盘格看得见。
	// 条件串在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效（AGENTS §6）
	const frameClass = $derived(
		fullscreen ? 'h-dvh w-full' : 'h-52 overflow-hidden rounded-lg sm:h-64 lg:h-auto lg:min-h-0 lg:flex-1'
	);

	function toggleRun(): void {
		if (clockStore.mode === 'stopwatch') {
			if (clockStore.stopwatch.state === 'running') clockStore.pauseStopwatch();
			else clockStore.startStopwatch();
			return;
		}
		if (clockStore.countdown.state === 'running') clockStore.pauseCountdown();
		else clockStore.startCountdown();
	}

	function resetRun(): void {
		if (clockStore.mode === 'stopwatch') clockStore.resetStopwatch();
		else clockStore.resetCountdown();
	}
</script>

<div class="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
	<!-- 左：当前模式的设置。切标签时整栏内容跟着换 -->
	<div class={LEFT_COLUMN}>
		{#if clockStore.mode === 'clock'}
			<ClockSettings />
		{:else if clockStore.mode === 'countdown'}
			<CountdownSettings />
		{:else if clockStore.mode === 'stopwatch'}
			<StopwatchSettings />
		{:else}
			<TextSettings />
		{/if}
	</div>

	<!-- 中：预览。小屏用 order 提到最前 -->
	<Panel id="clock-preview" heading="预览" class="min-w-0 max-lg:order-1 lg:min-h-0">
		<!-- 头部整条换成「模式切换 + 状态 + 打开窗口」：`heading` 降级成 sr-only 的 h2，
			     region 的名字不丢（UI-STYLE §8 的 header 槽口径）。
			     切换用 SegmentedControl 而不是 Tabs —— Tabs 的外壳带 `w-full shrink-0`，
			     放进 h-12 的头部会在窄屏撑满、把右边那枚下拉挤出去；
			     SegmentedControl 的外壳是自然宽度（`md:w-fit`），正合这种「一排小按钮」的场景。 -->
		{#snippet header()}
			<div class="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-4">
				<SegmentedControl
					aria-label="时钟模式"
					options={MODE_TABS}
					value={clockStore.mode}
					onchange={(value) => clockStore.setMode(value)}
				/>
				<div class="ml-auto flex shrink-0 items-center gap-1.5">
					{#if statusText}
						<span class="hidden text-xs text-gray-600 sm:inline">{statusText}</span>
					{/if}
					<Dropdown
						size="xs"
						label="打开显示窗口"
						triggerLabel="打开窗口"
						value=""
						options={windowActions}
						onSelect={handleWindowAction}
					/>
				</div>
			</div>
		{/snippet}

		<div class="flex flex-col gap-3 p-4 lg:min-h-0 lg:flex-1">
			<!-- 时钟舞台：这层只负责给它尺寸与棋盘格，舞台自身铺满容器 -->
			<div bind:this={frame} class={frameClass} style={CHECKER}>
				<ClockStage bind:ref={stage} />
			</div>

			{#if showControls}
				<div class="flex flex-wrap items-center gap-2" role="group" aria-label="计时控制">
					<Button variant="primary" label="{primaryLabel}计时" onclick={toggleRun}>{primaryLabel}</Button>
					<Button label="重置归零" title="重置归零" onclick={resetRun}>重置</Button>
				</div>
			{/if}
		</div>
	</Panel>

	<!-- 右：与模式无关的外观与窗口 -->
	<div class={RIGHT_COLUMN}>
		<AppearancePanel />
		<WindowPanel {onpip} {onstandalone} {oncopyurl} {onclose} {onfullscreen} />
	</div>
</div>

<Toast />
