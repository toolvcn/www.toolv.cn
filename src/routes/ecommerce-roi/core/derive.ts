// 定价反推与规模试算：两块都是「把一件的账往两头推」——
// 一头解售价与成本上限（定价决策），一头把一件的账放大成一盘（卖多少赚多少）。
// 纯函数、不碰 DOM，node 环境可直接单测。
//
// 两块共用一个前提：试算用的投产比 `roas`。单件口径的输入里没有广告费，而「这个价卖不亏」
// 本来就依赖「你打算按多少的投产比投」—— 保本 ROAS 以下的 ROAS 会让任何售价都亏。
import { computeMetrics } from './metrics.ts';
import { formatPercent } from './format.ts';
import type { ReverseResult, RoiInputs, ScaleResult, VolumeResult } from './types.ts';

/**
 * 从「目标净利率」反推售价与成本上限（定价决策就靠这几个数）。
 *
 * `roas` 是**试算用的投产比**，必须由调用方给：单件口径的输入里没有广告费，
 * 而「这个价卖不亏」的说法本来就依赖「你打算按多少的投产比投」—— 保本 ROAS 以下的
 * ROAS 会让任何售价都亏，以上才有解。结果卡上那个「假设投产比」输入框默认取保本 ROAS 向上取整，
 * 就是为了保证这里拿到的是一个能算出解的值。
 *
 * 推导：设售价 P，每卖一件要**真花掉**的钱（fixedCost）=
 *   单件成本 ×(1 − 未发货 − 在途 − 签收后 × s) + 发货 ×(1 − 未发货) + 已发货退款 × 退货成本
 * —— 未发货那件没出库，既不计货值也不计运费；在途件原封返回、按完好算；
 * 只有签收后退货才走「能收回的货款」打折。
 *
 * 每 1 元售价扣完退货、佣金、广告之后剩下 perYuanLeft（t 是 ROAS）：
 *   退还佣金   perYuanLeft = (1 − 退款总额) × (1 − k) − 1/t
 *   不退还佣金 perYuanLeft = 1 − 退款总额 − (1 − 未发货) × k − 1/t
 * 净利 = P × perYuanLeft − fixedCost，令它等于 0（保本）或等于 m·P（目标净利率）即可解出 P。
 *
 * 佣金口径必须跟 computeMetrics 一致：否则用户一关「退款退还佣金」，指标变了、
 * 反推出来的售价却不动，同一屏里两个数打架（示例盘里保本售价会差 1.7 元）。
 */
export function reverseFromMargin(input: RoiInputs, targetMargin: number, roas: number): ReverseResult {
	const {
		gmv: price,
		costRate,
		commissionRate,
		shipCost,
		unshippedRefundRate: unshipped,
		shippedRefundRate: shipped,
		inTransitRefundRate,
		recoverRate,
		returnShipCost,
		commissionRefunded
	} = input;
	const unitCost = price * costRate;

	// 退款总额与三分类：在途件原封返回、按 100% 算，只有签收后退货走「能收回的货款」
	const refundTotal = unshipped + shipped;
	const inTransit = Math.min(inTransitRefundRate, shipped);
	const signedRefund = shipped - inTransit;

	// 每 1 元售价剩下的比例：先扣退货与佣金，再扣广告（广告费 = 售价 ÷ ROAS）。
	// 佣金退还时只按净收入收，即 (1 − 退款总额) × k；不退还时按成交额收 ——
	// 但未发货退款那部分平台必然退佣，所以那一块始终不进佣金基数。
	// roas 拿不到一个正常值时按「不投广告」算（广告项 0），不把 NaN 混进下面几个除法里。
	const commissionPerYuan = commissionRefunded ? (1 - refundTotal) * commissionRate : (1 - unshipped) * commissionRate;
	const adPerYuan = Number.isFinite(roas) && roas > 0 ? 1 / roas : 0;
	const perYuanLeft = 1 - refundTotal - commissionPerYuan - adPerYuan;

	// 真花掉的钱：未发货的那件没出库（不计货值、不计运费），在途件按完好算，
	// 签收后退货按「能收回的货款」打折 —— 只有折掉的那部分才是真花掉的
	const fixedCost =
		unitCost * (1 - unshipped - inTransit - signedRefund * recoverRate) +
		shipCost * (1 - unshipped) +
		shipped * returnShipCost;

	const none: ReverseResult = {
		error: '',
		breakEvenPrice: Number.NaN,
		targetPrice: Number.NaN,
		maxUnitCost: Number.NaN,
		perYuanLeft
	};

	if (price <= 0) return { ...none, error: '先填一个大于 0 的售价' };
	if (perYuanLeft <= 0) {
		return { ...none, error: '退货率、佣金与广告已经吃掉全部空间：这个投产比下卖多少钱都是亏' };
	}

	const breakEvenPrice = fixedCost / perYuanLeft;

	const leftForMargin = perYuanLeft - targetMargin;
	if (leftForMargin <= 0) {
		return {
			...none,
			breakEvenPrice,
			error: `目标净利率超过当前口径能撑住的上限 ${formatPercent(perYuanLeft)}，先把退货率、佣金或成本降下来`
		};
	}
	const targetPrice = fixedCost / leftForMargin;

	// 反过来解成本：真花掉的钱里只有货品成本可控，其余按现值锁死
	const maxUnitCost =
		(price * leftForMargin - shipCost * (1 - unshipped) - shipped * returnShipCost) /
		(1 - unshipped - inTransit - signedRefund * recoverRate);

	return {
		error: '',
		breakEvenPrice,
		targetPrice,
		maxUnitCost: Math.max(maxUnitCost, 0),
		perYuanLeft
	};
}

/**
 * 单件口径的「卖多少赚多少」：按给定售价与销量，把一件的账放大成一盘账。
 *
 * 走整盘口径重算而不是「每件利润 × 销量」，因为**改价时成本率必须重算**：
 * 进价不跟着售价走（`C` 固定），售价从 69.9 降到 60，成本率就从 50% 涨到 58%，
 * 佣金、退货金额、货品成本全都跟着变。直接乘等于假设进价随售价等比上涨 ——
 * 降价试算会算得偏乐观，而这个工具最常被用来试的恰恰就是降价。
 *
 * `roas` 用来反推广告费（`成交额 ÷ ROAS`），拿不到有效值就按 0（不投广告）算。
 */
export function scaleToBatch(unit: RoiInputs, price: number, quantity: number, roas: number): ScaleResult {
	const gmv = price * quantity;
	const adCost = Number.isFinite(roas) && roas > 0 ? gmv / roas : 0;
	const none: ScaleResult = { error: '', metrics: null, price, quantity, gmv, adCost };
	if (!(price > 0)) return { ...none, error: '先填一个大于 0 的售价' };
	if (!(quantity > 0)) return { ...none, error: '销量要大于 0（单）' };

	const unitCost = unit.gmv * unit.costRate;
	return {
		...none,
		metrics: computeMetrics({
			...unit,
			gmv,
			orders: quantity,
			// 成本率按**新售价**重算：改价改的是毛利，进价还是那个进价
			costRate: unitCost / price,
			adCost,
			otherCost: 0
		})
	};
}

/**
 * 保本销量：把一段时间的**固定成本**摊平，要卖多少件、多少成交额。
 *
 * 这是「定价反推」那条式子的**第四种解法** —— 那边是
 * `净利 = 售价 × 每元剩余 − 固定花掉的钱`，三种解法全在解售价与成本；
 * 这里把「固定花掉的钱」换成一段时间的固定成本 `C`，销量记作 `Q`：
 *
 *   总净利 = Q × 每件利润 − C = 0   →   Q = C ÷ 每件利润
 *
 * `perUnitProfit` = ① 段那个「每件利润」（贡献利润）：扣完货、佣金、物流与退货损耗、
 * **还没扣推广费**的钱。这一层只做这一个除法，不认识退货三分类与佣金口径 —— 都在上游算完了。
 *
 * 与「假设投产比 / 试算售价 / 试算销量」那三个试算格**没有任何关系**：
 * 那三个是「按某个假设再算一遍」，这里问的是「按现在这盘真实参数，要卖多少件」。
 * 想按某个投产比算，那属于「卖多少赚多少」；这一格的口径就是**不投广告**（每件利润全留下）。
 *
 * `price` 只用来把销量折成成交额，所以它必须与 `perUnitProfit` 取自**同一个售价**。
 */
export function volumeFromFixedCost(fixedCost: number, perUnitProfit: number, price: number): VolumeResult {
	const none: VolumeResult = { error: '', quantity: Number.NaN, gmv: Number.NaN, perUnitProfit };
	if (!(price > 0)) return { ...none, error: '先填一个大于 0 的售价' };
	// 每件利润 ≤ 0 时这个除法没有意义：卖得越多亏得越多，不存在「卖到多少就摊平」
	// （跟 `reverseFromMargin` 里 `perYuanLeft ≤ 0` 那个分支同一个路数）
	if (!(perUnitProfit > 0)) {
		return { ...none, error: '这个价每件不赚钱 —— 固定成本摊不平，卖多少都补不上' };
	}
	const quantity = fixedCost / perUnitProfit;
	return { ...none, quantity, gmv: quantity * price };
}
