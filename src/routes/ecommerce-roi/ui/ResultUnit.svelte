<script lang="ts">
	// 结果卡 ②「反推与试算」（只有单件口径）：单件模型的几种解法 + 一次正向试算。
	//
	// **版式按「谁依赖谁」排，不按「数字摆得整齐」排**，同时**不留说明句**。
	// 改版前是一条前提条（假设投产比 / 目标净利率 / 固定成本挤在一起）+ 2×2 四张卡 +
	// 一块「卖多少赚多少」：前提与结果对不上号（目标净利率改不动保本售价、固定成本只管保本销量
	// 且不进规模试算），四张卡还混了「元」与「件/周期」两个量纲。
	// 分块之后又发现整段太高 —— 结果面板里这一节本来就要滚，而 272px 宽的正文一行只放得下
	// 二十来个字，**任何一句解释都要吃掉一两行高度**，所以第二版把说明句全部删掉：
	// 「谁管谁」由位置表达（前提就在它管的数旁边），口径与公式在说明栏（DocPanel）里逐条写着。
	//
	// 现在的三层：
	//   段首  假设投产比 —— 唯一跨两块的前提（定价反推拿它扣广告、规模试算拿它折广告费）
	//   块 A  定价反推（元）：目标净利率**在这一块的标题行右端**（管一整组 → 放标题行，
	//         跟退货那三个率的开关同一个约定）→ 每元剩余 → 三个价位解合成一张三行的列表
	//   块 B  规模试算（件）：两格前提各配一个自己的读数排在同一条里
	//         （固定成本 → 保本销量；试算售价 / 销量 → 净利），明细压成一行
	//
	// 三个数为什么是列表而不是卡片：卡片一个数要占「名称 / 数值 / 注脚」三行 + 内边距（约 82px），
	// 三个并排还会把注脚挤成两行；改成「名称 · 前提 → 数值」一行一个（约 28px）省掉一半高度，
	// 而且三行天然是同一组的三种解法，比三张卡片更像一张表。保本售价不再单独占整行 ——
	// 它「不看目标净利率」由另外两行的注脚反衬（那两行的注脚里都写着「净利率 X%」）。
	//
	// 两处读数也顺手改清楚了：
	//   - 净利那个数补上名字（原先旁边只有「元」）；
	//   - 每件的那个数叫**「扣广告后每件」**，跟 ① 段的「每件利润」（扣广告之前）分开叫 ——
	//     两个数只差一个广告费，原先一个叫「摊到每件」、注脚只说「扣完广告费之后」，看不出差别在哪。
	//
	// 这几格都是**临时试算**（不进输入面板）；除目标净利率外都不落盘 —— 目标净利率是商品的目标，
	// 跟着预设 / 会话快照 / CSV 一起存，假设投产比 / 固定成本 / 试算售价 / 试算销量则只在本次会话里。
	import Input from '$lib/ui/Input/Input.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { roiStore } from '../core/store.svelte.ts';
	import { toNumber } from '../core/parse.ts';
	import { formatCount, formatMoney, formatPercent, formatTimes } from '../core/format.ts';
	import {
		METRIC_CARD,
		NOTE_ERROR,
		NOTE_TEXT,
		SECTION_HEAD,
		SECTION_HEADING,
		SECTION_TITLE,
		TABLE_ROW,
		TRIAL_BAR
	} from './styles.ts';

	const reverse = $derived(roiStore.reverse);
	const volume = $derived(roiStore.breakEvenVolume);
	const scale = $derived(roiStore.scale);
	const gmv = $derived(roiStore.parsed?.gmv ?? 0);

	// ---------------------------------------------------------------- 段首：假设投产比
	//
	// 唯一**跨两块**的前提：定价反推拿它算「每 1 元售价要扣掉多少广告」，
	// 规模试算拿它把成交额折成广告费。所以它留在段首、不归任何一块。

	const trialRoasPlaceholder = $derived(roiStore.defaultTrialRoas === null ? '' : String(roiStore.defaultTrialRoas));
	/** 只在填错时出红字。留空不算错（那是「用默认值」），规则写在条尾那句里 */
	const trialRoasError = $derived(
		roiStore.trialRoasInvalid ? `不是有效数字，按 ${formatTimes(roiStore.trialRoasValue)} 算` : ''
	);
	/** 留空规则：贡献利润不为正时没有保本线可取，那时「留空取保本线向上取整」是假话 */
	const trialRoasNote = $derived(
		roiStore.defaultTrialRoas === null
			? '两块都用它；没有保本线可取，留空按不投广告算。'
			: `两块都用它；留空按保本线向上取整（${roiStore.defaultTrialRoas}）。`
	);

	// ---------------------------------------------------------------- 块 A：定价反推（元）
	//
	// 三个数解的是同一条式子 `净利 = 售价 × 每元剩余 − 固定花掉的钱`，只是解的量不同
	// （保本售价 / 达标售价 / 成本上限）。目标净利率是它们自己的前提，只管这一块。

	const targetMarginError = $derived(roiStore.targetMarginInvalid ? '不是有效数字，按 0 算' : '');
	const targetMarginRatio = $derived(
		Number.isFinite(Number(roiStore.targetMargin)) ? Number(roiStore.targetMargin) / 100 : 0
	);
	/** 达标那个价下的每件净利：净利率正好等于目标值，所以它 = 目标价 × 目标净利率 */
	const targetPriceProfit = $derived(reverse === null ? Number.NaN : reverse.targetPrice * targetMarginRatio);
	/** 成本上限被钳到 0 时说的是「成本已无空间」，不是一个读不懂的 0.00 */
	const maxCostNote = $derived(
		reverse !== null && reverse.maxUnitCost <= 0 ? '成本已无空间' : `净利率 ${formatPercent(targetMarginRatio)} 下`
	);

	// ---------------------------------------------------------------- 块 B：规模试算（件）
	//
	// 两个子块各有自己的前提，所以读数跟着各自的前提排，不集中在盒子末尾：
	//   固定成本只管「保本销量」（口径恒为不投广告，跟假设投产比无关）
	//   试算售价 / 销量只管「净利」（它的广告费才用假设投产比）

	/** 固定成本（元/日 或 元/月）：周期只决定结果的读法与切换时的换算倍数 */
	const FIXED_COST_PERIODS = [
		{ value: 'day', label: '日', title: '按每天的固定成本填，结果是「每天要卖多少」' },
		{ value: 'month', label: '月', title: '按每月的固定成本填，结果是「每月要卖多少」' }
	] as const;
	const periodLabel = $derived(roiStore.trialFixedCostPeriod === 'month' ? '月' : '日');
	/** 空串是「还没填」，跟填了 0 不是一回事 —— 前者给承诺语，后者照样算 */
	const volumeHasCost = $derived(roiStore.trialFixedCost.trim() !== '');
	/** 空串不算错，填了个非数或负数才提示（两者都按 0 参与计算） */
	const fixedCostError = $derived.by(() => {
		const raw = roiStore.trialFixedCost.trim();
		if (raw === '') return '';
		const value = toNumber(raw);
		return Number.isFinite(value) && value >= 0 ? '' : '要填一个不小于 0 的数字，按 0 算';
	});
	/** 保本销量：只认固定成本、每件利润与当前售价 —— 假设投产比怎么填都不动它 */
	const volumeText = $derived(
		volume !== null && volume.error === '' && volumeHasCost ? `${formatCount(volume.quantity)} 件/${periodLabel}` : '—'
	);
	/** 注脚压在**一行**里：这一段在窄面板上一行只放得下二十来个字，多一句就多一行高度 */
	const volumeNote = $derived.by(() => {
		if (volume === null) return '先填一个大于 0 的售价';
		if (volume.error !== '') return '';
		if (!volumeHasCost) return '填左边那格就有数';
		return `不投广告 · 成交额 ${formatMoney(volume.gmv)} 元`;
	});

	const scaleProfit = $derived(scale?.metrics?.netProfit ?? Number.NaN);
	const scaleProfitTone = $derived(scaleProfit < 0 ? 'text-red-700' : 'text-gray-900');
	/** 扣广告费之后的每件净利：跟 ① 段那个「每件利润」差着一个广告费，所以名字要分开叫 */
	const scalePerUnit = $derived(
		scale !== null && scale.metrics !== null ? scale.metrics.netProfit / scale.quantity : Number.NaN
	);
	/** 广告费那行的口径：拿不到投产比时按 0 算，不说会读成「这笔生意不用投广告」 */
	const scaleAdNote = $derived(
		Number.isFinite(roiStore.trialRoasValue)
			? `成交额 ÷ 投产比 ${formatTimes(roiStore.trialRoasValue)}`
			: '没给投产比，按不投广告算'
	);
	const scalePricePlaceholder = $derived(roiStore.parsed === null ? '' : String(Number(gmv.toFixed(2))));
	const scalePriceError = $derived(roiStore.scalePriceInvalid ? `不是有效数字，按 ${scalePricePlaceholder} 元算` : '');
	const scaleQtyError = $derived(roiStore.scaleQtyInvalid ? `不是有效数字，按 ${roiStore.scaleQtyValue} 单算` : '');
</script>

<section class="flex flex-col gap-3 border-t border-gray-200 pt-3">
	<h3 class={SECTION_HEADING}>反推与试算</h3>

	<div class="{TRIAL_BAR} flex flex-wrap items-center gap-x-3 gap-y-1">
		<div class="flex items-center gap-1.5">
			<label class="text-[11px] font-medium text-gray-600" for="roi-unit-roas">假设投产比</label>
			<div class="w-16">
				<Input
					id="roi-unit-roas"
					size="sm"
					mono
					inputmode="decimal"
					placeholder={trialRoasPlaceholder}
					bind:value={roiStore.trialRoas}
				/>
			</div>
		</div>
		{#if trialRoasError !== ''}
			<p class="w-full {NOTE_ERROR}">{trialRoasError}</p>
		{/if}
		<p class="w-full {NOTE_TEXT}">{trialRoasNote}</p>
	</div>

	<!-- 块 A：定价反推（元）。目标净利率只管这一块的三个数，所以摆在这一块的标题行右端。 -->
	<div class="flex flex-col gap-2">
		<div class={SECTION_HEAD}>
			<h3 class={SECTION_TITLE}>定价反推（元）</h3>
			<div class="flex items-center gap-1.5">
				<label class="text-[11px] font-medium text-gray-600" for="roi-unit-margin">目标净利率（%）</label>
				<div class="w-14">
					<Input
						id="roi-unit-margin"
						size="sm"
						mono
						inputmode="decimal"
						placeholder="0"
						bind:value={roiStore.targetMargin}
					/>
				</div>
			</div>
		</div>
		{#if targetMarginError !== ''}
			<p class={NOTE_ERROR}>{targetMarginError}</p>
		{/if}

		<!-- 中间量：下面三个数都由它推出来，所以摆在数**之前**；等式只写这一处。 -->
		{#if reverse !== null && reverse.error === ''}
			<p class={NOTE_TEXT}>
				每 1 元售价剩
				<span class="font-mono tabular-nums">{formatPercent(reverse.perYuanLeft)}</span>
				（扣完退货、佣金、广告）· 净利 = 售价 × {formatPercent(reverse.perYuanLeft)} − 固定成本
			</p>
		{/if}
		{#if reverse !== null && reverse.error !== ''}
			<p class="text-xs leading-5 text-red-700">{reverse.error}</p>
		{/if}

		{#if reverse !== null}
			<div class="{METRIC_CARD} flex flex-col">
				<div class={TABLE_ROW}>
					<div class="min-w-0 text-xs text-gray-900">
						保本售价<span class="text-[11px] text-gray-600"> · 低于它必亏</span>
					</div>
					<span class="shrink-0 font-mono text-sm font-semibold text-gray-900 tabular-nums">
						{formatMoney(reverse.breakEvenPrice)}
					</span>
				</div>
				<div class={TABLE_ROW}>
					<div class="min-w-0 text-xs text-gray-900">
						达标最低售价<span class="text-[11px] text-gray-600">
							· 净利率 {formatPercent(targetMarginRatio)} · 每件 {formatMoney(targetPriceProfit)} 元</span
						>
					</div>
					<span class="shrink-0 font-mono text-sm font-semibold text-gray-900 tabular-nums">
						{formatMoney(reverse.targetPrice)}
					</span>
				</div>
				<div class={TABLE_ROW}>
					<div class="min-w-0 text-xs text-gray-900">
						最高可接受单件成本<span class="text-[11px] text-gray-600"> · {maxCostNote}</span>
					</div>
					<span class="shrink-0 font-mono text-sm font-semibold text-gray-900 tabular-nums">
						{formatMoney(reverse.maxUnitCost)}
					</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- 块 B：规模试算（件）。两格前提各带自己的读数 —— 把读数挪到盒子末尾就会重演
	     「前提跟结果对不上号」那件事。 -->
	<div class="flex flex-col gap-2">
		<h3 class={SECTION_TITLE}>规模试算（件）</h3>

		<div class="{TRIAL_BAR} flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
				<div class="flex items-center gap-1.5">
					<label class="text-[11px] font-medium text-gray-600" for="roi-unit-fixed-cost">
						固定成本（元/{periodLabel}）
					</label>
					<div class="w-20">
						<Input id="roi-unit-fixed-cost" size="sm" mono inputmode="decimal" bind:value={roiStore.trialFixedCost} />
					</div>
					<!-- 日 / 月的开关贴着它管的那一格；`[&>button]:flex-none`：轻档默认 flex-1
					     均分整行，这里要贴着文字的窄控件 -->
					<SegmentedControl
						options={FIXED_COST_PERIODS}
						value={roiStore.trialFixedCostPeriod}
						tone="quiet"
						class="w-fit shrink-0 [&>button]:flex-none"
						aria-label="固定成本的周期"
						onchange={(period) => roiStore.setFixedCostPeriod(period)}
					/>
				</div>
				<span class="min-w-0 {NOTE_TEXT}">
					→ 保本销量
					<span class="font-mono font-semibold text-gray-900 tabular-nums">{volumeText}</span>
				</span>
			</div>
			{#if fixedCostError !== ''}
				<p class={NOTE_ERROR}>{fixedCostError}</p>
			{/if}
			{#if volume !== null && volume.error !== ''}
				<p class={NOTE_ERROR}>{volume.error}</p>
			{:else if volumeNote !== ''}
				<p class={NOTE_TEXT}>{volumeNote}</p>
			{/if}

			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 pt-2">
				<!-- 每对 label + input 包成一个 flex：这一行在窄面板下会折行，
				     拆成平级节点的话标签会和自己的框分到两行 -->
				<div class="flex items-center gap-1.5">
					<label class="text-[11px] font-medium text-gray-600" for="roi-unit-scale-price">试算售价</label>
					<div class="w-20">
						<Input
							id="roi-unit-scale-price"
							size="sm"
							mono
							inputmode="decimal"
							placeholder={scalePricePlaceholder}
							bind:value={roiStore.scalePrice}
						/>
					</div>
				</div>
				<div class="flex items-center gap-1.5">
					<label class="text-[11px] font-medium text-gray-600" for="roi-unit-scale-qty">销量</label>
					<div class="w-20">
						<Input
							id="roi-unit-scale-qty"
							size="sm"
							mono
							inputmode="decimal"
							placeholder={String(roiStore.scaleQtyValue)}
							bind:value={roiStore.scaleQty}
						/>
					</div>
				</div>
				<span class="min-w-0 {NOTE_TEXT}">
					→ 净利
					<span class="font-mono text-lg font-semibold tabular-nums {scaleProfitTone}">
						{formatMoney(scaleProfit)}
					</span>
					元
				</span>
			</div>
			{#if scalePriceError !== ''}
				<p class={NOTE_ERROR}>{scalePriceError}</p>
			{:else if scaleQtyError !== ''}
				<p class={NOTE_ERROR}>{scaleQtyError}</p>
			{/if}

			{#if scale !== null}
				{#if scale.error !== ''}
					<p class="text-xs leading-5 text-red-700">{scale.error}</p>
				{:else if scale.metrics !== null}
					<p class="font-mono {NOTE_TEXT}">
						成交额 <span class="text-gray-900">{formatMoney(scale.gmv)}</span> · 广告费
						<span class="text-gray-900">{formatMoney(scale.adCost)}</span>
						（{scaleAdNote}）· 扣广告后每件
						<span class="text-gray-900">{formatMoney(scalePerUnit)}</span>
					</p>
				{/if}
			{/if}
		</div>
	</div>
</section>
