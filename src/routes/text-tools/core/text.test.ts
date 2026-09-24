// 文本统计与清理纯函数、store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanText, countTextStats, utf8Bytes } from './text.ts';
import { textStore } from './store.svelte.ts';
import { EXAMPLE_CLEAN_INPUT, EXAMPLE_STATS_INPUT } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	textStore.tab = 'stats';
	textStore.statsInput = '';
	textStore.cleanInput = '';
	textStore.options = {
		trimLines: false,
		removeEmpty: false,
		collapseEmpty: false,
		unique: false,
		sort: 'none',
		reverse: false
	};
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('countTextStats', () => {
	it('中英文数字混合统计', () => {
		const stats = countTextStats('hello 世界 2026');
		expect(stats.chars).toBe(13); // 5 字母 + 1 空格 + 2 汉字 + 1 空格 + 4 数字
		expect(stats.cjk).toBe(2);
		expect(stats.latinWords).toBe(1);
		expect(stats.digitRuns).toBe(1);
		expect(stats.words).toBe(4);
	});

	it('emoji 按码点算 1 个字符，UTF-8 占 4 字节', () => {
		const stats = countTextStats('😀');
		expect(stats.chars).toBe(1);
		expect(stats.bytes).toBe(4);
		expect(utf8Bytes('中')).toBe(3);
	});

	it('空文本全 0', () => {
		expect(countTextStats('')).toEqual(countTextStats(''));
		const stats = countTextStats('');
		expect(stats.chars).toBe(0);
		expect(stats.lines).toBe(0);
		expect(stats.paragraphs).toBe(0);
	});

	it('行数、非空行与段落', () => {
		const stats = countTextStats('a\n\nb\nc\n');
		expect(stats.lines).toBe(5); // a / 空 / b / c / 尾空
		expect(stats.nonEmptyLines).toBe(3);
		expect(stats.paragraphs).toBe(2); // a 与 b\nc
	});

	it('非空白字符不含空格换行 Tab', () => {
		expect(countTextStats('a b\nc\td').charsNoSpace).toBe(4);
	});
});

describe('cleanText', () => {
	it('每行去首尾空白', () => {
		// 末行的尾 Tab 不构成新行，join 后没有第三个空行
		expect(cleanText(' a \n\tb\t', { ...base(), trimLines: true })).toBe('a\nb');
	});

	it('删除空行优先于合并连续空行', () => {
		expect(cleanText('a\n\n\nb', { ...base(), removeEmpty: true })).toBe('a\nb');
		expect(cleanText('a\n\n\nb', { ...base(), collapseEmpty: true })).toBe('a\n\nb');
	});

	it('删除重复行保留首次出现', () => {
		expect(cleanText('a\nb\na\nc\nb', { ...base(), unique: true })).toBe('a\nb\nc');
	});

	it('排序用码点比较，升序降序可逆', () => {
		expect(cleanText('b\nA\na\nB', { ...base(), sort: 'asc' })).toBe('A\nB\na\nb');
		expect(cleanText('b\nA\na\nB', { ...base(), sort: 'desc' })).toBe('b\na\nB\nA');
	});

	it('反转行序', () => {
		expect(cleanText('1\n2\n3', { ...base(), reverse: true })).toBe('3\n2\n1');
	});

	it('空文本直接返回空串', () => {
		expect(cleanText('', { ...base(), trimLines: true, removeEmpty: true })).toBe('');
	});

	it('CRLF 当作换行处理', () => {
		expect(cleanText('a\r\nb', { ...base() })).toBe('a\nb');
	});

	function base() {
		return {
			trimLines: false,
			removeEmpty: false,
			collapseEmpty: false,
			unique: false,
			sort: 'none' as const,
			reverse: false
		};
	}
});

describe('store', () => {
	it('统计随输入实时变化', () => {
		textStore.statsInput = 'ab';
		expect(textStore.stats.chars).toBe(2);
		textStore.clearStatsInput();
		expect(textStore.statsEmpty).toBe(true);
	});

	it('清理选项切换后结果实时更新', () => {
		textStore.cleanInput = 'a\na\n';
		textStore.toggleOption('unique');
		expect(textStore.cleaned).toBe('a\n');
		textStore.setSort('asc');
		expect(textStore.options.sort).toBe('asc');
	});

	it('应用写回输入框，输出与输入一致后 cleanChanged 为 false', () => {
		textStore.cleanInput = EXAMPLE_CLEAN_INPUT;
		textStore.toggleOption('unique');
		textStore.applyToInput();
		expect(textStore.cleanChanged).toBe(false);
		expect(textStore.cleanInput).not.toContain('banana\nbanana');
	});

	it('示例填充覆盖两个工作区', () => {
		textStore.loadStatsExample();
		expect(textStore.statsInput).toBe(EXAMPLE_STATS_INPUT);
		textStore.loadCleanExample();
		expect(textStore.cleanInput).toBe(EXAMPLE_CLEAN_INPUT);
		expect(textStore.options.unique).toBe(false);
	});

	it('复制清理结果写入剪贴板', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		textStore.cleanInput = 'x\ny';
		await textStore.copyCleaned();
		expect(writeText).toHaveBeenCalledWith('x\ny');
	});

	it('空输出复制给错误提示', async () => {
		textStore.cleanInput = '';
		await textStore.copyCleaned();
		expect(toast.message).toContain('没有可复制');
		expect(toast.tone).toBe('error');
	});
});
