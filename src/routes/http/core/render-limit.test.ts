import { describe, expect, it } from 'vitest';
import { limitItems, limitText } from './render-limit.ts';

describe('渲染窗口', () => {
	it('没到上限就原样返回', () => {
		expect(limitText('abc', 10)).toEqual({ text: 'abc', truncated: false, total: 3 });
		expect(limitItems([1, 2], 5)).toEqual({ items: [1, 2], truncated: false, total: 2 });
	});

	it('超了就截断并给出总量', () => {
		expect(limitText('abcdef', 3)).toEqual({ text: 'abc', truncated: true, total: 6 });
		expect(limitItems([1, 2, 3, 4], 2).items).toEqual([1, 2]);
		expect(limitItems([1, 2, 3, 4], 2).truncated).toBe(true);
	});

	it('上限为 0 时也算截断（不是静默显示全部）', () => {
		expect(limitText('a', 0).truncated).toBe(true);
	});
});
