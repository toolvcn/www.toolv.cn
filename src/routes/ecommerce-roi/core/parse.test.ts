// 输入解析的单测：两种口径的入口、两处「填法切换时的数字换算」、空态与示例态判定。
// 基准用例就是页面上的示例（一款成本率 50%、退货率 35% 的商品盘），README 里逐项列过，
// 改示例要同步改这里。
import { describe, expect, it } from 'vitest';
import {
	carryRefundTexts,
	convertAdText,
	convertCostText,
	convertOrdersText,
	convertRefundTexts,
	isEmptyInputs,
	isEmptyUnitInputs,
	isExampleInputs,
	isExampleUnitInputs,
	parseInputs,
	parseUnitInputs
} from './parse.ts';
import { computeMetrics, computeRoi } from './metrics.ts';
import { EMPTY_INPUTS, EXAMPLE_INPUTS, UNIT_EMPTY_INPUTS, UNIT_EXAMPLE_INPUTS } from '../config.ts';

describe('parseInputs', () => {
	it('百分数换算成小数，空串按 0', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, unshippedRefundRate: '25', otherCost: '' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.unshippedRefundRate).toBeCloseTo(0.25, 10);
		expect(parsed.inputs.otherCost).toBe(0);
	});

	it('容忍千分位逗号与首尾空白', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, gmv: ' 9,900 ' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.gmv).toBe(9900);
	});

	it('负数与非数字都拒掉，并说清是哪一项', () => {
		const negative = parseInputs({ ...EXAMPLE_INPUTS, adCost: '-1' });
		expect(negative).toEqual({ ok: false, error: '广告花费要填一个不小于 0 的数字', field: 'adCost' });

		const text = parseInputs({ ...EXAMPLE_INPUTS, orders: '一百' });
		expect(text.ok).toBe(false);
		if (text.ok) return;
		expect(text.error).toContain('订单数');
	});

	it('每条错误都指回该标红的那一格（页面据此把红字挂到字段上，而不是只报一句）', () => {
		expect(parseInputs({ ...EXAMPLE_INPUTS, orders: '一百' })).toMatchObject({ field: 'orders' });
		expect(parseInputs({ ...EXAMPLE_INPUTS, shipCost: '-' })).toMatchObject({ field: 'shipCost' });
		expect(parseInputs({ ...EXAMPLE_INPUTS, otherCost: '-' })).toMatchObject({ field: 'otherCost' });
		expect(parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '35', orders: '' })).toMatchObject({
			field: 'costRate'
		});
		expect(parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, unitCost: '-' })).toMatchObject({ field: 'unitCost' });
		expect(parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, commissionRate: '-' })).toMatchObject({
			field: 'commissionRate'
		});
	});

	it('比率超过 100% 直接报错，不当成 1.5 倍用', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, recoverRate: '120' });
		expect(parsed).toEqual({
			ok: false,
			error: '退货能收回的货款比例不能超过 100%',
			field: 'recoverRate'
		});
	});

	it('金额大到不真实时拒掉，而不是溢出成 Infinity / NaN', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, adCost: '9'.repeat(20) });
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('广告花费');
		expect(parsed.error).toContain('数值过大');
	});

	it('成本按「元/件」填时，用客单价（成交额 ÷ 订单数）折算成成本率', () => {
		// 6990 元 ÷ 100 单 = 客单价 69.9 元；34.95 元/件 正好是成本率 50%
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '34.95' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.costRate).toBeCloseTo(0.5, 10);
	});

	it('成本按「元/件」填、进价高过售价时算出负毛利率，而不是弹错拦住', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '80' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.costRate).toBeGreaterThan(1);
		expect(computeMetrics(parsed.inputs).grossMargin).toBeLessThan(0);
	});

	it('成本按「元/件」填但拿不到客单价时，说清要先填成交额与订单数', () => {
		const noOrders = parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '35', orders: '' });
		expect(noOrders.ok).toBe(false);
		if (noOrders.ok) return;
		expect(noOrders.error).toContain('成交额与订单数');
	});

	it('成本按「元/件」填 0 时不要求客单价，直接按 0 成本率算', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '0', gmv: '', orders: '' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.costRate).toBe(0);
	});

	it('100% 上限只管「按比例」这一路，两路的报错文案各说各的', () => {
		expect(parseInputs({ ...EXAMPLE_INPUTS, costMode: 'rate', costRate: '120' })).toEqual({
			ok: false,
			error: '商品成本率不能超过 100%',
			field: 'costRate'
		});
		expect(parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '120' }).ok).toBe(true);
	});
});

describe('切换成本填法时的数字换算', () => {
	it('按比例 → 按金额：50% 在客单价 69.9 元下就是 34.95 元/件', () => {
		expect(convertCostText({ ...EXAMPLE_INPUTS, costRate: '50' }, 'unit')).toBe('34.95');
	});

	it('按金额 → 按比例：34.95 元/件 换回 50%', () => {
		expect(convertCostText({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '34.95' }, 'rate')).toBe('50');
	});

	it('拿不到客单价时原样返回，不猜', () => {
		expect(convertCostText({ ...EXAMPLE_INPUTS, costRate: '50', orders: '' }, 'unit')).toBe('50');
		expect(convertCostText({ ...EXAMPLE_INPUTS, costRate: '50', gmv: '0' }, 'unit')).toBe('50');
	});

	it('空框与非数字原样返回，不变成 NaN', () => {
		expect(convertCostText({ ...EXAMPLE_INPUTS, costRate: '' }, 'unit')).toBe('');
		expect(convertCostText({ ...EXAMPLE_INPUTS, costRate: '-' }, 'unit')).toBe('-');
	});

	it('换算出来的文本再解析回去，成本率还是原来那个（只差两位小数的漂移）', () => {
		const text = convertCostText({ ...EXAMPLE_INPUTS, costRate: '37.5' }, 'unit');
		expect(text).toBe('26.21');
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: text });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.costRate).toBeCloseTo(0.375, 2);
	});
});

describe('订单数的两种填法（订单数 / 客单价）', () => {
	it('按客单价填：订单数 = 成交额 ÷ 客单价，两个口径算出同一盘', () => {
		const aov = parseInputs({ ...EXAMPLE_INPUTS, ordersMode: 'aov', orders: '69.9' });
		expect(aov.ok).toBe(true);
		if (!aov.ok) return;
		expect(aov.inputs.orders).toBeCloseTo(100, 10);

		const byCount = parseInputs({ ...EXAMPLE_INPUTS, ordersMode: 'count', orders: '100' });
		expect(byCount.ok).toBe(true);
		if (!byCount.ok) return;
		expect(computeMetrics(aov.inputs).netProfit).toBeCloseTo(computeMetrics(byCount.inputs).netProfit, 6);
	});

	it('客单价填 0 会除出 Infinity，拦下来并说清是客单价', () => {
		expect(parseInputs({ ...EXAMPLE_INPUTS, ordersMode: 'aov', orders: '0' })).toEqual({
			ok: false,
			error: '客单价要大于 0',
			field: 'orders'
		});
	});

	it('没填客单价按「没填」处理，不报错也不算出一盘假数', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, ordersMode: 'aov', orders: '' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.orders).toBe(0);
	});

	it('按客单价填时，成本按「元/件」仍算得对（客单价取自折算后的订单数，不是原始文本）', () => {
		const parsed = parseInputs({
			...EXAMPLE_INPUTS,
			ordersMode: 'aov',
			orders: '69.9',
			costMode: 'unit',
			costRate: '34.95'
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		// 34.95 元/件 ÷ 客单价 69.9 元 = 成本率 50%
		expect(parsed.inputs.costRate).toBeCloseTo(0.5, 10);
	});

	it('按客单价填成本却拿不到客单价时，提示要说「客单价」而不是「订单数」', () => {
		const parsed = parseInputs({
			...EXAMPLE_INPUTS,
			ordersMode: 'aov',
			orders: '',
			costMode: 'unit',
			costRate: '34.95'
		});
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('成交额与客单价');
	});

	it('切换填法时数字跟着换算：两个方向都是「成交额 ÷ 当前值」', () => {
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, ordersMode: 'count', orders: '100' })).toBe('69.9');
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, ordersMode: 'aov', orders: '69.9' })).toBe('100');
	});

	it('拿不到成交额、空框、0 值一律原样返回，不猜也不变成 NaN', () => {
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, orders: '100', gmv: '0' })).toBe('100');
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, orders: '' })).toBe('');
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, orders: '0' })).toBe('0');
		expect(convertOrdersText({ ...EXAMPLE_INPUTS, orders: '-' })).toBe('-');
	});
});

describe('广告的两种填法（广告花费 / 广告 ROAS）', () => {
	it('按 ROAS 填时换算成广告花费：6990 ÷ 6 = 1165', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.adCost).toBeCloseTo(1165, 10);
	});

	it('两种填法算出来的指标完全一致（ROAS 6 与广告费 1165 是同一条盘）', () => {
		const byCost = computeRoi({ ...EXAMPLE_INPUTS, adMode: 'cost', adCost: '1165' });
		const byRoas = computeRoi({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' });
		expect(byRoas.metrics?.netProfit).toBeCloseTo(byCost.metrics?.netProfit ?? Number.NaN, 10);
		expect(byRoas.metrics?.adRoas).toBeCloseTo(6, 10);
	});

	it('ROAS 填 0 或空按「没有这笔广告费」算，跟金额口径的空串同义', () => {
		const zero = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '0' });
		const empty = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '' });
		expect(zero.ok && zero.inputs.adCost).toBe(0);
		expect(empty.ok && empty.inputs.adCost).toBe(0);
	});

	it('ROAS 填负数或非数字时，报错要指名「广告 ROAS」而不是「广告花费」', () => {
		const negative = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '-1' });
		// 标签以字母结尾，消息里补一个空格（否则「ROAS要填」粘在一起）
		expect(negative).toEqual({ ok: false, error: '广告 ROAS 要填一个不小于 0 的数字', field: 'adCost' });
	});

	it('按 ROAS 填但拿不到成交额时，说清要先填成交额', () => {
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6', gmv: '' });
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('成交额');
	});

	it('切换填法时数字跟着换算，两个方向都是「成交额 ÷ 当前值」', () => {
		expect(convertAdText({ ...EXAMPLE_INPUTS, adMode: 'cost', adCost: '1165' })).toBe('6');
		expect(convertAdText({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' })).toBe('1165');
		// 换算过再解析回去，广告费还是原来那个
		const parsed = parseInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: convertAdText(EXAMPLE_INPUTS) });
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.adCost).toBeCloseTo(1165, 6);
	});

	it('拿不到成交额、空框、0 值一律原样返回，不猜也不变成 NaN', () => {
		expect(convertAdText({ ...EXAMPLE_INPUTS, adCost: '1165', gmv: '' })).toBe('1165');
		expect(convertAdText({ ...EXAMPLE_INPUTS, adCost: '' })).toBe('');
		expect(convertAdText({ ...EXAMPLE_INPUTS, adCost: '0' })).toBe('0');
		expect(convertAdText({ ...EXAMPLE_INPUTS, adCost: '-' })).toBe('-');
	});

	it('老预设没有 adMode 时按「填的是元」处理，数字原样算回同一组指标', () => {
		// 略过类型：模拟老文件（那时 RoiTextInputs 里还没有 adMode）
		const legacy = { ...EXAMPLE_INPUTS, adMode: undefined } as unknown as typeof EXAMPLE_INPUTS;
		const parsed = parseInputs(legacy);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.adCost).toBe(1165);
	});
});

describe('退款的两种填法（退款率 / 退款金额）', () => {
	it('按金额填时，用成交额折回退款率', () => {
		// 6990 元 × 20% = 1398 元、15% = 1048.5 元、5% = 349.5 元
		const parsed = parseInputs({
			...EXAMPLE_INPUTS,
			refundMode: 'amount',
			unshippedRefundRate: '1398',
			shippedRefundRate: '1048.5',
			inTransitRefundRate: '139.8'
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.unshippedRefundRate).toBeCloseTo(0.2, 10);
		expect(parsed.inputs.shippedRefundRate).toBeCloseTo(0.15, 10);
		expect(parsed.inputs.inTransitRefundRate).toBeCloseTo(0.02, 10);

		// 与按率填的示例是同一组数：两种填法必须算出同一盘账
		const byRate = parseInputs(EXAMPLE_INPUTS);
		expect(byRate.ok).toBe(true);
		if (!byRate.ok) return;
		expect(computeMetrics(parsed.inputs).netProfit).toBeCloseTo(computeMetrics(byRate.inputs).netProfit, 10);
	});

	it('按金额填 0 时不需要成交额，直接按 0 算', () => {
		const parsed = parseInputs({
			...EXAMPLE_INPUTS,
			refundMode: 'amount',
			unshippedRefundRate: '0',
			shippedRefundRate: '0',
			inTransitRefundRate: '0',
			gmv: ''
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.unshippedRefundRate).toBe(0);
	});

	it('按金额填但还没有成交额时，说清要先把成交额填好', () => {
		const parsed = parseInputs({
			...EXAMPLE_INPUTS,
			refundMode: 'amount',
			unshippedRefundRate: '1398',
			gmv: ''
		});
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('要先把成交额填好');
	});

	it('退款金额超过成交额（等于率超过 100%）时拒掉，不悄悄算出负的净收入', () => {
		expect(parseInputs({ ...EXAMPLE_INPUTS, refundMode: 'amount', unshippedRefundRate: '6991' })).toEqual({
			ok: false,
			error: '未发货退款金额不能超过成交额',
			field: 'unshippedRefundRate'
		});
	});

	it('在途高于已发货时按用户填的单位报，不在错误里把「元」换算成百分比', () => {
		expect(parseInputs({ ...EXAMPLE_INPUTS, shippedRefundRate: '10', inTransitRefundRate: '15' })).toEqual({
			ok: false,
			error: '在途退款率不能高于已发货退款率（15% > 10%）—— 在途件是已发货退款里的一部分',
			field: 'inTransitRefundRate'
		});

		const byAmount = parseInputs({
			...EXAMPLE_INPUTS,
			refundMode: 'amount',
			shippedRefundRate: '699',
			inTransitRefundRate: '1048.5'
		});
		expect(byAmount.ok).toBe(false);
		if (byAmount.ok) return;
		expect(byAmount.error).toContain('在途退款金额不能高于已发货退款金额');
		expect(byAmount.error).toContain('1048.5 元 > 699 元');
	});

	it('切换填法时三格一起换算数字，不静默改变含义', () => {
		expect(convertRefundTexts(EXAMPLE_INPUTS, 'amount', 6990)).toEqual({
			unshippedRefundRate: '1398',
			shippedRefundRate: '1048.5',
			inTransitRefundRate: '139.8'
		});
		expect(
			convertRefundTexts(
				{
					...EXAMPLE_INPUTS,
					refundMode: 'amount',
					unshippedRefundRate: '1398',
					shippedRefundRate: '1048.5',
					inTransitRefundRate: '139.8'
				},
				'rate',
				6990
			)
		).toEqual({ unshippedRefundRate: '20', shippedRefundRate: '15', inTransitRefundRate: '2' });
	});

	it('带入另一口径的退款参数：源先折成率，再按目标自己的填法写回', () => {
		// 整盘（按率、成交额 6990）→ 单件（按率、售价 69.9）：率与口径无关，字符串也不变
		expect(carryRefundTexts(EXAMPLE_INPUTS, 6990, UNIT_EXAMPLE_INPUTS, 69.9)).toEqual({
			ok: true,
			unshippedRefundRate: '20',
			shippedRefundRate: '15',
			inTransitRefundRate: '2'
		});

		// 单件（按率）→ 整盘（按金额）：按**整盘的**成交额折成元（不是把 20 直接抄过去）
		expect(carryRefundTexts(UNIT_EXAMPLE_INPUTS, 69.9, { ...EXAMPLE_INPUTS, refundMode: 'amount' }, 6990)).toEqual({
			ok: true,
			unshippedRefundRate: '1398',
			shippedRefundRate: '1048.5',
			inTransitRefundRate: '139.8'
		});

		// 源按金额填：金额跟口径绑死，必须先折成率再搬
		const fromAmount = {
			...EXAMPLE_INPUTS,
			refundMode: 'amount' as const,
			unshippedRefundRate: '1398',
			shippedRefundRate: '1048.5',
			inTransitRefundRate: '139.8'
		};
		expect(carryRefundTexts(fromAmount, 6990, UNIT_EXAMPLE_INPUTS, 69.9)).toMatchObject({
			ok: true,
			unshippedRefundRate: '20',
			shippedRefundRate: '15'
		});
	});

	it('搬不动时给原因，不硬塞一个值', () => {
		// 源三格都没填
		expect(
			carryRefundTexts(
				{ ...EXAMPLE_INPUTS, unshippedRefundRate: '', shippedRefundRate: '', inTransitRefundRate: '' },
				6990,
				UNIT_EXAMPLE_INPUTS,
				69.9
			)
		).toMatchObject({ ok: false });
		// 源本身有非法值
		expect(
			carryRefundTexts({ ...EXAMPLE_INPUTS, unshippedRefundRate: '-' }, 6990, UNIT_EXAMPLE_INPUTS, 69.9)
		).toMatchObject({ ok: false });
		// 目标按金额填却拿不到成交额 —— 折不出金额，宁可不动手
		expect(carryRefundTexts(UNIT_EXAMPLE_INPUTS, 69.9, { ...EXAMPLE_INPUTS, refundMode: 'amount' }, 0)).toMatchObject({
			ok: false
		});
	});

	it('拿不到成交额、空框、非数字一律原样返回，不猜也不变成 NaN', () => {
		expect(convertRefundTexts(EXAMPLE_INPUTS, 'amount', Number.NaN)).toEqual({
			unshippedRefundRate: '20',
			shippedRefundRate: '15',
			inTransitRefundRate: '2'
		});
		const empty = convertRefundTexts({ ...EXAMPLE_INPUTS, unshippedRefundRate: '' }, 'amount', 6990);
		expect(empty.unshippedRefundRate).toBe('');
		const nan = convertRefundTexts({ ...EXAMPLE_INPUTS, unshippedRefundRate: '-' }, 'amount', 6990);
		expect(nan.unshippedRefundRate).toBe('-');
	});
});

describe('单件口径', () => {
	it('换算成「订单数 = 1、广告费 = 0」的等价整盘输入', () => {
		const parsed = parseUnitInputs(UNIT_EXAMPLE_INPUTS);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.orders).toBe(1);
		expect(parsed.inputs.gmv).toBeCloseTo(Number(UNIT_EXAMPLE_INPUTS.price), 10);
		// 成本率 = 单件成本 ÷ 售价（35 ÷ 69.9 ≈ 50.07%，不必等于整盘示例的 50%）
		expect(parsed.inputs.costRate).toBeCloseTo(
			Number(UNIT_EXAMPLE_INPUTS.unitCost) / Number(UNIT_EXAMPLE_INPUTS.price),
			10
		);
		// 单件口径算的是广告费之前的账：这一项恒为 0，于是 ROAS 是 Infinity
		expect(parsed.inputs.adCost).toBe(0);
		expect(computeMetrics(parsed.inputs).adRoas).toBe(Number.POSITIVE_INFINITY);
	});

	it('单件口径 ≡ 等价整盘输入（订单数=1、广告费=0），与整盘示例不必数字相等', () => {
		const unitParsed = parseUnitInputs(UNIT_EXAMPLE_INPUTS);
		expect(unitParsed.ok).toBe(true);
		if (!unitParsed.ok) return;
		const unit = computeMetrics(unitParsed.inputs);

		// 单件把一单商品折算成整盘：订单数 = 1、成交额 = 售价、广告费 = 0
		expect(unitParsed.inputs.orders).toBe(1);
		expect(unitParsed.inputs.gmv).toBeCloseTo(Number(UNIT_EXAMPLE_INPUTS.price), 10);
		expect(unitParsed.inputs.adCost).toBe(0);
		// 成本率 = 单件成本 ÷ 售价（此处 35 ÷ 69.9 ≈ 50.07%，不必等于整盘示例的 50%）
		expect(unitParsed.inputs.costRate).toBeCloseTo(
			Number(UNIT_EXAMPLE_INPUTS.unitCost) / Number(UNIT_EXAMPLE_INPUTS.price),
			10
		);

		// 折算前后同一套公式：广告费恒为 0，净利 = 贡献利润，ROAS 无定义
		expect(unit.netProfit).toBeCloseTo(unit.contributionProfit, 10);
		expect(unit.adRoas).toBe(Number.POSITIVE_INFINITY);

		// 与整盘示例只共享模型、不共享数字：成本率不同（50% vs 50.07%）
		// 所以不再断言「单件净值 = 整盘净值 / 100 + 1165/100」这类逐位相等
	});

	it('售价为零拒掉；单件成本高于售价**不拦** —— 赔本卖是真实经营状况，该算出负利润', () => {
		expect(parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, price: '0' })).toEqual({
			ok: false,
			error: '售价要大于 0',
			field: 'price'
		});
		// 120 元的进价卖 69.9：成本率 171.67%，照常解析出来，由下游给出「卖一件亏一件」。
		// 这条上限原先有（报「单件成本不能高于售价」），2026-09 撤掉：整盘那格「按金额」填成本
		// 本来就不卡（进价高过售价是清库存 / 引流款的真实处境），两个口径不该两种处理。
		const over = parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, unitCost: '120' });
		expect(over.ok).toBe(true);
		if (!over.ok) return;
		expect(over.inputs.costRate).toBeCloseTo(120 / 69.9, 10);
		expect(computeMetrics(over.inputs).contributionProfit).toBeLessThan(0);
	});

	it('售价与成本都空才算空态（只填一个不算）', () => {
		expect(isEmptyUnitInputs(UNIT_EMPTY_INPUTS)).toBe(true);
		expect(isEmptyUnitInputs({ ...UNIT_EMPTY_INPUTS, price: '99' })).toBe(false);
	});

	it('售价空着与真的填了 0 也给不同提示', () => {
		const empty = parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, price: '' });
		expect(empty.ok).toBe(false);
		if (empty.ok) return;
		expect(empty.error).toBe('先填售价（元/件）');

		const zero = parseUnitInputs({ ...UNIT_EXAMPLE_INPUTS, price: '0' });
		expect(zero.ok).toBe(false);
		if (zero.ok) return;
		expect(zero.error).toBe('售价要大于 0');
	});

	it('退款按金额填时，金额是「每件退多少」，用售价折回率', () => {
		// 售价 69.9：20% = 13.98 元、15% = 10.485 元、2% = 1.398 元
		const parsed = parseUnitInputs({
			...UNIT_EXAMPLE_INPUTS,
			refundMode: 'amount',
			unshippedRefundRate: '13.98',
			shippedRefundRate: '10.485',
			inTransitRefundRate: '1.398'
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.inputs.unshippedRefundRate).toBeCloseTo(0.2, 10);
		expect(parsed.inputs.shippedRefundRate).toBeCloseTo(0.15, 10);
		expect(parsed.inputs.inTransitRefundRate).toBeCloseTo(0.02, 10);
	});
});

describe('空态', () => {
	it('三个主字段都空才算空态，只填一个不算', () => {
		expect(isEmptyInputs(EMPTY_INPUTS)).toBe(true);
		expect(isEmptyInputs({ ...EMPTY_INPUTS, gmv: '100' })).toBe(false);
		expect(isEmptyInputs({ ...EMPTY_INPUTS, costRate: '35' })).toBe(true);
	});
});

describe('示例态', () => {
	it('原封不动时是示例，改动任何一项就不再算示例', () => {
		expect(isExampleInputs(EXAMPLE_INPUTS)).toBe(true);
		expect(isExampleInputs({ ...EXAMPLE_INPUTS, gmv: '6991' })).toBe(false);
		// 开关也算一项：它是示例的一部分
		expect(isExampleInputs({ ...EXAMPLE_INPUTS, commissionRefunded: false })).toBe(false);
		expect(EMPTY_INPUTS.gmv === EXAMPLE_INPUTS.gmv).toBe(false);
	});

	it('单件示例同理', () => {
		expect(isExampleUnitInputs(UNIT_EXAMPLE_INPUTS)).toBe(true);
		expect(isExampleUnitInputs({ ...UNIT_EXAMPLE_INPUTS, price: '100' })).toBe(false);
	});
});
