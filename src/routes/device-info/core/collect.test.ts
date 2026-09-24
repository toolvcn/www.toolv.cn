// 采集层里的纯函数单测：格式化与哈希都不碰浏览器 API，能在 node 里直接跑。
// 真正读 navigator / performance 的那几个函数只能在浏览器里验，这里不碰。
import { describe, expect, it } from 'vitest';
import { countByKind, fnv1a, formatBatterySeconds, formatDuration, permissionStateLabel } from './collect.ts';

describe('formatDuration', () => {
	it('不到 1 秒按毫秒给，四舍五入到整数', () => {
		expect(formatDuration(120)).toBe('120 ms');
		expect(formatDuration(999.4)).toBe('999 ms');
		expect(formatDuration(0)).toBe('0 ms');
	});

	it('1 秒起换算成秒，保留两位', () => {
		expect(formatDuration(1000)).toBe('1.00 s');
		expect(formatDuration(2500)).toBe('2.50 s');
		expect(formatDuration(1500)).toBe('1.50 s');
	});

	it('拿不到的值返回 undefined，不写这一行', () => {
		expect(formatDuration(undefined)).toBeUndefined();
		expect(formatDuration(Number.NaN)).toBeUndefined();
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBeUndefined();
		expect(formatDuration(-1)).toBeUndefined();
	});
});

describe('formatBatterySeconds', () => {
	it('Infinity 表示估不出来，不能当数字写出去', () => {
		expect(formatBatterySeconds(Number.POSITIVE_INFINITY, '已充满')).toBeUndefined();
		expect(formatBatterySeconds(undefined, '已充满')).toBeUndefined();
	});

	it('0 的含义由调用方给：充满与耗尽都可能是 0', () => {
		expect(formatBatterySeconds(0, '已充满')).toBe('已充满');
		expect(formatBatterySeconds(0, '即将耗尽')).toBe('即将耗尽');
	});

	it('分钟与小时两档都按中文给', () => {
		expect(formatBatterySeconds(600, '已充满')).toBe('10 分钟');
		expect(formatBatterySeconds(3600, '已充满')).toBe('1 小时');
		expect(formatBatterySeconds(5400, '已充满')).toBe('1 小时 30 分');
	});
});

describe('fnv1a', () => {
	it('同一输入永远给同一个 8 位十六进制串', () => {
		const first = fnv1a('toolv.cn 设备指纹');
		expect(first).toBe(fnv1a('toolv.cn 设备指纹'));
		expect(first).toMatch(/^[0-9a-f]{8}$/);
	});

	it('空串落在 FNV 的初始偏移量上', () => {
		expect(fnv1a('')).toBe('811c9dc5');
	});

	it('差一个字符就是另一个值', () => {
		expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
	});
});

describe('countByKind', () => {
	it('按 kind 分别计数', () => {
		const devices = [
			{ kind: 'videoinput', label: '摄像头 A' },
			{ kind: 'audioinput', label: '' },
			{ kind: 'audiooutput', label: '扬声器' },
			{ kind: 'audioinput', label: '' }
		];
		expect(countByKind(devices, 'videoinput')).toBe(1);
		expect(countByKind(devices, 'audioinput')).toBe(2);
		expect(countByKind(devices, 'audiooutput')).toBe(1);
	});

	it('没有这一类就给 0，不会 NaN', () => {
		expect(countByKind([], 'videoinput')).toBe(0);
	});
});

describe('permissionStateLabel', () => {
	it('三态各给一句中文', () => {
		expect(permissionStateLabel('granted')).toBe('已授权');
		expect(permissionStateLabel('denied')).toBe('已拒绝');
		expect(permissionStateLabel('prompt')).toBe('未决定');
	});

	it('认不出的状态与空值都返回 undefined', () => {
		expect(permissionStateLabel('unknown')).toBeUndefined();
		expect(permissionStateLabel(undefined)).toBeUndefined();
	});
});
