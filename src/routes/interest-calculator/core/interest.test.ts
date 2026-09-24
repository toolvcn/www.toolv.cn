import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent } from './format.ts';
import {
	buildDeposit,
	buildLoan,
	equalInstallmentPayment,
	MAX_YEARS,
	parseAmount,
	parseRate,
	parseYears
} from './interest.ts';

/** 元 → 分，测试里读起来更顺 */
const yuan = (value: number): number => Math.round(value * 100);

describe('输入解析', () => {
	it('金额按分收，允许千分位逗号', () => {
		expect(parseAmount('1000000')).toEqual({ ok: true, value: yuan(1_000_000) });
		expect(parseAmount(' 1,000 ')).toEqual({ ok: true, value: yuan(1000) });
	});

	it('金额非法时给中文原因', () => {
		expect(parseAmount('').ok).toBe(false);
		expect(parseAmount('abc').ok).toBe(false);
		expect(parseAmount('0').ok).toBe(false);
		expect(parseAmount('-500').ok).toBe(false);
		expect(parseAmount('2000000000').ok).toBe(false);
	});

	it('年利率百分数转小数', () => {
		expect(parseRate('4.2')).toEqual({ ok: true, value: 0.042 });
		expect(parseRate('0')).toEqual({ ok: true, value: 0 });
		expect(parseRate('-1').ok).toBe(false);
		expect(parseRate('101').ok).toBe(false);
	});

	it('期限按整年收', () => {
		expect(parseYears('30')).toEqual({ ok: true, value: 30 });
		expect(parseYears('0').ok).toBe(false);
		expect(parseYears('2.5').ok).toBe(false);
		expect(parseYears(String(MAX_YEARS + 1)).ok).toBe(false);
	});
});

describe('等额本息月供', () => {
	it('零利率退化成按期限均分', () => {
		expect(equalInstallmentPayment(yuan(120_000), 0, 12)).toBe(yuan(10_000));
	});

	it('月供落在公开房贷计算器的量级上（100 万 30 年 4.2% ≈ 4890 元）', () => {
		const payment = equalInstallmentPayment(yuan(1_000_000), 0.042 / 12, 360);
		expect(payment).toBeGreaterThan(yuan(4880));
		expect(payment).toBeLessThan(yuan(4900));
	});
});

describe('贷款还款计划', () => {
	it('等额本金：每期本金固定，利息随余额递减', () => {
		const result = buildLoan({
			amountCents: yuan(120_000),
			annualRate: 0.12,
			years: 1,
			method: 'equal-principal'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const { rows, monthlyStep, firstPayment, lastPayment, totalInterest } = result.value;
		expect(rows).toHaveLength(12);
		expect(rows[0]?.principal).toBe(yuan(10_000));
		expect(rows[0]?.interest).toBe(yuan(1200)); // 120000 × 1%
		expect(rows[1]?.interest).toBe(yuan(1100)); // 110000 × 1%
		expect(monthlyStep).toBe(yuan(100)); // 每月少付 10000 × 1%
		expect(firstPayment).toBeGreaterThan(lastPayment ?? 0);
		expect(totalInterest).toBe(yuan(7800)); // 1% × (120000 + … + 10000)
	});

	it('等额本息：月供逐期一致，只有末期可能有几分尾差', () => {
		const result = buildLoan({
			amountCents: yuan(120_000),
			annualRate: 0.12,
			years: 1,
			method: 'equal-installment'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const { firstPayment, lastPayment, monthlyStep, rows } = result.value;
		expect(monthlyStep).toBe(0);
		// 前 n−1 期严格等于月供：每期利息取整到分，累积的尾差全部落到最后一期
		expect(rows.slice(0, -1).every((row) => row.payment === firstPayment)).toBe(true);
		expect(Math.abs((lastPayment ?? 0) - firstPayment)).toBeLessThanOrEqual(100);
	});

	it('本金合计等于借款额，最后一期把余额还清', () => {
		const result = buildLoan({
			amountCents: yuan(1_000_000),
			annualRate: 0.042,
			years: 30,
			method: 'equal-installment'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const { rows, months, totalPayment, totalInterest } = result.value;
		expect(months).toBe(360);
		const principalSum = rows.reduce((sum, row) => sum + row.principal, 0);
		expect(principalSum).toBe(yuan(1_000_000));
		expect(rows[rows.length - 1]?.balance).toBe(0);
		expect(totalPayment - totalInterest).toBe(yuan(1_000_000));
	});

	it('零利率时不产生利息', () => {
		const result = buildLoan({ amountCents: yuan(60_000), annualRate: 0, years: 5, method: 'equal-installment' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.totalInterest).toBe(0);
		expect(result.value.firstPayment).toBe(yuan(1000));
	});

	it('非法输入不抛异常，给中文原因', () => {
		expect(buildLoan({ amountCents: 0, annualRate: 0.05, years: 10, method: 'equal-installment' }).ok).toBe(false);
		expect(buildLoan({ amountCents: yuan(1000), annualRate: 1.5, years: 10, method: 'equal-installment' }).ok).toBe(
			false
		);
		expect(buildLoan({ amountCents: yuan(1000), annualRate: 0.05, years: 0, method: 'equal-installment' }).ok).toBe(
			false
		);
		expect(
			buildLoan({ amountCents: yuan(1000), annualRate: 0.05, years: MAX_YEARS + 1, method: 'equal-installment' }).ok
		).toBe(false);
	});
});

describe('存款计息', () => {
	it('单利：每年利息恒定', () => {
		const result = buildDeposit({
			amountCents: yuan(100_000),
			annualRate: 0.02,
			years: 3,
			mode: 'simple',
			freq: 1
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.rows.map((row) => row.interest)).toEqual([yuan(2000), yuan(2000), yuan(2000)]);
		expect(result.value.totalInterest).toBe(yuan(6000));
		expect(result.value.total).toBe(yuan(106_000));
		expect(result.value.effectiveRate).toBeCloseTo(0.02, 10);
	});

	it('复利按年：利息逐年变大', () => {
		const result = buildDeposit({
			amountCents: yuan(100_000),
			annualRate: 0.02,
			years: 3,
			mode: 'compound',
			freq: 1
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.rows[0]?.interest).toBe(yuan(2000));
		expect(result.value.rows[1]?.interest).toBe(yuan(2040));
		expect(result.value.rows[2]?.interest).toBe(yuan(2080.8));
		expect(result.value.total).toBe(yuan(106_120.8));
	});

	it('复利频率越高，到期越多，实际年化高于名义利率', () => {
		const yearly = buildDeposit({
			amountCents: yuan(100_000),
			annualRate: 0.12,
			years: 1,
			mode: 'compound',
			freq: 1
		});
		const monthly = buildDeposit({
			amountCents: yuan(100_000),
			annualRate: 0.12,
			years: 1,
			mode: 'compound',
			freq: 12
		});
		expect(yearly.ok && monthly.ok).toBe(true);
		if (!yearly.ok || !monthly.ok) return;
		expect(monthly.value.total).toBeGreaterThan(yearly.value.total);
		expect(monthly.value.effectiveRate).toBeGreaterThan(0.12);
		expect(monthly.value.effectiveRate).toBeCloseTo(0.126825, 5);
	});

	it('上一年年末等于下一年年初', () => {
		const result = buildDeposit({
			amountCents: yuan(50_000),
			annualRate: 0.015,
			years: 5,
			mode: 'compound',
			freq: 4
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const rows = result.value.rows;
		for (let i = 1; i < rows.length; i += 1) {
			expect(rows[i]?.start).toBe(rows[i - 1]?.end);
		}
		expect(rows[rows.length - 1]?.end).toBe(result.value.total);
	});
});

describe('格式化', () => {
	it('金额按两位小数出元', () => {
		expect(formatMoney(yuan(4890.51))).toBe('4890.51');
		expect(formatMoney(0)).toBe('0.00');
		expect(formatMoney(-1200)).toBe('-12.00');
		expect(formatMoney(Number.NaN)).toBe('—');
	});

	it('百分数两位小数', () => {
		expect(formatPercent(0.042)).toBe('4.20%');
		expect(formatPercent(0)).toBe('0.00%');
	});
});
