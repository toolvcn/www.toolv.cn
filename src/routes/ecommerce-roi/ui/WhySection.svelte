<script lang="ts">
	// 口径说明正文：逐节讲清「为什么这么算」，尽量每节都带一个反例对比 ——
	// 只讲正面理由没人看得下去。
	//
	// 这里的数字全部从两份示例（EXAMPLE_INPUTS / UNIT_EXAMPLE_INPUTS）现算，不写死 ——
	// 讲整盘就用整盘的示例，讲单件就用单件的示例。
	// 写死过一次的人都知道：改了示例数据、忘了改说明里的数，页面就自己打自己。
	import { computeMetrics, computeRoi } from '../core/metrics.ts';
	import { parseUnitInputs } from '../core/parse.ts';
	import { formatMoney, formatNumber, formatPercent, formatTimes } from '../core/format.ts';
	import { EXAMPLE_INPUTS, UNIT_EXAMPLE_INPUTS } from '../config.ts';
	import { SECTION_TITLE } from './styles.ts';

	// 示例盘是模块常量、computeRoi 是纯函数，所以这里不需要响应式，算一次就够
	const example = computeRoi(EXAMPLE_INPUTS).metrics;

	// 单件口径另有一份示例：两组数是同一款货的两种读法，但成本率的填法不同
	// （整盘按 50% 填 ↔ 单件按 35 ÷ 69.9 填），所以单件那几个数必须从**它自己**的示例算，
	// 不能拿整盘的数除以 100 去凑 —— 那会与单件结果卡上显示的每件利润差几分钱。
	const unitParsed = parseUnitInputs(UNIT_EXAMPLE_INPUTS);
	const unitExample = unitParsed.ok ? computeMetrics(unitParsed.inputs) : null;

	/** 示例里填的费率与单均成本，换算成数字一次，几处算式共用 */
	const inputShipCost = Number(EXAMPLE_INPUTS.shipCost) || 0;
	const inputCommissionRate = (Number(EXAMPLE_INPUTS.commissionRate) || 0) / 100;

	/** 说明文里用到的示例数字，集中在这里算一次；改示例数据这些段落会自动跟着变 */
	const ex = {
		adRoas: formatTimes(example?.adRoas ?? Number.NaN),
		netRoas: formatTimes(example?.netRoas ?? Number.NaN),
		netMarginOnGmv: formatPercent(example?.netMarginOnGmv ?? 0),
		netProfit: formatMoney(example?.netProfit ?? 0),
		allLossProfit: formatMoney(example?.allLossNetProfit ?? 0),
		recoverGain: formatMoney(example?.recoveredGoodsValue ?? 0),
		breakEven: formatTimes(example?.breakEvenRoas ?? Number.NaN),
		maxAdCost: formatMoney(example?.maxAdCost ?? 0),
		// 佣金差额只发生在**已发货**那两类：未发货的货没发出，平台必然退佣（见 metrics.ts 的
		// commissionBase），所以不能拿退款总额去乘 —— 那会把这块损失夸大两倍多
		shippedRefundAmount: formatNumber((example?.inTransitAmount ?? 0) + (example?.signedAmount ?? 0)),
		commissionDiff: formatMoney(((example?.inTransitAmount ?? 0) + (example?.signedAmount ?? 0)) * inputCommissionRate),
		commissionRate: formatPercent(inputCommissionRate),
		recoverRate: formatPercent((Number(EXAMPLE_INPUTS.recoverRate) || 0) / 100),
		shipCost: formatNumber(inputShipCost),
		// 运费占客单价的比重：9.9 与 99 是拿来举例的两头客单价（不在示例输入里），
		// 比例按示例那 3 元现算 —— 写死百分比就会在改示例时失真
		shipShareLow: formatPercent(inputShipCost / 9.9),
		shipShareHigh: formatPercent(inputShipCost / 99),
		grossMargin: formatPercent(example?.grossMargin ?? 0),
		adjustedMargin: formatPercent(example?.returnAdjustedMargin ?? 0),
		beSimple: formatTimes(example?.breakEvenRoasSimple ?? Number.NaN),
		beWithReturn: formatTimes(example?.breakEvenRoasWithReturn ?? Number.NaN),
		// 两份示例的成本率填法不同（整盘按比例、单件按金额），说"两边一致"时要把它讲出来
		costRateText: EXAMPLE_INPUTS.costRate,
		unitCostText: UNIT_EXAMPLE_INPUTS.unitCost,
		unitCostRateText: formatPercent(1 - (unitExample?.grossMargin ?? 0)),
		// 单件口径的数取自单件自己的示例（每件利润 = 贡献利润，也就是能投出去的广告费上限）
		unitAdBudget: formatMoney(unitExample?.contributionProfit ?? 0),
		unitAdShare: formatPercent(unitExample?.contributionMargin ?? Number.NaN),
		unitGrossMargin: formatPercent(unitExample?.grossMargin ?? Number.NaN),
		unitBreakEven: formatTimes(unitExample?.breakEvenRoas ?? Number.NaN),

		// 退款三分类那节要用的数
		unshippedRate: formatPercent((Number(EXAMPLE_INPUTS.unshippedRefundRate) || 0) / 100),
		shippedRate: formatPercent((Number(EXAMPLE_INPUTS.shippedRefundRate) || 0) / 100),
		inTransitRate: formatPercent((Number(EXAMPLE_INPUTS.inTransitRefundRate) || 0) / 100),
		unshippedOrders: formatNumber(example?.unshippedOrders ?? 0),
		unshippedShipSaving: formatMoney((example?.unshippedOrders ?? 0) * inputShipCost),
		wastedAdCost: formatMoney(example?.wastedAdCost ?? 0)
	};

	/** 九节说明。数字都是上面 ex 里的，改示例不会让这里失真 */
	const SECTIONS = [
		{
			id: 'two-roi',
			title: '一、市面上的「ROI」其实有两种，差得很远',
			body: [
				`媒体后台报的那个数严格叫 ROAS，等于成交额除以广告费，既不扣退货也不扣成本。财务口径的 ROI 要扣掉全部成本。`,
				`所以本工具两个都报。示例这一盘后台会显示 ${ex.adRoas}，扣掉退货变成 ${ex.netRoas}，再扣掉货、佣金、物流，净利率（对成交额）只剩 ${ex.netMarginOnGmv}。只盯后台那个数，很容易以为自己赚麻了。`
			]
		},
		{
			id: 'refund-three-kinds',
			title: '二、退款为什么要拆成未发货 / 在途 / 签收后三类',
			body: [
				`同一笔退款，货处在哪个阶段，要承担的成本完全不同 —— 合成一个「退货率」，就等于强行假设它们一样。`,
				`未发货退款：货没出库，货品成本、正向运费、逆向运费都不该算。这一类的代价只有一笔 —— 那批订单的推广费已经花掉了。`,
				`发货后仅退款（在途 / 拒收）：货已经寄出去了，正向运费实打实地花了；但退回时通常原封未拆，货值几乎能全额收回，逆向运费也常比正常退货便宜（有些平台由买家承担返程）。`,
				`签收后退货：拆过封、要质检，往往有折损，逆向运费里还含着二次包装的成本。`,
				`因为三类的差别主要在「货值能不能收回」上，「在途退款率」做成了选填：填了，那部分货值按 100% 收回；不填就全按签收后退货处理 —— 保守，只会多算损失、不会少算。`,
				`拆不拆的差别有多大？最常见的一种错法是给没发出去的那批货也收了发货运费。示例里未发货退款率 ${ex.unshippedRate}，100 单就是 ${ex.unshippedOrders} 单压根没发出去，按「一单一个快递」算，这 ${ex.unshippedShipSaving} 元运费根本不该发生。`,
				`未发货那一类在账面上「零损失」也是对的，别以为漏算了：它的代价是白花的推广费，示例里约 ${ex.wastedAdCost} 元 —— 这笔钱在利润表里的体现方式是「成交额少了、广告费没少」，与「退货真损失」不是一个口径，所以单独一行说，不进利润表。`
			]
		},
		{
			id: 'return-not-all-loss',
			title: '三、退货不能按全损算，退回厂家也算收回',
			body: [
				`常见的偷懒算法是「收入按 成交额 ×(1−退货率) 算，货品成本却按全量扣」—— 这等于假设退回来的货全废了。`,
				`退回来的货实际上有两条出路：自己再上架接着卖，或者整批退回给厂家拿回进价。两条都不必再承担这笔货款 —— 那批货的成本上一轮已经付过，再扣一次就是重复计损。能全额收回就填 100%（两条路都全收回）；厂家只退八成就填 80，两种都有就按货值加权。`,
				`示例里按全损算净利是 ${ex.allLossProfit} 元，按 ${ex.recoverRate} 能收回算是 ${ex.netProfit} 元，差了 ${ex.recoverGain} 元 —— 差出来的正是被重复计损掉的那部分。`,
				`注意这一项只作用于签收后退货：未发货的货没出库、在途的货原封回来，两者都不该被这个比例打折。所以公式里的⑨不再减残损货值 —— 它已经含在「发出成本 − 收回的货值」里了。`
			]
		},
		{
			id: 'shipping-per-order',
			title: '四、物流为什么不按成交额的比例算',
			body: [
				`发货成本跟实际发出去的单数绑死，一单一个快递，跟客单价没关系。`,
				`如果按「成交额 × 某个费率」来估，客单价低的小单会被严重低估成本：同样一单 ${ex.shipCost} 元运费，占 9.9 元客单价的 ${ex.shipShareLow}，占 99 元客单价的只有 ${ex.shipShareHigh}。所以这里按「单均成本 × 订单数」算，而且未发货退款的那批不计 —— 它们压根没进过快递袋。`
			]
		},
		{
			id: 'commission-switch',
			title: '五、佣金为什么单列一项，还做成开关',
			body: [
				`退款时平台退不退佣金，各家不一样：天猫、抖音退款后会退，部分平台不退。`,
				`不退的时候，退货那部分照样要交佣金。示例里已发货那两类退款 ${ex.shippedRefundAmount} 元，按 ${ex.commissionRate} 佣金算就是 ${ex.commissionDiff} 元 —— 直接从净利里扣，不是小数。所以这里给了一个开关，按你实际平台的规则选。`,
				`开关只管已发货那两类：未发货退款是货没发出，平台必然全额退佣，所以它始终不进佣金口径。`,
				`开关也不只影响指标：定价反推里的「每元剩余」用的是同一套佣金口径，所以一关开关，反推出来的保本售价、达标售价与成本上限都会跟着动。`
			]
		},
		{
			id: 'break-even-gmv',
			title: '六、保本 ROAS 为什么用成交额口径',
			body: [
				`因为广告后台只认成交额。用净收入口径算出来的保本线，跟你后台看到的 ROAS 不是一个坐标系，拿它去调出价只会误导。`,
				`示例的保本 ROAS 是 ${ex.breakEven}，意思是成交额至少要做到广告费的 ${ex.breakEven} 倍才不亏。换个说法更好用：这盘的广告费上限是 ${ex.maxAdCost} 元，花到这么多净利刚好归零 —— 超过了就是净亏，不是「少赚」。`
			]
		},
		{
			id: 'three-margins',
			title: '七、毛利率、退货修正毛利率、净利率：同一盘生意的三种说法',
			body: [
				`同一个销售额，扣到哪一层，叫法就不一样：只扣货款叫毛利率 ${ex.grossMargin}，再扣退货损耗叫退货修正毛利率 ${ex.adjustedMargin}，扣完全部叫净利率（对成交额）${ex.netMarginOnGmv}。`,
				`谈判时有人报「我这毛利率 ${ex.grossMargin}」，听着很赚；但同一盘生意扣完退货、佣金、物流、广告，净利率只剩 ${ex.netMarginOnGmv}。三个数都摆出来，就不存在「用哪一个说法糊弄」的空间。`,
				`毛利率只看货（成本率是多少就是多少），不含退货 —— 退货的账在第二格里算。保本 ROAS 也跟着有三层：只扣货款 ${ex.beSimple}、再扣退货 ${ex.beWithReturn}、完整口径 ${ex.breakEven}。口径越粗、算出的线越低，按低的那条出价就会亏 —— 出价一律用完整口径。`
			]
		},
		{
			id: 'unit-before-ad-cost',
			title: '八、单件口径只算到广告费之前',
			body: [
				`「整盘」和「单件」仍是同一套公式的两种读法：单件口径就是把订单数取 1、成交额取售价、成本率取「单件成本 ÷ 售价」，而广告费取 0。`,
				`广告费留给整盘口径去问 —— 那边两个数都收：你充了多少钱，或者后台跑出来的 ROAS，填一个另一个自动换算，因为投手手上往往只有其中一个。单件口径则完全不问你现在的投产比，因为「这款货保本 ROAS 是多少」与「ROAS 每高一点每件多赚多少」这两个问题，本来就不需要先知道你现在跑在什么 ROAS 上。这是选款与出价阶段最常用的两个问题，逼着人先报一个当前的 ROAS 反而挡路。`,
				`所以两边能互相验证的是广告费「之前」的那几个数：毛利率、退货修正毛利率、保本 ROAS —— 同一盘货填同一条成本率时两边相等。两份示例的成本率填法不同（整盘按比例填 ${ex.costRateText}%、单件按金额填 ${ex.unitCostText} 元/件，换算出来是 ${ex.unitCostRateText}），所以这几格会差零点几个百分点（示例里毛利率 ${ex.grossMargin} ↔ ${ex.unitGrossMargin}、保本 ROAS ${ex.breakEven} ↔ ${ex.unitBreakEven}）。净利则完全不同 —— 整盘那边还要再扣掉一笔广告费，示例的 100 单就是 1165 元。`,
				`单件口径直接给两个数：这款货每件赚多少（示例里 ${ex.unitAdBudget} 元 —— 它同时也是能投出去的广告费上限），以及每卖出 100 元净赚多少（${ex.unitAdShare}，正好是保本 ROAS 的倒数）。再配一张 ROAS 档位表回答「ROAS 做到多少、每件赚多少」—— 档位围着你的保本线现算，不是一组写死的数。`,
				`还要算「卖多少能赚多少」—— 结果卡的「卖多少赚多少」改售价或改销量就能看到总数，单件成本不跟着售价走，降价只是把毛利让出去。真要反推售价（这个价定得对不对、成本最多能涨到多少），得先说明按多少的投产比投 —— 在结果卡那个「假设投产比」里填一个即可，留空就默认取保本线向上取整的那一档。`
			]
		},
		{
			id: 'what-is-missing',
			title: '九、这个工具没算什么',
			body: [
				`税、仓储租金、人工（如果没填进「其他固定成本」）、退货商品二次销售的降价、资金占用与账期。`,
				`尤其是二次销售的降价：退回来的货往往要打折才卖得掉，那部分折价这里没算 —— 所以你可以在「退货能收回的货款」里保守一点（退回厂家只退八成就填 80），或者把预期折价折进「其他固定成本」。`,
				`另外，退回给厂家是要自己付运费的：那笔钱不进「退货能收回的货款」，而是填在「单均退货成本」里（它同时装着逆向物流和二次质检包装）。`,
				`还有两类售后没有单独建模：换货（收入不减，但要付双程物流 + 商品降级）与不退货仅退款（补寄 / 少件，收入部分退回、货要不回来）。前者可以把双程运费折进「单均退货成本」，后者可以按「未发货退款」记一笔、再把要不回的货值折进「其他固定成本」。`,
				`总之，这里算出来的是经营判断的参考，不是财务报表。要报税、要融资，请交给会计。`
			]
		}
	];
</script>

<section class="relative flex flex-col gap-4">
	<!-- relative 不能省：sr-only 是 absolute，没有定位上下文时包含块是初始包含块，
	     会逃出 #roi-doc-body 这个滚动容器的裁剪、把文档撑到内容之外（UI-STYLE §18） -->
	<h2 class="sr-only">为什么这么算</h2>

	{#each SECTIONS as section (section.id)}
		<div class="flex flex-col gap-1.5">
			<h3 class={SECTION_TITLE}>{section.title}</h3>
			{#each section.body as paragraph, i (i)}
				<p class="text-xs leading-5 text-gray-600">{paragraph}</p>
			{/each}
		</div>
	{/each}
</section>
