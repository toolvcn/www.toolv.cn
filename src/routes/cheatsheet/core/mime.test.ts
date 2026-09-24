// MIME 数据与搜索的单测。
import { describe, expect, it } from 'vitest';
import { groupMimeEntries, MIME_ENTRIES, MIME_GROUPS, searchMimeEntries } from './mime.ts';

describe('MIME_ENTRIES 数据完整性', () => {
	it('有扩展名的条目互不重复，MIME 与说明均非空', () => {
		const exts = MIME_ENTRIES.map((item) => item.ext).filter((ext) => ext !== '');
		expect(exts.length).toBe(new Set(exts).size);
		for (const item of MIME_ENTRIES) {
			expect(item.mime.trim()).not.toBe('');
			expect(item.note.trim()).not.toBe('');
		}
	});

	it('每个分组都有条目，总数不少于 60', () => {
		expect(MIME_ENTRIES.length).toBeGreaterThanOrEqual(60);
		for (const group of MIME_GROUPS) {
			expect(MIME_ENTRIES.filter((item) => item.group === group.id).length).toBeGreaterThan(0);
		}
	});
});

describe('searchMimeEntries 双向搜索', () => {
	it('空查询返回全量', () => {
		expect(searchMimeEntries('')).toHaveLength(MIME_ENTRIES.length);
		expect(searchMimeEntries('   ')).toHaveLength(MIME_ENTRIES.length);
	});

	it('按扩展名命中（带不带点都行）', () => {
		expect(searchMimeEntries('png').map((i) => i.mime)).toContain('image/png');
		expect(searchMimeEntries('.png').map((i) => i.mime)).toContain('image/png');
	});

	it('按 MIME 命中（反向查扩展名）', () => {
		const hits = searchMimeEntries('image/png');
		expect(hits.map((i) => i.ext)).toContain('.png');
	});

	it('别名与说明也能命中', () => {
		expect(searchMimeEntries('jpeg').map((i) => i.mime)).toContain('image/jpeg');
		expect(searchMimeEntries('压缩').map((i) => i.mime)).toContain('application/zip');
	});

	it('大小写不敏感', () => {
		expect(searchMimeEntries('IMAGE/PNG').map((i) => i.ext)).toContain('.png');
	});

	it('无命中返回空数组', () => {
		expect(searchMimeEntries('不存在的扩展名zzz')).toEqual([]);
	});
});

describe('groupMimeEntries', () => {
	it('分组不丢条目、不产生空组，且按 MIME_GROUPS 的顺序', () => {
		const sections = groupMimeEntries(MIME_ENTRIES);
		expect(sections.map((s) => s.group)).toEqual(MIME_GROUPS.map((g) => g.id));
		expect(sections.reduce((n, s) => n + s.items.length, 0)).toBe(MIME_ENTRIES.length);
	});

	it('搜索结果里落空的分组不出现', () => {
		const sections = groupMimeEntries(searchMimeEntries('image/png'));
		expect(sections).toHaveLength(1);
		expect(sections[0]?.group).toBe('image');
	});
});
