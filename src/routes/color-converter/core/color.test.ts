// 颜色转换纯函数的单测：解析、三种格式互转（往返）、WCAG 亮度 / 对比度、alpha 混合。
import { describe, expect, it } from 'vitest';
import {
	blend,
	contrastRatio,
	formatHsl,
	formatRatio,
	formatRgb,
	hslToRgb,
	parseColor,
	relativeLuminance,
	rgbToHex,
	rgbToHsl,
	wcagPass
} from './color.ts';

describe('parseColor · HEX', () => {
	it('6 位（含省略 #、大写）', () => {
		expect(parseColor('#2563eb')).toEqual({ r: 37, g: 99, b: 235, a: 1 });
		expect(parseColor('2563EB')).toEqual({ r: 37, g: 99, b: 235, a: 1 });
	});

	it('3 位短写法按位展开', () => {
		expect(parseColor('#f53')).toEqual({ r: 255, g: 85, b: 51, a: 1 });
	});

	it('4 位短写法带透明度', () => {
		expect(parseColor('#f53f')).toEqual({ r: 255, g: 85, b: 51, a: 1 });
		expect(parseColor('#f530')).toEqual({ r: 255, g: 85, b: 51, a: 0 });
	});

	it('8 位带透明度', () => {
		expect(parseColor('#ff573380')).toEqual({ r: 255, g: 87, b: 51, a: 128 / 255 });
	});

	it('非法长度与非法字符返回 null', () => {
		expect(parseColor('#12')).toBeNull();
		expect(parseColor('#12345')).toBeNull();
		expect(parseColor('#1234567')).toBeNull();
		expect(parseColor('#xyz')).toBeNull();
	});
});

describe('parseColor · rgb()/rgba()', () => {
	it('逗号写法', () => {
		expect(parseColor('rgb(255, 87, 51)')).toEqual({ r: 255, g: 87, b: 51, a: 1 });
		expect(parseColor('rgba(255, 87, 51, 0.5)')).toEqual({ r: 255, g: 87, b: 51, a: 0.5 });
	});

	it('现代空格与斜杠写法', () => {
		expect(parseColor('rgb(255 87 51)')).toEqual({ r: 255, g: 87, b: 51, a: 1 });
		expect(parseColor('rgb(255 87 51 / 0.5)')).toEqual({ r: 255, g: 87, b: 51, a: 0.5 });
	});

	it('百分比分量与百分比透明度，越界钳制', () => {
		expect(parseColor('rgb(100%, 20%, 0%)')).toEqual({ r: 255, g: 51, b: 0, a: 1 });
		expect(parseColor('rgb(300, -10, 51 / 150%)')).toEqual({ r: 255, g: 0, b: 51, a: 1 });
	});

	it('段数不对或非数字返回 null', () => {
		expect(parseColor('rgb(1, 2)')).toBeNull();
		expect(parseColor('rgb(1, 2, 3, 4, 5)')).toBeNull();
		expect(parseColor('rgb(a, b, c)')).toBeNull();
	});
});

describe('parseColor · hsl()/hsla()', () => {
	it('hsl 转 rgb：tomato 的 HSL 描述', () => {
		expect(parseColor('hsl(9, 100%, 64%)')).toEqual({ r: 255, g: 99, b: 71, a: 1 });
	});

	it('h 可带 deg、透明度走 alpha 通道', () => {
		expect(parseColor('hsl(369deg 100% 64% / 50%)')).toEqual({ r: 255, g: 99, b: 71, a: 0.5 });
	});

	it('h 负数归一到 0-360', () => {
		const color = parseColor('hsl(-351, 100%, 64%)');
		expect(color).toEqual({ r: 255, g: 99, b: 71, a: 1 });
	});

	it('s / l 缺百分号或段数不对返回 null', () => {
		expect(parseColor('hsl(9, 100, 64)')).toBeNull();
		expect(parseColor('hsl(9, 100%)')).toBeNull();
	});
});

describe('parseColor · 其他非法输入', () => {
	it('空串、未知函数、纯文本都返回 null', () => {
		expect(parseColor('')).toBeNull();
		expect(parseColor('   ')).toBeNull();
		expect(parseColor('foo(1, 2, 3)')).toBeNull();
		expect(parseColor('not a color')).toBeNull();
	});
});

describe('rgbToHex', () => {
	it('不透明输出 6 位小写', () => {
		expect(rgbToHex({ r: 255, g: 87, b: 51, a: 1 })).toBe('#ff5733');
	});

	it('带透明度输出 8 位', () => {
		expect(rgbToHex({ r: 255, g: 87, b: 51, a: 0.5 })).toBe('#ff573380');
		expect(rgbToHex({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
	});
});

describe('rgbToHsl / hslToRgb 互转', () => {
	it('红绿蓝黑白灰的基准值', () => {
		expect(rgbToHsl({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 100, l: 50, a: 1 });
		expect(rgbToHsl({ r: 0, g: 255, b: 0, a: 1 })).toEqual({ h: 120, s: 100, l: 50, a: 1 });
		expect(rgbToHsl({ r: 0, g: 0, b: 255, a: 1 })).toEqual({ h: 240, s: 100, l: 50, a: 1 });
		expect(rgbToHsl({ r: 255, g: 255, b: 255, a: 1 })).toEqual({ h: 0, s: 0, l: 100, a: 1 });
		expect(rgbToHsl({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, l: 0, a: 1 });
	});

	it('中灰的亮度约 50.2%', () => {
		expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, l: 50.2, a: 1 });
	});

	it('任意颜色往返误差不超过 1（alpha 一并保留）', () => {
		const samples = [
			{ r: 37, g: 99, b: 235, a: 1 },
			{ r: 255, g: 87, b: 51, a: 0.5 },
			{ r: 18, g: 183, b: 106, a: 1 },
			{ r: 250, g: 204, b: 21, a: 0.25 }
		];
		for (const sample of samples) {
			const roundTrip = hslToRgb(rgbToHsl(sample));
			expect(Math.abs(roundTrip.r - sample.r)).toBeLessThanOrEqual(1);
			expect(Math.abs(roundTrip.g - sample.g)).toBeLessThanOrEqual(1);
			expect(Math.abs(roundTrip.b - sample.b)).toBeLessThanOrEqual(1);
			expect(roundTrip.a).toBeCloseTo(sample.a, 5);
		}
	});
});

describe('formatRgb / formatHsl', () => {
	it('不透明输出 rgb() / hsl()', () => {
		expect(formatRgb({ r: 255, g: 87, b: 51, a: 1 })).toBe('rgb(255, 87, 51)');
		expect(formatHsl({ h: 9, s: 100, l: 64, a: 1 })).toBe('hsl(9, 100%, 64%)');
	});

	it('带透明度输出 rgba() / hsla()', () => {
		expect(formatRgb({ r: 255, g: 87, b: 51, a: 0.5 })).toBe('rgba(255, 87, 51, 0.5)');
		expect(formatHsl({ h: 9, s: 100, l: 64, a: 0.5 })).toBe('hsla(9, 100%, 64%, 0.5)');
	});

	it('透明度去掉尾零', () => {
		expect(formatRgb({ r: 0, g: 0, b: 0, a: 0.25 })).toBe('rgba(0, 0, 0, 0.25)');
	});
});

describe('relativeLuminance', () => {
	it('黑白是两个端点', () => {
		expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBe(1);
		expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
	});

	it('#767676 约 0.181（经典 AA 临界灰）', () => {
		expect(relativeLuminance({ r: 118, g: 118, b: 118, a: 1 })).toBeCloseTo(0.181, 2);
	});
});

describe('contrastRatio / wcagPass', () => {
	it('黑白对比度 21:1，同色 1:1', () => {
		expect(contrastRatio({ r: 255, g: 255, b: 255, a: 1 }, { r: 0, g: 0, b: 0, a: 1 })).toBe(21);
		expect(contrastRatio({ r: 255, g: 87, b: 51, a: 1 }, { r: 255, g: 87, b: 51, a: 1 })).toBe(1);
	});

	it('白底 #767676 约 4.54:1，刚好过 AA 正文', () => {
		const ratio = contrastRatio({ r: 255, g: 255, b: 255, a: 1 }, { r: 118, g: 118, b: 118, a: 1 });
		expect(ratio).toBeCloseTo(4.54, 2);
		expect(wcagPass(ratio).aaNormal).toBe(true);
	});

	it('四档边界的开闭：4.5 / 3 / 7 恰好达标', () => {
		const at = (ratio: number) => wcagPass(ratio);
		expect(at(4.5)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
		expect(at(4.49).aaNormal).toBe(false);
		expect(at(3).aaLarge).toBe(true);
		expect(at(2.99).aaLarge).toBe(false);
		expect(at(7).aaaNormal).toBe(true);
		expect(at(6.99).aaaNormal).toBe(false);
	});
});

describe('blend', () => {
	it('半透明红叠白得到粉色', () => {
		expect(blend({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 })).toEqual({
			r: 255,
			g: 128,
			b: 128,
			a: 1
		});
	});

	it('完全不透明返回前景，全透明返回背景', () => {
		const white = { r: 255, g: 255, b: 255, a: 1 };
		const black = { r: 10, g: 20, b: 30, a: 1 };
		expect(blend(black, white)).toEqual({ r: 10, g: 20, b: 30, a: 1 });
		expect(blend({ r: 10, g: 20, b: 30, a: 0 }, white)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
	});

	it('透明度参与对比度：50% 黑叠白对比度约 3.98，不再是 21', () => {
		const ratio = contrastRatio(blend({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }), {
			r: 255,
			g: 255,
			b: 255,
			a: 1
		});
		expect(ratio).toBeGreaterThan(3.9);
		expect(ratio).toBeLessThan(4.1);
	});
});

describe('formatRatio', () => {
	it('去掉尾零并最多保留两位', () => {
		expect(formatRatio(21)).toBe('21');
		expect(formatRatio(4.543)).toBe('4.54');
		expect(formatRatio(3)).toBe('3');
	});
});
