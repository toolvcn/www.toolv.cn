// 指标的单测：退款三分类、四个 ROI、保本线、三个利润率与三层保本线。
// 基准用例就是页面上的示例（一款成本率 50%、退款总额 35% 的商品盘），README 里逐项列过。
//
// 断言尽量写成算式而不是写死的数字：改示例时测试跟着一起变，不会出现
// 「代码改了、测试还按老数字过」这种假绿。
import { describe, expect, it } from 'vitest';
import { parseInputs } from './parse.ts';
import { computeMetrics, computeRoi } from './metrics.ts';
import { EMPTY_INPUTS, EXAMPLE_INPUTS } from '../config.ts';
import type { RoiInputs } from './types.ts';

/** 示例盘的数值输入：要绕过 parse 校验直接喂给 computeMetrics 的用例用它 */
function baseInputs(): RoiInputs {
	const parsed = parseInputs(EXAMPLE_INPUTS);
	if (!parsed.ok) throw new Error('示例不该解析失败：' + parsed.error);
	return parsed.inputs;
}

const G = 6990; // 成交额
const N = 100; // 订单数
const COST = 0.5; // 成本率
const COMMISSION = 0.05; // 佣金率
const SHIP = 3; // 单均发货成本
const RETURN_SHIP = 1; // 单均退货成本
const U = 0.2; // 未发货退款率
const M = 0.15; // 已发货退款率
const T = 0.02; // 在途退款率
const SIGNED = M - T; // 签收后退货率
const RECOVER = 0.98; // 签收退货能收回的货款
const AD = 1165; // 广告费

describe('退款三分类', () => {
	it('三类各占自己的率，合计等于退款总额', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.unshippedAmount).toBeCloseTo(G * U, 6);
		expect(metrics.inTransitAmount).toBeCloseTo(G * T, 6);
		expect(metrics.signedAmount).toBeCloseTo(G * SIGNED, 6);
		expect(metrics.returnedAmount).toBeCloseTo(G * (U + M), 6);
		expect(metrics.unshippedOrders).toBeCloseTo(N * U, 6);
		expect(metrics.inTransitOrders).toBeCloseTo(N * T, 6);
		expect(metrics.signedOrders).toBeCloseTo(N * SIGNED, 6);
		expect(metrics.returnedOrders).toBeCloseTo(N * (U + M), 6);
	});

	it('未发货的那批货没出库：货品成本只算真实发出去的', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.grossGoodsCost).toBeCloseTo(G * (1 - U) * COST, 6);
		// 就是 80 单的货，不是 100 单
		expect(metrics.grossGoodsCost).toBeCloseTo(80 * (G / N) * COST, 6);
	});

	it('正向物流只按实际发出的订单算，未发货退款那批不承担运费', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.forwardShipping).toBeCloseTo(N * (1 - U) * SHIP, 6);
		expect(metrics.forwardShipping).toBeCloseTo(240, 6);
	});

	it('逆向物流只按已发货退款的订单算，未发货退款没有逆向物流', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.reverseShipping).toBeCloseTo(N * M * RETURN_SHIP, 6);
		expect(metrics.reverseShipping).toBeCloseTo(15, 6);
	});

	it('在途件原封返回，货值按 100% 收回，不按「能收回的货款」打折', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		// 在途那一份不打折 + 签收后那一份打 s 折
		expect(metrics.recoveredGoodsValue).toBeCloseTo(G * COST * (T + SIGNED * RECOVER), 6);
		// 同样的参数若把在途率填成 0（全按签收后退货算），收回的货值会明显变少
		const noInTransit = computeRoi({ ...EXAMPLE_INPUTS, inTransitRefundRate: '0' });
		expect(metrics.recoveredGoodsValue).toBeGreaterThan(noInTransit.metrics?.recoveredGoodsValue ?? 0);
	});

	it('残损货值只发生在签收后退货那一类', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.damagedGoodsCost).toBeCloseTo(G * COST * SIGNED * (1 - RECOVER), 6);
		// 收回比例压到 0：只有签收后那部分变成全损，在途与未发货仍然不产生损失
		const allLoss = computeRoi({ ...EXAMPLE_INPUTS, recoverRate: '0' });
		expect(allLoss.metrics?.damagedGoodsCost).toBeCloseTo(G * COST * SIGNED, 6);
	});

	it('在途率填得比已发货退款率还高时被钳住，不产生负的签收后退货率', () => {
		// parse 会先报错拦下这一组输入（见 parse.test.ts），所以这里直接喂给 computeMetrics ——
		// 绕过校验的调用方（说明栏、别处的复用）也要拿到一个不崩的结果
		const metrics = computeMetrics({ ...baseInputs(), inTransitRefundRate: 0.5 });
		expect(metrics.signedAmount).toBe(0);
		expect(metrics.signedOrders).toBe(0);
		expect(metrics.inTransitAmount).toBeCloseTo(G * M, 6);
	});
});

describe('退款口径的退化（老预设的兼容根据）', () => {
	it('未发货与在途都填 0 时，逐位退化成「所有退款都按已发货退回处理」的旧口径', () => {
		// 老预设文件里只有一个 returnRate，迁移时整份落进「已发货退款率」，
		// 所以这条断言守的是「老预设导入后算出的数与当时一致」
		const { metrics } = computeRoi({ ...EXAMPLE_INPUTS, unshippedRefundRate: '0', inTransitRefundRate: '0' });
		if (!metrics) return;
		const r = M;
		expect(metrics.netRevenue).toBeCloseTo(G * (1 - r), 6);
		expect(metrics.grossGoodsCost).toBeCloseTo(G * COST, 6);
		expect(metrics.recoveredGoodsValue).toBeCloseTo(G * r * COST * RECOVER, 6);
		expect(metrics.damagedGoodsCost).toBeCloseTo(G * r * COST * (1 - RECOVER), 6);
		expect(metrics.netGoodsCost).toBeCloseTo(G * COST * (1 - r * RECOVER), 6);
		expect(metrics.forwardShipping).toBeCloseTo(N * SHIP, 6);
		expect(metrics.reverseShipping).toBeCloseTo(N * r * RETURN_SHIP, 6);
	});

	it('三类全为 0 时没有退款：净收入就是成交额、净货品成本就是全部货款', () => {
		const { metrics } = computeRoi({
			...EXAMPLE_INPUTS,
			unshippedRefundRate: '0',
			shippedRefundRate: '0',
			inTransitRefundRate: '0'
		});
		if (!metrics) return;
		expect(metrics.returnedAmount).toBe(0);
		expect(metrics.netRevenue).toBeCloseTo(G, 6);
		expect(metrics.netGoodsCost).toBeCloseTo(G * COST, 6);
		expect(metrics.forwardShipping).toBeCloseTo(N * SHIP, 6);
		expect(metrics.reverseShipping).toBe(0);
	});
});

describe('退货不是全损', () => {
	it('净货品成本 = 发出成本 − 收回的货值', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.netGoodsCost).toBeCloseTo(metrics.grossGoodsCost - metrics.recoveredGoodsValue, 6);
		expect(metrics.netGoodsCost).toBeCloseTo(2796 - 515.163, 6);
	});

	it('收回比例为 0 时只有签收后退货变全损，在途件仍按完好收回', () => {
		const withRecover = computeRoi(EXAMPLE_INPUTS);
		const allLoss = computeRoi({ ...EXAMPLE_INPUTS, recoverRate: '0' });
		if (!withRecover.metrics || !allLoss.metrics) return;
		// 「全损」也不会归零：在途那部分原封返回，压根不走这个比例
		expect(allLoss.metrics.recoveredGoodsValue).toBeCloseTo(G * COST * T, 6);
		expect(allLoss.metrics.damagedGoodsCost).toBeCloseTo(G * COST * SIGNED, 6);
		// 两者的净利差 = 签收退货那一类少收回的货值
		expect(withRecover.metrics.netProfit - allLoss.metrics.netProfit).toBeCloseTo(G * COST * SIGNED * RECOVER, 6);
	});
});

describe('退款这笔账的真损失', () => {
	it('真损失只含残损 + 逆向物流（佣金退还时），未发货那一类不产生损失', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.returnLoss).toBeCloseTo(metrics.damagedGoodsCost + metrics.reverseShipping, 6);
		expect(metrics.returnLoss).toBeCloseTo(9.087 + 15, 6);
	});

	it('未发货退款白花的推广费 = 广告费 × 未发货退款率，且不进利润表', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.wastedAdCost).toBeCloseTo(AD * U, 6);
		expect(metrics.wastedAdCost).toBeCloseTo(233, 6);
	});

	it('佣金不退还时只对**已发货**退款抽佣，未发货那部分平台必然退佣', () => {
		const refunded = computeRoi(EXAMPLE_INPUTS);
		const notRefunded = computeRoi({ ...EXAMPLE_INPUTS, commissionRefunded: false });
		if (!refunded.metrics || !notRefunded.metrics) return;
		// 加出来的是「在途 + 签收后」那一块，不是退款总额
		expect(notRefunded.metrics.commission - refunded.metrics.commission).toBeCloseTo(G * M * COMMISSION, 6);
		expect(notRefunded.metrics.returnLoss - refunded.metrics.returnLoss).toBeCloseTo(G * M * COMMISSION, 6);
		expect(notRefunded.metrics.netProfit).toBeLessThan(refunded.metrics.netProfit);
	});
});

describe('computeRoi 的指标与保本线', () => {
	it('示例盘的净收入、净利与四个 ROI', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		// 贡献利润是**净收入**减掉各项成本（不是成交额），差额就是退掉的那 2446.5
		const contribution = 4543.5 - 2280.837 - 227.175 - 240 - 15;
		const netProfit = contribution - AD;
		expect(metrics.netRevenue).toBeCloseTo(4543.5, 6);
		expect(metrics.contributionProfit).toBeCloseTo(contribution, 6);
		expect(metrics.netProfit).toBeCloseTo(netProfit, 6);
		expect(metrics.netProfit).toBeCloseTo(615.488, 6);
		expect(metrics.adRoas).toBeCloseTo(6, 6);
		expect(metrics.netRoas).toBeCloseTo(4543.5 / AD, 6);
		expect(metrics.adRoi).toBeCloseTo(netProfit / AD, 6);
		expect(metrics.businessRoi).toBeCloseTo(netProfit / (AD + 2280.837), 6);
	});

	it('保本 ROAS 是「净利归零」的那个点，广告费上限就是贡献利润', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.breakEvenRoas).toBeCloseTo(G / metrics.contributionProfit, 6);
		expect(metrics.maxAdCost).toBeCloseTo(metrics.contributionProfit, 6);

		// 把广告费顶到上限，净利应当归零
		const atCeiling = computeRoi({ ...EXAMPLE_INPUTS, adCost: String(metrics.maxAdCost) });
		expect(atCeiling.metrics?.netProfit).toBeCloseTo(0, 6);
	});

	it('客单价由成交额与订单数推出；订单数为 0 时不给 Infinity', () => {
		const { metrics } = computeRoi({ ...EXAMPLE_INPUTS, orders: '0' });
		expect(metrics?.aov).toBe(0);
	});

	it('广告费为 0 时 ROAS 是 Infinity（无中生有），不返回 NaN', () => {
		const { metrics } = computeRoi({ ...EXAMPLE_INPUTS, adCost: '0' });
		expect(metrics?.adRoas).toBe(Number.POSITIVE_INFINITY);
		expect(Number.isNaN(metrics?.netProfit ?? Number.NaN)).toBe(false);
	});

	it('毛利率为负时保本线不存在（Infinity），说明「投多少都亏」', () => {
		// 成本率拉到 90%，扣完佣金物流必然为负
		const { metrics } = computeRoi({ ...EXAMPLE_INPUTS, costRate: '90' });
		if (!metrics) return;
		expect(metrics.contributionProfit).toBeLessThan(0);
		expect(metrics.breakEvenRoas).toBe(Number.POSITIVE_INFINITY);
	});

	it('空盘不产生错误，只算出全 0（让页面走空态而不是报错）', () => {
		const result = computeRoi(EMPTY_INPUTS);
		expect(result.error).toBe('');
		expect(result.metrics?.netProfit).toBe(0);
	});
});

describe('三个利润率与三层保本线', () => {
	it('毛利率只看货（= 1 − 成本率），不受退款影响', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.grossMargin).toBeCloseTo(1 - COST, 10);
		// 退款率怎么改，毛利率都不动 —— 它是「商品本身赚多少」，退货的账在第二格里
		const noRefund = computeRoi({
			...EXAMPLE_INPUTS,
			unshippedRefundRate: '0',
			shippedRefundRate: '0',
			inTransitRefundRate: '0'
		});
		expect(noRefund.metrics?.grossMargin).toBeCloseTo(metrics.grossMargin, 10);
	});

	it('三层口径一层比一层薄，净利最薄', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.returnAdjustedMargin).toBeCloseTo((4543.5 - 2280.837) / G, 10);
		expect(metrics.netMarginOnGmv).toBeCloseTo(615.488 / G, 10);
		expect(metrics.grossMargin).toBeGreaterThan(metrics.returnAdjustedMargin);
		expect(metrics.returnAdjustedMargin).toBeGreaterThan(metrics.netMarginOnGmv);
	});

	it('保本 ROAS 三层口径一层比一层高（漏算成本会让线偏低）', () => {
		const { metrics } = computeRoi(EXAMPLE_INPUTS);
		if (!metrics) return;
		expect(metrics.breakEvenRoasSimple).toBeCloseTo(1 / (1 - COST), 10);
		expect(metrics.breakEvenRoasWithReturn).toBeCloseTo(G / (4543.5 - 2280.837), 10);
		expect(metrics.breakEvenRoasSimple).toBeLessThan(metrics.breakEvenRoasWithReturn);
		expect(metrics.breakEvenRoasWithReturn).toBeLessThan(metrics.breakEvenRoas);
	});
});
