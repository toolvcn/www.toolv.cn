// JSON 工具的编排层：模块级单例管住全部输入态，组件只负责渲染。
import { SAMPLE_JSON, transformJson } from './json.ts';
import { RENDER_TOKEN_LIMIT, type IndentKind, type JsonError, type JsonMode } from './types.ts';
import type { JsonToken } from '$lib/utils/json';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class JsonStore {
	// ---------------------------------------------------------------- 输入态

	input = $state('');
	mode = $state<JsonMode>('format');
	indent = $state<IndentKind>('2');
	/**
	 * 当前结果的镜像。输出是派生值（只能读），
	 * 而「复制」要拿到完整文本，所以由页面用一个 $effect 同步进来。
	 */
	output = $state('');

	/** 一次算完：输出、错误、分词同源，避免三处派生值各算一遍大文本 */
	readonly result = $derived(transformJson(this.input, this.mode, this.indent));

	// ---------------------------------------------------------------- 派生值

	get value(): string {
		return this.result.output;
	}

	get error(): JsonError | null {
		return this.result.error;
	}

	/** 渲染用的分词：超长时截断（复制用的 output 仍是完整的） */
	get visibleTokens(): JsonToken[] {
		return this.result.tokens.length > RENDER_TOKEN_LIMIT
			? this.result.tokens.slice(0, RENDER_TOKEN_LIMIT)
			: this.result.tokens;
	}

	/** 是否因为超长而截断了高亮显示 */
	get truncated(): boolean {
		return this.result.tokens.length > RENDER_TOKEN_LIMIT;
	}

	get isEmpty(): boolean {
		return this.input.trim() === '';
	}

	get isValid(): boolean {
		return !this.isEmpty && this.result.error === null;
	}

	get inputCount(): number {
		return this.input.length;
	}

	get outputCount(): number {
		return this.result.output.length;
	}

	get lineCount(): number {
		return this.result.output === '' ? 0 : this.result.output.split('\n').length;
	}

	/** 校验状态文案：界面显示与读屏播报共用一份 */
	get statusText(): string {
		if (this.isEmpty) return '等待输入';
		const error = this.result.error;
		if (error === null) return 'JSON 合法';
		const where = error.line === null ? '' : `第 ${error.line} 行第 ${error.column} 列：`;
		return `${where}${error.message}`;
	}

	// ---------------------------------------------------------------- 操作

	/** 切模式；已经是这个模式就不动 */
	setMode(mode: JsonMode): void {
		if (this.mode === mode) return;
		this.mode = mode;
	}

	setIndent(indent: IndentKind): void {
		if (this.indent === indent) return;
		this.indent = indent;
		// 压缩模式下缩进不生效，用户既然点缩进，说明想看格式化结果
		if (this.mode === 'minify') this.mode = 'format';
	}

	/** 填入示例：空态时最有用，也让首屏有个能看的东西 */
	loadSample(): void {
		this.input = SAMPLE_JSON;
		toast.show('已填入示例 JSON');
	}

	clearInput(): void {
		if (this.input === '') return;
		this.input = '';
		toast.show('已清空');
	}

	async copyOutput(): Promise<void> {
		const text = this.output;
		if (text === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(text, { ok: '已复制输出结果', fail: '复制失败，请手动选中输出内容复制' });
	}
}

export const jsonStore = new JsonStore();
