<script lang="ts">
	// 窗口面板：只有界面与回调，开窗 / 关窗 / 复制地址 / 全屏的实际动作留在页面那一层。
	//
	// 两种窗口形态**并列摆出来**，因为它们不是同一件事的两种实现，而是两个不同的诉求：
	//   悬浮窗 → 要「一直浮在别的软件上面」；独立窗口 → 要「离开这一页也照样活着、还能各开各的」。
	// 各自的代价写在下面两段说明里，别把它们合并成一个按钮。
	import { onMount } from 'svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { MODE_TABS, STANDALONE_PATH, WINDOW_SIZES } from '../config.ts';
	import { clockStore } from '../core/store.svelte.ts';
	import type { ClockMode } from '../core/types.ts';
	import { supportsPip } from './window.ts';

	let {
		onpip,
		onstandalone,
		oncopyurl,
		onclose,
		onfullscreen
	}: {
		onpip: () => void;
		/** 带 mode：四个模式可以各开一个窗口，互不干扰 */
		onstandalone: (mode: ClockMode) => void;
		oncopyurl: () => void;
		onclose: () => void;
		onfullscreen: () => void;
	} = $props();

	const SIZE_OPTIONS = WINDOW_SIZES.map((size) => ({ value: size.id, label: size.label }));

	// SSR 与客户端首帧一律按「不支持」渲染，挂载后再探测 —— 这两帧必须一致，否则 hydration 会告警。
	// 所以**不能**写成 `$derived(supportsPip())` 或 `$derived(browser && …)`：
	// 那样客户端首帧就变成 true，跟预渲染出来的 HTML 对不上。
	// 用 onMount 而不是 `$state + $effect`，是因为后者会被 eslint 的
	// `svelte/prefer-writable-derived` 判成「该写成 $derived」—— 而那恰恰是这里不能做的事。
	let pipSupported = $state(false);
	onMount(() => {
		pipSupported = supportsPip();
	});

	const windowOpen = $derived(clockStore.windowKind !== 'closed');

	const statusText = $derived(
		clockStore.windowKind === 'pip'
			? '悬浮窗已打开（画中画，始终置顶）'
			: clockStore.windowKind === 'standalone'
				? '独立窗口已打开'
				: ''
	);
</script>

<Panel id="clock-window" heading="窗口" class="shrink-0">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">窗口尺寸</span>
			<SegmentedControl
				aria-label="窗口尺寸"
				options={SIZE_OPTIONS}
				value={clockStore.windowSize}
				onchange={(value) => (clockStore.windowSize = value)}
			/>
		</div>

		{#if windowOpen}
			<div class="flex flex-wrap items-center gap-2">
				<Button variant="danger" label="关闭已打开的那个窗口" onclick={onclose}>关闭窗口</Button>
				<span class="text-xs text-gray-600">{statusText}</span>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				<Button variant="primary" label="打开置顶的悬浮窗，把时钟浮在其它软件上面" onclick={onpip}>打开悬浮窗</Button>
				<Button label="按当前模式的配置打开一个独立窗口" onclick={() => onstandalone(clockStore.mode)}>
					打开独立窗口
				</Button>
				<Button label="复制独立窗口的完整地址，可收藏或粘到 OBS 的浏览器源" onclick={oncopyurl}>复制地址</Button>
				<Button label="在这一页全屏显示" title="全屏显示当前内容" onclick={onfullscreen}>全屏</Button>
			</div>
		{/if}

		<!-- 四个模式可以各开一个窗口同时显示：窗口名按模式分开，新开一个不会顶掉已经在放的那个 -->
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">按模式打开独立窗口</span>
			<div class="flex flex-wrap gap-1.5">
				{#each MODE_TABS as tab (tab.value)}
					<Button size="xs" label="打开{tab.label}的独立窗口" onclick={() => onstandalone(tab.value)}>
						{tab.label}
					</Button>
				{/each}
			</div>
			<p class="text-[11px] leading-4 text-gray-600">
				不用先切标签 —— 想同时在副屏摆一个时钟、再摆一个倒计时，这里各点一下即可。
			</p>
		</div>

		<dl class="flex flex-col gap-2.5 border-t border-gray-100 pt-3">
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs font-medium text-gray-700">悬浮窗（画中画）</dt>
				<dd class="text-[11px] leading-4 text-gray-600">
					始终置顶、可自由拖拽缩放，在这页改样式会立刻同步过去。代价是跟这一页绑在一起 —— 关掉这页，它也跟着关。
					{#if !pipSupported}
						<span class="block text-amber-700">
							当前浏览器不支持置顶的画中画，点它只会改成打开独立窗口。Chrome / Edge 116+ 才有置顶形态。
						</span>
					{/if}
				</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs font-medium text-gray-700">独立窗口</dt>
				<dd class="text-[11px] leading-4 text-gray-600">
					打开 <code class="rounded bg-black/5 px-1 font-mono">{STANDALONE_PATH}</code>
					：有地址、能刷新、能收藏、能拖到副屏，关掉这页也照样显示。
					<strong class="font-medium text-gray-700">配置整份写在地址参数里</strong>，所以可以同时开好几个各显示各的
					（一个时钟 + 一个倒计时），地址也能直接粘进 OBS 的浏览器源。
				</dd>
			</div>
		</dl>

		<p class="text-[11px] leading-4 text-gray-600">
			地址就是那个窗口的全部配置：从这页打开的都带着完整参数，是一份固定快照 —— 想改就回这页改完重新打开。 不带参数的裸 <code
				class="rounded bg-black/5 px-1 font-mono">{STANDALONE_PATH}</code
			> 用的是默认样式。
		</p>
		<p class="text-[11px] leading-4 text-gray-600">
			两种窗口都是纯显示，控制按钮都留在这页。想离开这页也要能控制，就把它拖到副屏、这页留在主屏。
		</p>
	</div>
</Panel>
