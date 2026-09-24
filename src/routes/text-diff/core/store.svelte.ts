// 文本对比的编排层：两栏输入 + 三个忽略项 + 视图切换，模块级单例。
// 比较本身全在 core/diff.ts 的纯函数里，这里只管状态与文案，方便在 node 环境单测。
import { diffLines, splitLines, toSplitRows, toUnifiedText, type DiffOptions } from './diff.ts';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

/** 并排（左右两栏）/ 合并（一列） */
export type DiffView = 'split' | 'unified';

/** 一次最多渲染多少行：再长就只显示前一段，统计仍按全量 */
const MAX_RENDER_ROWS = 1000;

const EXAMPLE_LEFT = `{
  "name": "micro-tools",
  "version": "1.2.0",
  "scripts": {
    "dev": "vite dev --port 8000",
    "build": "vite build"
  },
  "dependencies": {
    "svelte": "^5.0.0"
  }
}`;

const EXAMPLE_RIGHT = `{
  "name": "micro-tools",
  "version": "1.3.0",
  "scripts": {
    "dev": "vite dev --port 8000",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "svelte": "^5.0.0",
    "vitest": "^4.0.0"
  }
}`;

class DiffStore {
	left = $state('');
	right = $state('');
	view = $state<DiffView>('split');
	ignoreCase = $state(false);
	ignoreWhitespace = $state(false);
	ignoreBlank = $state(false);

	readonly diffOptions = $derived<DiffOptions>({
		ignoreCase: this.ignoreCase,
		ignoreWhitespace: this.ignoreWhitespace,
		ignoreBlank: this.ignoreBlank
	});

	readonly result = $derived(diffLines(this.left, this.right, this.diffOptions));

	/** 合并视图直接渲染的行 */
	readonly lines = $derived(this.result.lines);
	readonly stats = $derived(this.result.stats);
	readonly degraded = $derived(this.result.degraded);

	/** 并排视图的行（删除与新增按下标配对） */
	readonly splitRows = $derived(toSplitRows(this.lines));

	// 渲染窗口：长文本只渲染前 MAX_RENDER_ROWS 行，统计与复制仍用全量
	readonly visibleLines = $derived(this.lines.slice(0, MAX_RENDER_ROWS));
	readonly visibleSplitRows = $derived(this.splitRows.slice(0, MAX_RENDER_ROWS));

	get hasInput(): boolean {
		return this.left !== '' || this.right !== '';
	}

	get truncated(): boolean {
		return this.lines.length > MAX_RENDER_ROWS;
	}

	get leftLineCount(): number {
		return splitLines(this.left).length;
	}

	get rightLineCount(): number {
		return splitLines(this.right).length;
	}

	/** 复制用的纯文本（`-` / `+` 前缀） */
	get unifiedText(): string {
		return toUnifiedText(this.lines);
	}

	get statusTone(): StatusTone {
		if (!this.hasInput) return 'neutral';
		if (this.degraded || this.truncated) return 'warn';
		return this.stats.added + this.stats.removed === 0 ? 'ok' : 'info';
	}

	get statusText(): string {
		if (!this.hasInput) return '左右各粘贴一段文本，实时显示行级差异';
		const { added, removed, equal } = this.stats;
		const head =
			added + removed === 0
				? `两处内容完全一致（${equal} 行）`
				: `新增 ${added} 行、删除 ${removed} 行、未变 ${equal} 行`;
		const notes: string[] = [];
		if (this.degraded) notes.push('内容过大，中间那段没做最优对齐');
		if (this.truncated) notes.push(`只显示前 ${MAX_RENDER_ROWS} 行`);
		return notes.length > 0 ? `${head}；${notes.join('；')}` : head;
	}

	// ---------------------------------------------------------------- 操作

	setView(view: DiffView): void {
		this.view = view;
	}

	loadExample(): void {
		this.left = EXAMPLE_LEFT;
		this.right = EXAMPLE_RIGHT;
		toast.show('已填入示例文本');
	}

	clear(): void {
		this.left = '';
		this.right = '';
		toast.show('已清空两栏文本');
	}

	/** 交换左右，用来反过来看「新增 / 删除」 */
	swap(): void {
		const left = this.left;
		this.left = this.right;
		this.right = left;
		toast.show('已交换左右两栏');
	}

	async copyResult(): Promise<void> {
		if (!this.hasInput) {
			toast.show('两栏还没有内容可复制', true);
			return;
		}
		await copyToClipboard(this.unifiedText, {
			ok: '已复制对比结果',
			fail: '复制失败，请手动选中结果复制'
		});
	}
}

export const diffStore = new DiffStore();
