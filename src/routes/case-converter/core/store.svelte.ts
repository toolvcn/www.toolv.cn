// 命名风格转换的编排层：单输入框，输出全部目标风格逐行展示，模块级单例。
import { convertCase } from './case.ts';
import { CASE_STYLES, EXAMPLE_INPUT, type CaseRow } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class CaseStore {
	input = $state(EXAMPLE_INPUT);

	/** 七种风格的结果一次算好，输出列表直接用 */
	readonly rows = $derived<CaseRow[]>(
		CASE_STYLES.map(({ style, label, scenario }) => ({
			style,
			label,
			scenario,
			output: convertCase(this.input, style)
		}))
	);

	get inputCount(): number {
		return this.input.length;
	}

	// ---------------------------------------------------------------- 操作

	loadExample(): void {
		this.input = EXAMPLE_INPUT;
		toast.show('已填入示例标识符');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyRow(row: CaseRow): Promise<void> {
		if (row.output === '') {
			toast.show('结果为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(row.output, { ok: `已复制 ${row.label} 结果`, fail: '复制失败，请手动选中复制' });
	}
}

export const caseStore = new CaseStore();
