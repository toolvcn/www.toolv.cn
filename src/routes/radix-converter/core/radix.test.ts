// 进制转换工具纯函数与 store 的单测。
import { beforeEach, describe, expect, it } from 'vitest';
import { autoDetect, formatRadix, parseDecimal, parseRadix } from './radix.ts';
import { radixStore } from './store.svelte.ts';

beforeEach(() => {
	radixStore.text = '255';
	radixStore.sourceBase = 10;
	radixStore.upperHex = true;
});

describe('parseRadix', () => {
	it('按输入进制解析十进制与二进制', () => {
		expect(parseRadix('255', 10)).toBe(255n);
		expect(parseRadix('11111111', 2)).toBe(255n);
		expect(parseRadix('377', 8)).toBe(255n);
		expect(parseRadix('ff', 16)).toBe(255n);
		expect(parseRadix('73', 36)).toBe(255n);
	});

	it('字母大小写混用可解析', () => {
		expect(parseRadix('1F', 16)).toBe(31n);
		expect(parseRadix('zz', 36)).toBe(1295n);
	});

	it('可选正负号', () => {
		expect(parseRadix('-ff', 16)).toBe(-255n);
		expect(parseRadix('+ff', 16)).toBe(255n);
	});

	it('忽略下划线与空白', () => {
		expect(parseRadix('1_000_000', 10)).toBe(1000000n);
		expect(parseRadix(' 255 ', 10)).toBe(255n);
	});

	it('超出进制的字符判非法', () => {
		expect(parseRadix('2', 2)).toBeNull();
		expect(parseRadix('8', 8)).toBeNull();
		expect(parseRadix('g', 16)).toBeNull();
		expect(parseRadix('', 10)).toBeNull();
		expect(parseRadix('--1', 10)).toBeNull();
		expect(parseRadix('abc', 10)).toBeNull();
	});

	it('任意大整数不受 Number 精度影响', () => {
		expect(parseRadix('ffffffffffffffffffffffff', 16)).toBe(2n ** 96n - 1n);
	});
});

describe('formatRadix', () => {
	it('小写输出且不补前导零', () => {
		expect(formatRadix(255n, 16)).toBe('ff');
		expect(formatRadix(255n, 2)).toBe('11111111');
		expect(formatRadix(255n, 8)).toBe('377');
		expect(formatRadix(0n, 2)).toBe('0');
	});

	it('负数带负号', () => {
		expect(formatRadix(-255n, 16)).toBe('-ff');
	});

	it('36 进制上限', () => {
		expect(formatRadix(35n, 36)).toBe('z');
		expect(formatRadix(36n, 36)).toBe('10');
	});

	it('parse 与 format 互逆', () => {
		const source = 'deadbeef1234567890abcdef';
		expect(formatRadix(parseRadix(source, 16)!, 16)).toBe(source);
	});
});

describe('autoDetect', () => {
	it('0x / 0b / 0o 前缀识别并去掉', () => {
		expect(autoDetect('0xFF')).toEqual({ text: 'FF', base: 16 });
		expect(autoDetect('0b101')).toEqual({ text: '101', base: 2 });
		expect(autoDetect('0o17')).toEqual({ text: '17', base: 8 });
		expect(autoDetect('123')).toEqual({ text: '123', base: 10 });
	});
});

describe('parseDecimal', () => {
	it('十进制快捷解析', () => {
		expect(parseDecimal('42')).toBe(42n);
		expect(parseDecimal('nope')).toBeNull();
	});
});

describe('store', () => {
	it('默认 255 转各进制', () => {
		expect(radixStore.outputOf(2)).toBe('11111111');
		expect(radixStore.outputOf(8)).toBe('377');
		expect(radixStore.outputOf(16)).toBe('FF');
		expect(radixStore.outputOf(36)).toBe('73');
		expect(radixStore.error).toBe('');
	});

	it('输入非法时各输出是占位符并给错误', () => {
		radixStore.text = '2';
		radixStore.sourceBase = 2;
		expect(radixStore.error).not.toBe('');
		expect(radixStore.outputOf(10)).toBe('—');
	});

	it('关闭大写后十六进制变小写', () => {
		radixStore.toggleUpper();
		expect(radixStore.outputOf(16)).toBe('ff');
	});

	it('改输入进制后按新进制解析', () => {
		radixStore.text = 'ff';
		radixStore.sourceBase = 16;
		expect(radixStore.outputOf(10)).toBe('255');
	});
});
