// URL 参数的单测。独立窗口的配置全靠它，写错一点就是「地址打开来跟预期不一样」，
// 所以三条都要钉住：认得的写法、认不出时的兜底、以及「编出去再解回来」的往返一致性。
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CLOCK_OPTIONS,
	DEFAULT_COUNTDOWN_OPTIONS,
	DEFAULT_STOPWATCH_OPTIONS,
	DEFAULT_STYLE,
	DEFAULT_TEXT_OPTIONS,
	TEXT_MAX_LENGTH
} from '../config.ts';
import { buildDisplayQuery, parseClockParam, parseDisplayParams, parseDurationParam } from './params.ts';
import type { DisplaySource } from './params.ts';

describe('parseDurationParam', () => {
	it('纯数字按秒算', () => {
		expect(parseDurationParam('1800')).toBe(1_800_000);
	});

	it('认 30m / 1h30m / 90s / 1h 这几种手写写法', () => {
		expect(parseDurationParam('30m')).toBe(1_800_000);
		expect(parseDurationParam('1h30m')).toBe(5_400_000);
		expect(parseDurationParam('90s')).toBe(90_000);
		expect(parseDurationParam('1h')).toBe(3_600_000);
	});

	it('认不出来的一律 null', () => {
		expect(parseDurationParam('')).toBeNull();
		expect(parseDurationParam('abc')).toBeNull();
		expect(parseDurationParam('1x')).toBeNull();
		expect(parseDurationParam('m')).toBeNull();
	});
});

describe('parseClockParam', () => {
	it('认 HH:MM 与 HH:MM:SS', () => {
		expect(parseClockParam('20:00')).toEqual({ hour: 20, minute: 0, second: 0 });
		expect(parseClockParam('9:05:30')).toEqual({ hour: 9, minute: 5, second: 30 });
	});

	it('越界或格式不对都给 null', () => {
		expect(parseClockParam('24:00')).toBeNull();
		expect(parseClockParam('20:60')).toBeNull();
		expect(parseClockParam('20')).toBeNull();
		expect(parseClockParam('aa:bb')).toBeNull();
		expect(parseClockParam('20:00:00:00')).toBeNull();
	});
});

describe('parseDisplayParams', () => {
	it('只解析地址里写了的项 —— 覆盖语义就靠这个', () => {
		const overrides = parseDisplayParams('?mode=countdown&bg=ff0000&alpha=0');
		expect(overrides.mode).toBe('countdown');
		expect(overrides.style.bg).toBe('#ff0000');
		expect(overrides.style.bgAlpha).toBe(0);
		// 没写的项一个都不该出现，否则会把本地配置整份盖掉
		expect(overrides.style.fg).toBeUndefined();
		expect(overrides.clockOptions.showSeconds).toBeUndefined();
	});

	it('显示角度与水平翻转', () => {
		expect(parseDisplayParams('rot=90').style.angle).toBe(90);
		expect(parseDisplayParams('rot=0').style.angle).toBe(0);
		expect(parseDisplayParams('flip=1').style.mirror).toBe(true);
		expect(parseDisplayParams('flip=0').style.mirror).toBe(false);
	});

	it('角度越界当作没写，裸地址即 0° / 不翻转', () => {
		expect(parseDisplayParams('rot=360').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=-1').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=abc').style.angle).toBeUndefined();
		expect(parseDisplayParams('').style.mirror).toBeUndefined();
	});

	it('认不出的值当作没写，不静默纠正成别的', () => {
		const overrides = parseDisplayParams('bg=zzz&font=comic&weight=9999&sec=maybe&size=1');
		expect(overrides.style.bg).toBeUndefined();
		expect(overrides.style.font).toBeUndefined();
		expect(overrides.style.weight).toBeUndefined();
		expect(overrides.style.sizeMode).toBeUndefined();
		expect(overrides.clockOptions.showSeconds).toBeUndefined();
	});

	it('布尔按 0 / 1 解析', () => {
		const overrides = parseDisplayParams('sec=0&tz=1&h12=1');
		expect(overrides.clockOptions.showSeconds).toBe(false);
		expect(overrides.clockOptions.showTimezone).toBe(true);
		expect(overrides.clockOptions.hourSystem).toBe('12');
	});

	it('size=auto 落自动档，具体像素落手动档', () => {
		expect(parseDisplayParams('size=auto').style.sizeMode).toBe('auto');
		const manual = parseDisplayParams('size=128').style;
		expect(manual.sizeMode).toBe('manual');
		expect(manual.fontSize).toBe(128);
	});

	it('前置文案按当前模式落到对应那一份上', () => {
		expect(parseDisplayParams('mode=countdown&prefix=距开播').countdownOptions.prefix).toBe('距开播');
		expect(parseDisplayParams('mode=stopwatch&prefix=本轮').stopwatchOptions.prefix).toBe('本轮');
	});

	it('倒计时的时长、目标时刻与超时开关', () => {
		const overrides = parseDisplayParams('dur=30m&at=20:30&over=1');
		expect(overrides.countdownOptions.durationMs).toBe(1_800_000);
		expect(overrides.countdownOptions.dailyHour).toBe(20);
		expect(overrides.countdownOptions.dailyMinute).toBe(30);
		expect(overrides.countdownOptions.dailySecond).toBe(0);
		expect(overrides.countdownOptions.overtime).toBe(true);
	});

	it('角度与翻转：裸地址不带这两项即 0 度 / 不翻转', () => {
		expect(parseDisplayParams('').style.angle).toBeUndefined();
		expect(parseDisplayParams('').style.mirror).toBeUndefined();
		expect(parseDisplayParams('rot=90&flip=1').style.angle).toBe(90);
		expect(parseDisplayParams('rot=90&flip=1').style.mirror).toBe(true);
	});

	it('角度越界或写得认不出来时不覆盖', () => {
		expect(parseDisplayParams('rot=400').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=-1').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=abc').style.angle).toBeUndefined();
		expect(parseDisplayParams('flip=maybe').style.mirror).toBeUndefined();
	});

	it('秒表精度长短两种写法都认', () => {
		expect(parseDisplayParams('prec=ms').stopwatchOptions.precision).toBe('millisecond');
		expect(parseDisplayParams('prec=tenth').stopwatchOptions.precision).toBe('tenth');
		expect(parseDisplayParams('prec=second').stopwatchOptions.precision).toBe('second');
	});

	it('角度与翻转：写在地址里才生效，越界与乱写当作没写', () => {
		expect(parseDisplayParams('rot=90').style.angle).toBe(90);
		expect(parseDisplayParams('flip=1').style.mirror).toBe(true);
		expect(parseDisplayParams('flip=0').style.mirror).toBe(false);
		expect(parseDisplayParams('rot=400').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=-30').style.angle).toBeUndefined();
		expect(parseDisplayParams('rot=abc').style.angle).toBeUndefined();
		expect(parseDisplayParams('flip=maybe').style.mirror).toBeUndefined();
	});

	it('裸地址不带角度与翻转 —— 默认就是不转', () => {
		expect(parseDisplayParams('').style.angle).toBeUndefined();
		expect(parseDisplayParams('').style.mirror).toBeUndefined();
	});
});

describe('地址的往返一致性', () => {
	const source: DisplaySource = {
		mode: 'countdown',
		style: {
			...DEFAULT_STYLE,
			bg: '#123456',
			bgAlpha: 40,
			fg: '#abcdef',
			sizeMode: 'manual',
			fontSize: 120,
			padding: 6,
			outline: 'strong',
			angle: 270,
			mirror: true
		},
		clockOptions: {
			...DEFAULT_CLOCK_OPTIONS,
			hourSystem: '12',
			blinkColon: true,
			showTimezone: true,
			dateFormat: 'cn'
		},
		countdownOptions: {
			...DEFAULT_COUNTDOWN_OPTIONS,
			kind: 'duration',
			durationMs: 90_000,
			overtime: true,
			prefix: '距开播'
		},
		stopwatchOptions: { ...DEFAULT_STOPWATCH_OPTIONS, precision: 'tenth' },
		textOptions: { ...DEFAULT_TEXT_OPTIONS, content: '会议中\n请勿打扰', align: 'left' }
	};

	it('编出去的地址解回来与原配置逐项一致', () => {
		const overrides = parseDisplayParams(buildDisplayQuery(source));
		expect(overrides.mode).toBe('countdown');
		expect(overrides.style).toMatchObject({
			bg: '#123456',
			bgAlpha: 40,
			fg: '#abcdef',
			sizeMode: 'manual',
			fontSize: 120,
			padding: 6,
			outline: 'strong',
			angle: 270,
			mirror: true
		});
		expect(overrides.clockOptions).toMatchObject({
			hourSystem: '12',
			blinkColon: true,
			showTimezone: true,
			dateFormat: 'cn'
		});
		expect(overrides.countdownOptions).toMatchObject({
			kind: 'duration',
			durationMs: 90_000,
			overtime: true,
			prefix: '距开播'
		});
		expect(overrides.stopwatchOptions).toMatchObject({ precision: 'tenth' });
	});

	it('全量写：默认值也一并写进去，地址才能独立成立', () => {
		const query = buildDisplayQuery({ ...source, mode: 'clock', style: { ...DEFAULT_STYLE } });
		const overrides = parseDisplayParams(query);
		// 样式每一项都该被写出来（而不是省略掉「与默认相同」的那些）
		expect(overrides.style).toMatchObject({
			bg: DEFAULT_STYLE.bg.toLowerCase(),
			bgAlpha: DEFAULT_STYLE.bgAlpha,
			sizeMode: 'auto',
			font: DEFAULT_STYLE.font,
			weight: DEFAULT_STYLE.weight,
			outline: DEFAULT_STYLE.outline
		});
	});

	it('时刻型的目标时刻（含秒）不会在往返里丢', () => {
		const daily: DisplaySource = {
			...source,
			countdownOptions: { ...source.countdownOptions, kind: 'daily', dailyHour: 9, dailyMinute: 5, dailySecond: 30 }
		};
		expect(parseDisplayParams(buildDisplayQuery(daily)).countdownOptions).toMatchObject({
			dailyHour: 9,
			dailyMinute: 5,
			dailySecond: 30
		});
	});

	it('空前置文案不占地址位置', () => {
		const silent: DisplaySource = {
			...source,
			countdownOptions: { ...source.countdownOptions, prefix: '' }
		};
		expect(buildDisplayQuery(silent)).not.toContain('prefix');
	});

	it('文字模式的内容与对齐也逐字往返一致', () => {
		const text: DisplaySource = { ...source, mode: 'text' };
		expect(parseDisplayParams(buildDisplayQuery(text)).textOptions).toMatchObject({
			content: '会议中\n请勿打扰',
			align: 'left'
		});
	});
});

describe('文字模式的参数', () => {
	it('内容超长会截断，不把地址撑爆', () => {
		const long = encodeURIComponent('字'.repeat(TEXT_MAX_LENGTH + 50));
		expect(parseDisplayParams(`text=${long}`).textOptions.content).toHaveLength(TEXT_MAX_LENGTH);
	});

	it('对齐只认 center / left', () => {
		expect(parseDisplayParams('align=left').textOptions.align).toBe('left');
		expect(parseDisplayParams('align=center').textOptions.align).toBe('center');
		expect(parseDisplayParams('align=right').textOptions.align).toBeUndefined();
	});

	it('换行会原样解回来（地址里是编码过的）', () => {
		const query = buildDisplayQuery({
			mode: 'text',
			style: { ...DEFAULT_STYLE },
			clockOptions: { ...DEFAULT_CLOCK_OPTIONS },
			countdownOptions: { ...DEFAULT_COUNTDOWN_OPTIONS },
			stopwatchOptions: { ...DEFAULT_STOPWATCH_OPTIONS },
			textOptions: { content: '第一行\n第二行', align: 'center' }
		});
		expect(parseDisplayParams(query).textOptions.content).toBe('第一行\n第二行');
	});
});
