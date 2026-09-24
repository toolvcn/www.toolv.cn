<script lang="ts">
	// 右侧说明栏：口径、公式与「为什么这么算」收在这一个面板里。
	// 只做外壳 + 滚动容器，正文拆成 FormulaSection / WhySection 两个纯内容组件 ——
	// 两段各有自己的小节层级，混在一个模板里读不下去。
	// 窄栏里长文必须自己滚（lg 起），否则会把三栏栅格顶高。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import CollapseToggle from './CollapseToggle.svelte';
	import FormulaSection from './FormulaSection.svelte';
	import WhySection from './WhySection.svelte';

	/**
	 * 移动端默认收起。
	 * 手机上说明栏排在最末（预设 → 投入与成本 → 结果 → 敏感性 → 说明），
	 * 要滚过参数与两张表才看得到，而它是「想核对口径时才看」的东西 —— 该给参数与结果让路。
	 *
	 * 用 `max-lg:hidden` 而不是 `{#if}`：正文始终在 DOM 里，
	 * 首屏 HTML 里的公式与口径说明是 SEO 长尾词的来源，不能被折叠掉。
	 */
	let expanded = $state(false);

	// 条件类名在脚本里拼：class 属性里的三元会被 prettier 拆断而静默失效（AGENTS §6）
	const bodyClass = $derived(
		`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 max-lg:max-h-[60vh]${expanded ? '' : ' max-lg:hidden'}`
	);
</script>

<Panel id="roi-doc" headingId="roi-doc-heading" heading="说明" tag="aside" class="max-lg:shrink-0 lg:min-h-0">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>口径与公式</span>
	{/snippet}

	{#snippet actions()}
		<!-- 展开 / 收起：窄栏专用（按钮自带 lg:hidden），与参数分组的同一枚见 CollapseToggle -->
		<CollapseToggle bind:expanded controls="roi-doc-body" />
	{/snippet}

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行 -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div id="roi-doc-body" class={bodyClass} tabindex="0" role="region" aria-label="口径与公式说明">
		<FormulaSection />
		<hr class="border-gray-200" />
		<WhySection />
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">示例盘的数字现算，换成自己的参数后请以结果卡为准</p>
		</div>
	{/snippet}
</Panel>
