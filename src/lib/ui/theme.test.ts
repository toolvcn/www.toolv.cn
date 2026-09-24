// 主题的解析逻辑（纯函数，不碰 DOM）—— 状态机里唯一值得测的部分：
// 三态怎么落到深浅、存储值怎么还原成偏好、循环顺序对不对。
import { describe, expect, it } from 'vitest';
import { nextPreference, parseStoredPreference, resolveTheme, type ThemePreference } from './theme.svelte.ts';

describe('resolveTheme', () => {
	it('跟随系统时由系统决定', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});

	it('显式选择时不看系统', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('parseStoredPreference', () => {
	it('认得两个显式值', () => {
		expect(parseStoredPreference('light')).toBe('light');
		expect(parseStoredPreference('dark')).toBe('dark');
	});

	it('没存过或存了脏值都当跟随系统', () => {
		expect(parseStoredPreference(null)).toBe('system');
		expect(parseStoredPreference('')).toBe('system');
		expect(parseStoredPreference('DARK')).toBe('system');
	});
});

describe('nextPreference', () => {
	it('按 系统 → 浅 → 深 循环', () => {
		const order: ThemePreference[] = ['system', 'light', 'dark'];
		expect(nextPreference('system')).toBe('light');
		expect(nextPreference('light')).toBe('dark');
		expect(nextPreference('dark')).toBe('system');
		expect(order).toHaveLength(3);
	});
});
