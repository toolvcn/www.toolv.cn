import { describe, expect, it } from 'vitest';
import { evaluate, formatNumber } from './calc.ts';

/** 角度制（deg）下的默认档：界面上默认也是这一档 */
const deg = (source: string) => evaluate(source, { deg: true });
const rad = (source: string) => evaluate(source, { deg: false });

describe('四则运算与优先级', () => {
	it('加减乘除按优先级算', () => {
		expect(deg('1 + 2 * 3')).toEqual({ ok: true, value: 7 });
		expect(deg('(1 + 2) * 3')).toEqual({ ok: true, value: 9 });
		expect(deg('10 / 4')).toEqual({ ok: true, value: 2.5 });
		expect(deg('10 % 3')).toEqual({ ok: true, value: 1 });
	});

	it('一元负号与连写的加减', () => {
		expect(deg('-3 + 5')).toEqual({ ok: true, value: 2 });
		expect(deg('-(2 + 3)')).toEqual({ ok: true, value: -5 });
		expect(deg('1 - -1')).toEqual({ ok: true, value: 2 });
	});

	it('幂运算右结合且优先级高于乘除', () => {
		expect(deg('2^3^2')).toEqual({ ok: true, value: 512 });
		expect(deg('2 * 3^2')).toEqual({ ok: true, value: 18 });
	});

	it('科学计数法与小数', () => {
		expect(deg('1e3')).toEqual({ ok: true, value: 1000 });
		expect(deg('2.5e-2')).toEqual({ ok: true, value: 0.025 });
		expect(deg('.5 + .5')).toEqual({ ok: true, value: 1 });
	});
});

describe('隐式乘法', () => {
	it('数字后紧跟括号 / 常量 / 函数算乘法', () => {
		expect(deg('2(3 + 4)')).toEqual({ ok: true, value: 14 });
		expect(deg('2pi')).toEqual({ ok: true, value: Math.PI * 2 });
		// sin(30°) 只有 0.5 的近似值，乘 3 之后带浮点噪声 —— 噪声由显示层（formatNumber）收拾
		const value = deg('3sin(30)');
		expect(value.ok && Math.abs(value.value - 1.5) < 1e-12).toBe(true);
	});

	it('两个光挨着的数不当乘法，报错而不是静默算', () => {
		expect(deg('2 3').ok).toBe(false);
	});
});

describe('函数与常量', () => {
	it('三角函数按角度制换算', () => {
		expect(deg('sin(30)').ok && Math.abs((deg('sin(30)') as { value: number }).value - 0.5) < 1e-12).toBe(true);
		expect(deg('cos(60)').ok && Math.abs((deg('cos(60)') as { value: number }).value - 0.5) < 1e-12).toBe(true);
		expect(deg('asin(0.5)').ok && Math.abs((deg('asin(0.5)') as { value: number }).value - 30) < 1e-12).toBe(true);
	});

	it('弧度制下不换算', () => {
		expect(rad('sin(0)')).toEqual({ ok: true, value: 0 });
		expect(rad('asin(0.5)').ok && Math.abs((rad('asin(0.5)') as { value: number }).value - Math.PI / 6) < 1e-12).toBe(
			true
		);
	});

	it('对数、根与取整', () => {
		expect(deg('ln(e)')).toEqual({ ok: true, value: 1 });
		expect(deg('log10(1000)')).toEqual({ ok: true, value: 3 });
		expect(deg('log2(8)')).toEqual({ ok: true, value: 3 });
		expect(deg('sqrt(16)')).toEqual({ ok: true, value: 4 });
		expect(deg('cbrt(27)')).toEqual({ ok: true, value: 3 });
		expect(deg('round(2.5)')).toEqual({ ok: true, value: 3 });
		expect(deg('floor(-1.2)')).toEqual({ ok: true, value: -2 });
		expect(deg('abs(-7)')).toEqual({ ok: true, value: 7 });
	});

	it('多参数函数', () => {
		expect(deg('pow(2, 10)')).toEqual({ ok: true, value: 1024 });
		expect(deg('min(3, 1, 2)')).toEqual({ ok: true, value: 1 });
		expect(deg('max(3, 1, 2)')).toEqual({ ok: true, value: 3 });
	});

	it('常量 pi / e 与全角 π', () => {
		expect(deg('pi')).toEqual({ ok: true, value: Math.PI });
		expect(deg('2π')).toEqual({ ok: true, value: Math.PI * 2 });
	});
});

describe('报错', () => {
	it('空表达式与未知字符', () => {
		expect(deg('').ok).toBe(false);
		expect(deg('   ').ok).toBe(false);
		expect(deg('1 + ?').ok).toBe(false);
	});

	it('括号不配对', () => {
		expect(deg('(1 + 2').ok).toBe(false);
		expect(deg('1 + 2)').ok).toBe(false);
	});

	it('函数用法不对', () => {
		expect(deg('sin 30').ok).toBe(false);
		expect(deg('pow(2)').ok).toBe(false);
		expect(deg('sqrt()').ok).toBe(false);
		expect(deg('min()').ok).toBe(false);
	});

	it('不认识的名字', () => {
		expect(deg('foo(1)').ok).toBe(false);
	});

	it('除零单独报错，溢出与 NaN 各自说清', () => {
		const zero = deg('1 / 0');
		expect(zero.ok).toBe(false);
		expect(zero.ok ? '' : zero.error).toContain('除数是 0');
		expect(deg('1e308 * 10').ok).toBe(false);
		expect(deg('sqrt(-1)').ok).toBe(false);
	});
});

describe('结果格式化', () => {
	it('收敛浮点噪声', () => {
		expect(formatNumber(0.1 + 0.2)).toBe('0.3');
		expect(formatNumber(1 / 3)).toBe('0.333333333333');
	});

	it('大数与极小数走科学计数法', () => {
		expect(formatNumber(1e20)).toBe('1e+20');
		expect(formatNumber(1e-12)).toBe('1e-12');
		expect(formatNumber(0)).toBe('0');
	});

	it('整数与非有限值', () => {
		expect(formatNumber(1024)).toBe('1024');
		expect(formatNumber(-2.5)).toBe('-2.5');
		expect(formatNumber(Number.NaN)).toBe('—');
	});
});
