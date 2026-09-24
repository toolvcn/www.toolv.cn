// JSON → TypeScript 的编排层：状态极少，输出是派生值，模块级单例。
import { jsonToTypeScript } from './json-to-ts.ts';
import { DEFAULT_EXPORT_KEYWORD, DEFAULT_ROOT_NAME, EXAMPLE_JSON } from '../config.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class JsonToTsStore {
	input = $state(EXAMPLE_JSON);
	rootName = $state(DEFAULT_ROOT_NAME);
	exportKeyword = $state(DEFAULT_EXPORT_KEYWORD);

	readonly result = $derived(
		jsonToTypeScript(this.input, { rootName: this.rootName, exportKeyword: this.exportKeyword })
	);

	get isEmpty(): boolean {
		return this.input.trim() === '';
	}
	get hasError(): boolean {
		return !this.isEmpty && !this.result.ok;
	}

	// ---------------------------------------------------------------- 操作

	loadExample(): void {
		this.input = EXAMPLE_JSON;
		this.rootName = DEFAULT_ROOT_NAME;
		this.exportKeyword = DEFAULT_EXPORT_KEYWORD;
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		if (!this.result.ok) {
			toast.show('当前输入有误，没有可复制的结果', true);
			return;
		}
		await copyToClipboard(this.result.code, { ok: '已复制 TypeScript 类型', fail: '复制失败，请手动选中复制' });
	}
}

export const jsonToTsStore = new JsonToTsStore();
