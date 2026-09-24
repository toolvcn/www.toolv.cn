// 利率计算：贷款（等额本息 / 等额本金）与存款（单利 / 复利）。全是纯函数，不碰 DOM，node 环境直接单测。
//
// 两条最容易写错、实现里一直盯着的口径：
//   1. **金额一律按「分」存整数**：用「元」的浮点累加 360 期之后会对不上账，
//      而还款计划表正是要逐行核对的东西；界面要显示时再除以 100；
//   2. **尾差落在最后一期**：前 n−1 期按公式算，最后一期直接把剩余本金还完，
//      否则「每期本金加起来 ≠ 借款额」，表格最后一行会留一个除不干净的余额。
import { fail, ok, type Result } from '$lib/utils/result';

/** 还款方式：等额本息（月供固定）/ 等额本金（月供逐月递减） */
export type RepayMethod = 'equal-installment' | 'equal-principal';

/** 计息方式：单利（到期一次性）/ 复利（按年滚） */
export type DepositMode = 'simple' | 'compound';

/** 复利的计息频率：一年计几次 */
export type CompoundFreq = 1 | 4 | 12;

/** 金额上限（元）：再往上不是算不动，是没人会对着这种数核对还款计划 */
export const MAX_AMOUNT = 1_000_000_000;

/** 年利率上限（百分数） */
export const MAX_RATE = 100;

/** 期限上限（年）：贷款与存款共用，40 年覆盖房贷与长期存款 */
export const MAX_YEARS = 40;

/** 还款计划一次多显示多少期：360 期全渲染没必要，先给两年再按需展开 */
export const SCHEDULE_STEP = 24;

export const REPAY_OPTIONS: ReadonlyArray<{ value: RepayMethod; label: string }> = [
	{ value: 'equal-installment', label: '等额本息' },
	{ value: 'equal-principal', label: '等额本金' }
];

export const DEPOSIT_MODE_OPTIONS: ReadonlyArray<{ value: DepositMode; label: string }> = [
	{ value: 'compound', label: '复利' },
	{ value: 'simple', label: '单利' }
];

/** 复利频率：Dropdown 的 value 走字符串 */
export const FREQ_OPTIONS: ReadonlyArray<{ value: string; label: string; description: string }> = [
	{ value: '1', label: '按年', description: '一年计一次息' },
	{ value: '4', label: '按季', description: '一年计四次息' },
	{ value: '12', label: '按月', description: '一年计十二次息' }
];

export interface LoanInput {
	/** 借款额（分） */
	amountCents: number;
	/** 年利率，小数（4.2% 传 0.042） */
	annualRate: number;
	years: number;
	method: RepayMethod;
}

export interface ScheduleRow {
	/** 第几期，从 1 开始 */
	index: number;
	/** 当期月供（分） */
	payment: number;
	/** 当期还掉的本金（分） */
	principal: number;
	/** 当期利息（分） */
	interest: number;
	/** 还完这一期还剩多少本金（分） */
	balance: number;
}

export interface LoanSummary {
	months: number;
	/** 首月月供（分） */
	firstPayment: number;
	/** 末月月供（分）：等额本金下比首月低，等额本息下与首月同 */
	lastPayment: number;
	/** 等额本金每月递减多少（分）；等额本息恒为 0 */
	monthlyStep: number;
	totalInterest: number;
	/** 本息合计 = 借款额 + 总利息 */
	totalPayment: number;
	rows: ScheduleRow[];
}

export interface DepositInput {
	/** 本金（分） */
	amountCents: number;
	annualRate: number;
	years: number;
	mode: DepositMode;
	freq: CompoundFreq;
}

export interface DepositYearRow {
	year: number;
	/** 年初余额（分） */
	start: number;
	/** 当年利息（分） */
	interest: number;
	/** 年末余额（分） */
	end: number;
}

export interface DepositSummary {
	totalInterest: number;
	/** 到期本息（分） */
	total: number;
	/** 实际年化（小数）：复利按频率滚一年之后高于名义利率，单利就等于名义利率 */
	effectiveRate: number;
	rows: DepositYearRow[];
}

/** 等额本息的月供：P·r·(1+r)^n / ((1+r)^n − 1)；零利率时退化成 P/n */
export function equalInstallmentPayment(amountCents: number, monthlyRate: number, months: number): number {
	if (monthlyRate === 0) return Math.round(amountCents / months);
	const growth = Math.pow(1 + monthlyRate, months);
	return Math.round((amountCents * monthlyRate * growth) / (growth - 1));
}

/** 金额（元）→ 分。允许千分位逗号（从表格或网页上粘来的很常见） */
export function parseAmount(text: string): Result<number> {
	const raw = text.trim().replace(/,/g, '');
	if (raw === '') return fail('填一下金额');
	const value = Number(raw);
	if (!Number.isFinite(value)) return fail('金额得是数字');
	if (value <= 0) return fail('金额要大于 0');
	if (value > MAX_AMOUNT) return fail(`金额最多 ${MAX_AMOUNT} 元，再大也没法逐期核对了`);
	return ok(Math.round(value * 100));
}

/** 年利率（百分数）→ 小数 */
export function parseRate(text: string): Result<number> {
	const raw = text.trim();
	if (raw === '') return fail('填一下年利率');
	const value = Number(raw);
	if (!Number.isFinite(value)) return fail('年利率得是数字');
	if (value < 0) return fail('年利率不能是负数');
	if (value > MAX_RATE) return fail(`年利率最多 ${MAX_RATE}%`);
	return ok(value / 100);
}

/** 期限（年）→ 整数年 */
export function parseYears(text: string): Result<number> {
	const raw = text.trim();
	if (raw === '') return fail('填一下期限');
	const value = Number(raw);
	if (!Number.isFinite(value)) return fail('期限得是数字');
	if (!Number.isInteger(value)) return fail('期限按整年填');
	if (value < 1 || value > MAX_YEARS) return fail(`期限在 1 到 ${MAX_YEARS} 年之间`);
	return ok(value);
}

export function buildLoan(input: LoanInput): Result<LoanSummary> {
	const { amountCents, annualRate, years, method } = input;
	if (amountCents <= 0) return fail('金额要大于 0');
	if (annualRate < 0 || annualRate > 1) return fail('年利率在 0 到 100% 之间');
	if (!Number.isInteger(years) || years < 1 || years > MAX_YEARS) {
		return fail(`期限在 1 到 ${MAX_YEARS} 年之间`);
	}

	const months = years * 12;
	const monthlyRate = annualRate / 12;
	const perPeriod =
		method === 'equal-installment'
			? equalInstallmentPayment(amountCents, monthlyRate, months)
			: Math.round(amountCents / months);

	const rows: ScheduleRow[] = [];
	let balance = amountCents;
	let totalInterest = 0;
	for (let index = 1; index <= months; index += 1) {
		const interest = Math.round(balance * monthlyRate);
		// 等额本息下 perPeriod 是整期月供，本金 = 月供 − 利息；等额本金下它本身就是每期本金
		const principal =
			index === months
				? balance
				: method === 'equal-installment'
					? Math.max(0, Math.min(perPeriod - interest, balance))
					: Math.min(perPeriod, balance);
		balance -= principal;
		totalInterest += interest;
		rows.push({ index, payment: principal + interest, principal, interest, balance });
	}

	const first = rows[0];
	const last = rows[rows.length - 1];
	const second = rows[1];
	return ok({
		months,
		firstPayment: first?.payment ?? 0,
		lastPayment: last?.payment ?? 0,
		monthlyStep: method === 'equal-principal' && first && second ? first.payment - second.payment : 0,
		totalInterest,
		totalPayment: amountCents + totalInterest,
		rows
	});
}

export function buildDeposit(input: DepositInput): Result<DepositSummary> {
	const { amountCents, annualRate, years, mode, freq } = input;
	if (amountCents <= 0) return fail('金额要大于 0');
	if (annualRate < 0 || annualRate > 1) return fail('年利率在 0 到 100% 之间');
	if (!Number.isInteger(years) || years < 1 || years > MAX_YEARS) {
		return fail(`期限在 1 到 ${MAX_YEARS} 年之间`);
	}

	// 复利按频率滚一年之后的增长因子；单利逐年利息恒定，等于「本金 × 年利率」
	const yearFactor = mode === 'compound' ? Math.pow(1 + annualRate / freq, freq) : 1;
	const yearlySimple = Math.round(amountCents * annualRate);

	const rows: DepositYearRow[] = [];
	let balance = amountCents;
	let totalInterest = 0;
	for (let year = 1; year <= years; year += 1) {
		const start = balance;
		const interest = mode === 'compound' ? Math.round(start * yearFactor) - start : yearlySimple;
		balance = start + interest;
		totalInterest += interest;
		rows.push({ year, start, interest, end: balance });
	}

	return ok({
		totalInterest,
		total: balance,
		effectiveRate: mode === 'compound' ? yearFactor - 1 : annualRate,
		rows
	});
}

export interface InterestExample {
	id: string;
	label: string;
	description: string;
	mode: 'loan' | 'deposit';
	amount: string;
	rate: string;
	years: string;
	method: RepayMethod;
	depositMode: DepositMode;
	freq: CompoundFreq;
}

/** 示例：贷款两条各演示一种还款方式，存款两条演示复利与单利 */
export const INTEREST_EXAMPLES: ReadonlyArray<InterestExample> = [
	{
		id: 'mortgage',
		label: '房贷 100 万 · 30 年',
		description: '等额本息 · 年利率 4.2%',
		mode: 'loan',
		amount: '1000000',
		rate: '4.2',
		years: '30',
		method: 'equal-installment',
		depositMode: 'compound',
		freq: 1
	},
	{
		id: 'principal',
		label: '车贷 20 万 · 5 年',
		description: '等额本金 · 年利率 4.9%',
		mode: 'loan',
		amount: '200000',
		rate: '4.9',
		years: '5',
		method: 'equal-principal',
		depositMode: 'compound',
		freq: 1
	},
	{
		id: 'fixed',
		label: '定存 10 万 · 3 年',
		description: '复利按年 · 年利率 2.5%',
		mode: 'deposit',
		amount: '100000',
		rate: '2.5',
		years: '3',
		method: 'equal-installment',
		depositMode: 'compound',
		freq: 1
	},
	{
		id: 'demand',
		label: '存款 5 万 · 2 年',
		description: '单利 · 年利率 1.5%',
		mode: 'deposit',
		amount: '50000',
		rate: '1.5',
		years: '2',
		method: 'equal-installment',
		depositMode: 'simple',
		freq: 12
	}
];
