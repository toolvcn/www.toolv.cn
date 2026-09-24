// 已保存表达式的序列化 / 校验单测：落盘与恢复共用这一段解析，边界都在这里钉住。
import { describe, expect, it } from 'vitest';
import { MAX_SAVED, MAX_SAVED_NAME } from '../config.ts';
import { fallbackName, parseSaved, serializeSaved } from './saved.ts';
import type { SavedPreset } from './types.ts';

function entry(over: Partial<SavedPreset> = {}): SavedPreset {
	return { id: 7, name: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g', ...over };
}

describe('serializeSaved', () => {
	it('落盘不带运行期的 id', () => {
		const parsed = JSON.parse(serializeSaved([entry()]));
		expect(parsed).toEqual([{ name: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' }]);
		expect(parsed[0].id).toBeUndefined();
	});

	it('存了测试文本的条目带 input 落盘', () => {
		const parsed = JSON.parse(serializeSaved([entry({ input: '2026-09' })]));
		expect(parsed[0].input).toBe('2026-09');
	});

	it('没存测试文本的条目不写 input 键，形状与旧数据一致', () => {
		const parsed = JSON.parse(serializeSaved([entry()]));
		expect('input' in parsed[0]).toBe(false);
		expect(Object.keys(parsed[0])).toEqual(['name', 'pattern', 'flags']);
	});
});

describe('fallbackName', () => {
	it('短表达式原样当名字', () => {
		expect(fallbackName('\\d{4}')).toBe('\\d{4}');
	});

	it('超长表达式截断并留省略号', () => {
		const name = fallbackName('a'.repeat(MAX_SAVED_NAME + 20));
		expect(name).toHaveLength(MAX_SAVED_NAME);
		expect(name.endsWith('…')).toBe(true);
	});
});

describe('parseSaved', () => {
	it('正常恢复一条', () => {
		const result = parseSaved(serializeSaved([entry()]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved).toEqual([{ name: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' }]);
	});

	it('名称缺失时用表达式兜底', () => {
		const result = parseSaved(JSON.stringify([{ pattern: '\\d+', flags: 'g' }]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved[0].name).toBe('\\d+');
	});

	it('修饰符归一化：去重、排序、滤掉非法字母', () => {
		const result = parseSaved(
			JSON.stringify([
				{ name: 'a', pattern: 'a', flags: 'mg' },
				{ name: 'b', pattern: 'b', flags: 'gz' }
			])
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved[0].flags).toBe('gm');
		expect(result.saved[1].flags).toBe('g');
	});

	it('超上限的只取前 MAX_SAVED 条', () => {
		const many = Array.from({ length: MAX_SAVED + 5 }, (_, i) => ({ name: `n${i}`, pattern: `p${i}`, flags: '' }));
		const result = parseSaved(JSON.stringify(many));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved).toHaveLength(MAX_SAVED);
	});

	it('测试文本原样恢复，哪怕是空串（空串也是有意义的存档）', () => {
		const result = parseSaved(serializeSaved([entry({ input: '' })]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved[0].input).toBe('');
	});

	it('没有 input 键的旧配置照样能恢复，input 为 undefined', () => {
		const result = parseSaved(JSON.stringify([{ name: '日期', pattern: '\\d+', flags: 'g' }]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved[0].input).toBeUndefined();
	});

	it('input 不是字符串时忽略，不判坏数据', () => {
		const result = parseSaved(JSON.stringify([{ name: 'x', pattern: '\\d+', flags: 'g', input: 42 }]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.saved[0].input).toBeUndefined();
	});

	it('坏数据整体失败，不给半套', () => {
		expect(parseSaved('不是 JSON').ok).toBe(false);
		expect(parseSaved('{"a":1}').ok).toBe(false);
		expect(parseSaved('[1]').ok).toBe(false);
		expect(parseSaved('[{"name":"x","flags":"g"}]').ok).toBe(false);
	});
});
