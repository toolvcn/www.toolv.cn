// 时间戳转换工具纯函数与 store 的单测。
import { beforeEach, describe, expect, it } from 'vitest';
import {
	dateFromLocalText,
	dateFromTimestamp,
	diffTimestamps,
	epochOf,
	formatDiff,
	formatInZone,
	formatLocal,
	formatUtc,
	nowStampText,
	parseNumber,
	resolveTimestampMs
} from './format.ts';
import { tsStore } from './store.svelte.ts';

beforeEach(() => {
	tsStore.tsText = '1704067200';
	tsStore.tsUnit = 'auto';
	tsStore.localText = '';
	tsStore.cmpAText = '';
	tsStore.cmpBText = '';
	tsStore.cmpUnit = 'auto';
});

describe('parseNumber', () => {
	it('合法数字与带空白输入都能解析', () => {
		expect(parseNumber('1704067200')).toBe(1704067200);
		expect(parseNumber('  1.75e3 ')).toBe(1750);
		expect(parseNumber('-1000')).toBe(-1000);
	});

	it('空串与垃圾输入返回 null', () => {
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('   ')).toBeNull();
		expect(parseNumber('abc')).toBeNull();
	});
});

describe('resolveTimestampMs（auto 识别单位）', () => {
	it('小于 1e11 的数值当秒', () => {
		expect(resolveTimestampMs(1_704_067_200, 'auto')).toBe(1_704_067_200_000);
		expect(resolveTimestampMs(1, 'auto')).toBe(1000);
	});

	it('不小于 1e11 的数值当毫秒', () => {
		expect(resolveTimestampMs(1_704_067_200_000, 'auto')).toBe(1_704_067_200_000);
	});

	it('手动指定单位时不猜', () => {
		expect(resolveTimestampMs(1_704_067_200, 's')).toBe(1_704_067_200_000);
		expect(resolveTimestampMs(1_704_067_200, 'ms')).toBe(1_704_067_200);
	});

	it('负数（1970 前）也支持', () => {
		expect(resolveTimestampMs(-1000, 's')).toBe(-1_000_000);
	});

	it('超出 Date 可表示范围返回 null', () => {
		expect(resolveTimestampMs(1e14, 's')).toBeNull();
		expect(resolveTimestampMs(9e15, 'ms')).toBeNull();
	});
});

describe('日期格式化', () => {
	it('本地时间按 YYYY-MM-DD HH:mm:ss 输出且补零', () => {
		const date = new Date(2024, 0, 5, 9, 7, 3);
		expect(formatLocal(date)).toBe('2024-01-05 09:07:03');
	});

	it('UTC 输出与 toISOString 口径一致', () => {
		const date = new Date(Date.UTC(2024, 0, 5, 9, 7, 3, 120));
		expect(formatUtc(date)).toBe('2024-01-05 09:07:03');
	});

	it('时间 → 时间戳：毫秒与秒成对', () => {
		expect(epochOf(1_704_067_200_123)).toEqual({ seconds: 1_704_067_200, milliseconds: 1_704_067_200_123 });
	});
});

describe('人类时间输入', () => {
	it('datetime-local 格式可解析，非法格式返回 null', () => {
		expect(dateFromLocalText('2024-01-05T09:07')).not.toBeNull();
		expect(dateFromLocalText('2024-01-05 09:07')).toBeNull();
		expect(dateFromLocalText('abc')).toBeNull();
		expect(dateFromLocalText('')).toBeNull();
	});
});

describe('世界时钟', () => {
	it('UTC 时区显示同一时刻', () => {
		const text = formatInZone(1_704_067_200_000, 'UTC');
		expect(text.length).toBeGreaterThan(5);
		expect(text).toMatch(/\d/);
	});

	it('同一时刻在不同时区输出不同', () => {
		const shanghai = formatInZone(1_704_067_200_000, 'Asia/Shanghai');
		const utc = formatInZone(1_704_067_200_000, 'UTC');
		expect(shanghai).not.toBe(utc);
	});
});

describe('双时间戳差值', () => {
	it('按 B − A 拆成天时分秒与毫秒余数', () => {
		const diff = diffTimestamps(1_704_067_200_000, 1_704_067_200_000 + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 500);
		expect(diff).toMatchObject({ negative: false, days: 2, hours: 3, minutes: 4, seconds: 5, milliseconds: 500 });
		expect(diff.totalMs).toBe(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 500);
	});

	it('B 早于 A 时负号只出现在最前面，分量仍是正数', () => {
		const diff = diffTimestamps(1_704_067_200_000, 1_704_067_200_000 - 90_000);
		expect(diff.negative).toBe(true);
		expect(diff.totalMs).toBe(-90_000);
		expect([diff.days, diff.hours, diff.minutes, diff.seconds]).toEqual([0, 0, 1, 30]);
		expect(formatDiff(diff)).toBe('−0 天 0 小时 1 分 30 秒');
	});

	it('同一时刻差值为全零', () => {
		expect(formatDiff(diffTimestamps(1_704_067_200_000, 1_704_067_200_000))).toBe('0 天 0 小时 0 分 0 秒');
	});

	it('nowStampText 按单位给出位数', () => {
		expect(nowStampText('s').length).toBe(10);
		expect(nowStampText('auto').length).toBe(10);
		expect(nowStampText('ms').length).toBe(13);
		expect(Number(nowStampText('ms'))).toBeGreaterThanOrEqual(Number(nowStampText('s')) * 1000);
	});
});

describe('store', () => {
	it('默认示例时间戳解析成 2024-01-01 UTC 附近', () => {
		expect(tsStore.tsParsed).toMatchObject({ kind: 'ok' });
		expect(tsStore.tsUtcText).toBe('2024-01-01 00:00:00');
	});

	it('清空输入是 idle 而不是错误', () => {
		tsStore.tsText = '';
		expect(tsStore.tsParsed.kind).toBe('idle');
	});

	it('非法输入给错误文案', () => {
		tsStore.tsText = 'not-a-number';
		expect(tsStore.tsError).not.toBe('');
	});

	it('世界时钟参考来源随输入切换', () => {
		expect(tsStore.clockSource).toContain('时间戳');
		tsStore.tsText = '';
		tsStore.localText = '2024-02-01T12:00';
		expect(tsStore.clockSource).toContain('日期时间');
	});

	it('人类时间转毫秒在有效输入下给出数字', () => {
		tsStore.localText = '2024-01-01T08:00';
		expect(tsStore.localEpochMs).toBeTypeOf('number');
	});

	it('取现在会填成十位秒级时间戳', () => {
		tsStore.fillNow();
		expect(parseNumber(tsStore.tsText)).toBeTypeOf('number');
		expect(tsStore.tsText.length).toBe(10);
	});

	it('毫秒单位下取现在填的是毫秒且不重置单位选择', () => {
		tsStore.tsUnit = 'ms';
		tsStore.fillNow();
		expect(tsStore.tsUnit).toBe('ms');
		expect(tsStore.tsText.length).toBe(13);
	});

	it('dateFromTimestamp 越界返回统一错误', () => {
		const result = dateFromTimestamp(1e14, 's');
		if ('error' in result) expect(result.error).not.toBe('');
	});

	it('对比默认值：A 是此刻，B 留空', () => {
		tsStore.initCompare();
		expect(tsStore.cmpAText.length).toBe(10);
		expect(tsStore.cmpBText).toBe('');
		expect(tsStore.cmpDiff).toBeNull();
	});

	it('两侧都有效才出差值，方向是 B − A', () => {
		tsStore.cmpAText = '1704067200';
		tsStore.cmpBText = '1704067200';
		expect(tsStore.cmpDiff?.totalMs).toBe(0);

		tsStore.cmpBText = '1704067260';
		expect(tsStore.cmpDiff?.totalMs).toBe(60_000);
		expect(tsStore.cmpDiff?.minutes).toBe(1);

		tsStore.cmpBText = '1704067140';
		expect(tsStore.cmpDiff?.negative).toBe(true);
	});

	it('任一侧为空或非法时差值为空，脚注点明是哪一侧', () => {
		tsStore.cmpAText = '1704067200';
		tsStore.cmpBText = '';
		expect(tsStore.cmpDiff).toBeNull();
		expect(tsStore.cmpHint).toContain('都填上');

		tsStore.cmpBText = 'abc';
		expect(tsStore.cmpDiff).toBeNull();
		expect(tsStore.cmpHint).toContain('B');

		tsStore.cmpAText = 'abc';
		expect(tsStore.cmpHint).toContain('A');
	});

	it('对比单位切换后 A / B 一起改口径', () => {
		tsStore.cmpAText = '1704067200';
		tsStore.cmpBText = '1704067201';
		expect(tsStore.cmpDiff?.totalMs).toBe(1000); // auto 按秒读

		tsStore.setCmpUnit('ms');
		expect(tsStore.cmpDiff?.totalMs).toBe(1); // 同一串文本改按毫秒读
	});
});
