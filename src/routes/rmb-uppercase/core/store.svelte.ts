// 人民币大写的编排层：单输入框，输出实时派生，模块级单例。
import { toRmbUppercase } from './rmb.ts';
import { EXAMPLE_INPUT, type RmbResult } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class RmbStore {
	input = $state(EXAMPLE_INPUT);

	readonly result = $derived<RmbResult>(toRmbUppercase(this.input));

	get output(): string {
		return this.result.output;
	}

	get error(): string {
		return this.result.error;
	}

	get inputCount(): number {
		return this.input.length;
	}

	// ---------------------------------------------------------------- 操作

	loadExample(): void {
		this.input = EXAMPLE_INPUT;
		toast.show('已填入示例金额');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		if (this.output === '') {
			toast.show('没有可复制的结果，请先输入有效金额');
			return;
		}
		await copyToClipboard(this.output, { ok: '已复制大写金额', fail: '复制失败，请手动选中复制' });
	}
}

export const rmbStore = new RmbStore();
