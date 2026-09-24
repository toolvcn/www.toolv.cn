// 时间换算与解析的单测。这些函数是三个模式共用的地基，写错了整页都不对，
// 所以边界（取整方向、跨天、小数位、非法输入）都要钉住。
import { describe, expect, it } from 'vitest';
import {
	alignToPrecision,
	durationFromParts,
	formatClock,
	formatDate,
	formatDuration,
	nextDailyTarget,
	outlineColor,
	parseUnitText,
	rotateLayout,
	splitDuration,
	textWidthEm,
	timezoneLabel,
	weekdayLabel
} from './format.ts';

describe('alignToPrecision', () => {
	it('倒计时向上取整：差 1ms 到 30 分钟也算 30 分钟', () => {
		expect(alignToPrecision(1_799_999, 'second', 'up')).toBe(1_800_000);
	});

	it('秒表向下取整：走过 5.9 秒显示的是 5 秒', () => {
		expect(alignToPrecision(5_900, 'second', 'down')).toBe(5_000);
	});

	it('十分之一秒与毫秒档各自对齐', () => {
		expect(alignToPrecision(5_940, 'tenth', 'down')).toBe(5_900);
		expect(alignToPrecision(5_999, 'millisecond', 'down')).toBe(5_999);
	});

	it('负数先夹到 0，不会算出负向对齐的怪值', () => {
		expect(alignToPrecision(-1_500, 'second', 'up')).toBe(0);
	});
});

describe('formatDuration', () => {
	it('不足一小时不占小时位', () => {
		expect(formatDuration(1_800_000, 'second')).toBe('30:00');
		expect(formatDuration(59_000, 'second')).toBe('00:59');
	});

	it('超过一小时才补上小时位', () => {
		expect(formatDuration(5_400_000, 'second')).toBe('01:30:00');
	});

	it('按精度补小数位', () => {
		expect(formatDuration(65_300, 'tenth')).toBe('01:05.3');
		expect(formatDuration(65_345, 'millisecond')).toBe('01:05.345');
	});

	it('负数按 0 处理', () => {
		expect(formatDuration(-5_000, 'second')).toBe('00:00');
	});
});

describe('formatClock', () => {
	const noon = new Date(2026, 8, 20, 13, 5, 9).getTime();

	it('24 小时制带秒', () => {
		expect(formatClock(noon, '24', true)).toEqual({ time: '13:05:09', meridiem: '' });
	});

	it('关掉秒只有时分', () => {
		expect(formatClock(noon, '24', false).time).toBe('13:05');
	});

	it('12 小时制带上下午标记，13 点归一为 1 点', () => {
		expect(formatClock(noon, '12', true)).toEqual({ time: '01:05:09', meridiem: 'PM' });
	});

	it('午夜 0 点显示 12 点而不是 0 点', () => {
		const midnight = new Date(2026, 8, 20, 0, 0, 0).getTime();
		expect(formatClock(midnight, '12', false)).toEqual({ time: '12:00', meridiem: 'AM' });
	});
});

describe('日期与星期', () => {
	const day = new Date(2026, 8, 20, 10, 0, 0).getTime();

	it('两种日期格式', () => {
		expect(formatDate(day, 'iso')).toBe('2026-09-20');
		expect(formatDate(day, 'cn')).toBe('2026年9月20日');
		expect(formatDate(day, 'none')).toBe('');
	});

	it('星期按本地星期几给中文', () => {
		expect(weekdayLabel(day)).toBe('星期日');
	});

	it('时区标注带正负号，整点不补 :00', () => {
		expect(timezoneLabel(day)).toMatch(/^UTC[+-]\d+(:\d{2})?$/);
		expect(timezoneLabel(day)).not.toContain(':00');
	});
});

describe('nextDailyTarget', () => {
	it('今天的点还没到就用今天', () => {
		const from = new Date(2026, 8, 20, 8, 0, 0).getTime();
		const target = new Date(nextDailyTarget(from, 20, 0, 0));
		expect(target.getDate()).toBe(20);
		expect(target.getHours()).toBe(20);
	});

	it('今天的点已经过了就滚到明天', () => {
		const from = new Date(2026, 8, 20, 21, 0, 0).getTime();
		const target = new Date(nextDailyTarget(from, 20, 0, 0));
		expect(target.getDate()).toBe(21);
		expect(target.getHours()).toBe(20);
	});

	it('正好等于目标时刻也算「已经过了」，推到明天（否则会停在 00:00 不动）', () => {
		const from = new Date(2026, 8, 20, 20, 0, 0).getTime();
		expect(new Date(nextDailyTarget(from, 20, 0, 0)).getDate()).toBe(21);
	});

	it('跨月由 Date 自己进位', () => {
		const from = new Date(2026, 8, 30, 23, 0, 0).getTime();
		const target = new Date(nextDailyTarget(from, 20, 0, 0));
		expect(target.getMonth()).toBe(9);
		expect(target.getDate()).toBe(1);
	});
});

describe('时长的拆解与解析', () => {
	it('拆成时分秒', () => {
		expect(splitDuration(5_400_000 + 65_000)).toEqual({ hours: 1, minutes: 31, seconds: 5 });
	});

	it('拼回毫秒', () => {
		expect(durationFromParts(1, 31, 5)).toBe(5_465_000);
	});

	it('空串当 0，超上限与非法输入一律 null', () => {
		expect(parseUnitText('', 59)).toBe(0);
		expect(parseUnitText(' 7 ', 59)).toBe(7);
		expect(parseUnitText('60', 59)).toBeNull();
		expect(parseUnitText('1.5', 59)).toBeNull();
		expect(parseUnitText('-1', 59)).toBeNull();
		expect(parseUnitText('abc', 59)).toBeNull();
	});
});

describe('描边取色', () => {
	it('浅色文字配深描边，深色文字配浅描边', () => {
		expect(outlineColor('#ffffff')).toBe('rgba(0, 0, 0, 0.6)');
		expect(outlineColor('#111827')).toBe('rgba(255, 255, 255, 0.8)');
	});

	it('3 位简写按展开后的颜色判：`#abc` 是浅色，配深描边', () => {
		expect(outlineColor('#abc')).toBe('rgba(0, 0, 0, 0.6)');
		expect(outlineColor('#000')).toBe('rgba(255, 255, 255, 0.8)');
	});

	it('认不出的写法不炸，按「不是浅色」处理，配浅描边', () => {
		expect(outlineColor('')).toBe('rgba(255, 255, 255, 0.8)');
		expect(outlineColor('#12')).toBe('rgba(255, 255, 255, 0.8)');
	});
});

describe('文字宽度估算', () => {
	it('中文按整字宽、英文数字按半字宽', () => {
		// 「会议中」三个全角字 = 3em
		expect(textWidthEm('会议中', 0.6)).toBe(3);
		// 「12345」五个半角 = 5 × 0.6
		expect(textWidthEm('12345', 0.6)).toBeCloseTo(3, 5);
	});

	it('中英混排按各自宽度累加', () => {
		expect(textWidthEm('会议中 ok', 0.6)).toBeCloseTo(3 + 0.6 * 3, 5);
	});

	it('空串是 0，不会把除数算成负的', () => {
		expect(textWidthEm('', 0.6)).toBe(0);
	});

	it('字体族只影响半角那部分', () => {
		expect(textWidthEm('中ab', 0.5)).toBeCloseTo(1 + 1, 5);
		expect(textWidthEm('中ab', 0.6)).toBeCloseTo(1 + 1.2, 5);
	});
});

describe('rotateLayout', () => {
	// 480 × 180 是默认那档小窗的形状，横长竖短，正好能看出 90° 该不该对调
	const W = 480;
	const H = 180;

	it('0 度不转也不缩', () => {
		const layout = rotateLayout(0, false, W, H);
		expect(layout.swap).toBe(false);
		expect(layout.scale).toBe(1);
		expect(layout.transform).toContain('rotate(0deg)');
	});

	it('90 / 270 度把长宽对调，正好填满不用缩', () => {
		for (const angle of [90, 270]) {
			const layout = rotateLayout(angle, false, W, H);
			expect(layout.swap).toBe(true);
			expect(layout.scale).toBe(1);
		}
	});

	it('180 度只倒过来，长宽不对调也不用缩', () => {
		const layout = rotateLayout(180, false, W, H);
		expect(layout.swap).toBe(false);
		expect(layout.scale).toBe(1);
	});

	it('45 度缩到放得下，不再裁掉角', () => {
		const layout = rotateLayout(45, false, W, H);
		expect(layout.scale).toBeLessThan(1);
		// 缩完之后的外接框应当正好卡在容器里（误差来自四舍五入）
		const half = Math.SQRT1_2;
		const boxH = W * half + H * half;
		expect(boxH * layout.scale).toBeLessThanOrEqual(H + 1);
	});

	it('翻转写进 transform，与角度互不干扰', () => {
		expect(rotateLayout(0, true, W, H).transform).toContain('scaleX(-1)');
		expect(rotateLayout(0, false, W, H).transform).toContain('scaleX(1)');
	});

	it('负角度与超过 360 度都折回 0-359', () => {
		expect(rotateLayout(-90, false, W, H).transform).toContain('rotate(270deg)');
		expect(rotateLayout(450, false, W, H).transform).toContain('rotate(90deg)');
	});

	it('量不到尺寸时按不缩处理（SSR 首帧）', () => {
		expect(rotateLayout(45, false, 0, 0).scale).toBe(1);
	});
});

describe('rotateLayout（角度与翻转的摆放）', () => {
	/** 一块横着的 480 × 180 画布 */
	const W = 480;
	const H = 180;

	it('0° 不转不动：不对调也不缩', () => {
		expect(rotateLayout(0, false, W, H)).toMatchObject({ swap: false, scale: 1 });
	});

	it('90° / 270° 长宽对调，正好填满不用缩', () => {
		expect(rotateLayout(90, false, W, H)).toMatchObject({ swap: true, scale: 1 });
		expect(rotateLayout(270, false, W, H)).toMatchObject({ swap: true, scale: 1 });
	});

	it('180° 只是倒过来：不对调也不缩', () => {
		expect(rotateLayout(180, false, W, H)).toMatchObject({ swap: false, scale: 1 });
	});

	it('45° 这种斜角要整体缩到放得下', () => {
		const { scale } = rotateLayout(45, false, W, H);
		expect(scale).toBeLessThan(1);
		// 缩放后外接框的两个方向都不该超出容器
		const rad = Math.PI / 4;
		const boxW = W * Math.cos(rad) + H * Math.sin(rad);
		const boxH = W * Math.sin(rad) + H * Math.cos(rad);
		expect(boxW * scale).toBeLessThanOrEqual(W + 0.001);
		expect(boxH * scale).toBeLessThanOrEqual(H + 0.001);
	});

	it('transform 里带上角度、翻转与缩放', () => {
		expect(rotateLayout(90, true, W, H).transform).toContain('rotate(90deg)');
		expect(rotateLayout(90, true, W, H).transform).toContain('scaleX(-1)');
		expect(rotateLayout(0, false, W, H).transform).toContain('scaleX(1)');
	});

	it('角度超出 0-359 先归一，负数与 360 都收敛', () => {
		expect(rotateLayout(360, false, W, H).transform).toContain('rotate(0deg)');
		expect(rotateLayout(-90, false, W, H).transform).toContain('rotate(270deg)');
	});

	it('量不到尺寸（SSR 首帧）按不缩处理', () => {
		expect(rotateLayout(90, false, 0, 0)).toMatchObject({ swap: false, scale: 1 });
	});
});

describe('rotateLayout（显示角度的摆放）', () => {
	it('0 度：不对调、不缩放，transform 是恒等', () => {
		const layout = rotateLayout(0, false, 480, 180);
		expect(layout.swap).toBe(false);
		expect(layout.scale).toBe(1);
		expect(layout.transform).toContain('rotate(0deg)');
		expect(layout.transform).toContain('scale(1)');
	});

	it('90 / 270 度靠长宽对调填满，不用缩', () => {
		for (const angle of [90, 270]) {
			const layout = rotateLayout(angle, false, 480, 180);
			expect(layout.swap).toBe(true);
			expect(layout.scale).toBe(1);
		}
	});

	it('180 度不对调也不缩（外接框还是原来那么大）', () => {
		const layout = rotateLayout(180, false, 480, 180);
		expect(layout.swap).toBe(false);
		expect(layout.scale).toBe(1);
	});

	it('45 度会缩到放得下：外接框比容器大，缩完不裁切', () => {
		const layout = rotateLayout(45, false, 480, 180);
		expect(layout.scale).toBeLessThan(1);
		// 缩完之后的外接框应当正好贴住容器（宽度或高度有一边卡住）
		const rad = Math.PI / 4;
		const cos = Math.abs(Math.cos(rad));
		const sin = Math.abs(Math.sin(rad));
		const boxW = (480 * cos + 180 * sin) * layout.scale;
		const boxH = (480 * sin + 180 * cos) * layout.scale;
		expect(Math.min(480 / boxW, 180 / boxH)).toBeCloseTo(1, 3);
	});

	it('翻转写进 transform，且不影响缩放', () => {
		const layout = rotateLayout(90, true, 480, 180);
		expect(layout.transform).toContain('scaleX(-1)');
		expect(layout.scale).toBe(1);
	});

	it('负角度与超过 360 的角度都归一到 0-359', () => {
		expect(rotateLayout(-90, false, 480, 180).transform).toBe(rotateLayout(270, false, 480, 180).transform);
		expect(rotateLayout(450, false, 480, 180).transform).toBe(rotateLayout(90, false, 480, 180).transform);
	});

	it('量不到尺寸（SSR 首帧）时按不缩处理', () => {
		const layout = rotateLayout(90, false, 0, 0);
		expect(layout.swap).toBe(false);
		expect(layout.scale).toBe(1);
	});
});
