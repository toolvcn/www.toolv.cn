// 利率计算器的编排层：一行输入（金额 / 年利率 / 期限）+ 方式选择，其余全是派生。模块级单例。
//
// 输入不合法时不抛异常、也不保留上一次的结果 —— 两块面板一起回到空态，原因只在状态条与输入框描边里说。
// 这条跟 /subnet-calculator 一致：宁可「空着 + 说清为什么」，也不要「结果还在、但它不是当前输入算的」。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import { formatMoney, formatPercent } from './format.ts';
import {
	buildDeposit,
	buildLoan,
	INTEREST_EXAMPLES,
	parseAmount,
	parseRate,
	parseYears,
	SCHEDULE_STEP,
	type CompoundFreq,
	type DepositMode,
	type DepositSummary,
	type LoanSummary,
	type RepayMethod,
	type ScheduleRow
} from './interest.ts';

export type Mode = 'loan' | 'deposit';

/**
 * 明细表的一行：贷款按月、存款按年，列不同所以在这一层摊平。
 * `payment`（月供）只有贷款用得上；存款那一栏读的是 `principal`（年初）与 `balance`（年末），
 * `payment` 与 `balance` 取同一个值，凑齐五个字段只为让两套表头共用一份行类型。
 */
export interface DetailRow {
	key: string;
	period: string;
	payment: string;
	principal: string;
	interest: string;
	balance: string;
}

class InterestStore {
	mode = $state<Mode>('loan');
	amountText = $state('1000000');
	rateText = $state('4.2');
	yearsText = $state('30');
	method = $state<RepayMethod>('equal-installment');
	depositMode = $state<DepositMode>('compound');
	freqText = $state('1');
	/** 明细表已显示多少行（渲染窗口：全部行都已算好，只是不一次全渲染） */
	shown = $state(SCHEDULE_STEP);

	// ---------------------------------------------------------------- 解析与校验

	readonly amount = $derived(parseAmount(this.amountText));
	readonly rate = $derived(parseRate(this.rateText));
	readonly years = $derived(parseYears(this.yearsText));
	readonly freq = $derived(Number(this.freqText) as CompoundFreq);

	/** 当前这一条错误：金额 → 利率 → 期限，一次只报一条，先修最前面那个 */
	readonly error = $derived(
		this.amount.ok ? (this.rate.ok ? (this.years.ok ? '' : this.years.error) : this.rate.error) : this.amount.error
	);

	readonly errorField = $derived(this.amount.ok ? (this.rate.ok ? (this.years.ok ? '' : 'years') : 'rate') : 'amount');

	// ---------------------------------------------------------------- 计算

	readonly loan = $derived.by((): LoanSummary | null => {
		if (!this.amount.ok || !this.rate.ok || !this.years.ok) return null;
		const result = buildLoan({
			amountCents: this.amount.value,
			annualRate: this.rate.value,
			years: this.years.value,
			method: this.method
		});
		return result.ok ? result.value : null;
	});

	/** 另一种还款方式：两种各算一遍，结果卡里给一句「少付 / 多付多少利息」 */
	readonly altLoan = $derived.by((): LoanSummary | null => {
		if (this.mode !== 'loan' || !this.amount.ok || !this.rate.ok || !this.years.ok) return null;
		const result = buildLoan({
			amountCents: this.amount.value,
			annualRate: this.rate.value,
			years: this.years.value,
			method: this.method === 'equal-installment' ? 'equal-principal' : 'equal-installment'
		});
		return result.ok ? result.value : null;
	});

	readonly deposit = $derived.by((): DepositSummary | null => {
		if (!this.amount.ok || !this.rate.ok || !this.years.ok) return null;
		const result = buildDeposit({
			amountCents: this.amount.value,
			annualRate: this.rate.value,
			years: this.years.value,
			mode: this.depositMode,
			freq: this.freq
		});
		return result.ok ? result.value : null;
	});

	// ---------------------------------------------------------------- 明细表

	readonly rows = $derived.by((): DetailRow[] => {
		if (this.mode === 'loan') {
			return (this.loan?.rows ?? []).map((row: ScheduleRow): DetailRow => {
				// 等额本息下「还了多少本金」不是重点，但表里仍给它一列：逐期对账时要看得出本金在加速
				return {
					key: String(row.index),
					period: `第 ${row.index} 期`,
					payment: formatMoney(row.payment),
					principal: formatMoney(row.principal),
					interest: formatMoney(row.interest),
					balance: formatMoney(row.balance)
				};
			});
		}
		return (this.deposit?.rows ?? []).map((row): DetailRow => {
			return {
				key: String(row.year),
				period: `第 ${row.year} 年`,
				payment: formatMoney(row.end),
				principal: formatMoney(row.start),
				interest: formatMoney(row.interest),
				balance: formatMoney(row.end)
			};
		});
	});

	readonly visibleRows = $derived(this.rows.slice(0, this.shown));
	readonly remainingRows = $derived(Math.max(0, this.rows.length - this.visibleRows.length));

	// ---------------------------------------------------------------- 状态条

	get resultTone(): StatusTone {
		if (this.error !== '') return 'error';
		return this.mode === 'loan' ? (this.loan === null ? 'neutral' : 'ok') : this.deposit === null ? 'neutral' : 'ok';
	}

	get resultText(): string {
		if (this.error !== '') return this.error;
		if (this.mode === 'loan') {
			const loan = this.loan;
			if (loan === null) return '填好金额、年利率与期限，这里给出月供与总利息';
			const label = this.method === 'equal-installment' ? '等额本息' : '等额本金';
			return `${label} · ${loan.months} 期 · 月供 ${formatMoney(loan.firstPayment)} 元 · 总利息 ${formatMoney(loan.totalInterest)} 元`;
		}
		const deposit = this.deposit;
		if (deposit === null) return '填好金额、年利率与期限，这里得到期利息与实际年化';
		const mode = this.depositMode === 'compound' ? '复利' : '单利';
		return `${mode} · ${this.years.ok ? this.years.value : 0} 年 · 到期本息 ${formatMoney(deposit.total)} 元 · 实际年化 ${formatPercent(deposit.effectiveRate)}`;
	}

	get detailTone(): StatusTone {
		if (this.error !== '') return 'error';
		return this.rows.length === 0 ? 'neutral' : 'ok';
	}

	get detailText(): string {
		if (this.error !== '') return '改对之后这里会重新列出每期的账';
		if (this.rows.length === 0) return this.mode === 'loan' ? '还款计划按顺序列在这里' : '逐年本息列在这里';
		const unit = this.mode === 'loan' ? '期' : '年';
		const tail = this.remainingRows > 0 ? ` · 还剩 ${this.remainingRows} ${unit}` : '';
		return `共 ${this.rows.length} ${unit}${tail}`;
	}

	// ---------------------------------------------------------------- 操作

	setMode(mode: Mode): void {
		this.mode = mode;
		this.shown = SCHEDULE_STEP;
	}

	setMethod(method: RepayMethod): void {
		this.method = method;
	}

	setDepositMode(mode: DepositMode): void {
		this.depositMode = mode;
	}

	setFreq(value: string): void {
		this.freqText = value;
	}

	showMore(): void {
		this.shown += SCHEDULE_STEP;
	}

	loadExample(id: string): void {
		const example = INTEREST_EXAMPLES.find((item) => item.id === id);
		if (!example) return;
		this.mode = example.mode;
		this.amountText = example.amount;
		this.rateText = example.rate;
		this.yearsText = example.years;
		this.method = example.method;
		this.depositMode = example.depositMode;
		this.freqText = String(example.freq);
		this.shown = SCHEDULE_STEP;
		toast.show(`已填入示例：${example.label}`);
	}

	clearAll(): void {
		this.amountText = '';
		this.rateText = '';
		this.yearsText = '';
		this.shown = SCHEDULE_STEP;
	}

	async copyValue(text: string, label: string): Promise<void> {
		await copyToClipboard(text, { ok: `已复制${label}`, fail: '复制失败，请手动选中复制' });
	}
}

export const interestStore = new InterestStore();
