<script lang="ts">
	// 参数卡：按当前口径渲染两套字段。
	// 整盘口径问「这盘生意卖了多少钱」，单件口径问「一款货卖多少、成本多少」——
	// 后者不用编订单数，试一个 SKU 的定价时更顺手。
	//
	// 单件口径**不问投产比**：它算的是广告费之前的账（保本 ROAS 是多少、每件能拿出多少钱投广告），
	// 这两件事都不需要先知道自己现在跑在什么 ROAS 上。真按某个 ROAS 算的账在结果卡里现填。
	// 整盘口径反过来 —— 那盘生意一定有广告费，所以「广告」那格允许两种填法
	// （直接填花了多少钱，或填后台跑出来的 ROAS），另一个数在提示栏里自动算出来。
	//
	// **退款拆成三个率**（未发货 / 已发货 / 其中在途）：同一笔退款，三类承担的成本完全不同，
	// 合成一个「退货率」会把「未发货的那批也收了发货运费」这类错误悄悄算进去。
	// 在途是选填项 —— 不填就等于全部按签收后退货处理（保守），填了才能把拒收件按「原封可再售」算。
	//
	// 每个数值字段都交给 NumberField（可见 label + 输入框 + 有值才出现的清空按钮 + 字段级红字），
	// 这里只负责分组与文案，不再逐个写 label + Input。字段的红字靠 `field` 认领
	// `roiStore.errorField` 指过来的那条错误，所以这里的每个 NumberField 都要写 `field`。
	//
	// 分组壳走 ui/InputSection.svelte（标题行 + 组级开关 + lg 以下的收起 / 展开）。
	// **组级的填法开关（退款那三个率）留在小节标题行**（理由见 styles.ts 的 SECTION_HEAD）；
	// **字段级的填法开关贴字段名右端**（`NumberField` 的 `labelExtra`）—— 它只管这一格，
	// 贴在那个名字旁边才看得出管的是谁。目前三处：广告花费、订单数、商品成本。
	//
	// 面板头部右侧是口径切换与 示例 / 清空：这三样都只作用于本面板的输入，
	// 贴在输入区上方比挂在整宽工具条上更好找（原先口径独占一行、示例与清空隔着半屏）。
	// 宽度只够放图标按钮 —— xl 下面板只有 20rem（320px），带文字的两个按钮会把标题行挤到换行被裁掉。
	// 「清空」是这一页唯一的破坏性操作（十几个字段一次性清掉、进不了预设回退），所以先弹一次确认。
	import { ArrowLeftRight, Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { roiStore } from '../core/store.svelte.ts';
	import { formatCount, formatMoney, formatPercent, formatTimes } from '../core/format.ts';
	import CommissionSwitch from './CommissionSwitch.svelte';
	import NumberField from './NumberField.svelte';
	import { FIELD_GRID, NOTE_TEXT } from './styles.ts';
	import InputSection from './InputSection.svelte';
	import { FOOTER_BAR } from '$lib/ui/styles';

	/** 口径切换：整盘看一段时间的总投放，单件看一款商品的单件账 */
	const MODE_OPTIONS = [
		{ value: 'batch', label: '整盘', title: '看一段时间的总投放' },
		{ value: 'unit', label: '单件', title: '看一款商品的单件账' }
	] as const;

	/**
	 * 订单数那格的两种填法。
	 * 两者是一件事的两头（订单数 = 成交额 ÷ 客单价），所以跟成本 / 广告 / 退款那三处一样：
	 * 一个开关、二选一，切换时数字跟着换算。
	 *
	 * 按钮文案**不带「按」字**（「单数 / 客单价」）：它紧跟字段名，连起来读已经是「订单数 · 单数」，
	 * 那个介词是多余的；而且这一行要同时放下字段名与按钮，最窄的 lg 档只有 151px。
	 */
	const ORDERS_MODE_LABEL = { count: '单数', aov: '客单价' } as const;
	const isOrdersAov = $derived(roiStore.inputs.ordersMode === 'aov');

	/**
	 * 商品成本的两种填法。
	 * 之所以要「金额」：运营手上拿到的货价是「进价 35 元」这种绝对值，
	 * 换算成成本率经常除不尽（35 ÷ 69.9 = 50.0715…%），只能填近似值 ——
	 * 按金额填反而精确（成本率 × 成交额 = 单件成本 × 订单数，两条路同一个数）。
	 */
	const COST_MODE_LABEL = { rate: '比例', unit: '金额' } as const;

	/**
	 * 广告那格的两种填法（只整盘口径有）。
	 * 投手手上两个数都有：有的只知道自己充了多少钱，有的只看后台跑出来的 ROAS。
	 * 让人先做一道除法才能开始算，是纯粹的拦截。
	 */
	const AD_MODE_LABEL = { cost: '花费', roas: 'ROAS' } as const;

	/**
	 * 字段名右端那枚填法交换按钮。**三处共用**：广告花费 / 订单数 / 商品成本。
	 *
	 * 形态是「当前填法 + 交换图标」，点一下换到另一种 —— 两个选项来回切的场景，
	 * 一枚按钮比两枚分段按钮省一半宽度，而且贴在它所管的那个名字旁边，看得出管的是谁。
	 * 文案一律不带「按」字（「花费 / ROAS」「单数 / 客单价」「比例 / 金额」）。
	 *
	 * **高度 24px（`h-6`）是下限** —— axe 的 target-size / UI-STYLE §18 的触控目标。
	 * 但字段名的行高只有 16px，按钮照 24px 排版会把这一格的标题行顶高：
	 * 字段网格是两列并排，左边标题行一高，右边那格（成交额）的输入框就跟着低 8px
	 * —— 同排的两个输入框不在一条线上，这才是「跟输入框对不齐」（实测 2xl 档差 12px 那种）。
	 * 所以用 `-my-1` 把上下各 4px 吃掉：按钮本身仍是 24px 的点击区，
	 * 在行里却只占 16px，标题行高度与网格里其它字段完全一致。
	 * 代价只有一处：hover 的浅蓝底上下各溢出标题行 4px（下缘刚好贴到输入框顶边），静止态看不出来。
	 *
	 * 字号 `text-xs`，与 12px 的字段名、同页 `SEG_BTN_QUIET` 同档。
	 * 形态是**无边框、无底色**的轻按钮，只靠蓝字表达「这是当前的填法」
	 * —— 一屏三处填法切换全带框会互相抢镜头（同 SEG_ON_QUIET 的取舍）。
	 *
	 * **尺寸是按「字段名 + 按钮」最挤的那一格倒推的**：整盘口径里最长的是
	 * 「单件成本（元/件）」106px 配 2 字按钮、「客单价（元/单）」94px 配 3 字按钮，
	 * 而 2xl 档字段只有 167px。所以内边距收到 `px-1.5`、图标 `size-3`、字图标间距 `gap-0.5`
	 * —— 2 字按钮 50px、3 字 62px，`106 + 8 + 50 = 164 ≤ 167` 才刚好放得下（实测）。
	 * 再宽一档（比如原先把「按」字带上）这两格就会折行，而折行会让本格标题行长高、
	 * 把同排另一列的输入框顶下去。
	 */
	const MODE_SWAP_BTN =
		'inline-flex h-6 -my-1 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

	/**
	 * 退款三格（未发货 / 已发货 / 其中在途）的填法。
	 * **整组一个开关**：三格要么都按率、要么都按金额 —— 「在途 ≤ 已发货」是它们之间的约束，
	 * 一格填率、一格填金额的话这条约束没法直接比。
	 */
	const REFUND_MODES = [
		{ value: 'rate', label: '按比例', title: '填退款率（占成交单数的比例），能直接跟后台的退款率对账' },
		{ value: 'amount', label: '按金额', title: '填退掉的成交额（元），按成交额折回退款率' }
	] as const;

	/** 输入框里的原始文本 → 数字；空串与非法值给 NaN（「没填」要跟「填了 0」分开） */
	function toNumber(raw: string): number {
		const text = raw.trim().replace(/,/g, '');
		return text === '' ? Number.NaN : Number(text);
	}

	/**
	 * 清空全部参数：十几个字段一次性清掉，且进不了预设回退，所以先问一次。
	 * 与 websocket 的「恢复默认预设」、regex 的「删除本地配置」同一套确认框
	 * （`$lib/ui/Confirm`，全站挂在 `+layout.svelte`）。
	 * 提成具名函数而不是写在 `onclick` 里：`await` 要 async 承载，
	 * 内联的异步 IIFE 读起来只剩括号。
	 */
	async function clearAll(): Promise<void> {
		if (await confirm.ask('确定要清空全部参数吗？这一步不能撤销。')) roiStore.clearAll();
	}

	/**
	 * 客单价：成交额 ÷ 订单数。「按金额」填成本全靠它换算，所以在这儿算一份给提示语用。
	 *
	 * 取**解析后的**数而不是输入框里的原始文本：订单数那一格按客单价填时，
	 * 框里装的是客单价本身（`ordersMode === 'aov'`），拿它去除成交额会除反。
	 */
	const batchAov = $derived.by(() => {
		const p = roiStore.parsed;
		return p !== null && p.gmv > 0 && p.orders > 0 ? p.gmv / p.orders : 0;
	});

	/**
	 * 订单数那格下方的提示：把**另一个**数算出来给人看 ——
	 * 按订单数填时给客单价，按客单价填时给订单数（自己填的那个不必再抄一遍）。
	 *
	 * 客单价原先只在面板底栏出现，离订单数这一格隔了小半屏 —— 而「按金额填成本」与
	 * 「按 ROAS 填广告」两个提示栏都要引用它，就近放一份对得上。
	 * 没填全时给「会算出什么」的承诺语，跟广告框那条提示栏同一个写法。
	 */
	const ordersHint = $derived.by(() => {
		if (isOrdersAov) {
			const orders = roiStore.parsed?.orders ?? 0;
			return orders > 0
				? `订单数 = 成交额 ÷ 客单价 → ${formatCount(orders)} 单`
				: '成交额与客单价都填上，这里就能算出订单数';
		}
		return batchAov > 0
			? `客单价 = 成交额 ÷ 订单数 → ${formatMoney(batchAov)} 元/单`
			: '成交额与订单数都填上，这里就能算出客单价';
	});

	/** 成本字段的说明：切到「按金额」时必须把换算依据（客单价）说出来，否则用户不知道凭什么叫这个数换算 */
	const costHint = $derived(
		roiStore.inputs.costMode !== 'unit'
			? ''
			: batchAov > 0
				? `按客单价 ${formatMoney(batchAov)} 元/件 换算成成本率`
				: '先填成交额与订单数，才能按金额换算成本率'
	);

	/**
	 * 广告那格下方的提示栏：**两边只填一个，另一个在这里自动算出来**。
	 *
	 * 取 `activeParsed` 而不是原始文本：它给的是换算后的广告费，也就是结果卡真正在用的那个数
	 * —— 用原始文本的话，「按 ROAS 填 6」时这里没法顺手报出「= 1165 元」。
	 * 广告费为 0 时不报 ROAS：那是个 Infinity，没有意义。
	 */
	const adHint = $derived.by(() => {
		const parsed = roiStore.activeParsed;
		const m = roiStore.metrics;
		if (!parsed.ok || m === null) return '';
		const adCost = parsed.inputs.adCost;
		if (roiStore.inputs.adMode === 'roas') {
			return adCost > 0
				? `广告费 = 成交额 ÷ ROAS → ${formatMoney(adCost)} 元`
				: '填好成交额与 ROAS，这里就能算出广告花费';
		}
		return adCost > 0
			? `广告 ROAS = 成交额 ÷ 广告费 → ${formatTimes(m.adRoas)}`
			: '广告花费或 ROAS 填一个，另一个自动算出来';
	});

	/** 三处填法按钮的「当前」与「点一下会换成」，字段名右端那枚交换按钮用 */
	const adModeLabel = $derived(AD_MODE_LABEL[roiStore.inputs.adMode]);
	const adModeOther = $derived(roiStore.inputs.adMode === 'cost' ? 'roas' : 'cost');
	const adModeOtherLabel = $derived(AD_MODE_LABEL[adModeOther]);

	const ordersModeLabel = $derived(ORDERS_MODE_LABEL[roiStore.inputs.ordersMode]);
	const ordersModeOther = $derived(roiStore.inputs.ordersMode === 'count' ? 'aov' : 'count');
	const ordersModeOtherLabel = $derived(ORDERS_MODE_LABEL[ordersModeOther]);

	const costModeLabel = $derived(COST_MODE_LABEL[roiStore.inputs.costMode]);
	const costModeOther = $derived(roiStore.inputs.costMode === 'rate' ? 'unit' : 'rate');
	const costModeOtherLabel = $derived(COST_MODE_LABEL[costModeOther]);

	/**
	 * 当前口径的退款三格原始文本。
	 * **不能一律读整盘那套** —— 单件口径有它自己的三个数，合计与越界提示都得跟着口径走。
	 */
	const refundTexts = $derived(roiStore.mode === 'batch' ? roiStore.inputs : roiStore.unitInputs);
	const refundMode = $derived(refundTexts.refundMode);
	const refundIsAmount = $derived(refundMode === 'amount');
	/** 三格 label 的尾巴：按率是「率（%）」、按金额是「金额（元）」 */
	const refundLabelTail = $derived(refundIsAmount ? '金额（元）' : '率（%）');

	/** 另一套输入里填过退款相关的东西没有 —— 有才摆「带入」按钮（见退货组下方） */
	const otherRefundHasValue = $derived.by(() => {
		const other = roiStore.mode === 'batch' ? roiStore.unitInputs : roiStore.inputs;
		return [
			other.unshippedRefundRate,
			other.shippedRefundRate,
			other.inTransitRefundRate,
			other.recoverRate,
			other.returnShipCost
		].some((raw) => raw.trim() !== '');
	});
	const otherModeLabel = $derived(roiStore.mode === 'batch' ? '单件' : '整盘');

	/**
	 * 退款两类之和。**按率填时是百分数、按金额填时是元** —— 填了几个就算几个，一个都没填给 NaN。
	 * 这跟商家后台那个「退款率 / 退款金额」是同一个口径，拿来对账用 ——
	 * 后台不给三类的占比，但它一定给一个总额。
	 */
	const refundTotal = $derived.by(() => {
		const parts = [refundTexts.unshippedRefundRate, refundTexts.shippedRefundRate]
			.map((raw) => raw.trim())
			.filter((raw) => raw !== '' && Number.isFinite(toNumber(raw)))
			.map((raw) => toNumber(raw));
		return parts.length === 0 ? Number.NaN : parts.reduce((sum, value) => sum + value, 0);
	});

	/**
	 * 退款组的脚注：只报**合计**（跟后台那个总额对账用）。
	 * 「在途 > 已发货」与「按金额填却没成交额」两条校验不在这里 ——
	 * 它们已经由解析层指回具体那一格，红字挂在字段下面（同一件事不说两遍）。
	 */
	const refundNote = $derived.by(() => {
		if (!Number.isFinite(refundTotal)) return '';
		return refundIsAmount
			? `合计退款金额 ${formatMoney(refundTotal)} 元 · 未发货 + 已发货`
			: `合计退款率 ${formatPercent(refundTotal / 100)} · 未发货 + 已发货，可直接跟后台的退款率对账`;
	});

	// 面板底栏那行小字。
	// 整盘的客单价已经挪到「订单数」框下面了，这里不再重复（同一件事不说两遍）；
	// 单件口径把单件毛利放这儿，那是推出来给人核对的数。
	const footerText = $derived.by(() => {
		if (roiStore.mode === 'batch') return '费率按成交额比例填 · 退款率与物流按单计';
		const m = roiStore.metrics;
		const price = roiStore.activeParsed.ok ? roiStore.activeParsed.inputs.gmv : 0;
		const margin =
			m !== null && price > 0
				? `单件毛利 ${formatMoney(price * m.grossMargin)} 元 · 毛利率 ${formatPercent(m.grossMargin)}`
				: '待填售价与单件成本';
		return `${margin} · 单件口径只算广告费之前的账`;
	});
</script>

<!-- 字段名右端那枚填法交换按钮：广告花费 / 订单数 / 商品成本三处共用一段，
     免得把 aria-label 与 title 的拼法重复三遍。
     参数是「当前填法的文案 + 点一下会换成的那个 + 切换回调」。 -->
{#snippet fillModeSwap(current: string, other: string, onswap: () => void)}
	<button
		type="button"
		class={MODE_SWAP_BTN}
		aria-label={`填法切换：当前按「${current}」填，点击换成按「${other}」`}
		title={`当前按「${current}」填 · 点一下换成按「${other}」`}
		onclick={onswap}
	>
		{current}
		<ArrowLeftRight class="size-3 shrink-0" aria-hidden="true" />
	</button>
{/snippet}

<!-- `xl:row-span-2`：中栏分左右两列时，本面板单独占满**左列整列**，右列由结果 / 敏感性上下分。
     栅格放置由每块自己声明（敏感性原先的 `xl:col-span-2` 也是这个路数），Converter 只给列定义。 -->
<Panel id="roi-input" headingId="roi-input-heading" heading="投入与成本" class="lg:min-h-0 xl:row-span-2">
	<!-- 口径贴在标题右边（它只决定本面板填哪些字段），操作按钮靠右 -->
	{#snippet headingExtra()}
		<SegmentedControl
			options={MODE_OPTIONS}
			value={roiStore.mode}
			class="w-fit"
			aria-label="计算口径"
			onchange={(v) => roiStore.setMode(v)}
		/>
	{/snippet}

	{#snippet actions()}
		<Button icon label="填入示例数据" onclick={() => roiStore.loadExample()}>
			<Lightbulb class="size-4" aria-hidden="true" />
		</Button>
		<Button icon label="清空全部参数" title="清空全部参数（会先问一次）" onclick={() => void clearAll()}>
			<Eraser class="size-4" aria-hidden="true" />
		</Button>
	{/snippet}

	<!-- 桌面在面板内滚：外层已经是定高栅格行，这里 flex-1 + min-h-0 才是滚动区；
	     移动端没有定高（fill 只从 lg 起），不封顶、随页面自然生长，表单不该被塞进小滚动框 -->
	<div class="flex flex-col gap-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
		<!-- 首屏预填的就是示例数据：不标出来，用户改两个字段就可能把示例数当成自己的结果发出去。
		     改动任意一项后 `isExample` 变 false，这行自己消失。 -->
		{#if roiStore.isExample}
			<p class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
				下面是示例数据 —— 改动任意一项后这行就消失，别把它的结果当成自己盘出来的数。
			</p>
		{/if}

		{#if roiStore.mode === 'batch'}
			<!-- 成交与广告（这一组不再有标题行开关：广告那格的填法交换跟着字段名走） -->
			<InputSection title="成交与广告">
				<div class={FIELD_GRID}>
					<NumberField
						id="roi-ad-cost"
						field="adCost"
						label={roiStore.inputs.adMode === 'roas' ? '广告 ROAS' : '广告花费（元）'}
						bind:value={roiStore.inputs.adCost}
						hint={adHint}
					>
						{#snippet labelExtra()}
							{@render fillModeSwap(adModeLabel, adModeOtherLabel, () => roiStore.setAdMode(adModeOther))}
						{/snippet}
					</NumberField>
					<NumberField id="roi-gmv" field="gmv" label="成交额（元）" required bind:value={roiStore.inputs.gmv} />
					<NumberField
						id="roi-orders"
						field="orders"
						label={isOrdersAov ? '客单价（元/单）' : '订单数（单）'}
						required
						hint={ordersHint}
						bind:value={roiStore.inputs.orders}
					>
						{#snippet labelExtra()}
							{@render fillModeSwap(ordersModeLabel, ordersModeOtherLabel, () =>
								roiStore.setOrdersMode(ordersModeOther)
							)}
						{/snippet}
					</NumberField>
				</div>
			</InputSection>

			<!-- 成本（填法开关贴「商品成本率」的字段名右端，与广告 / 订单数同一形态） -->
			<InputSection title="成本项">
				<div class={FIELD_GRID}>
					<NumberField
						id="roi-cost"
						field="costRate"
						label={roiStore.inputs.costMode === 'unit' ? '单件成本（元/件）' : '商品成本率（%）'}
						required
						bind:value={roiStore.inputs.costRate}
						hint={costHint}
					>
						{#snippet labelExtra()}
							{@render fillModeSwap(costModeLabel, costModeOtherLabel, () => roiStore.setCostMode(costModeOther))}
						{/snippet}
					</NumberField>
					<NumberField
						id="roi-commission-rate"
						field="commissionRate"
						label="平台佣金率（%）"
						bind:value={roiStore.inputs.commissionRate}
					/>
					<NumberField
						id="roi-ship-cost"
						field="shipCost"
						label="单均发货成本（元/单）"
						hint="快递费、运费险等随单物流支出"
						bind:value={roiStore.inputs.shipCost}
					/>
					<NumberField
						id="roi-other-cost"
						field="otherCost"
						label="其他固定成本（元）"
						hint="仓储、人工等不随成交额变动的成本"
						bind:value={roiStore.inputs.otherCost}
					/>
				</div>
			</InputSection>

			<!-- 退货 -->
			<InputSection title="退货">
				{#snippet actions()}
					<SegmentedControl
						options={REFUND_MODES}
						value={refundMode}
						tone="quiet"
						class="w-fit"
						aria-label="退款三类的填法"
						onchange={(mode) => roiStore.setRefundMode(mode)}
					/>
				{/snippet}

				<div class={FIELD_GRID}>
					<NumberField
						id="roi-unshipped-refund"
						field="unshippedRefundRate"
						label={`未发货退款${refundLabelTail}`}
						required
						hint="发货前就退掉：货没出库，只白花推广费"
						bind:value={roiStore.inputs.unshippedRefundRate}
					/>
					<NumberField
						id="roi-shipped-refund"
						field="shippedRefundRate"
						label={`已发货退款${refundLabelTail}`}
						required
						hint="发出之后才退：发货运费已经花掉了"
						bind:value={roiStore.inputs.shippedRefundRate}
					/>
					<NumberField
						id="roi-in-transit-refund"
						field="inTransitRefundRate"
						label={`其中在途退款${refundLabelTail}`}
						hint="选填 · 拒收件原封回来，按能再卖算"
						bind:value={roiStore.inputs.inTransitRefundRate}
					/>
					<NumberField
						id="roi-recover-rate"
						field="recoverRate"
						label="退货能收回的货款（%）"
						hint="只对签收后退货打这个折 · 再上架卖、退回厂家都算"
						bind:value={roiStore.inputs.recoverRate}
					/>
					<NumberField
						id="roi-return-ship-cost"
						field="returnShipCost"
						label="单均退货成本（元/单）"
						hint="按已发货退款的订单计"
						bind:value={roiStore.inputs.returnShipCost}
					/>
					<CommissionSwitch bind:checked={roiStore.inputs.commissionRefunded} />
				</div>
				{#if refundNote !== '' || otherRefundHasValue}
					<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						{#if refundNote !== ''}
							<p class={NOTE_TEXT}>{refundNote}</p>
						{/if}
						{#if otherRefundHasValue}
							<!-- 两处同一枚（整盘口径 / 单件口径各一个分支），文案随 otherModeLabel 变 ——
							     走 Button 的 ghost（蓝字下划线）+ xs 档，不再各自手写一串类名：
							     原先那串是 blue-700，而 UI-STYLE §9 的 ghost 是 blue-600，同一个「轻量文字按钮」两种蓝 -->
							<Button
								variant="ghost"
								size="xs"
								label={`带入${otherModeLabel}的退款参数`}
								title={`把${otherModeLabel}口径里填的退款参数按当前填法搬过来（未发货 / 已发货 / 在途 / 收回比例 / 退货成本 / 佣金开关）`}
								onclick={() => roiStore.copyRefundFromOtherMode()}
							>
								带入{otherModeLabel}的退款参数
							</Button>
						{/if}
					</div>
				{/if}
			</InputSection>
		{:else}
			<!-- 商品 -->
			<InputSection title="商品（单件）">
				<div class={FIELD_GRID}>
					<NumberField
						id="roi-price"
						field="price"
						label="售价（元/件）"
						required
						bind:value={roiStore.unitInputs.price}
					/>
					<NumberField
						id="roi-unit-cost"
						field="unitCost"
						label="单件成本（元/件）"
						required
						bind:value={roiStore.unitInputs.unitCost}
					/>
					<NumberField
						id="roi-unit-ship"
						field="shipCost"
						label="单件发货成本（元/件）"
						hint="快递费、运费险等随单物流支出"
						bind:value={roiStore.unitInputs.shipCost}
					/>
				</div>
			</InputSection>

			<!-- 平台 -->
			<InputSection title="平台">
				<div class={FIELD_GRID}>
					<NumberField
						id="roi-unit-commission"
						field="commissionRate"
						label="平台佣金率（%）"
						bind:value={roiStore.unitInputs.commissionRate}
					/>
				</div>
			</InputSection>

			<!-- 退货 -->
			<InputSection title="退货">
				{#snippet actions()}
					<SegmentedControl
						options={REFUND_MODES}
						value={refundMode}
						tone="quiet"
						class="w-fit"
						aria-label="退款三类的填法"
						onchange={(mode) => roiStore.setRefundMode(mode)}
					/>
				{/snippet}

				<div class={FIELD_GRID}>
					<NumberField
						id="roi-unit-unshipped-refund"
						field="unshippedRefundRate"
						label={`未发货退款${refundLabelTail}`}
						required
						hint="发货前就退掉：货没出库，只白花推广费"
						bind:value={roiStore.unitInputs.unshippedRefundRate}
					/>
					<NumberField
						id="roi-unit-shipped-refund"
						field="shippedRefundRate"
						label={`已发货退款${refundLabelTail}`}
						required
						hint="发出之后才退：发货运费已经花掉了"
						bind:value={roiStore.unitInputs.shippedRefundRate}
					/>
					<NumberField
						id="roi-unit-in-transit-refund"
						field="inTransitRefundRate"
						label={`其中在途退款${refundLabelTail}`}
						hint="选填 · 拒收件原封回来，按能再卖算"
						bind:value={roiStore.unitInputs.inTransitRefundRate}
					/>
					<NumberField
						id="roi-unit-recover-rate"
						field="recoverRate"
						label="退货能收回的货款（%）"
						hint="只对签收后退货打这个折 · 再上架卖、退回厂家都算"
						bind:value={roiStore.unitInputs.recoverRate}
					/>
					<NumberField
						id="roi-unit-return-ship"
						field="returnShipCost"
						label="单件退货成本（元/件）"
						hint="按已发货退款的件数计"
						bind:value={roiStore.unitInputs.returnShipCost}
					/>
					<CommissionSwitch bind:checked={roiStore.unitInputs.commissionRefunded} />
				</div>
				{#if refundNote !== '' || otherRefundHasValue}
					<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						{#if refundNote !== ''}
							<p class={NOTE_TEXT}>{refundNote}</p>
						{/if}
						{#if otherRefundHasValue}
							<!-- 两处同一枚（整盘口径 / 单件口径各一个分支），文案随 otherModeLabel 变 ——
							     走 Button 的 ghost（蓝字下划线）+ xs 档，不再各自手写一串类名：
							     原先那串是 blue-700，而 UI-STYLE §9 的 ghost 是 blue-600，同一个「轻量文字按钮」两种蓝 -->
							<Button
								variant="ghost"
								size="xs"
								label={`带入${otherModeLabel}的退款参数`}
								title={`把${otherModeLabel}口径里填的退款参数按当前填法搬过来（未发货 / 已发货 / 在途 / 收回比例 / 退货成本 / 佣金开关）`}
								onclick={() => roiStore.copyRefundFromOtherMode()}
							>
								带入{otherModeLabel}的退款参数
							</Button>
						{/if}
					</div>
				{/if}
			</InputSection>
		{/if}
	</div>

	<!-- 底栏是 truncate，放不下就省略，不会切字：这一列只有 20rem 宽，
	     标题行是 h-12 固定高 + flex-wrap，长一点的提示会换行后被裁掉。 -->
	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">{footerText}</p>
		</div>
	{/snippet}
</Panel>
