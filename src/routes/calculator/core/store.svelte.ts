// 科学计算器的编排层：一个表达式 + 角度制，结果是派生；历史是唯一需要自己维护的状态。模块级单例。
//
// 求值的过程（词法 / 解析 / 函数表）全在 `core/calc.ts`，这一层只管「表达式是什么、算出来怎么显示、
// 哪些进历史」—— 所以边界情况都能在 node 环境里单测，不用开浏览器。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import { evaluate, formatNumber } from './calc.ts';

/** 历史存哪：只有本工具用，所以就近定义、由 +page.svelte 读写（不建 config.ts） */
export const HISTORY_KEY = 'toolv:calculator:history';

/** 历史最多留多少条：再多就要翻页了，本页不做翻页 */
export const MAX_HISTORY = 20;

/** 默认表达式：一进来就有个能算的结果，首屏不是空的 */
export const DEFAULT_EXPR = '(12 + 8) * 3 / 2^2';

export interface HistoryEntry {
	/** keyed each 用自增 id，不用表达式文本（同一条算式可以算两次） */
	id: number;
	expr: string;
	result: string;
}

class CalcStore {
	expr = $state(DEFAULT_EXPR);
	/** 角度制：三角函数按度算；关掉就是弧度制 */
	deg = $state(true);
	history = $state<HistoryEntry[]>([]);
	#nextId = 1;

	readonly result = $derived(evaluate(this.expr, { deg: this.deg }));
	readonly error = $derived(this.result.ok ? '' : this.result.error);
	readonly resultText = $derived(this.result.ok ? formatNumber(this.result.value) : '—');

	// ---------------------------------------------------------------- 状态条

	get resultTone(): StatusTone {
		if (this.error !== '') return 'error';
		return this.expr.trim() === '' ? 'neutral' : 'ok';
	}

	get resultStatus(): string {
		if (this.error !== '') return this.error;
		if (this.expr.trim() === '') return '写个算式，下面实时给出结果';
		return this.deg ? '角度制：三角函数按度算' : '弧度制：三角函数按弧度算';
	}

	get historyText(): string {
		return this.history.length === 0 ? '还没有算过' : `${this.history.length} 条，点一条填回输入框`;
	}

	// ---------------------------------------------------------------- 操作

	setDeg(value: boolean): void {
		this.deg = value;
	}

	/** 在表达式末尾追加片段（函数按钮用）；追加而不是替换，改一半的式子不会被冲掉 */
	insert(text: string): void {
		this.expr = `${this.expr}${text}`;
	}

	clear(): void {
		this.expr = '';
	}

	/** 入历史：算式不对时不入，也不静默 —— 用 toast 把原因说一遍 */
	submit(): void {
		if (!this.result.ok) {
			toast.show(`算式还不对：${this.result.error}`, true);
			return;
		}
		const expr = this.expr.trim();
		const entry = { id: this.#nextId, expr, result: formatNumber(this.result.value) };
		this.#nextId += 1;
		// 与上一条完全一样就不重复记：连点两次「计算」不该堆出两行
		const top = this.history[0];
		if (top !== undefined && top.expr === entry.expr && top.result === entry.result) return;
		this.history = [entry, ...this.history].slice(0, MAX_HISTORY);
	}

	/** 点历史里的一条：把算式填回输入框 */
	apply(id: number): void {
		const entry = this.history.find((item) => item.id === id);
		if (entry === undefined) return;
		this.expr = entry.expr;
	}

	remove(id: number): void {
		this.history = this.history.filter((item) => item.id !== id);
	}

	clearHistory(): void {
		this.history = [];
	}

	/** 从 localStorage 恢复：只认长得对的条目，脏数据直接丢掉而不是让页面崩 */
	loadHistory(raw: unknown): void {
		if (!Array.isArray(raw)) return;
		const entries: HistoryEntry[] = [];
		for (const item of raw.slice(0, MAX_HISTORY)) {
			const candidate = item as Partial<HistoryEntry>;
			if (typeof candidate.expr !== 'string' || typeof candidate.result !== 'string') continue;
			entries.push({ id: this.#nextId, expr: candidate.expr, result: candidate.result });
			this.#nextId += 1;
		}
		this.history = entries;
	}

	async copyResult(): Promise<void> {
		await copyToClipboard(this.resultText, { ok: '已复制结果', fail: '复制失败，请手动选中复制' });
	}
}

export const calcStore = new CalcStore();
