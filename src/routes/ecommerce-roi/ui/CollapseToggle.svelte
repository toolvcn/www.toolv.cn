<script lang="ts">
	// 窄栏（<lg）里的「展开 / 收起」小按钮：说明栏与每个参数分组各挂一枚。
	//
	// 抽出来的理由：两处的**交互逐字相同** —— `aria-expanded` 跟着状态、
	// `aria-controls` 指向被折叠的区域、文案在「展开 / 收起」间切、箭头随展开旋转 180°。
	// 各写一份的下场是这类细节迟早只改一处（箭头的旋转方向、aria 的两个属性、断点）。
	// 只有「折叠的是哪块」「默认展开还是收起」不同 —— 那是调用方的状态（`bind:expanded`），不是按钮的事。
	//
	// 两处折叠都用 `max-lg:hidden` 而不是 `{#if}`：正文始终在 DOM 里，
	// 首屏 HTML 里的口径说明与表单语义不能因为折叠而少掉一半。按钮因此也只在 <lg 出现。
	import { ChevronDown } from '@lucide/svelte';
	import { HEADER_BTN } from '$lib/ui/styles';

	let {
		expanded = $bindable(false),
		controls
	}: {
		/** 折叠状态，由调用方持有（写 `bind:expanded`） */
		expanded: boolean;
		/** 被折叠区域的 `id`（`aria-controls` 的目标） */
		controls: string;
	} = $props();

	// 条件类名一律在脚本里拼：写在 class 属性里的三元会被 prettier 折行拆断而静默失效（AGENTS §6）
	const chevronClass = $derived(`size-3.5 shrink-0 transition-transform${expanded ? ' rotate-180' : ''}`);
</script>

<button
	type="button"
	class="{HEADER_BTN} lg:hidden"
	aria-expanded={expanded}
	aria-controls={controls}
	onclick={() => (expanded = !expanded)}
>
	{expanded ? '收起' : '展开'}
	<ChevronDown class={chevronClass} aria-hidden="true" />
</button>
