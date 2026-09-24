// 复制摘要里「我填了什么」那几行的单测：回显原始字符串、没填的整项不出现。
import { describe, expect, it } from 'vitest';
import { summaryInputs, summaryUnitInputs } from './summary.ts';
import { EMPTY_INPUTS, EXAMPLE_INPUTS, UNIT_EMPTY_INPUTS, UNIT_EXAMPLE_INPUTS } from '../config.ts';

describe('summaryInputs', () => {
	it('回显原始字符串，按用户填的口径说', () => {
		const lines = summaryInputs(EXAMPLE_INPUTS, '');
		// 广告按花费填就说花费；按 ROAS 填就说 ROAS（不换算成 1165）
		expect(lines.join('\n')).toContain('广告花费 1165 元');
		expect(lines.join('\n')).toContain('商品成本率 50%');
		expect(summaryInputs({ ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' }, '').join('\n')).toContain('广告 ROAS 6');
		expect(summaryInputs({ ...EXAMPLE_INPUTS, costMode: 'unit', costRate: '34.95' }, '').join('\n')).toContain(
			'单件成本 34.95 元/件'
		);
	});

	it('佣金带上「退款退不退」：它决定按成交额还是按净收入抽', () => {
		expect(summaryInputs(EXAMPLE_INPUTS, '').join('\n')).toContain('平台佣金率 5%（退款退还）');
		expect(summaryInputs({ ...EXAMPLE_INPUTS, commissionRefunded: false }, '').join('\n')).toContain(
			'平台佣金率 5%（退款不退还）'
		);
	});

	it('没填的项整项不出现（空串 ≠ 填了 0），整组空就整组不出现', () => {
		const lines = summaryInputs({ ...EMPTY_INPUTS, gmv: '1000' }, '');
		expect(lines).toHaveLength(1);
		expect(lines[0]).toBe('成交与广告：成交额 1000 元');
	});

	it('目标净利只在填了的时候出现', () => {
		expect(summaryInputs(EXAMPLE_INPUTS, '').join('\n')).not.toContain('目标净利');
		expect(summaryInputs(EXAMPLE_INPUTS, '500').join('\n')).toContain('目标净利 500 元');
	});

	it('订单数那格按客单价填时回显也说客单价 —— 不然会被照着当成单数复算', () => {
		const text = summaryInputs({ ...EXAMPLE_INPUTS, ordersMode: 'aov', orders: '69.9' }, '').join('\n');
		expect(text).toContain('客单价 69.9 元/单');
		expect(text).not.toContain('订单数');
	});

	it('目标按投产比填时回显也说投产比 —— 同一串「6」换口径不能读成同一件事', () => {
		const text = summaryInputs(EXAMPLE_INPUTS, '6', 'roas').join('\n');
		expect(text).toContain('假设投产比 6');
		expect(text).not.toContain('目标净利');
	});

	it('退款按金额填时回显也说金额（含「其中在途」），仍是原始字符串不换算', () => {
		const text = summaryInputs(
			{
				...EXAMPLE_INPUTS,
				refundMode: 'amount',
				unshippedRefundRate: '1398',
				shippedRefundRate: '1048.5',
				inTransitRefundRate: '349.5'
			},
			''
		).join('\n');
		expect(text).toContain('未发货退款金额 1398 元');
		expect(text).toContain('已发货退款金额 1048.5 元');
		expect(text).toContain('其中在途退款金额 349.5 元');
		// 换成金额口径后就不该再出现「退款率」这三个字
		expect(text).not.toContain('退款率');
	});
});

describe('summaryUnitInputs', () => {
	it('照单件口径的字段回显，单件口径没有广告费', () => {
		const text = summaryUnitInputs(UNIT_EXAMPLE_INPUTS, '', '').join('\n');
		expect(text).toContain('售价 69.9 元/件');
		expect(text).toContain('单件成本 35 元/件');
		expect(text).toContain(`单件退货成本 ${UNIT_EXAMPLE_INPUTS.returnShipCost} 元/件`);
		expect(text).not.toContain('广告');
	});

	it('目标净利率与试算 ROAS 只在填了的时候出现', () => {
		const text = summaryUnitInputs(UNIT_EXAMPLE_INPUTS, '20', '6').join('\n');
		expect(text).toContain('目标净利率 20%');
		expect(text).toContain('试算 ROAS 6');
		expect(summaryUnitInputs(UNIT_EXAMPLE_INPUTS, '', '').join('\n')).not.toContain('目标');
	});

	it('单件口径的退款按金额填，回显同样跟着走（金额是每件退多少）', () => {
		const text = summaryUnitInputs(
			{
				...UNIT_EXAMPLE_INPUTS,
				refundMode: 'amount',
				unshippedRefundRate: '13.98',
				shippedRefundRate: '10.485',
				inTransitRefundRate: '3.495'
			},
			'',
			''
		).join('\n');
		expect(text).toContain('未发货退款金额 13.98 元');
		expect(text).toContain('已发货退款金额 10.485 元');
		expect(text).toContain('其中在途退款金额 3.495 元');
	});

	it('全空时不产出任何行', () => {
		expect(summaryUnitInputs(UNIT_EMPTY_INPUTS, '', '')).toEqual([]);
	});
});
