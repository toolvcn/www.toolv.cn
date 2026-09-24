// 日期计算的类型、选项元数据与默认值。日期一律用 'YYYY-MM-DD' 字符串进出，
// 对齐 <input type="date"> 的原生格式。

/** 三个工作区：日期差 / 日期加减 / 工作日统计 */
export type DateTab = 'diff' | 'add' | 'business';

/** 加减的时间单位 */
export type Unit = 'day' | 'week' | 'month' | 'year';

export interface UnitOption {
	value: Unit;
	label: string;
	description: string;
}

export const UNIT_OPTIONS: ReadonlyArray<UnitOption> = [
	{ value: 'day', label: '天', description: '按日历日推进；勾选「跳过周末」时只走工作日' },
	{ value: 'week', label: '周', description: '一周 = 7 个日历日' },
	{ value: 'month', label: '月', description: '按日历月推进，月末自动钳制（1-31 加一个月不会跳到 3 月）' },
	{ value: 'year', label: '年', description: '按日历年推进，2-29 加一年钳到 2-28' }
];

/** 日期差统计。days 起算绝对值，swapped 标记结束早于开始的情形 */
export interface DiffStats {
	swapped: boolean;
	/** 相差天数（不含头） */
	days: number;
	/** 含头含尾的天数 = days + 1（请假、工期口径） */
	inclusiveDays: number;
	/** 约合周数（一位小数） */
	weeks: number;
	/** 满月数：不足整月的零头舍去 */
	months: number;
	/** 满年数：按满月数折算 */
	years: number;
	/** 两个日期各自的星期几 */
	startWeekday: string;
	endWeekday: string;
}

/** 日期加减结果 */
export interface AddResult {
	/** 结果日期，格式 YYYY-MM-DD */
	formatted: string;
	weekday: string;
	/** 人话描述整个过程，如「2026-09-05 加 30 天 → 2026-10-05」 */
	summary: string;
}

/** 工作日统计。口径：周一到周五算工作日，不含法定节假日调休 */
export interface BusinessStats {
	totalDays: number;
	businessDays: number;
	weekendDays: number;
}

/** 三个标签各自的默认示例，固定值保证预渲染的 HTML 稳定（不用当天日期，避免构建时冻结） */
export const EXAMPLES = {
	diff: { start: '2026-01-01', end: '2026-10-01' },
	add: { base: '2026-09-07', amount: 30, unit: 'day' as Unit, minus: false, businessOnly: false },
	business: { start: '2026-09-01', end: '2026-09-30' }
};
