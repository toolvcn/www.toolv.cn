<script lang="ts">
	// 主界面：三栏工作区 —— 左「参数预设」、中「投入与成本 / 结果 / 敏感性」、右「说明」。
	//
	// **没有整宽工具条**：口径切换与 示例 / 清空 都在「投入与成本」面板头部（它们只作用于输入），
	// 「复制结果摘要」在「结果」面板头部（它只作用于结果）。
	// 原先这些控件挤在一条通栏上，口径孤零零占掉一行、中间全是空档，
	// 而且「复制结果摘要」离结果卡隔着一屏 —— 控件贴在它作用的那块旁边，读起来才对得上。
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import DocPanel from './DocPanel.svelte';
	import InputPanel from './InputPanel.svelte';
	import PresetPanel from './PresetPanel.svelte';
	import ResultPanel from './ResultPanel.svelte';
	import SensitivityPanel from './SensitivityPanel.svelte';
</script>

<!-- relative 给 sr-only 的 h2 提供定位上下文，避免它逃出裁剪撑高文档 -->
<section id="roi-workspace" aria-labelledby="roi-workspace-heading" class="relative flex min-h-0 flex-1 flex-col gap-4">
	<h2 id="roi-workspace-heading" class="sr-only">电商 ROI 计算工作区</h2>

	<!-- 三栏：预设 / 主体 / 说明。lg 起三栏等高、各栏自己滚；窄屏按顺序堆叠。
	     说明栏宽度分四档，每档都是「中栏还剩多少」反推出来的 —— 改之前先把这几条算式核一遍：
	       lg / 2xl / 120rem  22rem / 22rem / 28rem
	                      说明栏本来就是「查的时候才看」的参考栏，公式长串横向可滚（`whitespace-pre`），
	                      让一点宽度比挤中栏划算 —— 中栏右列（结果 / 敏感性）有硬下限：
	                      xl 1280 时它正好 304px，就是结果卡两列指标卡的下限 300px。
	       xl       20rem  比 lg 窄一档，把省下的 2rem 让给「投入与成本」：
	                      1280 这档中栏只有 608px，输入栏原来只有 288px（比 lg / 2xl 的 352px 还窄），
	                      提成 320px 后右列仍是 304px 不动。
	       注意 xl 这两条（说明栏 20rem + 输入栏 20rem）是一对：
	       只改输入栏会把空间从中栏右列拿，结果卡的两列指标卡就会换行。 -->
	<div
		class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_20rem] 2xl:grid-cols-[16rem_minmax(0,1fr)_22rem] min-[120rem]:grid-cols-[16rem_minmax(0,1fr)_28rem]"
	>
		<PresetPanel />

		<!-- 中栏三块。行 / 列的升档完全跟着**中栏实际宽度**走，不跟着视口：
		     lg 三栏生效后中栏只剩约 350px，一律纵向堆三块（投入 / 结果 / 敏感性）——
		       行高 1.5fr / 1fr / 1fr，投入面板十来个字段，是这一档里最需要高度的一块；
		     xl 起中栏分左右两列 —— **左列整列是「投入与成本」**（`xl:row-span-2`），
		       右列上下两块：结果 / 敏感性。
		       左列 20rem（xl）/ 24rem（2xl）是被右列反推出来的上限：右列在 xl 只剩 304px
		       （结果卡里是两列指标卡、每张约 136px，再窄就要换行），在 2xl 是 464px
		       （仍在敏感性并排的 448px 阈值之上）。左列再宽就得动右列，所以多出来的那 2rem
		       是从说明栏拿的（见上一条注释）。
		       2xl 给到 24rem 是有用的：字段网格在这两档是两列，每格从 151px 涨到约 168px ——
		       订单数那格挂着一个 127px 的填法开关，宽一点才不挤。

		     右列两行按 **1.5 : 1** 分 —— 结果拿大头，敏感性只是「查表」，不跟它平分。
		       结果卡是这一页的主产出（两个数 → 结论 → 这笔钱的账 → 口径交叉验证），
		       本来就远长于一屏，多给的高度换来的是少滚一段；
		       敏感性是**对照着看**的材料，整块滚一点不伤它的用法。

		     **行高是视口的、敏感性自己的列数是容器的**（见 SensitivityPanel）—— 两者不同步：
		     并排只在面板够宽时发生，所以在 1426px 上下这一行的高度会“多出”一截。
		     要按视口再细分就加 `2xl:grid-rows-[…]`。

		     行高一律 `minmax(0,·)`：面板内的滚动区高度必须确定，否则它会长到内容那么高、
		     滚动落到没有滚动条的外层 —— 里外都不滚。 -->
		<div
			class="grid min-h-0 grid-cols-1 gap-4 lg:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]"
		>
			<InputPanel />
			<ResultPanel />
			<SensitivityPanel />
		</div>

		<DocPanel />
	</div>

	<Toast />
</section>
