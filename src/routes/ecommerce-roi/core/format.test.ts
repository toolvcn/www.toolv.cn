// 格式化的单测（口径见 format.ts 文件头）：非有限值一律给「—」，不把「—」写成 0。
import { describe, expect, it } from 'vitest';
import { formatMoney, formatTimes } from './format.ts';

describe('格式化', () => {
	it('金额两位小数（不加千分位），倍数两位小数，Infinity 给占位', () => {
		expect(formatMoney(9900)).toBe('9900.00');
		expect(formatMoney(-1234.5)).toBe('-1234.50');
		expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('—');
		expect(formatTimes(4.95)).toBe('4.95');
		expect(formatTimes(Number.POSITIVE_INFINITY)).toBe('—');
	});
});
