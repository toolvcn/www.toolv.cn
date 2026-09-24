// 日期计算纯函数的单测：解析校验、日期差、加减（工作日模式、月末钳制）、工作日统计。
import { describe, expect, it } from 'vitest';
import {
	addDate,
	addMonthsClamped,
	businessStats,
	diffInDays,
	diffStats,
	formatDate,
	fullMonthsBetween,
	parseDate,
	weekdayLabel
} from './date.ts';

describe('parseDate', () => {
	it('合法日期返回 UTC 正午的 Date', () => {
		const date = parseDate('2026-09-05');
		expect(date).not.toBeNull();
		expect(date!.toISOString()).toBe('2026-09-05T12:00:00.000Z');
	});

	it('格式不对返回 null', () => {
		expect(parseDate('')).toBeNull();
		expect(parseDate('2026/09/05')).toBeNull();
		expect(parseDate('2026-9-5')).toBeNull();
	});

	it('日溢出（2-31、4-31）返回 null，不被 Date 静默进位', () => {
		expect(parseDate('2026-02-31')).toBeNull();
		expect(parseDate('2026-04-31')).toBeNull();
	});

	it('闰年 2-29 合法、平年 2-29 非法', () => {
		expect(parseDate('2024-02-29')).not.toBeNull();
		expect(parseDate('2026-02-29')).toBeNull();
	});
});

describe('formatDate / weekdayLabel', () => {
	it('格式化与星期标签', () => {
		expect(formatDate(parseDate('2026-09-05')!)).toBe('2026-09-05');
		expect(weekdayLabel(parseDate('2026-09-05')!)).toBe('星期六');
		expect(weekdayLabel(parseDate('2026-09-07')!)).toBe('星期一');
	});
});

describe('diffInDays / fullMonthsBetween', () => {
	it('同月相差、跨年相差', () => {
		expect(diffInDays(parseDate('2026-09-01')!, parseDate('2026-09-30')!)).toBe(29);
		expect(diffInDays(parseDate('2026-01-01')!, parseDate('2027-01-01')!)).toBe(365);
		expect(diffInDays(parseDate('2028-01-01')!, parseDate('2029-01-01')!)).toBe(366);
	});

	it('满月数按「日」锚定，零头舍去', () => {
		expect(fullMonthsBetween(parseDate('2026-01-31')!, parseDate('2026-03-01')!)).toBe(1);
		expect(fullMonthsBetween(parseDate('2026-01-01')!, parseDate('2026-03-01')!)).toBe(2);
		expect(fullMonthsBetween(parseDate('2025-03-15')!, parseDate('2026-03-15')!)).toBe(12);
	});
});

describe('diffStats', () => {
	it('常规区间：天数、含头含尾、周月年', () => {
		const stats = diffStats('2026-01-01', '2026-10-01');
		expect(stats).not.toBeNull();
		expect(stats!.days).toBe(273);
		expect(stats!.inclusiveDays).toBe(274);
		expect(stats!.weeks).toBe(39);
		expect(stats!.months).toBe(9);
		expect(stats!.years).toBe(0);
		expect(stats!.swapped).toBe(false);
	});

	it('结束早于开始：按绝对值展示并标 swapped', () => {
		const stats = diffStats('2026-10-01', '2026-01-01');
		expect(stats!.days).toBe(273);
		expect(stats!.swapped).toBe(true);
	});

	it('非法输入返回 null', () => {
		expect(diffStats('', '2026-01-01')).toBeNull();
		expect(diffStats('bad', '2026-01-01')).toBeNull();
	});

	it('同一天：相差 0 天、含头含尾 1 天', () => {
		const stats = diffStats('2026-09-05', '2026-09-05');
		expect(stats!.days).toBe(0);
		expect(stats!.inclusiveDays).toBe(1);
	});
});

describe('addMonthsClamped', () => {
	it('月末钳制：1-31 加一个月落在 2-28，不滚进 3 月', () => {
		expect(formatDate(addMonthsClamped(parseDate('2026-01-31')!, 1))).toBe('2026-02-28');
		expect(formatDate(addMonthsClamped(parseDate('2024-01-31')!, 1))).toBe('2024-02-29');
	});

	it('负数与跨年', () => {
		expect(formatDate(addMonthsClamped(parseDate('2026-03-31')!, -1))).toBe('2026-02-28');
		expect(formatDate(addMonthsClamped(parseDate('2026-12-15')!, 2))).toBe('2027-02-15');
	});
});

describe('addDate', () => {
	it('加天：普通与跨月', () => {
		expect(addDate('2026-09-07', 30, 'day', false)?.formatted).toBe('2026-10-07');
		expect(addDate('2026-09-25', 10, 'day', false)?.formatted).toBe('2026-10-05');
	});

	it('跳过周末：周五加 1 个工作日落到周一；跨周末加 5 个工作日', () => {
		// 2026-09-04 是周五：+1 工作日 → 周一 09-07
		expect(addDate('2026-09-04', 1, 'day', true)?.formatted).toBe('2026-09-07');
		// 2026-09-07 是周一：+5 工作日 → 下周一 09-14
		expect(addDate('2026-09-07', 5, 'day', true)?.formatted).toBe('2026-09-14');
	});

	it('减天与减工作日', () => {
		expect(addDate('2026-09-07', -7, 'day', false)?.formatted).toBe('2026-08-31');
		// 2026-09-07 周一减 1 个工作日 → 上周五 09-04
		expect(addDate('2026-09-07', -1, 'day', true)?.formatted).toBe('2026-09-04');
	});

	it('周 / 月 / 年：月年走钳制，周不跳周末', () => {
		expect(addDate('2026-01-31', 1, 'month', false)?.formatted).toBe('2026-02-28');
		expect(addDate('2026-09-07', 1, 'week', false)?.formatted).toBe('2026-09-14');
		expect(addDate('2024-02-29', 1, 'year', false)?.formatted).toBe('2025-02-28');
	});

	it('businessOnly 对非「天」单位不生效', () => {
		expect(addDate('2026-09-04', 1, 'week', true)?.formatted).toBe('2026-09-11');
	});

	it('amount 为 0 或非法输入返回 null', () => {
		expect(addDate('2026-09-07', 0, 'day', false)).toBeNull();
		expect(addDate('', 3, 'day', false)).toBeNull();
	});

	it('summary 是完整人话描述', () => {
		expect(addDate('2026-09-07', -3, 'month', false)?.summary).toBe('2026-09-07 减 3 个月 → 2026-06-07（星期日）');
	});
});

describe('businessStats', () => {
	it('整月区间：30 天含 22 个工作日、8 个周末日（2026-09）', () => {
		const stats = businessStats('2026-09-01', '2026-09-30');
		expect(stats!.totalDays).toBe(30);
		expect(stats!.weekendDays).toBe(8);
		expect(stats!.businessDays).toBe(22);
	});

	it('单天区间：工作日与周末日各自成立', () => {
		expect(businessStats('2026-09-07', '2026-09-07')!.businessDays).toBe(1);
		expect(businessStats('2026-09-06', '2026-09-06')!.weekendDays).toBe(1);
	});

	it('结束早于开始返回 null（区间要求方向正确）', () => {
		expect(businessStats('2026-09-30', '2026-09-01')).toBeNull();
	});

	it('非法输入返回 null', () => {
		expect(businessStats('bad', '2026-09-01')).toBeNull();
	});
});
