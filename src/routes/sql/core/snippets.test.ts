// 片段存档的序列化 / 解析单测：重点在「坏数据整份拒绝」与「名称缺失用首行兜底」两条口径。
import { describe, expect, it } from 'vitest';
import { fallbackSnippetName, parseSnippets, serializeSnippets, type SqlSnippet } from './snippets.ts';
import { MAX_SNIPPETS, MAX_SNIPPET_NAME } from '../config.ts';

const snippet = (id: number, name: string, sql: string): SqlSnippet => ({ id, name, sql });

describe('fallbackSnippetName', () => {
	it('取第一行非空内容（注释行也算）', () => {
		expect(fallbackSnippetName('\n\n-- 查活跃用户\nSELECT 1;\n')).toBe('-- 查活跃用户');
	});

	it('整段都是空白时给「未命名片段」', () => {
		expect(fallbackSnippetName('   \n\t\n')).toBe('未命名片段');
	});

	it('首行过长时截断到上限并加省略号', () => {
		const name = fallbackSnippetName('x'.repeat(MAX_SNIPPET_NAME + 20));
		expect(name.length).toBe(MAX_SNIPPET_NAME);
		expect(name.endsWith('…')).toBe(true);
	});
});

describe('serializeSnippets', () => {
	it('不写运行期的 id', () => {
		const text = serializeSnippets([snippet(7, '活跃用户', 'SELECT 1;')]);
		expect(text).not.toContain('"id"');
		expect(JSON.parse(text)).toEqual([{ name: '活跃用户', sql: 'SELECT 1;' }]);
	});
});

describe('parseSnippets', () => {
	it('落盘再解析能原样回来（round-trip）', () => {
		const list = [snippet(1, '活跃用户', 'SELECT 1;'), snippet(2, '慢查询', 'SELECT 2;')];
		const parsed = parseSnippets(serializeSnippets(list));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.snippets).toEqual([
			{ name: '活跃用户', sql: 'SELECT 1;' },
			{ name: '慢查询', sql: 'SELECT 2;' }
		]);
	});

	it('不是 JSON、不是数组、没有 sql 都整份拒绝', () => {
		expect(parseSnippets('这不是 JSON')).toEqual({ ok: false, error: '内容不是合法的 JSON' });
		expect(parseSnippets('{"sql":"SELECT 1;"}')).toEqual({ ok: false, error: '内容应为数组' });
		expect(parseSnippets('[{"name":"空片段","sql":"   "}]')).toEqual({
			ok: false,
			error: '存在没有内容的片段条目'
		});
		expect(parseSnippets('[null]')).toEqual({ ok: false, error: '存在非对象的片段条目' });
	});

	it('名称缺失用 SQL 首行兜底，不算坏数据', () => {
		const parsed = parseSnippets('[{"sql":"-- 说明\\nSELECT 1;"}]');
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.snippets[0]!.name).toBe('-- 说明');
	});

	it('超出条数上限时截断', () => {
		const many = Array.from({ length: MAX_SNIPPETS + 5 }, (_, index) => ({
			name: `片段 ${index}`,
			sql: 'SELECT 1;'
		}));
		const parsed = parseSnippets(JSON.stringify(many));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.snippets).toHaveLength(MAX_SNIPPETS);
	});
});
