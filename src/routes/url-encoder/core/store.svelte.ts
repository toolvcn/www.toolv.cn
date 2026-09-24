// URL 编解码 & 查询字符串的编排层：模块级单例。
// 输入串是唯一事实来源：文本视图直接编辑它；参数表视图把它拆成三段（地址 / 参数 / # 片段）编辑后再合成回它。
import { composeFragmentParams, composeQuery, parseQueryString, splitQueryInput, transformUrl } from './url.ts';
import {
	EXAMPLE_ENCODE_TEXT,
	EXAMPLE_QUERY_TEXT,
	type EncodeStrategy,
	type QueryParamRow,
	type UrlDirection,
	type UrlInputView,
	type UrlSegment
} from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

/** 把 dragId 那条移到 targetId 那条所在的位置（其余顺延）；找不到就原样返回 */
function moveByTarget<T extends { id: number }>(rows: T[], dragId: number, targetId: number): T[] {
	if (dragId === targetId) return rows;
	const from = rows.findIndex((row) => row.id === dragId);
	const to = rows.findIndex((row) => row.id === targetId);
	if (from === -1 || to === -1) return rows;
	const next = [...rows];
	const [moved] = next.splice(from, 1);
	// 插回原下标：from < to 时目标已被挤上去一格，插在 to 正好是它原来的位置
	next.splice(to, 0, moved);
	return next;
}

/** 与相邻那条交换（拖拽手柄上 ↑ / ↓ 的落点）；到边界就原样返回 */
function nudge<T extends { id: number }>(rows: T[], id: number, delta: number): T[] {
	const from = rows.findIndex((row) => row.id === id);
	const to = from + delta;
	if (from === -1 || to < 0 || to >= rows.length) return rows;
	const next = [...rows];
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

class UrlStore {
	// ---------------------------------------------------------------- 输入侧

	/** 输入串：文本 / 参数表两种视图共用的事实来源 */
	encInput = $state(EXAMPLE_ENCODE_TEXT);
	/** 输入区视图：文本直接编解码，参数表分三段编辑 */
	inputView = $state<UrlInputView>('text');
	encDirection = $state<UrlDirection>('encode');
	strategy = $state<EncodeStrategy>('component');

	// ---------------------------------------------------------------- 参数表的三段
	// 进参数表时按当前输入串拆出来，三段任一改动都重新合成回输入串。三段常驻（空也显示，可直接补）。

	/** 地址段：`?` 之前（含 `?`）的域名 / 路径 */
	prefix = $state('');
	/** 参数段：`?` 之后、`#` 之前的键值行 */
	queryRows = $state<QueryParamRow[]>([]);
	/** # 片段段：`#` 之后的键值行（与参数段同形，规则不同：不编码、值为空只留键） */
	fragmentRows = $state<QueryParamRow[]>([]);
	/** 两段共用的自增 id：each 的 key 用 id，两段加起来唯一即可 */
	#seq = 0;

	/** 输出区文本的镜像：派生值只能读，「复制」要拿到文本，由页面 $effect 同步 */
	encOutput = $state('');

	readonly encResult = $derived(transformUrl(this.encInput, this.encDirection, this.strategy));

	get encValue(): string {
		return this.encResult.output;
	}

	get encError(): string {
		return this.encResult.error;
	}

	get encInputCount(): number {
		return this.encInput.length;
	}

	/** 输出区文本：文本视图是编解码结果；参数表视图是三段合成出的整条串 */
	get outputText(): string {
		return this.inputView === 'params' ? this.#composeInput() : this.encResult.output;
	}

	/** 地址非空时输出是整条 URL 而不只是查询串（标题据此显示「结果 URL」） */
	get hasUrlPrefix(): boolean {
		return this.prefix !== '';
	}

	get outputError(): string {
		return this.inputView === 'params' ? '' : this.encResult.error;
	}

	get outputCount(): number {
		return this.outputText.length;
	}

	/** 地址 + 参数段 + # 片段段：片段段非空才带 `#` */
	#composeInput(): string {
		const fragment = composeFragmentParams(this.fragmentRows);
		return `${this.prefix}${composeQuery(this.queryRows)}${fragment === '' ? '' : `#${fragment}`}`;
	}

	// ---------------------------------------------------------------- 输入视图 / 三段编辑

	setInputView(view: UrlInputView): void {
		if (this.inputView === view) return;
		this.inputView = view;
		// 进参数表按当前输入串拆三段；切回文本不写回，免得只切视图就改动了内容
		if (view === 'params') this.#rebuildFromInput();
	}

	setPrefix(value: string): void {
		this.prefix = value;
		this.#commitInput();
	}

	/** 新增一行：空行不进合成串，所以不必立刻重合成 */
	addRow(segment: UrlSegment): void {
		const id = ++this.#seq;
		if (segment === 'query') this.queryRows = [...this.queryRows, { id, key: '', value: '' }];
		else this.fragmentRows = [...this.fragmentRows, { id, key: '', value: '' }];
	}

	removeRow(segment: UrlSegment, id: number): void {
		if (segment === 'query') {
			if (!this.queryRows.some((row) => row.id === id)) return;
			this.queryRows = this.queryRows.filter((row) => row.id !== id);
		} else {
			if (!this.fragmentRows.some((row) => row.id === id)) return;
			this.fragmentRows = this.fragmentRows.filter((row) => row.id !== id);
		}
		this.#commitInput();
	}

	/** 拖拽落点：把 dragId 那条移到 targetId 那条的位置（只在同一段内生效） */
	moveRow(segment: UrlSegment, dragId: number, targetId: number): void {
		if (segment === 'query') this.queryRows = moveByTarget(this.queryRows, dragId, targetId);
		else this.fragmentRows = moveByTarget(this.fragmentRows, dragId, targetId);
		this.#commitInput();
	}

	/** 拖拽的键盘等价操作：手柄聚焦后按 ↑ / ↓ 与相邻那条交换 */
	nudgeRow(segment: UrlSegment, id: number, delta: number): void {
		if (segment === 'query') this.queryRows = nudge(this.queryRows, id, delta);
		else this.fragmentRows = nudge(this.fragmentRows, id, delta);
		this.#commitInput();
	}

	updateQueryRow(id: number, key: string, value: string): void {
		this.queryRows = this.queryRows.map((row) => (row.id === id ? { ...row, key, value } : row));
		this.#commitInput();
	}

	updateFragmentRow(id: number, key: string, value: string): void {
		this.fragmentRows = this.fragmentRows.map((row) => (row.id === id ? { ...row, key, value } : row));
		this.#commitInput();
	}

	/** 按当前输入串重拆三段：查询段进参数表，# 片段段进片段行 */
	#rebuildFromInput(): void {
		const { prefix, query, suffix } = splitQueryInput(this.encInput);
		this.prefix = prefix;
		this.queryRows = parseQueryString(query).map((param) => ({ id: ++this.#seq, key: param.key, value: param.value }));
		// 片段串与查询串语法相同，解析直接复用；差别只在合成（见 composeFragmentParams）
		const fragment = suffix.startsWith('#') ? suffix.slice(1) : '';
		this.fragmentRows = parseQueryString(fragment).map((param) => ({
			id: ++this.#seq,
			key: param.key,
			value: param.value
		}));
	}

	/** 三段任一改动都立刻重新合成整条输入串 */
	#commitInput(): void {
		this.encInput = this.#composeInput();
	}

	// ---------------------------------------------------------------- 操作

	setEncDirection(direction: UrlDirection): void {
		// 方向只在文本视图有意义，参数表视图那一组是灰的
		if (this.inputView !== 'text' || this.encDirection === direction) return;
		// 换方向时把当前输出搬到输入：编码结果直接解回来验证，不用手动复制
		this.encInput = this.encResult.output;
		this.encDirection = direction;
		this.encOutput = '';
	}

	/** 策略只在编码方向有意义；点了就切到编码，避免「按钮在解码时点了没反应」 */
	applyStrategy(strategy: EncodeStrategy): void {
		if (this.inputView !== 'text') return;
		this.strategy = strategy;
		if (this.encDirection === 'decode') this.encDirection = 'encode';
	}

	/** 示例随视图给：文本视图给一条带非法字符的 URL，参数表视图给一条查询串 */
	loadExample(): void {
		if (this.inputView === 'params') {
			this.encInput = EXAMPLE_QUERY_TEXT;
			this.#rebuildFromInput();
			toast.show('已填入示例查询串');
			return;
		}
		this.encInput = EXAMPLE_ENCODE_TEXT;
		if (this.encDirection === 'decode') this.encDirection = 'encode';
		toast.show('已填入示例文本');
	}

	clearAll(): void {
		this.encInput = '';
		if (this.inputView === 'params') {
			this.prefix = '';
			this.queryRows = [];
			this.fragmentRows = [];
		}
	}

	async copyOutput(): Promise<void> {
		const text = this.encOutput;
		if (text === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(text, { ok: '已复制输出结果', fail: '复制失败，请手动选中复制' });
	}
}

export const urlStore = new UrlStore();
