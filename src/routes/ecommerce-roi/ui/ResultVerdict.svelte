<script lang="ts">
	// 结果卡 ①「结论」段：两个数盒 + 一句话结论 + 一行比率。
	//
	// 开这一页最想问的两句：「最低多少才不算亏本」与「那现在赚了多少」——
	// 所以左盒给保本线、右盒给本口径的那笔钱（整盘净利润 / 单件每件利润），两个数盒排在最前；
	// 下面的结论条补的是「离保本还有多远」，不再重复这两个数。
	// 底色只给右边上：保本线是个常数、不分好坏，给它染红绿反而读成「这条线有问题」。
	import { roiStore } from '../core/store.svelte.ts';
	import { formatMoney, formatNumber, formatPercent, formatTimes } from '../core/format.ts';

	const m = $derived(roiStore.metrics);
	const isUnit = $derived(roiStore.isUnit);
	const period = $derived(roiStore.period);
	const gmv = $derived(roiStore.parsed?.gmv ?? 0);
	const adCost = $derived(roiStore.parsed?.adCost ?? 0);

	// 结论条底色按「赚 / 亏 / 模型就不成立」分三档，条件类名在脚本里拼
	const VERDICT_TONE = {
		ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		error: 'border-red-200 bg-red-50 text-red-700',
		warn: 'border-amber-200 bg-amber-50 text-amber-700',
		neutral: 'border-gray-200 bg-gray-50 text-gray-600'
	} as const;
	// 广告费为 0（整盘没投广告）时，净利润照样算得出来 —— 它等于贡献利润，
	// 所以也按盈亏上色。原先这里给中性底，是因为当时右盒摆的是 ROAS，广告费为 0 时它确实算不出来。
	// 单件口径的广告费**恒为 0**（它算的就是广告费之前的账），那不是「还没填」，不能走中性底。
	const verdictTone = $derived.by(() => {
		if (m === null) return 'neutral';
		if (m.contributionProfit <= 0) return 'warn';
		return m.netProfit >= 0 ? 'ok' : 'error';
	});
	const verdictClass = $derived(`rounded-lg border px-3 py-2.5 text-sm font-medium ${VERDICT_TONE[verdictTone]}`);
	const profitTone = $derived(m !== null && m.netProfit < 0 ? 'text-red-700' : 'text-gray-900');

	/**
	 * 保本 ROAS 的旁注：贡献利润不为正时这条线不存在，说明要跟着换口径。
	 * 不写「这本期 / 这每件」—— 两个口径拼出来都不成句。
	 */
	const breakEvenNote = $derived(
		m !== null && m.contributionProfit > 0 ? `低于它${period}必亏` : '贡献利润不为正，投多少都亏'
	);

	/** 保本 ROAS 的代入式：贡献利润 ≤ 0 时这个除法没有意义，直接说明原因 */
	const breakEvenFormula = $derived(
		m !== null && m.contributionProfit > 0
			? `成交额 ÷ 贡献利润 → ${formatNumber(gmv)} ÷ ${formatNumber(m.contributionProfit)}`
			: '贡献利润不为正 → 保本线不存在'
	);

	const heroLeft = $derived({
		label: '保本 ROAS',
		value: formatTimes(m?.breakEvenRoas ?? Number.NaN),
		note: breakEvenNote
	});

	/**
	 * 顶部右边那个数：**本口径下最先想知道的那笔钱**。
	 *
	 * 整盘口径：这盘投放的净利润（元）—— 不管投没投广告，最先想问的都是「这次投入赚了多少」
	 * （没投广告时它就等于贡献利润，照样给数），所以大数给金额，当前 ROAS 降到下面那行小字
	 * —— 它仍是跟左边保本线对照的对象，只是不再是主位（比率的完整列表在 ④）。
	 * 单件口径：广告费恒为 0，问不出「这期赚多少」，但能算出**每件赚多少** ——
	 * 也就是贡献利润。它是这一页最该被记住的第二个数字（第一个是保本 ROAS），
	 * 而且两个数说的是同一件事的两面：把每件利润全当广告费投出去，
	 * 换回来的成交额除以它就是保本 ROAS —— 所以「每件利润」才是这个词该有的名字，
	 * 不再叫「每件可投广告费」（那是投手的读法，挡住了「这款货到底赚不赚钱」这个更先到的问题）。
	 *
	 * 两个口径合起来就是**左盒门槛、右盒结果**：左边答「最低多少才不亏」，右边答「那现在呢」。
	 */
	const heroRight = $derived.by(() => {
		if (m === null) return { label: '净利润（元）', value: '—', note: '', formula: '' };
		if (isUnit) {
			return {
				label: '每件利润（元）',
				value: formatMoney(m.contributionProfit),
				note: m.contributionProfit > 0 ? '扣完全部成本，还没投广告' : '成本已吃满：卖一件亏一件',
				// 单件口径没有广告费，也就没有「成交额 ÷ 广告费」这条代入可用 —— 留空，那一行不渲染
				formula: ''
			};
		}
		// 没投广告（adCost 空 / 0）不给「—」：净利润就是贡献利润，算得出来，只是没有 ROAS 可报 ——
		// 现实里纯做自然流量、压根不投广告的店是有的，那时候这盒不该空着。
		return {
			label: '净利润（元）',
			value: formatMoney(m.netProfit),
			note: adCost > 0 ? `当前 ROAS ${formatTimes(m.adRoas)}` : '本期没有广告投入',
			// 每个数挂一条「公式 → 本次代入」是本页的约定；净利润这条就是它自己的定义式。
			// 广告费为 0 时它也照写（末尾那个 0.00 正好解释了「为什么等于贡献利润」）。
			formula: `贡献利润 − 广告费 → ${formatNumber(m.contributionProfit)} − ${formatNumber(adCost)}`
		};
	});
</script>

<!-- 手机上也并排（不退回单列）：竖排要吃掉近 200px，把下面那块「账」直接推到
     结果卡的折叠线以下；而这两个数恰恰是最该在第一眼里出现的。每格 165px 够放下
     「低于它本期必亏」这行 11px 小字。
     **左盒门槛、右盒结果**：左边是那条该记住的线（保本 ROAS），右边是本口径最先想知道的那笔钱
     （整盘净利润、单件每件利润）；当前 ROAS 退到右盒那行小字 —— 整盘用户开口问的是「赚了多少」，
     不是比率，比率归 ④。
     两个盒子的最后一行都是**公式代入**（左：成交额 ÷ 贡献利润；右：贡献利润 − 广告费）——
     原先只有左边有、右边缺，同一排两个盒子长得不一样。
     每个数都要挂「公式 → 本次代入」是本页的约定。 -->
<div class="grid grid-cols-2 gap-3">
	<div class="rounded-lg border px-3 py-2.5 {VERDICT_TONE.neutral}">
		<div class="text-xs font-medium">{heroLeft.label}</div>
		<div class="font-mono text-2xl leading-8 font-semibold tabular-nums">{heroLeft.value}</div>
		<div class="text-[11px] leading-4">{heroLeft.note}</div>
		<div class="mt-0.5 font-mono text-[11px] leading-4">{breakEvenFormula}</div>
	</div>
	<div class="rounded-lg border px-3 py-2.5 {VERDICT_TONE[verdictTone]}">
		<div class="text-xs font-medium">{heroRight.label}</div>
		<div class="font-mono text-2xl leading-8 font-semibold tabular-nums">{heroRight.value}</div>
		<div class="text-[11px] leading-4">{heroRight.note}</div>
		{#if heroRight.formula !== ''}
			<div class="mt-0.5 font-mono text-[11px] leading-4">{heroRight.formula}</div>
		{/if}
	</div>
</div>

<!-- 比率那句的解释（为什么它就是保本 ROAS 的倒数）收进 ④ 的三层口径折叠 ——
     结论区只留数字与一句话，说明另找地方，别在黄金位上堆三行小字。 -->
<div class="flex flex-col gap-2">
	<p class={verdictClass} role="status" aria-live="polite">{roiStore.verdict}</p>
	{#if isUnit}
		<p class="text-xs leading-5 text-gray-600">
			每卖出 100 元净赚
			<span class="font-mono font-semibold text-gray-900 tabular-nums">
				{formatMoney((m?.contributionMargin ?? 0) * 100)}
			</span>
			元 · 保本 ROAS
			<span class="font-mono tabular-nums">{formatTimes(m?.breakEvenRoas ?? Number.NaN)}</span>
			的倒数
		</p>
	{:else}
		<!-- 金额已经在上面那个绿 / 红盒子里了，这里只说「赚了几个点」——
		     再报一遍净利等于把同一件事说两次；两个分母口径的换算在 ④ 的利润率卡里。 -->
		<p class="text-xs leading-5 text-gray-600">
			净利率
			<span class="font-mono font-semibold tabular-nums {profitTone}">
				{formatPercent(m?.netMarginOnGmv ?? Number.NaN)}
			</span>
			· 每卖出 100 元{(m?.netMarginOnGmv ?? 0) < 0 ? '亏' : '到手'}
			<span class="font-mono tabular-nums {profitTone}">
				{formatMoney(Math.abs(m?.netMarginOnGmv ?? 0) * 100)}
			</span>
			元
		</p>
	{/if}
</div>
