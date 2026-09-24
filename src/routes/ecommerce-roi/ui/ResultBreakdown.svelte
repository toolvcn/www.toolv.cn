<script lang="ts">
	// 结果卡 ③「这笔钱怎么来的」：利润明细 + 退货这笔账。
	//
	// 这一段是唯一「逐行能自己核对」的一块：收入减各项成本等于净利，读者不需要懂任何 ROI 口径
	// 就能看懂，也就能信这个结论。所以它排在比率**之前** —— 原先它在最底下，
	// 要滚过八张指标卡才看得到，把最可读的东西埋在最深处是反的。
	//
	// 「退货这笔账」按**未发货 / 在途 / 签收后**三类摊开：同一笔退款，三类承担的成本完全不同
	// （货没出库 / 原封回来 / 拆封折损），合成一行会让「未发货那类退了钱却没损失」
	// 看起来像漏算。先把三类的规模摆出来，再算真损失，顺序不能反。
	import { roiStore } from '../core/store.svelte.ts';
	import { formatCount, formatMoney, formatNumber, formatPercent } from '../core/format.ts';
	import { NOTE_TEXT, SECTION_HEADING, TABLE_ROW, TABLE_VALUE } from './styles.ts';

	/** 利润明细的一行。`unitHidden`：单件口径下不存在这一项（如其他固定成本），整行不渲染 */
	interface ProfitRow {
		name: string;
		value: string;
		formula: string;
		unitHidden?: boolean;
	}

	const m = $derived(roiStore.metrics);
	const isUnit = $derived(roiStore.isUnit);
	const period = $derived(roiStore.period);
	const p = $derived(roiStore.parsed);
	const gmv = $derived(p?.gmv ?? 0);
	const shipCost = $derived(p?.shipCost ?? 0);
	const returnShipCost = $derived(p?.returnShipCost ?? 0);
	const commissionRate = $derived(p?.commissionRate ?? 0);
	const unshippedRate = $derived(p?.unshippedRefundRate ?? 0);
	const shippedRate = $derived(p?.shippedRefundRate ?? 0);
	const recoverRate = $derived(p?.recoverRate ?? 0);
	const orderCount = $derived(p?.orders ?? 0);
	const otherCost = $derived(p?.otherCost ?? 0);
	const commissionRefunded = $derived(roiStore.commissionRefunded);

	/** 整盘口径成本那两格的原始文本与填法：结果卡里的算式要跟输入框里那条路对得上 */
	const costMode = $derived(roiStore.inputs.costMode);
	const costText = $derived(roiStore.inputs.costRate);
	/** 单件口径**自己的**成本格 —— 它跟整盘那格是两个输入，不能互相借用 */
	const unitCostText = $derived(roiStore.unitInputs.unitCost);

	/** 实际发出的单数（未发货退款的不发）与已发货退款的单数 */
	const shippedOrders = $derived(orderCount * (1 - unshippedRate));
	const refundedAfterShipOrders = $derived(orderCount * shippedRate);

	/** 签收后退货率 = 已发货退款 − 在途。用金额反推，省得再对一遍 `Math.min` 那记钳位 */
	const signedRate = $derived(gmv > 0 && m !== null ? m.signedAmount / gmv : 0);

	/**
	 * 净货品成本的算式，三条路按口径与整盘那格的填法分：
	 * - 单件口径：用**单件自己的成本格**，件数按发货比例写（它只有 1 件）。
	 *   这条曾经借用整盘的 `costMode`/`costRate` —— 整盘那格停在「按金额」时，
	 *   单件口径会显示出整盘的单件成本，同一屏里输入与算式对不上。
	 * - 整盘按金额：单件成本 × 实际发出单数
	 * - 整盘按比例：成交额 × 成本率
	 * 三条的落点都是「发出成本 − 收回货值」，只是写法跟着用户填的那条走。
	 */
	const netGoodsCostFormula = $derived(
		isUnit
			? `单件成本 ${unitCostText || '—'} × 发货比例 ${formatPercent(1 - unshippedRate)} → 发出 ${formatNumber(m?.grossGoodsCost ?? 0)} − 收回 ${formatNumber(m?.recoveredGoodsValue ?? 0)}`
			: costMode === 'unit'
				? `单件成本 ${costText || '—'} × 实际发出 ${formatCount(shippedOrders)} 单 → 发出 ${formatNumber(m?.grossGoodsCost ?? 0)} − 收回 ${formatNumber(m?.recoveredGoodsValue ?? 0)}`
				: `成交额 ${formatNumber(gmv)} × 成本率 ${formatPercent(p?.costRate ?? 0)}（只算实际发出的货）→ 发出 ${formatNumber(m?.grossGoodsCost ?? 0)} − 收回 ${formatNumber(m?.recoveredGoodsValue ?? 0)}`
	);

	/**
	 * 利润表：从左到右逐层扣，最后一行是净利。
	 *
	 * 四处按口径换算法：
	 * 1. 净货品成本 —— 算式见上面的 `netGoodsCostFormula`。
	 * 2. 正向物流 —— **只按实际发出的订单算**，未发货退款的那批没发出去。这条必须写出来，
	 *    否则读者会以为自己漏算了一笔运费。
	 * 3. 逆向物流 —— 只按已发货退款的单数算；单件口径下退货订单数是小数（0.15 单），
	 *    用 formatCount 会显示「0 单退货」，公式跟结果对不上，所以改按率写。
	 * 4. 其他固定成本 / 广告花费 —— 单件口径没有这两项（前者恒 0、后者只算广告费之前），整行去掉。
	 */
	const profitRows = $derived<ProfitRow[]>(
		[
			{
				name: '净收入',
				value: formatMoney(m?.netRevenue ?? 0),
				formula: `成交额 − 退款总额 → ${formatNumber(gmv)} − ${formatNumber(m?.returnedAmount ?? 0)}`
			},
			{
				name: '净货品成本',
				value: `− ${formatMoney(m?.netGoodsCost ?? 0)}`,
				formula: netGoodsCostFormula
			},
			{
				name: '平台佣金',
				value: `− ${formatMoney(m?.commission ?? 0)}`,
				formula: `${commissionRefunded ? '净收入' : `成交额 − 未发货退款`} × ${formatPercent(commissionRate)}`
			},
			{
				name: '正向物流',
				value: `− ${formatMoney(m?.forwardShipping ?? 0)}`,
				formula: isUnit
					? `发货比例 ${formatPercent(1 - unshippedRate)} × ${formatNumber(shipCost)} 元`
					: `实际发出 ${formatCount(shippedOrders)} 单 × ${formatNumber(shipCost)} 元`
			},
			{
				name: '逆向物流',
				value: `− ${formatMoney(m?.reverseShipping ?? 0)}`,
				formula: isUnit
					? `已发货退款率 ${formatPercent(shippedRate)} × ${formatNumber(returnShipCost)} 元`
					: `已发货退款 ${formatCount(refundedAfterShipOrders)} 单 × ${formatNumber(returnShipCost)} 元`
			},
			{
				name: '其他固定成本',
				value: `− ${formatMoney(otherCost)}`,
				formula: '人工 / 仓储等，按你填的算',
				unitHidden: true
			},
			{
				name: '广告花费',
				value: `− ${formatMoney(p?.adCost ?? 0)}`,
				formula: `${period}的投放花费`,
				unitHidden: true
			}
		].filter((row) => !(isUnit && row.unitHidden))
	);

	const profitTone = $derived(m !== null && m.netProfit < 0 ? 'text-red-700' : 'text-gray-900');
</script>

<section class="flex flex-col gap-3 border-t border-gray-200 pt-3">
	<h3 class={SECTION_HEADING}>这笔钱怎么来的</h3>
	<div class="flex flex-col">
		<h3 class="pb-1 text-xs font-semibold text-gray-900">{period}利润明细</h3>
		{#each profitRows as row, i (i)}
			<div class={TABLE_ROW}>
				<span class="text-xs text-gray-900">{row.name}</span>
				<span class={TABLE_VALUE}>{row.value}</span>
			</div>
		{/each}
		<div class="flex items-baseline justify-between gap-3 border-t border-gray-300 pt-2">
			<!-- 单件口径的账只记到广告费之前，合计就是「每件利润」：
			     它同时也是能投出去的广告费上限，两个数在这里是同一个数 -->
			<span class="text-sm font-semibold text-gray-900">{isUnit ? '每件利润' : '净利润'}</span>
			<span class="shrink-0 font-mono text-sm font-semibold tabular-nums {profitTone}">
				{formatMoney(isUnit ? (m?.contributionProfit ?? 0) : (m?.netProfit ?? 0))}
			</span>
		</div>
		<!-- 每行那半行等宽算式原先常驻，占掉这张表将近一半高度（每行两行文字 → 一行）；
		     它是「想核对时才看」的材料，收进原生 details —— 跟 ④ 的三层口径同一个套路：
		     零 JS、键盘可达、默认收起。表本身仍然逐行可读，「收入减成本」这层算法没被藏起来。 -->
		<details class="mt-1">
			<summary class="cursor-pointer {NOTE_TEXT}">每一项的算式</summary>
			<div class="mt-1 flex flex-col gap-0.5">
				{#each profitRows as row, i (i)}
					<p class="font-mono text-[11px] leading-4 break-all text-gray-600">{row.name}：{row.formula}</p>
				{/each}
			</div>
		</details>
	</div>

	<!-- 退货那笔账单独摊开：这是本工具跟别的 ROI 计算器的分水岭。
	     先是「三类各自退了多少」、再算真损失 —— 反过来的话，
	     「未发货退款真损失 0」看着像漏算，而它恰恰是最该被理解的那一类。
	     **三类的口径说明不挂在行上**，收进下面那个 details 的第一段（它本来就在讲这件事，
	     逐类讲完是同一句话）—— 行上重复一遍是这张表另一半高度。 -->
	<div class="flex flex-col">
		<h3 class="pb-1 text-xs font-semibold text-gray-900">退货这笔账</h3>
		<div class={TABLE_ROW}>
			<span class="text-xs text-gray-900">未发货退款 {formatPercent(unshippedRate)}</span>
			<span class={TABLE_VALUE}>{formatMoney(m?.unshippedAmount ?? 0)}</span>
		</div>
		<div class={TABLE_ROW}>
			<span class="text-xs text-gray-900">在途退款 {formatPercent(shippedRate - signedRate)}</span>
			<span class={TABLE_VALUE}>{formatMoney(m?.inTransitAmount ?? 0)}</span>
		</div>
		<div class={TABLE_ROW}>
			<span class="text-xs text-gray-900">签收后退货 {formatPercent(signedRate)}</span>
			<span class={TABLE_VALUE}>{formatMoney(m?.signedAmount ?? 0)}</span>
		</div>
		<div class={TABLE_ROW}>
			<span class="text-xs text-gray-900">{isUnit ? '退款金额（按退款率摊到每件）' : '退款总额（退给买家）'}</span>
			<span class={TABLE_VALUE}>{formatMoney(m?.returnedAmount ?? 0)}</span>
		</div>

		<div class={TABLE_ROW}>
			<div class="flex min-w-0 items-baseline gap-2">
				<span class="text-xs text-gray-900">能收回的货值</span>
				<!-- 这一行是全表唯一的「加回来」，不点一句会被读成又是一笔损失 -->
				<span class={NOTE_TEXT}>不是损失</span>
			</div>
			<span class="shrink-0 font-mono text-xs text-emerald-700 tabular-nums">
				+ {formatMoney(m?.recoveredGoodsValue ?? 0)}
			</span>
		</div>
		<div class={TABLE_ROW}>
			<span class="text-xs text-gray-900">残损货值</span>
			<span class={TABLE_VALUE}>{formatMoney(m?.damagedGoodsCost ?? 0)}</span>
		</div>
		{#if !commissionRefunded}
			<div class={TABLE_ROW}>
				<div class="min-w-0">
					<div class="text-xs text-gray-900">退不回的佣金</div>
					<!-- 只算已发货那两类：未发货的货没发出，平台必然退佣，谈不上「退不回」 -->
					<div class="font-mono {NOTE_TEXT}">平台不退还，已发货退款那部分也要交</div>
				</div>
				<span class={TABLE_VALUE}>
					{formatMoney(((m?.inTransitAmount ?? 0) + (m?.signedAmount ?? 0)) * commissionRate)}
				</span>
			</div>
		{/if}
		<div class="flex items-baseline justify-between gap-3 border-t border-gray-300 pt-2">
			<span class="text-xs font-semibold text-gray-900">退货真损失</span>
			<span class="shrink-0 font-mono text-sm font-semibold text-gray-900 tabular-nums">
				{formatMoney(m?.returnLoss ?? 0)}
			</span>
		</div>
		<!-- 一行结论（真损失的占比与「收回比例带来了多少」是本工具的分水岭，留在版面上），
		     余下的口径解释收进原生 details —— 跟 ④ 的三层口径同一个套路：零 JS、
		     键盘可达、默认收起。 -->
		<p class="mt-1.5 {NOTE_TEXT}">
			退款占成交额
			<span class="font-mono tabular-nums">{formatPercent(gmv > 0 ? (m?.returnedAmount ?? 0) / gmv : 0)}</span>
			· 真损失占
			<span class="font-mono tabular-nums">{formatPercent(gmv > 0 ? (m?.returnLoss ?? 0) / gmv : 0)}</span>
			· 收回比例 {formatPercent(recoverRate)}，比按「退回来的货全损」算
			<span class="font-mono font-medium text-emerald-700 tabular-nums">
				多赚 {formatMoney(m?.recoveredGoodsValue ?? 0)} 元
			</span>
		</p>
		<details class="mt-1">
			<summary class="cursor-pointer {NOTE_TEXT}"> 为什么真损失只有上面这几块 </summary>
			<p class="mt-1 {NOTE_TEXT}">
				未发货退款那类货没出库，在途那类原封回来，两者都不产生任何损失；只有签收后退货会拆封折损 （它才是<span
					class="font-medium">唯一走「能收回的货款」那档</span
				>的一类）。 真损失因此只剩三块：残损货值、逆向物流、平台不退的佣金（关掉开关才有）。
				「收回比例」装的是两条出路：自己再上架接着卖，或整批退回厂家拿回进价 —— 厂家只退八成就填 80，
				剩下的两成会按残损计入。
			</p>
			<!-- 上面那两行原先常驻在行上，现在收进来 —— 逐行算式放进折叠，表本身仍逐行可读 -->
			<div class="mt-1 flex flex-col gap-0.5">
				<p class="font-mono text-[11px] leading-4 break-all text-gray-600">
					能收回的货值 = 在途件货值（原封，按 100% 算）+ 签收退货货值 × 收回 {formatPercent(recoverRate)}
				</p>
				<p class="font-mono text-[11px] leading-4 break-all text-gray-600">
					残损货值 = 签收退货货值 × (1 − 收回 {formatPercent(recoverRate)})
				</p>
			</div>
			<p class="mt-1 {NOTE_TEXT}">
				未发货退款那一类的代价是<span class="font-medium">推广费</span
				>：货与运费都没损失，但那批订单的广告费已经花掉了，约
				<span class="font-mono tabular-nums">{formatMoney(m?.wastedAdCost ?? 0)}</span>
				元（按未发货退款占比摊）。它不进上面这张表 —— 利润表里这件事的体现方式是「成交额少了、广告费没少」，与真损失不是同一个口径。
			</p>
		</details>
	</div>
</section>
