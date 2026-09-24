// 文本统计 & 清理的编排层：两个工作区（统计 / 清理）共用一个 store，模块级单例。
import { cleanText, countTextStats, DEFAULT_CLEAN_OPTIONS, type CleanOptions, type TextStats } from './text.ts';
import { EXAMPLE_CLEAN_INPUT, EXAMPLE_STATS_INPUT } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

export type ToolTab = 'stats' | 'clean';

class TextStore {
	tab = $state<ToolTab>('stats');

	// 统计工作区
	statsInput = $state(EXAMPLE_STATS_INPUT);
	readonly stats = $derived<TextStats>(countTextStats(this.statsInput));
	get statsEmpty(): boolean {
		return this.statsInput === '';
	}

	// 清理工作区
	cleanInput = $state(EXAMPLE_CLEAN_INPUT);
	options = $state<CleanOptions>({ ...DEFAULT_CLEAN_OPTIONS });
	readonly cleaned = $derived(cleanText(this.cleanInput, this.options));

	get cleanEmpty(): boolean {
		return this.cleanInput === '';
	}
	get cleanChanged(): boolean {
		return this.cleaned !== this.cleanInput;
	}

	// ---------------------------------------------------------------- 操作

	setTab(tab: ToolTab): void {
		this.tab = tab;
	}

	toggleOption(key: Exclude<keyof CleanOptions, 'sort'>): void {
		this.options = { ...this.options, [key]: !this.options[key] };
	}

	setSort(sort: CleanOptions['sort']): void {
		this.options = { ...this.options, sort };
	}

	loadStatsExample(): void {
		this.statsInput = EXAMPLE_STATS_INPUT;
	}

	clearStatsInput(): void {
		this.statsInput = '';
	}

	loadCleanExample(): void {
		this.cleanInput = EXAMPLE_CLEAN_INPUT;
		this.options = { ...DEFAULT_CLEAN_OPTIONS };
	}

	clearCleanInput(): void {
		this.cleanInput = '';
	}

	/** 把清理结果写回输入框，方便在此基础上继续调整选项 */
	applyToInput(): void {
		this.cleanInput = this.cleaned;
		toast.show('已把清理结果写回输入框');
	}

	async copyCleaned(): Promise<void> {
		if (this.cleaned === '') {
			toast.show('没有可复制的内容，请先输入文本', true);
			return;
		}
		await copyToClipboard(this.cleaned, { ok: '已复制清理结果', fail: '复制失败，请手动选中复制' });
	}
}

export const textStore = new TextStore();
