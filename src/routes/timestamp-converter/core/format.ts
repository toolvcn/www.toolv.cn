// 时间戳转换的纯函数：解析数字、按单位换算、格式化展示。
// 全部用本地 Date 方法手动拼串，不用 toLocaleString —— 输出在单测里可预测。
// 不碰 DOM，node 环境可直接测。
import { TS_ERROR, type TsUnit } from './types.ts';

/** Date 能表示的范围边界（毫秒）：超了 new Date() 就是 Invalid Date */
const MS_LIMIT = 8.64e15;

/** 把用户输入的文本读成有限数字；空或非数字返回 null */
export function parseNumber(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return null;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}

/**
 * 按单位把数字时间戳换算成毫秒。
 * auto：|值| < 1e11 当成秒（约公元 5138 年前都成立），否则当毫秒。
 * 越界返回 null，界面走统一错误文案。
 */
export function resolveTimestampMs(value: number, unit: TsUnit): number | null {
	let ms: number;
	if (unit === 'ms') {
		ms = value;
	} else if (unit === 's') {
		ms = value * 1000;
	} else {
		ms = Math.abs(value) < 1e11 ? value * 1000 : value;
	}
	return Math.abs(ms) <= MS_LIMIT ? ms : null;
}

/** 毫秒数可表示时给 Date，否则返回错误字符串 */
export function dateFromTimestamp(value: number, unit: TsUnit): { date: Date } | { error: string } {
	const ms = resolveTimestampMs(value, unit);
	if (ms === null) return { error: TS_ERROR };
	return { date: new Date(ms) };
}

/**
 * 此刻的时间戳文本：毫秒单位填毫秒，其余（含 auto）填秒。
 * 只能在浏览器侧的交互里调用 —— 页面是预渲染的（+page.ts 的 prerender），
 * 若在模块初始化时算，构建时刻的时间戳会烘进 HTML，隔一阵再看就是错的。
 */
export function nowStampText(unit: TsUnit): string {
	const ms = Date.now();
	return String(unit === 'ms' ? ms : Math.floor(ms / 1000));
}

/** 本地时间 YYYY-MM-DD HH:mm:ss（本机时区） */
export function formatLocal(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
		date.getMinutes()
	)}:${pad(date.getSeconds())}`;
}

/** UTC 时间 YYYY-MM-DD HH:mm:ss（即 toISOString 去掉 T 与毫秒尾巴） */
export function formatUtc(date: Date): string {
	return date.toISOString().replace('T', ' ').slice(0, 19);
}

/** 秒与毫秒两套单位的结果：时间 → 时间戳方向用 */
export function epochOf(ms: number): { seconds: number; milliseconds: number } {
	return { seconds: Math.floor(ms / 1000), milliseconds: ms };
}

/**
 * datetime-local 的输入值（"2026-01-02T15:04"）→ 本机时区 Date。
 * 无效返回 null，由调用方报错。
 */
export function dateFromLocalText(text: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** 世界时钟某一行：同一时刻在指定时区的显示 */
export function formatInZone(ms: number, zone: string): string {
	return new Intl.DateTimeFormat('zh-CN', {
		dateStyle: 'short',
		timeStyle: 'medium',
		hour12: false,
		timeZone: zone
	}).format(new Date(ms));
}

// ------------------------------------------------------------------ 差值

/** 两个时间戳的差值分量，方向统一由 negative 表达 */
export interface TsDiff {
	/** B − A 的整毫秒数，负号表示 B 早于 A */
	totalMs: number;
	/** B 早于 A */
	negative: boolean;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	/** 不足一秒的毫秒余数（非负） */
	milliseconds: number;
}

/**
 * 把 B − A 拆成天 / 时 / 分 / 秒 / 毫秒。分量一律取绝对值，方向只看 negative ——
 * 否则会算出「−1 天 + 23 小时」这种没人读得懂的结果。
 */
export function diffTimestamps(msA: number, msB: number): TsDiff {
	const totalMs = msB - msA;
	const rest = Math.abs(totalMs);
	return {
		totalMs,
		negative: totalMs < 0,
		days: Math.floor(rest / 86_400_000),
		hours: Math.floor(rest / 3_600_000) % 24,
		minutes: Math.floor(rest / 60_000) % 60,
		seconds: Math.floor(rest / 1000) % 60,
		milliseconds: rest % 1000
	};
}

/** 差值的中文串：早于时在最前面给一个负号，例如「−2 天 3 小时 4 分 5 秒」 */
export function formatDiff(diff: TsDiff): string {
	const body = `${diff.days} 天 ${diff.hours} 小时 ${diff.minutes} 分 ${diff.seconds} 秒`;
	return diff.negative ? `−${body}` : body;
}
