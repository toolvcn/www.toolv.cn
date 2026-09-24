// 日期计算的纯函数：解析、格式化、日期差、加减（含工作日模式与月末钳制）、工作日统计。
// 全部基于 UTC 正午（12:00）计算，躲开时区偏移与夏令时的坑；不碰 DOM，node 可直接单测。
import type { AddResult, BusinessStats, DiffStats, Unit } from './types.ts';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/**
 * 解析 'YYYY-MM-DD' 为 UTC 正午的 Date。
 * 严格校验：格式不对或日溢出（如 2026-02-31 被 Date 滚到 3 月）都返回 null。
 */
export function parseDate(input: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
	if (!m) return null;
	const year = Number(m[1]);
	const month = Number(m[2]) - 1;
	const day = Number(m[3]);
	const date = new Date(Date.UTC(year, month, day, 12));
	// Date 构造会静默进位：月份或日期对不上就是非法日期
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
		return null;
	}
	return date;
}

/** 格式化为 YYYY-MM-DD */
export function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** 星期几的中文说法，如「星期三」 */
export function weekdayLabel(date: Date): string {
	return `星期${WEEKDAYS[date.getUTCDay()]}`;
}

/** 相差天数（b - a，同为 UTC 正午时无夏令时干扰） */
export function diffInDays(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** 满月数：以「日」为锚，不足整月的零头舍去（1-31 到次年 3-1 算 14 个满月） */
export function fullMonthsBetween(a: Date, b: Date): number {
	const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
	return b.getUTCDate() >= a.getUTCDate() ? months : months - 1;
}

/** 某年某月的天数；month 允许越界，Date 会归一化 */
function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
}

/** 两个日期的相差统计。方向不拘：结束早于开始时按绝对值展示并标 swapped */
export function diffStats(startInput: string, endInput: string): DiffStats | null {
	const start = parseDate(startInput);
	const end = parseDate(endInput);
	if (!start || !end) return null;

	const swapped = end.getTime() < start.getTime();
	const [from, to] = swapped ? [end, start] : [start, end];

	const days = diffInDays(from, to);
	const months = fullMonthsBetween(from, to);
	return {
		swapped,
		days,
		inclusiveDays: days + 1,
		weeks: Math.round((days / 7) * 10) / 10,
		months,
		years: Math.floor(months / 12),
		startWeekday: weekdayLabel(start),
		endWeekday: weekdayLabel(end)
	};
}

/** 按日历日推进 |amount| 天；businessOnly 时跳过周六周日（负数同理倒着走） */
export function addDaysBusiness(base: Date, amount: number, businessOnly: boolean): Date {
	const step = amount >= 0 ? 1 : -1;
	const result = new Date(base.getTime());
	let remaining = Math.abs(amount);
	while (remaining > 0) {
		result.setUTCDate(result.getUTCDate() + step);
		const weekday = result.getUTCDay();
		if (businessOnly && (weekday === 0 || weekday === 6)) continue;
		remaining -= 1;
	}
	return result;
}

/**
 * 按日历月推进，目标月不存在的那天钳到月末（1-31 加一个月 → 2-28/29，不会静默滚进 3 月）。
 */
export function addMonthsClamped(base: Date, amount: number): Date {
	const year = base.getUTCFullYear();
	const month = base.getUTCMonth() + amount;
	const day = Math.min(base.getUTCDate(), daysInMonth(year, month));
	return new Date(Date.UTC(year, month, day, 12));
}

/** 日期加减的总入口：单位分派，businessOnly 只对「天」生效 */
export function addDate(baseInput: string, amount: number, unit: Unit, businessOnly: boolean): AddResult | null {
	const base = parseDate(baseInput);
	if (!base || !Number.isFinite(amount) || amount === 0) return null;

	let result: Date;
	switch (unit) {
		case 'day':
			result = addDaysBusiness(base, amount, businessOnly);
			break;
		case 'week':
			result = addDaysBusiness(base, amount * 7, false);
			break;
		case 'month':
			result = addMonthsClamped(base, amount);
			break;
		case 'year':
			result = addMonthsClamped(base, amount * 12);
			break;
	}

	const verb = amount > 0 ? '加' : '减';
	const absAmount = Math.abs(amount);
	const unitLabel = { day: '天', week: '周', month: '个月', year: '年' }[unit];
	return {
		formatted: formatDate(result),
		weekday: weekdayLabel(result),
		summary: `${formatDate(base)} ${verb} ${absAmount} ${unitLabel} → ${formatDate(result)}（${weekdayLabel(result)}）`
	};
}

/**
 * 区间工作日统计（含头含尾）。口径：周一到周五为工作日，
 * 不考虑法定节假日与调休 —— 纯数学口径，页面上会注明。
 */
export function businessStats(startInput: string, endInput: string): BusinessStats | null {
	const start = parseDate(startInput);
	const end = parseDate(endInput);
	if (!start || !end || end.getTime() < start.getTime()) return null;

	const totalDays = diffInDays(start, end) + 1;
	let weekendDays = 0;
	const cursor = new Date(start.getTime());
	for (let i = 0; i < totalDays; i += 1) {
		const weekday = cursor.getUTCDay();
		if (weekday === 0 || weekday === 6) weekendDays += 1;
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return { totalDays, weekendDays, businessDays: totalDays - weekendDays };
}
