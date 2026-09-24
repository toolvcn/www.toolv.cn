// 日期计算的编排层：三个标签各自一份状态，结果全是派生值，模块级单例。
import { copyText } from '$lib/utils/browser';
import { addDate, businessStats, diffStats } from './date.ts';
import { EXAMPLES, type DateTab, type Unit } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

class DateStore {
	tab = $state<DateTab>('diff');

	// ---------------------------------------------------------------- 日期差
	diffStart = $state(EXAMPLES.diff.start);
	diffEnd = $state(EXAMPLES.diff.end);
	readonly diff = $derived(diffStats(this.diffStart, this.diffEnd));

	// ---------------------------------------------------------------- 日期加减
	addBase = $state(EXAMPLES.add.base);
	/** 数字输入框的原始文本，空串 / 非法时结果为 null */
	addAmountText = $state(String(EXAMPLES.add.amount));
	addMinus = $state(EXAMPLES.add.minus);
	addUnit = $state<Unit>(EXAMPLES.add.unit);
	addBusinessOnly = $state(EXAMPLES.add.businessOnly);

	readonly add = $derived(
		addDate(
			this.addBase,
			this.#addNumber * (this.addMinus ? -1 : 1),
			this.addUnit,
			this.addUnit === 'day' && this.addBusinessOnly
		)
	);
	/** businessOnly 只对「天」有意义；其他单位下 UI 禁用勾选，这里也强制按 false 算 */
	get businessDisabled(): boolean {
		return this.addUnit !== 'day';
	}

	/** 数字输入框解析出的整数；空 / 非法给 NaN 让结果为 null（小数天数没有定义，一律取整） */
	get #addNumber(): number {
		const n = Number(this.addAmountText);
		return Number.isFinite(n) ? Math.trunc(n) : NaN;
	}

	// ---------------------------------------------------------------- 工作日统计
	bizStart = $state(EXAMPLES.business.start);
	bizEnd = $state(EXAMPLES.business.end);
	readonly business = $derived(businessStats(this.bizStart, this.bizEnd));
	/** 结束早于开始：businessStats 返回 null，这里区分「没填完」与「区间反了」给不同提示 */
	get bizRangeReversed(): boolean {
		return this.bizStart !== '' && this.bizEnd !== '' && this.bizStart > this.bizEnd;
	}

	// ---------------------------------------------------------------- 操作

	setTab(tab: DateTab): void {
		this.tab = tab;
	}

	setUnit(value: string): void {
		this.addUnit = value as Unit;
	}

	/** 本地今天，格式 YYYY-MM-DD；点击时才取，SSR 预渲染不含当天 */
	today(): string {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	}

	fillDiffToday(which: 'start' | 'end'): void {
		if (which === 'start') this.diffStart = this.today();
		else this.diffEnd = this.today();
	}

	fillAddToday(): void {
		this.addBase = this.today();
	}

	fillBizToday(which: 'start' | 'end'): void {
		if (which === 'start') this.bizStart = this.today();
		else this.bizEnd = this.today();
	}

	loadExample(): void {
		if (this.tab === 'diff') {
			this.diffStart = EXAMPLES.diff.start;
			this.diffEnd = EXAMPLES.diff.end;
		} else if (this.tab === 'add') {
			this.addBase = EXAMPLES.add.base;
			this.addAmountText = String(EXAMPLES.add.amount);
			this.addMinus = EXAMPLES.add.minus;
			this.addUnit = EXAMPLES.add.unit;
			this.addBusinessOnly = EXAMPLES.add.businessOnly;
		} else {
			this.bizStart = EXAMPLES.business.start;
			this.bizEnd = EXAMPLES.business.end;
		}
	}

	// ---------------------------------------------------------------- 复制

	async copyDiff(): Promise<void> {
		const diff = this.diff;
		if (!diff) {
			toast.show('请先填写两个合法日期', true);
			return;
		}
		const text = `${diff.swapped ? '约合' : '相差'} ${diff.days} 天（含头含尾 ${diff.inclusiveDays} 天），约 ${diff.weeks} 周 / ${diff.months} 个月 / ${diff.years} 年`;
		await this.#copy(text);
	}

	async copyAdd(): Promise<void> {
		if (!this.add) {
			toast.show('请先填好日期与天数', true);
			return;
		}
		await this.#copy(`${this.add.formatted}（${this.add.weekday}）`);
	}

	async copyBusiness(): Promise<void> {
		const stats = this.business;
		if (!stats) {
			toast.show('请先填写正确的日期区间', true);
			return;
		}
		await this.#copy(`共 ${stats.totalDays} 天：工作日 ${stats.businessDays} 天，周末 ${stats.weekendDays} 天`);
	}

	async #copy(text: string): Promise<void> {
		const ok = await copyText(text);
		toast.show(ok ? '已复制结果' : '复制失败，请手动选中复制', !ok);
	}
}

export const dateStore = new DateStore();
