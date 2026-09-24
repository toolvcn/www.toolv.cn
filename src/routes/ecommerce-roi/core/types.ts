// 电商 ROI 计算的类型定义。纯类型，不碰 DOM，node 环境可直接单测。
// 可配置的默认值、示例 / 空盘数据与敏感性档位不在这里 —— 在工具根目录的 `config.ts`。

/**
 * 商品成本的填法：
 * - `rate`：直接填占成交额的百分比（%）
 * - `unit`：填单件成本（元/件），内部按客单价（成交额 ÷ 订单数）换算成成本率
 *
 * 两种填法在利润表上**精确等价**：`成交额 × (单件成本 ÷ 客单价) = 单件成本 × 订单数`，
 * 归一成成本率只是因为下游有四处要用它（毛利率、保本 ROAS 第一层、敏感性、规模试算反推），
 * 不存在精度损失 —— 35 元/件 × 100 单 = 3500 元，按比例填 50% 也是同一个数。
 *
 * 之所以要两种：运营手上拿到的货价是「进价 35 元」这种绝对值，
 * 换算成成本率经常除不尽（35 ÷ 69.9 = 50.0715…%），手填只能填近似值 ——
 * 所以**按金额那条路反而更准**（35 元/件 → 3500.00；手填 50% → 3495.00）。
 */
export type CostMode = 'rate' | 'unit';

/**
 * 整盘口径「广告」那格的填法：
 * - `cost`：直接填广告花费（元）
 * - `roas`：填广告 ROAS（成交额 ÷ 广告费），内部按成交额换算成广告花费
 *
 * 之所以要两种：投手手里两个数都有 —— 有的只知道自己充了多少钱，有的只看后台跑出来的 ROAS。
 * 让人先做一道除法才能开始算，是纯粹的拦截。
 * 单件口径没有这个开关：它算的是广告费之前的账，输入里压根没有广告费（见 `UnitTextInputs`）。
 */
export type AdMode = 'cost' | 'roas';

/**
 * 「订单数」那格的填法：
 * - `count`：直接填订单数（单）
 * - `aov`：填客单价（元/单），内部按 `订单数 = 成交额 ÷ 客单价` 换算
 *
 * 之所以要两种：运营手里常常只有「客单价 69.9 元」这个数（或想按某个客单价试算订单量），
 * 让人先做一道除法才能开始算，是纯粹的拦截 —— 跟商品成本、广告那两处同一个理由。
 */
export type OrdersMode = 'count' | 'aov';

/**
 * 退货那三格的填法（整组一个开关）：
 * - `rate`：退款率（%，占成交单数的比例）
 * - `amount`：退款金额（元）—— 口径是**退掉的成交额**，内部按 `率 = 金额 ÷ 成交额` 折回
 *
 * 之所以要两种：后台两个数都给 —— 复核单量时看退款率（能直接跟售后单数对账），
 * 盘钱时看退款金额。让人先做一道除法才能开始算，是纯粹的拦截。
 *
 * 三格共用一个开关而不是各给一个：「在途 ≤ 已发货」是它们之间的约束，
 * 一格填率、一格填金额的话这条约束没法直接比。
 */
export type RefundMode = 'rate' | 'amount';

/**
 * 退款三分类的公共形状：`refundMode` + 三个字段。
 * 两种口径的输入（`RoiTextInputs` / `UnitTextInputs`）都继承它 ——
 * 解析、填法换算与摘要回显因此只需要认这一个形状。
 */
export interface RefundTexts {
	/** 三格按哪种填法：率还是退款金额（见 `RefundMode`） */
	refundMode: RefundMode;
	/**
	 * 未发货退款：发货前取消 / 仅退款未发货，按**成交订单数**口径。
	 * 这一类的货没出库，所以既不承担货品成本，也没有正向物流与逆向物流 ——
	 * 唯一的损失是那笔订单的推广费已经花掉了。
	 */
	unshippedRefundRate: string;
	/**
	 * 已发货退款：发货之后才退掉的，按**成交订单数**口径。
	 * 等于后台「发货后仅退款（拒收 / 拦截）」与「退货退款（签收后）」之和 ——
	 * 这两类的**正向物流都已经花掉了**，是最容易漏掉的一笔。
	 */
	shippedRefundRate: string;
	/**
	 * 在途退款：已发货退款里属于「发货后仅退款（拒收 / 拦截）」的那部分，**选填**。
	 *
	 * 填了才能把拒收件单独拎出来：它原封返回、货值 100% 能再卖，
	 * 不该按「退货能收回的货款」打折。留空即 0，等于全部按签收后退货处理
	 * （保守，不漏算损失）。取值必须 ≤ 已发货退款。
	 */
	inTransitRefundRate: string;
}

/**
 * 用户填的原始输入：一律是字符串。
 * 理由跟 rmb-uppercase 一样 —— 输入框里可能是空、可能是「12.」这种中间态，
 * 先收字符串再在纯函数里解析，校验错误才能变成一句中文提示，而不是 NaN 到处流。
 * 空字符串按 0 处理（「没填这项」就是没有这笔成本）。
 */
export interface RoiTextInputs extends RefundTexts {
	/** 广告：按 adMode 决定这格填的是**广告花费（元）**还是**广告 ROAS** */
	adCost: string;
	/** 广告按哪种口径填 */
	adMode: AdMode;
	/** 成交额（元）：下单口径，未扣退款 */
	gmv: string;
	/** 订单数（单）—— 按 `ordersMode` 决定这格填的是订单数还是客单价 */
	orders: string;
	/** 订单数按哪种口径填 */
	ordersMode: OrdersMode;
	/** 商品成本：按 costMode 决定它是百分数还是元/件 */
	costRate: string;
	/** 商品成本按哪种口径填 */
	costMode: CostMode;
	/** 平台佣金率（% of 成交额） */
	commissionRate: string;
	/** 单均发货成本（元/单）：快递 + 包材。**只按实际发出的订单计**（未发货退款的不发） */
	shipCost: string;
	/**
	 * 退货能收回的货款比例（%）：按「货值」算能拿回多少，**只作用于签收后的退货**。
	 * 两种出路都填在这里 —— 自己再上架接着卖（100%，但得再花一次物流）、
	 * 整批退回给厂家拿回进价（厂家只退八成就填 80）。两种都有就按货值加权。
	 */
	recoverRate: string;
	/** 单均退货成本（元/单）：逆向物流 + 二次质检包装，按**已发货退款**的订单计 */
	returnShipCost: string;
	/** 其他固定成本（元）：人工、仓储等 */
	otherCost: string;
	/** 退款时平台是否退还佣金 */
	commissionRefunded: boolean;
}

/** 校验通过后的数值输入，比率已换算成 0~1 的小数 */
export interface RoiInputs {
	adCost: number;
	gmv: number;
	orders: number;
	costRate: number;
	commissionRate: number;
	shipCost: number;
	/** 未发货退款率 */
	unshippedRefundRate: number;
	/** 已发货退款率 = 在途 + 签收后 */
	shippedRefundRate: number;
	/** 在途退款率（选填，≤ 已发货退款率） */
	inTransitRefundRate: number;
	recoverRate: number;
	returnShipCost: number;
	otherCost: number;
	commissionRefunded: boolean;
}

/** 一次计算的全部中间量与指标，全部相对同一个成交额 */
export interface RoiMetrics {
	/** 客单价 = 成交额 ÷ 订单数 */
	aov: number;

	// ---- 退款三分类：同一笔退款，三类承担的成本完全不同 ----
	/** 未发货退款金额：货没出库，只有推广费白花了 */
	unshippedAmount: number;
	/** 未发货退款单数 */
	unshippedOrders: number;
	/** 在途退款（拒收 / 拦截）金额：货原封返回，按 100% 可再售 */
	inTransitAmount: number;
	/** 在途退款单数 */
	inTransitOrders: number;
	/** 签收后退货金额：唯一会拆封、会折损的那一类 */
	signedAmount: number;
	/** 签收后退货单数 */
	signedOrders: number;
	/** 退款总额 = 未发货 + 在途 + 签收后 */
	returnedAmount: number;
	/** 退款总单数 */
	returnedOrders: number;
	/** 净收入 = 成交额 − 退款总额：真正到手的钱 */
	netRevenue: number;

	/** 发出货品成本 = 成交额 ×(1 − 未发货退款率)× 成本率：未发货那批货压根没出库 */
	grossGoodsCost: number;
	/** 能收回的货值 = 在途件（按 100%）+ 签收退货件（按收回比例）—— 都不是损失 */
	recoveredGoodsValue: number;
	/** 残损货值：只有签收后退货会折损（在途件原封、未发货件没出库） */
	damagedGoodsCost: number;
	/** 净货品成本 = 发出货品成本 − 能收回的货值 */
	netGoodsCost: number;

	/** 平台佣金 */
	commission: number;
	/** 正向物流 = **实际发出**的订单数 × 单均发货成本（未发货退款的订单不发，不计） */
	forwardShipping: number;
	/** 逆向物流 = 已发货退款单数 × 单均退货成本 */
	reverseShipping: number;

	/** 贡献利润 = 净收入 − 除广告费以外的全部成本：这是广告费的上限 */
	contributionProfit: number;
	/** 净利润 = 贡献利润 − 广告费 */
	netProfit: number;
	/** 净利率（对**净收入**）= 净利润 ÷ 净收入；对成交额的那一版是下面的 netMarginOnGmv */
	netMargin: number;

	/** 广告 ROAS = 成交额 ÷ 广告费（媒体后台口径，业内口头说的「ROI」） */
	adRoas: number;
	/** 扣退货 ROAS = 净收入 ÷ 广告费 */
	netRoas: number;
	/** 广告 ROI = 净利润 ÷ 广告费 */
	adRoi: number;
	/** 生意 ROI = 净利润 ÷ (广告费 + 净货品成本) */
	businessRoi: number;
	/** 保本 ROAS = 成交额 ÷ 贡献利润；贡献利润 ≤ 0 时为 Infinity（投多少都亏） */
	breakEvenRoas: number;
	/** 广告费上限 = 贡献利润（投到这么多，净利刚好为 0） */
	maxAdCost: number;
	/** 贡献利润率 = 贡献利润 ÷ 成交额：每 1 元成交额里能拿去投广告的比例，也就是保本 ROAS 的倒数 */
	contributionMargin: number;

	/** 退款真的亏掉的钱 = 残损货值 + 逆向物流 + 平台不退的佣金（未发货那一类的真损失是 0） */
	returnLoss: number;
	/** 若假设退回来的货全损（收回比例按 0 算），净利润会是多少 */
	allLossNetProfit: number;
	/**
	 * 未发货退款白花掉的广告费 = 广告费 × 未发货退款率。
	 *
	 * **归因视角，不进利润表**：利润表里这件事的体现方式是「成交额少了但广告费没少」，
	 * 还包含「本该赚到却没赚到的毛利」，与这个数不是一个口径。它只回答
	 * 「有多少推广费打了水漂」，别拿它去加减利润。
	 */
	wastedAdCost: number;

	// ---- 利润率：三个口径从粗到细，页面并排给出，让人看清"毛利率"和"净利率"差在哪 ----
	/** 商品毛利率 = (成交额 − 发出货品成本) ÷ 成交额，即 1 − 成本率 */
	grossMargin: number;
	/** 退货修正后毛利率 = (净收入 − 净货品成本) ÷ 成交额 */
	returnAdjustedMargin: number;
	/** 净利率（对成交额）：定价时看的那个数 */
	netMarginOnGmv: number;

	// ---- 保本 ROAS 的三层口径：数字一层层变高，正好说明"漏算成本会低估保本线" ----
	/** 只扣商品成本：1 ÷ 商品毛利率 */
	breakEvenRoasSimple: number;
	/** 再扣退货（含收回的货值） */
	breakEvenRoasWithReturn: number;
}

export interface RoiResult {
	/** 非空表示输入有问题，此时 metrics 为 null */
	error: string;
	metrics: RoiMetrics | null;
}

// ---------------------------------------------------------------- 单件口径

/**
 * 计算口径：
 * - `batch` 整盘：一段时间的总投放（成交额 + 订单数），看的是这盘生意
 * - `unit` 单件：一款商品的单件经济账（售价 + 单件成本），用来定价与出价
 *
 * 两者是同一套公式 —— 单件口径等价于「订单数 = 1、成交额 = 售价、成本率 = 单件成本 ÷ 售价」，
 * 所以指标、敏感性表、说明全都复用，只有输入与金额的读法不同。
 */
export type RoiMode = 'batch' | 'unit';

/**
 * 单件口径的输入：一款商品卖多少钱、成本多少、退货怎么算。
 *
 * **没有广告费 / 投产比**：单件口径算的是**广告费之前**的账 ——
 * 它只回答两件事：「这款货保本 ROAS 是多少」和「ROAS 每高一点，每件多赚多少」，
 * 这两件事都不需要先知道自己现在跑在什么 ROAS 上。
 * 广告费真的进来的时候（定价反推要按某个 ROAS 反解售价）在结果卡里现填一个试算值。
 */
export interface UnitTextInputs extends RefundTexts {
	/** 售价（元/件） */
	price: string;
	/** 单件成本（元/件） */
	unitCost: string;
	/** 单件发货成本（元/件）：只按实际发出的件数计 */
	shipCost: string;
	/** 平台佣金率（% of 售价） */
	commissionRate: string;
	/**
	 * 退货能收回的货款比例（%）：只作用于签收后的退货。
	 * 退款三格（`refundMode` / 未发货 / 已发货 / 在途）来自 `RefundTexts` ——
	 * 单件口径下按金额填时，金额是**每件**退掉的售价。
	 */
	recoverRate: string;
	/** 单件退货成本（元/件）：按已发货退款的件数计 */
	returnShipCost: string;
	commissionRefunded: boolean;
}

/** 反推结果：售价定多少不亏、要多少才达标、成本最多能到多少 */
export interface ReverseResult {
	/** 非空表示算不出来，给中文原因（如退货率把空间吃光了） */
	error: string;
	/** 净利润为 0 的售价；无解时为 NaN */
	breakEvenPrice: number;
	/** 目标净利率（对售价）下的最低售价；无解时为 NaN */
	targetPrice: number;
	/** 目标净利率下可接受的最高单件成本；无解时为 NaN */
	maxUnitCost: number;
	/** 每 1 元售价里，扣完退货、佣金、广告之后剩下的比例（分式里的分母），供页面解释 */
	perYuanLeft: number;
}

/**
 * 「卖多少赚多少」的结果：把单件账按给定售价与销量放大成一盘账。
 *
 * 为什么不直接拿「每件利润 × 销量」：改售价时**成本率会变**（进价不跟着售价走），
 * 于是佣金、退货金额、货品成本都得按新售价重算 —— 直接乘等于假设进价随售价等比上涨，
 * 降价试算会算得过于乐观。所以这里走整盘口径重算一次，结果跟整盘那套指标完全同源。
 */
export interface ScaleResult {
	/** 非空表示算不出来（售价或销量不是一个正数） */
	error: string;
	/** 放大后的整盘指标；算不出来时为 null */
	metrics: RoiMetrics | null;
	/** 实际采用的售价（元/件）：留空或填了非法值时回落成当前售价 */
	price: number;
	/** 实际采用的销量（单）：留空或填了非法值时回落成默认销量 */
	quantity: number;
	/** 成交额 = 售价 × 销量 */
	gmv: number;
	/** 按试算 ROAS 反推的广告费总额；没有可用投产比时为 0（不投广告） */
	adCost: number;
}

/**
 * 「保本销量」试算格里的固定成本按哪种周期填：
 * - `day`：每天花这么多（人工、仓储、房租摊到一天）
 * - `month`：每月花这么多
 *
 * 周期只决定**结果的读法**（「每天要卖 X 件」还是「每月要卖 X 件」）与切换时数字的换算倍数，
 * 公式里不出现天数 —— 保本销量本来就是「这份成本对应的时间里要卖多少件」。
 */
export type FixedCostPeriod = 'day' | 'month';

/**
 * 保本销量的结果：把一段时间的固定成本摊平，要卖多少件、多少成交额。
 *
 * 与 `ReverseResult` 是**同一个式子的不同解法**：那边解售价与成本上限，这边解销量
 * （见 `derive.ts` 的 `volumeFromFixedCost`）。与 ② 段那几个试算格（假设投产比等）无关。
 */
export interface VolumeResult {
	/** 非空表示算不出来（售价 ≤ 0，或每件利润 ≤ 0 —— 卖多少都摊不平） */
	error: string;
	/** 保本销量（件）；无解时为 NaN */
	quantity: number;
	/** 保本成交额 = 保本销量 × 售价；无解时为 NaN */
	gmv: number;
	/** 实际采用的每件利润（元/件，扣推广费之前）：摊平固定成本的那个分子，供页面解释 */
	perUnitProfit: number;
}

/**
 * 目标按什么口径填（结果卡 ② 段，界面上二选一）：
 * - `profit`：目标净利（元）—— 想赚多少钱，反推需要的投产比
 * - `roas`：投产比（ROAS）—— 按这个投产比投，算要投入多少广告费、能赚多少
 *
 * 两者是**同一条线的两种说法**，不是两个自由度：
 * 广告费 = 成交额 ÷ 投产比 = 净利天花板 − 净利，给定任一个另一个就定了。
 * 所以界面上二选一，切换时数字跟着换算。
 */
export type TargetBasis = 'profit' | 'roas';

/** 目标 → 需要的 ROAS：与保本线同源，目标填 0 时算出来的就是保本 ROAS */
export interface TargetRoasResult {
	/** 非空表示算不出来（目标超过天花板、或还没填成交额） */
	error: string;
	/** 达到目标所需的 ROAS；无解时为 NaN */
	roas: number;
	/** 净利天花板 = 贡献利润：广告费降到 0 也最多赚这么多 */
	ceiling: number;
}

/** 「最该盯的一项」：把各变量各试一遍，挑出改善它收益最大的那个 */
export interface SensitiveItem {
	/** 变量名，直接给用户看 */
	label: string;
	/** 有利的变动方向 */
	direction: 'up' | 'down';
	/** 当前值：percent 是 0~1 的小数，amount 是元 */
	current: number;
	/** 变动后的值（同口径） */
	next: number;
	/** 值怎么显示：percent 按百分数、amount 按金额 */
	kind: 'percent' | 'amount';
	/** 这么动能多赚多少净利（元） */
	gain: number;
}

/** 敏感性表的一行：某个退货率下，保本 ROAS 会变成多少 */
export interface ReturnRateRow {
	/** 退货率（%），直接给用户看的口径 */
	ratePercent: number;
	breakEvenRoas: number;
	netProfit: number;
}

/** 敏感性表的一行：某个 ROAS 下的净利润 */
export interface RoasRow {
	roas: number;
	/** 反推的广告费 = 成交额 ÷ ROAS */
	adCost: number;
	netProfit: number;
}
