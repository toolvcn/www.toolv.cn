// 定价反推、规模试算与保本销量的单测：三块都是「把一件的账往两头推」的解法，
// 前两块按「假设投产比」算、改价时成本率必须重算；保本销量不碰投产比（口径是不投广告）。
//
// 断言尽量写成算式：反推与指标是同一套口径的两头，把算式抄一遍就等于同时验了
// 「反推解得对」与「指标认得这个解」—— 写死数字的话，两边一起错也看不出来。
import { describe, expect, it } from 'vitest';
import { parseUnitInputs } from './parse.ts';
import { computeMetrics } from './metrics.ts';
import { reverseFromMargin, scaleToBatch, volumeFromFixedCost } from './derive.ts';
import { UNIT_EXAMPLE_INPUTS } from '../config.ts';
import type { RoiInputs } from './types.ts';

/** 单件示例的数值输入。广告费恒为 0 —— 反推要的投产比是第三个参数单独传的 */
function unitInputs(): RoiInputs {
	const parsed = parseUnitInputs(UNIT_EXAMPLE_INPUTS);
	if (!parsed.ok) throw new Error('示例不该解析失败：' + parsed.error);
	return parsed.inputs;
}

/** 单件示例的退款结构，几个算式都要用 */
function refundShape(inputs: RoiInputs) {
	const refundTotal = inputs.unshippedRefundRate + inputs.shippedRefundRate;
	const inTransit = Math.min(inputs.inTransitRefundRate, inputs.shippedRefundRate);
	return { refundTotal, inTransit, signedRefund: inputs.shippedRefundRate - inTransit };
}

/**
 * 每件真花掉的钱（未发货的不出库、在途的原封回来、只有签收后退货打折）。
 * 与 `reverseFromMargin` 里的 fixedCost 是同一个式子 —— 这里独立写一遍，就是为了两侧对不上时报出来。
 */
function fixedCostPerUnit(inputs: RoiInputs): number {
	const { inTransit, signedRefund } = refundShape(inputs);
	const unitCost = inputs.gmv * inputs.costRate;
	return (
		unitCost * (1 - inputs.unshippedRefundRate - inTransit - signedRefund * inputs.recoverRate) +
		inputs.shipCost * (1 - inputs.unshippedRefundRate) +
		inputs.shippedRefundRate * inputs.returnShipCost
	);
}

describe('反推：保本售价、目标净利率与成本上限', () => {
	/** 试算 ROAS：这一组用例统一按 6 算（结果卡默认取的是 4，见下面单独那条） */
	const TRIAL = 6;

	it('保本售价：按这个价卖，净利刚好归零', () => {
		const inputs = unitInputs();
		const reverse = reverseFromMargin(inputs, 0, TRIAL);
		expect(reverse.error).toBe('');
		expect(reverse.breakEvenPrice).toBeCloseTo(fixedCostPerUnit(inputs) / reverse.perYuanLeft, 6);

		// 拿保本价重算一遍，净利率应当是 0（成本率与广告费都按同一个 ROAS 重算）
		const atBreakEven = computeMetrics({
			...inputs,
			gmv: reverse.breakEvenPrice,
			costRate: (inputs.gmv * inputs.costRate) / reverse.breakEvenPrice,
			adCost: reverse.breakEvenPrice / TRIAL
		});
		expect(atBreakEven.netMarginOnGmv).toBeCloseTo(0, 6);
	});

	it('结果卡默认那个试算 ROAS（保本线向上取整 = 4）下的三个数', () => {
		const inputs = unitInputs();
		const center = Math.ceil(computeMetrics(inputs).breakEvenRoas);
		expect(center).toBe(4);

		const reverse = reverseFromMargin(inputs, 0.2, center);
		expect(reverse.error).toBe('');
		const { refundTotal } = refundShape(inputs);
		// 每元剩余 = 1 − 退款总额 − 退还佣金口径（净收入 × 佣金率）− 1 ÷ 试算 ROAS
		const commissionPerYuan = (1 - refundTotal) * inputs.commissionRate;
		expect(reverse.perYuanLeft).toBeCloseTo(1 - refundTotal - commissionPerYuan - 1 / center, 10);
		expect(reverse.breakEvenPrice).toBeCloseTo(fixedCostPerUnit(inputs) / reverse.perYuanLeft, 6);
		expect(reverse.targetPrice).toBeCloseTo(fixedCostPerUnit(inputs) / (reverse.perYuanLeft - 0.2), 6);
		// 试算 ROAS 高于保本线，所以保本售价低于现价 —— 按这个 ROAS 投是赚的
		expect(reverse.breakEvenPrice).toBeLessThan(inputs.gmv);
	});

	it('试算 ROAS 掉到保本线以下时，反推的保本价会高于现价（现在的定价就是亏的）', () => {
		const inputs = unitInputs();
		// 示例的保本线是 3.93，所以 3 才在它之下 —— 4 已经过线了
		const lower = reverseFromMargin(inputs, 0.2, 3);
		expect(lower.error).toBe('');
		expect(lower.breakEvenPrice).toBeGreaterThan(inputs.gmv);
		// ROAS 越低，广告摊到每元的份额越大，保本价越高
		expect(lower.breakEvenPrice).toBeGreaterThan(reverseFromMargin(inputs, 0.2, TRIAL).breakEvenPrice);
	});

	it('目标净利率 20%：反推的最低价卖出去正好是 20%', () => {
		const inputs = unitInputs();
		const reverse = reverseFromMargin(inputs, 0.2, TRIAL);
		expect(reverse.error).toBe('');

		const atTarget = computeMetrics({
			...inputs,
			gmv: reverse.targetPrice,
			costRate: (inputs.gmv * inputs.costRate) / reverse.targetPrice,
			adCost: reverse.targetPrice / TRIAL
		});
		expect(atTarget.netMarginOnGmv).toBeCloseTo(0.2, 6);
	});

	it('成本上限：把成本顶到上限，净利率正好是目标值', () => {
		const inputs = unitInputs();
		const reverse = reverseFromMargin(inputs, 0.2, TRIAL);
		expect(reverse.error).toBe('');

		// 售价不变、成分不变，只把成本顶到上限，净利率应当正好是 20%
		const atCeiling = computeMetrics({
			...inputs,
			costRate: reverse.maxUnitCost / inputs.gmv,
			adCost: inputs.gmv / TRIAL
		});
		expect(atCeiling.netMarginOnGmv).toBeCloseTo(0.2, 6);
	});

	it('退款率与佣金把空间吃光时不给死数，而是说清原因', () => {
		// 退款总额 90%（未发货 40 + 已发货 50）再叠 30% 佣金，每元剩余必然为负
		const inputs = { ...unitInputs(), unshippedRefundRate: 0.4, shippedRefundRate: 0.5, commissionRate: 0.3 };
		const reverse = reverseFromMargin(inputs, 0.2, TRIAL);
		expect(reverse.error).not.toBe('');
		expect(Number.isNaN(reverse.breakEvenPrice)).toBe(true);
	});

	it('目标净利率高于口径上限时单独报错，但保本价照给', () => {
		const inputs = unitInputs();
		const reverse = reverseFromMargin(inputs, 0.9, TRIAL);
		expect(reverse.error).toContain('上限');
		expect(Number.isNaN(reverse.breakEvenPrice)).toBe(false);
		expect(Number.isNaN(reverse.targetPrice)).toBe(true);
	});

	// 这一组是回归测试：原先 perYuanLeft 写死「退还佣金」口径，用户一关开关，
	// 同页的指标变了、反推的售价却不动，两个数互相打脸。
	it('佣金不退还时反推跟着走：每元剩余变少，保本价与达标价抬高、成本上限压低', () => {
		const refunded = unitInputs();
		const notRefunded = { ...refunded, commissionRefunded: false };
		const a = reverseFromMargin(refunded, 0.2, TRIAL);
		const b = reverseFromMargin(notRefunded, 0.2, TRIAL);
		const { refundTotal } = refundShape(refunded);

		// 每元售价里要留出来付广告费的那份 = 1 ÷ 试算 ROAS
		const adShare = 1 / TRIAL;
		// 退还佣金：按净收入抽；不退还：按成交额抽，但**未发货那部分平台必然退佣**，所以还要减掉它
		expect(a.perYuanLeft).toBeCloseTo(1 - refundTotal - (1 - refundTotal) * refunded.commissionRate - adShare, 10);
		expect(b.perYuanLeft).toBeCloseTo(
			1 - refundTotal - (1 - refunded.unshippedRefundRate) * refunded.commissionRate - adShare,
			10
		);
		expect(b.perYuanLeft).toBeLessThan(a.perYuanLeft);

		expect(b.breakEvenPrice).toBeGreaterThan(a.breakEvenPrice);
		expect(b.targetPrice).toBeGreaterThan(a.targetPrice);
		expect(b.maxUnitCost).toBeLessThan(a.maxUnitCost);
	});

	it('佣金不退还时，反推出的售价拿同页指标复核仍是目标净利率', () => {
		const inputs = { ...unitInputs(), commissionRefunded: false };
		const reverse = reverseFromMargin(inputs, 0.2, TRIAL);
		expect(reverse.error).toBe('');

		// 换了售价，成本率与广告费要按同一口径重算（单件成本与试算 ROAS 都不变）
		const at = (price: number) =>
			computeMetrics({
				...inputs,
				gmv: price,
				costRate: (inputs.gmv * inputs.costRate) / price,
				adCost: price / TRIAL
			});
		expect(at(reverse.breakEvenPrice).netMarginOnGmv).toBeCloseTo(0, 6);
		expect(at(reverse.targetPrice).netMarginOnGmv).toBeCloseTo(0.2, 6);
	});
});

describe('规模试算：卖多少赚多少', () => {
	it('按现价卖 100 单、投产比 5：成交额 6990、广告费 1398', () => {
		const inputs = unitInputs();
		const scale = scaleToBatch(inputs, inputs.gmv, 100, 5);
		expect(scale.error).toBe('');
		expect(scale.gmv).toBeCloseTo(6990, 10);
		expect(scale.adCost).toBeCloseTo(1398, 10);
		// 单件成本不随数量变，但**只按实际发出的件数算**：未发货退款 20%，所以是 80 件 × 35
		expect(scale.metrics?.grossGoodsCost).toBeCloseTo(80 * (inputs.gmv * inputs.costRate), 6);
		expect(scale.metrics?.grossGoodsCost).toBeCloseTo(2800, 6);
		expect(scale.metrics?.netProfit).toBeCloseTo(computeMetrics(inputs).contributionProfit * 100 - 1398, 6);
	});

	it('不投广告时等于「每件利润 × 销量」', () => {
		const inputs = unitInputs();
		const scale = scaleToBatch(inputs, inputs.gmv, 100, 0);
		expect(scale.adCost).toBe(0);
		expect(scale.metrics?.netProfit).toBeCloseTo(computeMetrics(inputs).contributionProfit * 100, 6);
	});

	it('改售价时成本率按新售价重算，不是只把差价乘上去', () => {
		const inputs = unitInputs();
		const scale = scaleToBatch(inputs, 60, 100, 5);
		// 进价还是 35 元/件，所以整批货款不变；跟着变的是收入与佣金基数
		expect(scale.metrics?.grossGoodsCost).toBeCloseTo(80 * (inputs.gmv * inputs.costRate), 6);
		expect(scale.metrics?.commission).toBeCloseTo(6000 * (1 - 0.35) * 0.05, 6);
		// 降价把毛利让出去，广告费却按成交额 ÷ ROAS 缩水得慢，于是由盈转亏：
		// 现价 69.9 时每批赚 379.23，降到 60 每批亏 34.1
		expect(scale.metrics?.netProfit).toBeCloseTo(-34.1, 6);
		expect(scaleToBatch(inputs, inputs.gmv, 100, 5).metrics?.netProfit).toBeCloseTo(
			computeMetrics(inputs).contributionProfit * 100 - 6990 / 5,
			6
		);
	});

	it('售价或销量不是正数时给中文原因，不算出一盘数', () => {
		expect(scaleToBatch(unitInputs(), 0, 100, 5).error).not.toBe('');
		expect(scaleToBatch(unitInputs(), 0, 100, 5).metrics).toBeNull();
		expect(scaleToBatch(unitInputs(), 69.9, 0, 5).error).not.toBe('');
		expect(scaleToBatch(unitInputs(), 69.9, 0, 5).metrics).toBeNull();
	});

	it('拿不到投产比（NaN / 0）时按不投广告算，不把 NaN 混进广告费', () => {
		const byNan = scaleToBatch(unitInputs(), 69.9, 100, Number.NaN);
		expect(byNan.adCost).toBe(0);
		expect(Number.isFinite(byNan.metrics?.netProfit ?? Number.NaN)).toBe(true);
		expect(scaleToBatch(unitInputs(), 69.9, 100, 0).adCost).toBe(0);
	});
});

describe('保本销量：把一段时间的固定成本摊平', () => {
	/** 示例盘的每件利润（= 贡献利润，扣推广费之前）—— 保本销量的分子 */
	const PER_UNIT = () => computeMetrics(unitInputs()).contributionProfit;

	it('件数 = 固定成本 ÷ 每件利润，成交额 = 件数 × 售价', () => {
		const inputs = unitInputs();
		const volume = volumeFromFixedCost(500, PER_UNIT(), inputs.gmv);
		expect(volume.error).toBe('');
		expect(volume.perUnitProfit).toBeCloseTo(PER_UNIT(), 10);
		expect(volume.quantity).toBeCloseTo(500 / PER_UNIT(), 10);
		expect(volume.gmv).toBeCloseTo(volume.quantity * inputs.gmv, 10);

		// 示例盘的具体量级：日成本 500 → 28 件/天（formatCount 取整）、成交额 1966.55 元
		expect(volume.quantity).toBeCloseTo(28.13, 2);
		expect(volume.gmv).toBeCloseTo(1966.55, 1);
	});

	/**
	 * 关键用例：拿这个销量回整盘口径复核，**加上这笔固定成本之后净利正好归零**。
	 * 这是判断「公式对不对」的唯一硬标准 —— 写死数字只能证明算出来的没变，
	 * 证明不了它跟指标那一侧是同一个口径。
	 */
	it('按这个销量回整盘口径复核，扣掉固定成本后净利归零（两套口径对得上）', () => {
		const inputs = unitInputs();
		const fixedCost = 10000;
		const volume = volumeFromFixedCost(fixedCost, PER_UNIT(), inputs.gmv);
		expect(volume.error).toBe('');

		const atBreakEven = computeMetrics({
			...inputs,
			gmv: volume.gmv,
			orders: volume.quantity,
			// 售价不变，成本率也不变；广告费恒为 0（单件口径只算广告费之前），固定成本进 otherCost
			adCost: 0,
			otherCost: fixedCost
		});
		expect(atBreakEven.netProfit).toBeCloseTo(0, 6);
	});

	it('固定成本加倍，件数与成交额跟着加倍（与是日还是月无关 —— 周期只是读法）', () => {
		const inputs = unitInputs();
		const once = volumeFromFixedCost(500, PER_UNIT(), inputs.gmv);
		const twice = volumeFromFixedCost(1000, PER_UNIT(), inputs.gmv);
		expect(twice.quantity).toBeCloseTo(once.quantity * 2, 10);
		expect(twice.gmv).toBeCloseTo(once.gmv * 2, 10);
	});

	it('固定成本填 0 就是「没有这笔」，出 0 件而不是报错', () => {
		const volume = volumeFromFixedCost(0, PER_UNIT(), unitInputs().gmv);
		expect(volume.error).toBe('');
		expect(volume.quantity).toBe(0);
		expect(volume.gmv).toBe(0);
	});

	// 每件不赚钱时这个除法没有意义：卖得越多亏得越多，不存在「卖到多少就摊平」。
	// 给一句中文原因而不是 Infinity / 负数，跟 `reverseFromMargin` 那条分支同一个路数。
	it('每件利润 ≤ 0 时说清原因，不给死数', () => {
		const zero = volumeFromFixedCost(500, 0, 69.9);
		expect(zero.error).not.toBe('');
		expect(Number.isNaN(zero.quantity)).toBe(true);

		const negative = volumeFromFixedCost(500, -3, 69.9);
		expect(negative.error).not.toBe('');
		expect(Number.isNaN(negative.gmv)).toBe(true);

		// 成本吃满的示例盘（单件成本高过售价）也要走这条
		const eaten = { ...unitInputs(), costRate: 1.5 };
		expect(volumeFromFixedCost(500, computeMetrics(eaten).contributionProfit, eaten.gmv).error).not.toBe('');
	});

	it('售价不是正数时先说先填售价，不算出一盘假数', () => {
		expect(volumeFromFixedCost(500, PER_UNIT(), 0).error).toContain('售价');
		expect(Number.isNaN(volumeFromFixedCost(500, PER_UNIT(), 0).quantity)).toBe(true);
	});
});
