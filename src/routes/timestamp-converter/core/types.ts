// 时间戳 & 时区转换的类型与常量。

/** 时间戳单位：auto 按量级猜（<1e11 当秒），可手动指定 */
export type TsUnit = 'auto' | 's' | 'ms';

/** 世界时钟对照表里的一行 */
export interface WorldZone {
	/** 界面显示名 */
	label: string;
	/** Intl timeZone 认的 IANA 名 */
	zone: string;
}

/** 预设的世界时钟：覆盖常用协作时区，顺序即显示顺序 */
export const WORLD_ZONES: WorldZone[] = [
	{ label: '北京', zone: 'Asia/Shanghai' },
	{ label: '东京', zone: 'Asia/Tokyo' },
	{ label: '新加坡', zone: 'Asia/Singapore' },
	{ label: '伦敦', zone: 'Europe/London' },
	{ label: '纽约', zone: 'America/New_York' },
	{ label: '洛杉矶', zone: 'America/Los_Angeles' },
	{ label: 'UTC', zone: 'UTC' }
];

/** 解析失败或越界的统一错误文案（界面与单测共用） */
export const TS_ERROR = '时间戳无效或超出可表示范围';
