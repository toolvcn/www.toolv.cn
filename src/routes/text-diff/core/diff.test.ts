// 行级 diff 纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diffLines, splitLines, toSplitRows, toUnifiedText, type DiffOptions } from './diff.ts';
import { diffStore } from './store.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

const PLAIN: DiffOptions = { ignoreCase: false, ignoreWhitespace: false, ignoreBlank: false };
const ignore = (patch: Partial<DiffOptions>): DiffOptions => ({ ...PLAIN, ...patch });

beforeEach(() => {
	diffStore.left = '';
	diffStore.right = '';
	diffStore.view = 'split';
	diffStore.ignoreCase = false;
	diffStore.ignoreWhitespace = false;
	diffStore.ignoreBlank = false;
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('切行', () => {
	it('CRLF 统一成 LF，末尾换行不产生空行', () => {
		expect(splitLines('a\r\nb\n')).toEqual(['a', 'b']);
		expect(splitLines('a\rb')).toEqual(['a', 'b']);
		expect(splitLines('')).toEqual([]);
	});

	it('中间与末尾的空行都保留，只去掉末尾换行造出来的那个', () => {
		expect(splitLines('a\n\nb\n')).toEqual(['a', '', 'b']);
		expect(splitLines('a\n\n')).toEqual(['a', '']);
	});
});

describe('行级 diff', () => {
	it('两栏完全相同时全是未变行', () => {
		const { lines, stats } = diffLines('a\nb\nc', 'a\nb\nc', PLAIN);
		expect(lines.every((line) => line.kind === 'equal')).toBe(true);
		expect(stats).toEqual({ added: 0, removed: 0, equal: 3 });
	});

	it('末尾多一行记为新增，行号取右栏', () => {
		const { lines, stats } = diffLines('a\nb', 'a\nb\nc', PLAIN);
		expect(lines).toEqual([
			{ kind: 'equal', leftNo: 1, rightNo: 1, text: 'a', rightText: 'a' },
			{ kind: 'equal', leftNo: 2, rightNo: 2, text: 'b', rightText: 'b' },
			{ kind: 'add', leftNo: null, rightNo: 3, text: 'c' }
		]);
		expect(stats).toEqual({ added: 1, removed: 0, equal: 2 });
	});

	it('中间少一行记为删除，行号取左栏', () => {
		const { lines, stats } = diffLines('a\nb\nc', 'a\nc', PLAIN);
		expect(lines.map((line) => line.kind)).toEqual(['equal', 'del', 'equal']);
		expect(lines[1]).toMatchObject({ kind: 'del', leftNo: 2, rightNo: null, text: 'b' });
		expect(stats).toEqual({ added: 0, removed: 1, equal: 2 });
	});

	it('改动一行拆成相邻的删除 + 新增', () => {
		const { lines } = diffLines('a\nb\nc', 'a\nB\nc', PLAIN);
		expect(lines.map((line) => `${line.kind}:${line.text}`)).toEqual(['equal:a', 'del:b', 'add:B', 'equal:c']);
	});

	it('一侧为空时另一侧整段是新增 / 删除', () => {
		expect(diffLines('', 'a\nb', PLAIN).lines.map((l) => l.kind)).toEqual(['add', 'add']);
		expect(diffLines('a\nb', '', PLAIN).lines.map((l) => l.kind)).toEqual(['del', 'del']);
		expect(diffLines('', '', PLAIN).lines).toEqual([]);
	});
});

describe('忽略项', () => {
	it('忽略大小写：只差大小写的行算未变，右栏仍保留原文', () => {
		const { lines } = diffLines('Foo\nbar', 'foo\nbar', ignore({ ignoreCase: true }));
		expect(lines[0]).toMatchObject({ kind: 'equal', text: 'Foo', rightText: 'foo' });
	});

	it('忽略行首尾空白：缩进不同的同一行算未变', () => {
		const { lines } = diffLines('  a\nb', 'a\nb', ignore({ ignoreWhitespace: true }));
		expect(lines.every((line) => line.kind === 'equal')).toBe(true);
	});

	it('不勾忽略项时大小写与空白都算差异', () => {
		expect(diffLines('Foo', 'foo', PLAIN).stats.equal).toBe(0);
		expect(diffLines('  a', 'a', PLAIN).stats.equal).toBe(0);
	});

	it('忽略空行：空行不参与比较，行号仍按原文', () => {
		const { lines, stats } = diffLines('a\n\nb', 'a\nb', ignore({ ignoreBlank: true }));
		expect(lines.map((line) => line.kind)).toEqual(['equal', 'equal']);
		expect(lines[1]).toMatchObject({ leftNo: 3, rightNo: 2 });
		expect(stats.equal).toBe(2);
	});
});

describe('并排配对', () => {
	const rows = (left: string, right: string) => toSplitRows(diffLines(left, right, PLAIN).lines);

	it('一删一增配成一行改动', () => {
		expect(rows('a\nb\nc', 'a\nB\nc').map((row) => row.kind)).toEqual(['equal', 'change', 'equal']);
	});

	it('删多增少：多出来的删除独占一行', () => {
		expect(rows('a\nb\nc\nd', 'a\nX').map((row) => row.kind)).toEqual(['equal', 'change', 'del', 'del']);
	});

	it('增多删少：多出来的新增独占一行', () => {
		expect(rows('a\nb', 'a\nX\nY\nZ').map((row) => row.kind)).toEqual(['equal', 'change', 'add', 'add']);
	});

	it('未变行的右格用右栏原文', () => {
		const [first] = rows('a', 'a');
		expect(first.left?.text).toBe('a');
		expect(first.right?.text).toBe('a');
	});
});

describe('复制用的纯文本', () => {
	it('按增删加 - / + 前缀，未变行留一个空格', () => {
		const text = toUnifiedText(diffLines('a\nb', 'a\nc', PLAIN).lines);
		expect(text).toBe(' a\n-b\n+c');
	});
});

describe('store', () => {
	it('两栏内容变化后统计实时跟着变', () => {
		diffStore.left = 'a\nb\nc';
		diffStore.right = 'a\nB\nc\nd';
		expect(diffStore.stats).toEqual({ added: 2, removed: 1, equal: 2 });
		expect(diffStore.hasInput).toBe(true);
	});

	it('示例 / 清空 / 交换', () => {
		diffStore.loadExample();
		expect(diffStore.left).not.toBe('');
		expect(diffStore.right).not.toBe('');
		const left = diffStore.left;
		diffStore.swap();
		expect(diffStore.right).toBe(left);
		diffStore.clear();
		expect(diffStore.left).toBe('');
		expect(diffStore.right).toBe('');
	});

	it('空态与「完全一致」的状态文案不重样', () => {
		expect(diffStore.statusTone).toBe('neutral');
		expect(diffStore.statusText).toContain('实时显示');
		diffStore.left = 'a\nb';
		diffStore.right = 'a\nb';
		expect(diffStore.statusTone).toBe('ok');
		expect(diffStore.statusText).toContain('完全一致');
	});

	it('超过渲染上限时状态里带提示，统计仍是全量', () => {
		const many = Array.from({ length: 1200 }, (_, i) => `line-${i}`).join('\n');
		diffStore.left = many;
		diffStore.right = `${many}\nline-extra`;
		expect(diffStore.stats.added).toBe(1);
		expect(diffStore.truncated).toBe(true);
		expect(diffStore.visibleLines).toHaveLength(1000);
		expect(diffStore.statusText).toContain('只显示前 1000 行');
	});

	it('视图切换', () => {
		diffStore.setView('unified');
		expect(diffStore.view).toBe('unified');
	});

	it('没有内容时复制给红色提示', async () => {
		await diffStore.copyResult();
		expect(toast.message).toBe('两栏还没有内容可复制');
		expect(toast.tone).toBe('error');
	});

	it('复制成功写进剪贴板', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		diffStore.left = 'a\nb';
		diffStore.right = 'a\nc';
		await diffStore.copyResult();
		expect(writeText).toHaveBeenCalledWith(' a\n-b\n+c');
		expect(toast.tone).toBe('neutral');
	});

	it('复制失败弹红色提示', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		diffStore.left = 'a';
		diffStore.right = 'a';
		await diffStore.copyResult();
		expect(toast.tone).toBe('error');
	});
});
