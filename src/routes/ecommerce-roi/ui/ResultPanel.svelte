<script lang="ts">
	// 结果卡的外壳：两种异常态（空 / 报错）的切换 + 四段正文的装配。
	//
	// 分段按「读者会问什么」（段 = 一个问题），段之间一条分隔线 + 段标题：
	//   ① 结论           两个数盒 → 一句话结论 → 一行比率          → ResultVerdict
	//   ② 试算与下一步    整盘：上限 + 目标那条线                    → ResultTrial
	//                    单件：定价反推 + 规模试算（各带自己的前提）   → ResultUnit
	//   ③ 这笔钱怎么来的  利润明细 + 退货这笔账                      → ResultBreakdown
	//   ④ 比率与口径      比率卡 + 三层口径折叠                      → ResultRatio
	// 每段各自成一个组件（每段自己的派生值也跟着搬进去了），这里只管顺序与异常态 ——
	// 原先它们挤在同一个文件里，脚本 340 行、模板 450 行，改一处要在两处之间来回跳。
	//
	// 分段的目的是**同类归位、同一件事只说一遍**：原先保本 ROAS 说三遍、净利说两遍、
	// 两组卡两套列数，还把「广告费上限」压在倒数第二块。「下一步动哪个最值」已搬到敏感性面板
	// （它跟那两张表回答的是同一个问题）。
	//
	// ② 段是唯一按口径分成两个组件的：单件那几个反解原先拆在 ② 与末尾的 ⑤ 两段，
	// 合成一段之后顺序与内容都不再与整盘相同构（详见 ResultUnit 的文件头）。
	import { Copy } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { roiStore } from '../core/store.svelte.ts';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import ResultBreakdown from './ResultBreakdown.svelte';
	import ResultRatio from './ResultRatio.svelte';
	import ResultTrial from './ResultTrial.svelte';
	import ResultUnit from './ResultUnit.svelte';
	import ResultVerdict from './ResultVerdict.svelte';

	/**
	 * 复制按钮就放在本面板的头部 —— 它复制的正是这块里摊开的那几个数，
	 * 原先挂在整宽工具条上，离结果卡隔着一屏。
	 * 空态也算进禁用：空串按 0 解析，metrics 不为 null，但摘出来是一串没有意义的 0。
	 * 禁用态的判断不能写在 class 里（prettier 拆行会静默失效），所以放脚本。
	 */
	const copyDisabled = $derived(roiStore.metrics === null || roiStore.isEmpty);

	const isUnit = $derived(roiStore.isUnit);
</script>

<!-- `@container`：下面所有卡片网格的列数改看**本面板自己的宽度**，不看视口 ——
     这块面板的宽度不随视口单调递增（lg 三栏生效、xl 中栏再分列、2xl 说明栏加宽都会让它变窄），
     按视口写的 `sm:` / `2xl:` 会在这些档上把列数跳来跳去（跟 SensitivityPanel 同一个理由）。 -->
<Panel id="roi-result" headingId="roi-result-heading" heading="结果" class="@container lg:min-h-0">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>{isUnit ? '每卖一件的账' : '这段投放的账'}</span>
	{/snippet}

	{#snippet actions()}
		<Button
			variant="primary"
			size="xs"
			label="复制结果摘要"
			disabled={copyDisabled}
			onclick={() => void roiStore.copySummary()}
		>
			<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制结果摘要
		</Button>
	{/snippet}

	<!-- 结果很长：桌面在面板内滚，移动端封顶 60vh 也滚（UI-STYLE §17），
	     否则这一个面板就能把手机页面撑到几千 px -->
	<div class="flex flex-col gap-4 overflow-y-auto p-4 max-lg:max-h-[60vh] lg:min-h-0 lg:flex-1">
		{#if roiStore.isEmpty}
			<p class="py-6 text-center text-sm text-gray-600">
				{isUnit ? '在左侧填入售价与单件成本，结果会实时出现在这里' : '在左侧填入投放数据，结果会实时出现在这里'}
			</p>
		{:else if roiStore.error !== ''}
			<!-- 具体错在哪由**字段旁那条红字**说（`roiStore.errorField`）。这里只说明「结果为什么没出来」，
			     并留一个 role="status" 把状态变化播报出去 —— 整句话在这里再抄一遍，
			     桌面同屏就有两处一模一样的红字（同一件事只说一遍）。 -->
			<p
				class="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
				role="status"
				aria-live="polite"
			>
				有参数还不对 —— 按左侧标红那一项下面的红字改，结果会自动出来。
			</p>
		{:else}
			<ResultVerdict />
			<!-- ② 段两种口径**不同构**：整盘是「试算与下一步」（广告费上限 + 目标那条线），
			     单件是「反推与试算」（定价反推 + 规模试算两块）。
			     后者原先拆在 ② 与末尾的 ⑤ 两段、合并之后又把三格前提挤成一条、四个数排成 2×2，
			     结果是「改一格有的数动有的数不动」—— 现在按依赖重新分成两块，
			     每格前提紧挨它产出的数（详见 ResultUnit 的文件头）。 -->
			{#if isUnit}
				<ResultUnit />
			{:else}
				<ResultTrial />
			{/if}
			<ResultBreakdown />
			<ResultRatio />
		{/if}
	</div>

	<div class={FOOTER_BAR}>
		<p class="truncate text-xs text-gray-600">所有计算在浏览器本地完成，不上传任何数据</p>
	</div>
</Panel>
