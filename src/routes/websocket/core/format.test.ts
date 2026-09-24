// format.ts 的单测：展示格式化与预设解析。
import { describe, expect, it } from 'vitest';
import {
	defaultPresets,
	formatDuration,
	formatSize,
	formatTime,
	parsePresets,
	statusText,
	typeText
} from './format.ts';

describe('格式化', () => {
	it('formatDuration 按分秒展示', () => {
		expect(formatDuration(0)).toBe('0分0秒');
		expect(formatDuration(65_000)).toBe('1分5秒');
	});

	it('formatTime 输出 HH:MM:SS.mmm', () => {
		expect(formatTime(new Date(2026, 0, 1, 12, 30, 45, 7).getTime())).toBe('12:30:45.007');
	});

	it('formatSize 按 B / KB / MB 进位', () => {
		expect(formatSize('abc')).toBe('3 B');
		expect(formatSize('x'.repeat(2048))).toBe('2.0 KB');
		expect(formatSize('x'.repeat(1024 * 1024))).toBe('1.0 MB');
	});

	it('statusText 覆盖三种状态', () => {
		expect(statusText('connected')).toBe('已连接');
		expect(statusText('connecting')).toBe('连接中');
		expect(statusText('disconnected')).toBe('已断开');
	});

	it('typeText 保留 JSON 专有名词、其余翻成中文', () => {
		expect(typeText('JSON')).toBe('JSON');
		expect(typeText('Text')).toBe('文本');
	});
});

describe('defaultPresets', () => {
	it('内置两条常用预设，每次返回新数组', () => {
		const first = defaultPresets();
		expect(first).toHaveLength(2);
		expect(first.map((preset) => preset.label)).toEqual(['ping 消息', '认证请求']);
		// 返回的是新数组，改它不会污染下一次调用
		first[0].label = '改过了';
		expect(defaultPresets()[0].label).toBe('ping 消息');
	});
});

describe('parsePresets', () => {
	it('没存过或整份不可用时返回 null，交给调用方回退到内置预设', () => {
		expect(parsePresets(null)).toBeNull();
		expect(parsePresets('')).toBeNull();
		expect(parsePresets('not json')).toBeNull();
		expect(parsePresets('{"a":1}')).toBeNull();
	});

	it('正常解析', () => {
		expect(parsePresets('[{"id":1,"label":"a","data":"x"}]')).toEqual([{ id: 1, label: 'a', data: 'x' }]);
	});

	it('空数组是「用户删光了」，不能当成没存过', () => {
		expect(parsePresets('[]')).toEqual([]);
	});

	it('坏条目丢掉，不牵连其它条目', () => {
		const raw = JSON.stringify([
			{ id: 1, label: 'a', data: 'x' },
			{ id: 'nope', label: 'b', data: 'y' },
			{ id: 3, label: 42, data: 'z' },
			null,
			'junk',
			{ id: 6, label: 'c', data: 'w' }
		]);
		expect(parsePresets(raw)).toEqual([
			{ id: 1, label: 'a', data: 'x' },
			{ id: 6, label: 'c', data: 'w' }
		]);
	});
});
