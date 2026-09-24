// 一盘生意的全部指标：从数值输入算出中间量与四个 ROI、三个利润率、三层保本线。
// 纯函数、不碰 DOM，node 环境可直接单测。
//
// 口径上的五个关键决定（README 的「逐项公式」与页面底部「为什么这么算」逐条解释，编号与那边对齐）：
//   1. 退款按「未发货 / 在途 / 签收后」三类分开算（`u` / `t` / `r − t`）—— 同一笔退款，三类承担的
//      成本完全不同：未发货的货没出库（不计货品成本、不计正向与逆向物流）、在途的货原封返回
//      （按 100% 可再售）、只有签收后退货才会拆封折损。少拆这一层，最容易漏掉的是
//      「未发货的那批货也收了发货运费」。
//   2. 货品成本按**实际发出量**算（`grossGoodsCost` 里那个 `1 − u`）—— 没出库的那批不该计成本，
//      也就没有「先按全量算、回头再加回来」这一步。
//   3. 物流按**订单**计，不按成交额的比例计，而且只按实际发出的订单计 —— 一单一个快递、
//      跟客单价无关；未发货退款那批压根没进过快递袋。
//   4. 保本 ROAS 用**成交额**口径（广告后台只认成交额），不是净收入口径。
//   5. **残损货值不再单独减一次** —— 它已经含在「发出货品成本 − 收回货值」里（`⑨` 里没有 `⑤`），
//      再减一遍等于把残损扣两次。
//
// 夹在 2 与 5 之间的那层是「退货不等于全损」：`recoveredGoodsValue`（在途件原封 + 签收件按
// `recoverRate` 收回）不是损失，只有残损那一块才是 —— 页面「为什么这么算」的第三节专讲它。
// 唯一的反向依赖在里面那个 `computeRoi` 上：它是「解析 + 计算」的一步到位版，
// 只有说明栏与单测用。指标本身不认识文本输入。
import { parseInputs } from './parse.ts';
import type { RoiInputs, RoiMetrics, RoiResult, RoiTextInputs } from './types.ts';

/** 一笔投放的全部中间量与指标（口径见文件头） */
export function computeMetrics(input: RoiInputs): RoiMetrics {
	const {
		adCost,
		gmv,
		orders,
		costRate,
		commissionRate,
		shipCost,
		unshippedRefundRate,
		shippedRefundRate,
		inTransitRefundRate,
		recoverRate,
		returnShipCost,
		otherCost,
		commissionRefunded
	} = input;

	const aov = orders > 0 ? gmv / orders : 0;

	// ---- 退款三分类 ----
	// 在途率钳到「已发货退款率」以内：parse 已经校验过，这里再兜一次是给直接调 computeMetrics 的调用方
	const inTransit = Math.min(inTransitRefundRate, shippedRefundRate);
	/** 签收后退货率 = 已发货退款 − 在途：唯一会拆封、会折损的那一类 */
	const signedRefund = shippedRefundRate - inTransit;

	const unshippedOrders = orders * unshippedRefundRate;
	const inTransitOrders = orders * inTransit;
	const signedOrders = orders * signedRefund;
	const returnedOrders = unshippedOrders + inTransitOrders + signedOrders;

	const unshippedAmount = gmv * unshippedRefundRate;
	const inTransitAmount = gmv * inTransit;
	const signedAmount = gmv * signedRefund;
	const returnedAmount = gmv * (unshippedRefundRate + shippedRefundRate);
	const netRevenue = gmv - returnedAmount;

	// 货品成本只算**真正发出去**的货：未发货退款的那批压根没出库，不计成本，也就没有「加回来」一说
	const grossGoodsCost = gmv * (1 - unshippedRefundRate) * costRate;
	// 能收回的货值：拒收件原封返回（按 100% 算），签收退货按「能收回的货款」打折
	const recoveredGoodsValue = gmv * costRate * (inTransit + signedRefund * recoverRate);
	// 残损只发生在签收后退货那一类
	const damagedGoodsCost = gmv * costRate * signedRefund * (1 - recoverRate);
	const netGoodsCost = grossGoodsCost - recoveredGoodsValue;

	// 佣金退不退各平台不同：退就只按净收入收，不退就按全额成交额收。
	// 例外是未发货退款那一类 —— 货没发出，平台必然退佣，所以它一定不计入佣金基数。
	const commissionBase = commissionRefunded ? netRevenue : gmv - unshippedAmount;
	const commission = commissionBase * commissionRate;

	// 正向物流只按实际发出的订单算；逆向物流按已发货退款（在途 + 签收后）算
	const forwardShipping = orders * (1 - unshippedRefundRate) * shipCost;
	const reverseShipping = orders * shippedRefundRate * returnShipCost;

	const contributionProfit = netRevenue - netGoodsCost - commission - forwardShipping - reverseShipping - otherCost;
	const netProfit = contributionProfit - adCost;
	const netMargin = netRevenue > 0 ? netProfit / netRevenue : 0;

	const contributionMargin = gmv > 0 ? contributionProfit / gmv : 0;

	// 三个利润率，从粗到细。商品毛利率只看货（1 − 成本率，跟退货无关），
	// 退货修正毛利率再把退货算进去，净利率扣完全部。
	// 注意 grossMargin **不能**写成「(成交额 − 发出货品成本) ÷ 成交额」—— 后者把未发货那批省下的货值
	// 也算进去了，不再是「商品本身赚多少」这个意思，三层保本线的第一层会跟着一起跑。
	const grossMargin = 1 - costRate;
	const returnAdjustedMargin = gmv > 0 ? (netRevenue - netGoodsCost) / gmv : 0;
	const netMarginOnGmv = gmv > 0 ? netProfit / gmv : 0;

	// 保本 ROAS 的三层口径：漏算的成本越多，算出来越乐观（数字越低）
	const returnAdjustedContribution = netRevenue - netGoodsCost;

	return {
		aov,
		unshippedAmount,
		unshippedOrders,
		inTransitAmount,
		inTransitOrders,
		signedAmount,
		signedOrders,
		returnedAmount,
		returnedOrders,
		netRevenue,

		grossGoodsCost,
		recoveredGoodsValue,
		damagedGoodsCost,
		netGoodsCost,

		commission,
		forwardShipping,
		reverseShipping,

		contributionProfit,
		netProfit,
		netMargin,

		adRoas: adCost > 0 ? gmv / adCost : Number.POSITIVE_INFINITY,
		netRoas: adCost > 0 ? netRevenue / adCost : Number.POSITIVE_INFINITY,
		adRoi: adCost > 0 ? netProfit / adCost : Number.POSITIVE_INFINITY,
		businessRoi: adCost + netGoodsCost > 0 ? netProfit / (adCost + netGoodsCost) : Number.POSITIVE_INFINITY,
		// 保本线：投到「贡献利润」这么多钱时净利刚好为 0，对回去就是成交额 ÷ 贡献利润
		breakEvenRoas: contributionMargin > 0 ? 1 / contributionMargin : Number.POSITIVE_INFINITY,
		maxAdCost: contributionProfit,
		contributionMargin,

		// 未发货退款那一类不产生真损失：货没出库、运费也没花。它的代价是白花的推广费，见 wastedAdCost。
		// 「退不回的佣金」只算已发货那两类 —— 未发货的货没发出，平台必然退佣，
		// 与上面 commissionBase 里 `gmv − unshippedAmount` 减掉的必须是同一块，否则两处对不上账
		returnLoss:
			damagedGoodsCost + reverseShipping + (commissionRefunded ? 0 : (inTransitAmount + signedAmount) * commissionRate),
		allLossNetProfit: netProfit - recoveredGoodsValue,
		wastedAdCost: adCost * unshippedRefundRate,

		grossMargin,
		returnAdjustedMargin,
		netMarginOnGmv,

		breakEvenRoasSimple: grossMargin > 0 ? 1 / grossMargin : Number.POSITIVE_INFINITY,
		breakEvenRoasWithReturn:
			returnAdjustedContribution > 0 ? gmv / returnAdjustedContribution : Number.POSITIVE_INFINITY
	};
}

/** 解析 + 计算。输入非法时 metrics 为 null，error 给一句中文原因 */
export function computeRoi(texts: RoiTextInputs): RoiResult {
	const parsed = parseInputs(texts);
	if (!parsed.ok) return { error: parsed.error, metrics: null };
	return { error: '', metrics: computeMetrics(parsed.inputs) };
}
