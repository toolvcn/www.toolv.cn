<script lang="ts">
	// 敏感性表：把「别的条件不变、只动一个变量」的结果摊开。
	//
	// 顺序是 **ROAS → 净利润 在前，退款率 → 保本线 在后** —— DOM 顺序就是显示顺序：
	// 上下排时是上下、并排时是左右。**别改用 CSS `order` 调顺序**：那样读屏顺序与视觉顺序会对不上。
	//
	// 两张表的地位随口径变：单件口径的第一张是**主结果**（那边没有「现在的 ROAS」，
	// 档位围着保本线现算，标题与列头也跟着改说法）；整盘口径两张都算「附带信息」
	// （结论已经由用户填的 ROAS 给定了），第二张是「退款率涨到哪一档开始吃光利润」的补充视角。
	//
	// 第二张扫的是**退款总额**（未发货 + 已发货），三类的相对结构保持不变 ——
	// 现实中「退货率涨了」涨的是整体，不会只涨某一类。所以高亮时也拿两类之和去比。
	//
	// 两张表的行用「档位数值」当 key：档位来自 core/types.ts 的常量数组，值天然唯一，
	// 换档位就是换一行语义，用下标反而会让高亮行错位。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { formatMoney, formatNumber, formatPercent, formatTimes } from '../core/format.ts';
	import type { RoasRow } from '../core/types.ts';
	import { roiStore } from '../core/store.svelte.ts';
	import Sparkline from './Sparkline.svelte';
	import { NOTE_TEXT } from './styles.ts';

	const isUnit = $derived(roiStore.mode === 'unit');
	/** 当前退款总额（未发货 + 已发货），四舍五入到整数百分点，用来跟档位比 */
	const currentRefundRate = $derived(
		roiStore.activeParsed.ok
			? Math.round(
					(roiStore.activeParsed.inputs.unshippedRefundRate + roiStore.activeParsed.inputs.shippedRefundRate) * 100
				)
			: -1
	);
	const currentRoas = $derived(roiStore.metrics?.adRoas ?? Number.NaN);
	const breakEvenRoas = $derived(roiStore.metrics?.breakEvenRoas ?? Number.NaN);

	/**
	 * ROAS 那张表（第一张）标哪一档。
	 * 整盘口径填了「现在的 ROAS」，标当前值；单件口径**没有**这个输入，
	 * 整张表本来就是围着保本线生成的，所以标保本线向上取整那一档（也就是 `defaultTrialRoas`）。
	 */
	const markedRoas = $derived(isUnit ? (roiStore.defaultTrialRoas ?? Number.NaN) : currentRoas);

	/**
	 * 两张表最后一列的口径随模式变，而且是**两种不同的东西**，别合成一个变量：
	 * 退款率表那一列是 `breakEvenByReturnRate` 给的 `netProfit` —— 它**已经扣了当前广告费**，
	 * 只是单件口径下广告费恒为 0，那一格才正好等于每件利润，所以单件叫「每件利润」；
	 * ROAS 表那一列是按各档 ROAS 各扣一次广告费（`profitByRoas`），单件口径下是「每件净利」。
	 */
	const returnProfitLabel = $derived(isUnit ? '每件利润' : '净利润');
	const roasProfitLabel = $derived(isUnit ? '每件净利' : '净利润');

	/**
	 * 当前值落在哪一档：给那一行加底色，让用户一眼定位自己在哪。
	 * **超出档位范围就返回 -1（不高亮任何一行）** —— 档位是写死的几档（0~90% / 1~10），
	 * 高亮端点会让人误读成「我现在就是这一档」，宁可一行都不标。
	 */
	const nearReturnRate = $derived.by(() => {
		const rows = roiStore.returnRateTable;
		if (rows.length === 0) return -1;
		const first = rows[0].ratePercent;
		const last = rows[rows.length - 1].ratePercent;
		if (currentRefundRate < first || currentRefundRate > last) return -1;
		return rows.reduce(
			(best, row) =>
				Math.abs(row.ratePercent - currentRefundRate) < Math.abs(best.ratePercent - currentRefundRate) ? row : best,
			rows[0]
		).ratePercent;
	});
	const nearRoas = $derived.by(() => {
		const rows = roiStore.roasTable;
		if (rows.length === 0) return -1;
		const first = rows[0].roas;
		const last = rows[rows.length - 1].roas;
		if (!(markedRoas >= first && markedRoas <= last)) return -1;
		return rows.reduce(
			(best, row) => (Math.abs(row.roas - markedRoas) < Math.abs(best.roas - markedRoas) ? row : best),
			rows[0]
		).roas;
	});

	/** 脚注：有高亮行说「底色那行是哪一档」，没有就说明当前值不在档位里 */
	const returnRateNote = $derived(
		nearReturnRate >= 0
			? `底色那行最接近你当前的退款率（${formatPercent(currentRefundRate / 100)}，未发货 + 已发货）`
			: `当前退款率 ${formatPercent(currentRefundRate / 100)} 不在表的档位内`
	);
	const roasNote = $derived.by(() => {
		if (isUnit) {
			// 单件口径的表是围着保本线生成的，高亮那行就是保本线向上取整的那一档
			return nearRoas >= 0
				? `底色那行是保本线那一档（保本 ROAS ${formatTimes(breakEvenRoas)}）；广告费 = 售价 ÷ ROAS`
				: `保本 ROAS ${formatTimes(breakEvenRoas)}；广告费 = 售价 ÷ ROAS —— 保本线不在这几档之间`;
		}
		return nearRoas >= 0
			? `底色那行最接近你当前的 ROAS（${formatTimes(currentRoas)}）；广告费 = 成交额 ÷ ROAS`
			: `当前 ROAS ${formatTimes(currentRoas)} 不在表的档位内；广告费 = 成交额 ÷ ROAS`;
	});

	/**
	 * 「下一步动哪个最值」：只给一个答案。
	 * 十几个输入摆在那里，给一张表等于没给，给一个数才有用。
	 * 它**原先长在结果卡的结论下面**，现搬到这里 —— 跟下面两张表回答的是同一个问题
	 * （动哪个变量、动多少会怎样），摆一处才读得通；结果卡那边把那两行让给了数字。
	 */
	const sensitiveNote = $derived.by(() => {
		const item = roiStore.sensitive;
		if (item === null) return '';
		const at = (value: number): string =>
			item.kind === 'percent' ? formatPercent(value) : `${formatNumber(value)} 元`;
		const move =
			item.direction === 'down'
				? `从 ${at(item.current)} 降到 ${at(item.next)}`
				: `从 ${at(item.current)} 提到 ${at(item.next)}`;
		return `${item.label} ${move}，${isUnit ? '每件' : '本期'}净利多 ${formatMoney(item.gain)} 元 —— 比动其它任何一项都值`;
	});

	const TH = 'pb-1 text-left text-xs font-medium text-gray-600';
	const TH_RIGHT = 'pb-1 text-right text-xs font-medium text-gray-600';
	const TD = 'py-1 font-mono text-xs tabular-nums';

	// 条件类名一律在脚本里拼：写在 class 属性里的三元会被 prettier 折行拆断而静默失效（AGENTS §6）
	/** 高亮行底色（只给底色，文字色交给下面两个） */
	const rowClass = (active: boolean): string => (active ? 'bg-blue-50' : '');
	/** 行内文字色：th 自带颜色会盖掉 tr 上的，所以 th 与 td 用同一个函数取色，同行不会出现两种色 */
	const toneClass = (active: boolean): string => (active ? 'text-gray-900' : 'text-gray-700');
	/** 净利格：负数优先给红字，其余跟随高亮 */
	const profitClass = (row: RoasRow, active: boolean): string =>
		`${TD} text-right ${row.netProfit < 0 ? 'text-red-700' : toneClass(active)}`;
</script>

<!-- `@container` 让下面那张 grid 的列数跟着**本面板自己的宽度**走，不跟视口：
     这个面板在中栏里的宽度不随视口单调递增（xl 分左右两列、2xl 左列还变宽），视口断点对不上它。
     容器查询必须放在**祖先**上：放在 grid 自己身上的话，`@md:` 匹配不到它自己。 -->
<Panel
	id="roi-sensitivity"
	headingId="roi-sensitivity-heading"
	heading="敏感性：换一个变量会怎样"
	class="@container lg:min-h-0"
>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>其余条件保持不变</span>
	{/snippet}

	<!-- 两张表**左右并排**，但只在面板自己的宽度够时才排：
	     每张表要放三列（退款率 / 保本 ROAS / 净利润），加间距至少 370px 才不成问题。
	     `@md` = 28rem = 448px 面板宽 → 每张 200px，留了余量；对应视口约 1424px 起。
	     1280–1423 这段中栏分栏后本面板只有 304px，并排每张 127px —— 三列表格会挤坏，
	     所以那一档退回上下排（实测整块 832px，内滚 382px）。
	     **用容器查询而不是 `xl:`/`2xl:` 视口断点**：视口 1535 → 1536 时左列从 20rem 跳到 24rem，
	     右列反而变窄（559 → 464px），按视口写会在跨 2xl 那一下把表格挤扁。 -->
	<!-- 同结果卡：桌面面板内滚，移动端封顶 60vh -->
	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行 -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="grid grid-cols-1 gap-4 overflow-y-auto p-4 max-lg:max-h-[60vh] lg:min-h-0 lg:flex-1 @md:grid-cols-2"
		tabindex="0"
		role="region"
		aria-label="敏感性表"
	>
		<!-- 错误态与空态：表是空数组时不能照渲染表头，否则是一张空表配一句「-1.0%」的注脚。
		     并排布局下它要横跨两列，否则会缩在左半边 -->
		{#if roiStore.error !== '' || roiStore.isEmpty}
			<!-- 具体错在哪由**字段旁边**那条红字说（`roiStore.errorField`），这里只说「表为什么没出来」——
			     同一句话在结果卡与这里各摆一遍，桌面同屏看到两处，是最没必要的重复。 -->
			<p class="py-6 text-center text-xs leading-5 text-gray-600 @md:col-span-2">
				{roiStore.error !== '' ? '先修正左侧标红的那一项，两张表会跟着算出来' : '填好左侧参数，两张表会跟着算出来'}
			</p>
		{:else}
			<!-- 「下一步动哪个最值」：只有一句结论，所以铺满整行（并排时也横跨两列）——
			     它是从结果卡搬过来的，跟下面两张表回答同一个问题。一项都改善不了时整块不渲染，
			     不硬凑答案（`roiStore.sensitive` 为 null）。 -->
			{#if sensitiveNote !== ''}
				<p
					class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 @md:col-span-2"
				>
					下一步最值的一项：<span class="font-medium text-gray-900">{sensitiveNote}</span>
				</p>
			{/if}

			<!-- ROAS → 净利。**第一张**：单件口径下它是主结果（那边没有「现在的 ROAS」，
			     整张表的档位围着保本线现算），所以标题也跟着换成一句人话 -->
			<!-- relative 给下面 caption 的 sr-only 提供定位上下文（UI-STYLE §18） -->
			<div class="relative min-w-0">
				<h3 class="pb-1.5 text-xs font-semibold text-gray-900">
					{isUnit ? 'ROAS 做到多少，每件赚多少' : 'ROAS 与净利润的关系'}
				</h3>
				<table class="w-full border-collapse text-left">
					<caption class="sr-only">不同 ROAS 下的广告费与{isUnit ? '每件净利' : '净利润'}</caption>
					<thead>
						<tr class="border-b border-gray-200">
							<th scope="col" class={TH}>ROAS</th>
							<th scope="col" class={TH_RIGHT}>对应广告费</th>
							<th scope="col" class={TH_RIGHT}>{roasProfitLabel}</th>
						</tr>
					</thead>
					<tbody>
						{#each roiStore.roasTable as row (row.roas)}
							<tr class={rowClass(row.roas === nearRoas)}>
								<th scope="row" class={`py-1 text-xs font-normal ${toneClass(row.roas === nearRoas)}`}>
									{row.roas}
								</th>
								<td class={`${TD} text-right ${toneClass(row.roas === nearRoas)}`}>{formatMoney(row.adCost)}</td>
								<td class={profitClass(row, row.roas === nearRoas)}>{formatMoney(row.netProfit)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<Sparkline
					values={roiStore.roasTable.map((row) => row.netProfit)}
					highlight={roiStore.roasTable.findIndex((row) => row.roas === nearRoas)}
				/>
				<p class="mt-1.5 {NOTE_TEXT}">{roasNote}</p>
			</div>

			<!-- 退款率 → 保本 ROAS。**第二张**：退款率从 10% 涨到 30%、保本 ROAS 被推高多少，
			     看这张（卖服装最常问的一句）。扫的是两类之和，三类的结构按当前比例同比缩放 -->
			<!-- relative 给下面 caption 的 sr-only 提供定位上下文（UI-STYLE §18） -->
			<div class="relative min-w-0">
				<h3 class="pb-1.5 text-xs font-semibold text-gray-900">退款率推高保本线</h3>
				<table class="w-full border-collapse text-left">
					<caption class="sr-only">不同退款率下的保本 ROAS 与{isUnit ? '每件利润' : '净利润'}</caption>
					<thead>
						<tr class="border-b border-gray-200">
							<th scope="col" class={TH}>退款率</th>
							<th scope="col" class={TH_RIGHT}>保本 ROAS</th>
							<th scope="col" class={TH_RIGHT}>{returnProfitLabel}</th>
						</tr>
					</thead>
					<tbody>
						{#each roiStore.returnRateTable as row (row.ratePercent)}
							<tr class={rowClass(row.ratePercent === nearReturnRate)}>
								<th scope="row" class={`py-1 text-xs font-normal ${toneClass(row.ratePercent === nearReturnRate)}`}>
									{row.ratePercent}%
								</th>
								<td class={`${TD} text-right ${toneClass(row.ratePercent === nearReturnRate)}`}>
									{formatTimes(row.breakEvenRoas)}
								</td>
								<td class={`${TD} text-right ${toneClass(row.ratePercent === nearReturnRate)}`}>
									{formatMoney(row.netProfit)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<Sparkline
					values={roiStore.returnRateTable.map((row) => row.breakEvenRoas)}
					highlight={roiStore.returnRateTable.findIndex((row) => row.ratePercent === nearReturnRate)}
				/>
				<p class="mt-1.5 {NOTE_TEXT}">{returnRateNote}</p>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">两张表都只改了一个变量，其余按左侧填的值算</p>
		</div>
	{/snippet}
</Panel>
