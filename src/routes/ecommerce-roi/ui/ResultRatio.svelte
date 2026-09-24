<script lang="ts">
	// 结果卡 ④「比率与口径」：4 个 ROI + 3 个利润率**合成一组卡** + 三层口径折叠。
	//
	// 7 张卡是同一类东西（比率），合成**一组** —— 原先拆成「4 张 ROI 卡」+「3 张利润率卡」
	// 两组、两套列数（2 列 / 1 列 / 3 列），中间还夹一个标题与两句说明：
	// 同一块面板里列数来回跳，是最直接的「乱」。
	// 列数改用**容器查询**（配合 Panel 上的 `@container`）：只跟本面板宽度走，分两档 ——
	// `@2xs`(18rem=288px) 两列、`@md`(28rem=448px) 三列。这两个阈值是**实测倒推**出来的：
	// 卡从 2 列掉到 1 列会多出 3 行，比合并省下的还多（1280 档实测：本段 2 列 641px、
	// 1 列 849px，结果卡内容跟着从 2073px 长到 2281px），所以窄面板也必须两列；而 304px 下每张 136px 与旧版的 ROI 卡
	// 一样宽、464px 下每张 140px 与旧版的利润率卡一样宽 —— 都是这个面板原本就接受过的宽度。
	import { roiStore } from '../core/store.svelte.ts';
	import { formatMoney, formatNumber, formatPercent, formatTimes } from '../core/format.ts';
	import { METRIC_CARD, METRIC_FORMULA, METRIC_VALUE, NOTE_TEXT, SECTION_HEADING } from './styles.ts';

	const m = $derived(roiStore.metrics);
	const isUnit = $derived(roiStore.isUnit);
	const gmv = $derived(roiStore.parsed?.gmv ?? 0);
	const adCost = $derived(roiStore.parsed?.adCost ?? 0);
	const costRate = $derived(roiStore.parsed?.costRate ?? 0);

	// 下面几张卡的文案是写死的字面量、数组顺序也固定，所以用下标当 key。
	// 名称虽然当前不重复，但它是业务字段：改名、或将来加进来一条同名的，key 会静默撞上。

	/** 四个口径的指标卡：名称 / 数值 / 代入公式 */
	const cards = $derived([
		{
			name: '广告 ROAS',
			value: formatTimes(m?.adRoas ?? Number.NaN),
			formula: `成交额 ÷ 广告费 → ${formatNumber(gmv)} ÷ ${formatNumber(adCost)}`
		},
		{
			name: '扣退货 ROAS',
			value: formatTimes(m?.netRoas ?? Number.NaN),
			formula: `净收入 ÷ 广告费 → ${formatNumber(m?.netRevenue ?? Number.NaN)} ÷ ${formatNumber(adCost)}`
		},
		{
			name: '广告 ROI',
			value: formatPercent(m?.adRoi ?? Number.NaN),
			formula: `净利 ÷ 广告费 → ${formatNumber(m?.netProfit ?? Number.NaN)} ÷ ${formatNumber(adCost)}`
		},
		{
			name: '生意 ROI',
			value: formatPercent(m?.businessRoi ?? Number.NaN),
			formula: `净利 ÷ (广告费 + 净货品成本) → ${formatNumber(m?.netProfit ?? Number.NaN)} ÷ ${formatNumber(adCost + (m?.netGoodsCost ?? 0))}`
		}
	]);

	/**
	 * 利润率：从粗到细并排给出，「毛利率」和「净利率」差在哪一眼看到。
	 *
	 * **三张是一串递进**（只扣货款 → 再扣退货 → 扣完全部），抽掉任何一张这串就断了 ——
	 * 尤其是最后那张：没有它就看不出「一层层扣到最后还剩多少」这个终点。
	 *
	 * 它的数在 ① 段那行「每卖出 100 元净赚 X 元」里也出现（一个写成元、一个写成百分数），
	 * **这处重复是有意的，别当成冗余删掉**：① 那行是结论区里跟保本 ROAS 配对的一句，
	 * 这一张是递进序列的最后一格，两处的作用不同；而且 ① 那行没有公式代入，
	 * 要核对「贡献利润 ÷ 成交额」只能看这张卡。
	 */
	const margins = $derived([
		{
			name: '商品毛利率',
			hint: '只扣货款',
			value: formatPercent(m?.grossMargin ?? Number.NaN),
			formula: `1 − 成本率 → 1 − ${formatPercent(costRate)}`
		},
		{
			name: '退货修正毛利率',
			hint: '再扣退货损耗',
			value: formatPercent(m?.returnAdjustedMargin ?? Number.NaN),
			formula: `(净收入 − 净货品成本) ÷ 成交额 → (${formatNumber(m?.netRevenue ?? Number.NaN)} − ${formatNumber(m?.netGoodsCost ?? Number.NaN)}) ÷ ${formatNumber(gmv)}`
		},
		{
			// 单件口径没有广告费，所以这一格换成**广告费之前**的那个比例：
			// 每 1 元成交额里净赚多少 —— 它正好是保本 ROAS 的倒数。
			// 整盘口径仍用「净利率」，且两个分母口径都留在这一张卡里：普通人看的是「对成交额」，
			// 但习惯财务口径的人（和复制摘要里的数）用的是「对净收入」，不能只说一半。
			name: isUnit ? '净赚比例' : '净利率',
			hint: isUnit
				? '扣完全部成本，还没投广告'
				: `扣完全部，对成交额（对净收入 ${formatPercent(m?.netMargin ?? Number.NaN)}）`,
			value: formatPercent((isUnit ? m?.contributionMargin : m?.netMarginOnGmv) ?? Number.NaN),
			formula: isUnit
				? `贡献利润 ÷ 成交额 → ${formatNumber(m?.contributionProfit ?? Number.NaN)} ÷ ${formatNumber(gmv)}`
				: `净利润 ÷ 成交额 → ${formatNumber(m?.netProfit ?? Number.NaN)} ÷ ${formatNumber(gmv)}`
		}
	]);

	/** 保本 ROAS 的三层口径：漏算的成本越多，算出来的线越低 */
	const breakEvens = $derived([
		{ name: '只扣货款', value: formatTimes(m?.breakEvenRoasSimple ?? Number.NaN) },
		{ name: '再扣退货', value: formatTimes(m?.breakEvenRoasWithReturn ?? Number.NaN) },
		{ name: '完整口径', value: formatTimes(m?.breakEvenRoas ?? Number.NaN) }
	]);
</script>

<section class="flex flex-col gap-3 border-t border-gray-200 pt-3">
	<div class="flex flex-col gap-0.5">
		<h3 class={SECTION_HEADING}>
			{isUnit ? '三个比例，一层比一层薄' : '比率与口径'}
		</h3>
		<!-- 这一行压到 20 字以内：它是 **11px 小字**，304px 面板里一行只放得下约 20 个汉字，
		     长一点就变两行文字墙 —— 而这已经是「结论区往下第一块比率」的位置，不该被说明占掉 -->
		<p class={NOTE_TEXT}>
			{isUnit ? '三个数对着同一个售价，差别只在扣到哪一层' : '用来跟平台后台、同行的数对上'}
		</p>
	</div>
	<div class="grid grid-cols-1 gap-3 @2xs:grid-cols-2 @md:grid-cols-3">
		<!-- 四个 ROI 卡全都以广告费为分母，而单件口径的广告费恒为 0（那一格是 Infinity）——
		     整块不显示，比显示四张「—」诚实 -->
		{#if !isUnit}
			{#each cards as card, i (i)}
				<div class={METRIC_CARD}>
					<div class="text-xs font-medium text-gray-600">{card.name}</div>
					<div class={METRIC_VALUE}>{card.value}</div>
					<div class={METRIC_FORMULA}>{card.formula}</div>
				</div>
			{/each}
		{/if}
		{#each margins as item, i (i)}
			<div class={METRIC_CARD}>
				<div class="text-xs font-medium text-gray-600">{item.name}</div>
				<div class={METRIC_VALUE}>{item.value}</div>
				<div class={NOTE_TEXT}>{item.hint}</div>
				<div class={METRIC_FORMULA}>{item.formula}</div>
			</div>
		{/each}
	</div>

	<!-- 三层口径对照：口径越粗线越低，按粗口径出价就会亏。默认收起（原生 details：零 JS、键盘可达）——
	     它是「解释别人算的保本线为什么更低」的材料，不是每天要看的数；真正要记住的那条
	     （完整口径）已经在顶部那个盒子里给了，所以这里不再重复大数字与代入式。
	     原先它装在一个琥珀色大块里，块里还混着广告费上限与目标净利（那两个已经归 ②）。 -->
	<details class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
		<summary class="cursor-pointer text-[11px] leading-4 text-amber-700">
			别人算的保本线比我低？看三种口径差在哪
		</summary>
		<div class="mt-2 grid grid-cols-3 gap-2">
			{#each breakEvens as item, i (i)}
				<div>
					<div class="text-[11px] leading-4 text-amber-700">{item.name}</div>
					<div class="font-mono text-sm text-amber-700 tabular-nums">{item.value}</div>
				</div>
			{/each}
		</div>
		<p class="mt-1.5 text-[11px] leading-4 text-amber-700">
			同一盘生意、三种口径。漏算的成本越多、算出来的线越低，按低的那条出价就会亏 —— 出价请用「完整口径」。
		</p>
		{#if isUnit}
			<!-- 单件口径没有广告费输入，「保本 ROAS 是多少」这句话得有个着落：把每件利润当广告费
			     全投出去，换回来的成交额正好等于售价，除一下就是这条线。这段原先挂在琥珀块里，
			     块拆了挪进这个折叠（它本来就是口径解释），顺便把「净赚比例是它的倒数」说到一处。 -->
			<p class="mt-1.5 border-t border-amber-200 pt-1.5 text-[11px] leading-4 text-amber-700">
				单件口径：把每件利润（{formatMoney(m?.contributionProfit ?? Number.NaN)} 元）全部当广告费投出去，投产比低于
				<span class="font-mono tabular-nums">{formatTimes(m?.breakEvenRoas ?? Number.NaN)}</span>
				就换不回这一件的成交额。上面那行「每卖出 100 元净赚多少」正好是这条线的倒数，说的是一件事。
			</p>
		{/if}
	</details>
</section>
