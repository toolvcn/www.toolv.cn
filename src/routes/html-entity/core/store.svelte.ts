// HTML 实体编解码的编排层：模块级单例。
// 单输入框一个工作区，方向切「文本 → 实体」与「实体 → 文本」，输出实时派生。
import { decodeHtml, encodeHtml } from './entities.ts';
import { EXAMPLE_TEXT, type EncodeScope, type EncodeStyle, type EntityDirection } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class EntityStore {
	direction = $state<EntityDirection>('encode');
	input = $state(EXAMPLE_TEXT);
	scope = $state<EncodeScope>('symbols');
	style = $state<EncodeStyle>('named');
	/** 结果的镜像：派生值只能读，「复制」要拿到文本，由页面 $effect 同步 */
	outputMirror = $state('');

	readonly result = $derived(
		this.direction === 'encode' ? encodeHtml(this.input, this.scope, this.style) : decodeHtml(this.input)
	);

	get output(): string {
		return this.result;
	}

	get inputCount(): number {
		return this.input.length;
	}

	get outputCount(): number {
		return this.result.length;
	}

	// ---------------------------------------------------------------- 操作

	/** 换方向时把当前输出搬回输入框：来回验证数据不用手动复制 */
	swapDirection(): void {
		const previousOutput = this.result;
		this.input = previousOutput;
		this.direction = this.direction === 'encode' ? 'decode' : 'encode';
		this.outputMirror = '';
	}

	/** 编码选项只在编码方向有意义；点了就切到编码，避免「按钮在解码时点了没反应」 */
	applyScope(scope: EncodeScope): void {
		this.scope = scope;
		if (this.direction === 'decode') this.direction = 'encode';
	}

	applyStyle(style: EncodeStyle): void {
		this.style = style;
		if (this.direction === 'decode') this.direction = 'encode';
	}

	loadExample(): void {
		this.input = EXAMPLE_TEXT;
		if (this.direction === 'decode') this.direction = 'encode';
		toast.show('已填入示例文本');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		const text = this.outputMirror;
		if (text === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(text, { ok: '已复制输出结果', fail: '复制失败，请手动选中复制' });
	}
}

export const entityStore = new EntityStore();
