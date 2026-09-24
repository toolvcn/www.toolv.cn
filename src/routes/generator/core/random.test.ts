// 随机生成核心逻辑的单测：随机源注入确定性序列，断言约束（范围 / 保底 / 去重 / 后处理）而非具体值。
import { describe, expect, test } from 'vitest';
import {
	generateLorem,
	generateNumbers,
	generatePassword,
	generateUuids,
	passwordEntropy,
	passwordPoolSize,
	randomInts,
	strengthLabel
} from './random.ts';
import {
	AMBIGUOUS_CHARS,
	CHAR_DIGITS,
	CHAR_LOWER,
	CHAR_SYMBOLS,
	CHAR_UPPER,
	LATIN_OPENING,
	type RandomSource
} from './types.ts';

/** 确定性随机源：按给定 32 位字序列循环发放 */
function seqSource(words: number[]): RandomSource {
	let cursor = 0;
	return (count: number) => {
		const out = new Uint32Array(count);
		for (let i = 0; i < count; i++) out[i] = words[cursor++ % words.length]!;
		return out;
	};
}

describe('randomInts', () => {
	test('落在 [min, max] 且个数正确', () => {
		const values = randomInts(50, 3, 9, seqSource([1, 5, 9, 100000, 3, 7]));
		expect(values).toHaveLength(50);
		for (const value of values) expect(value).toBeGreaterThanOrEqual(3);
		for (const value of values) expect(value).toBeLessThanOrEqual(9);
	});

	test('拒绝采样：超出量化上界的样本被丢弃，不产生模偏差外的值', () => {
		// range = 3 → limit = floor(2^32 / 3) * 3。2^32-1 是最大的越界样本（应被拒绝）
		const range = 3;
		const limit = Math.floor(0x100000000 / range) * range;
		const out = randomInts(3, 10, 12, seqSource([limit, 0, 1, 2, 0]));
		expect(out).toHaveLength(3);
		for (const value of out) expect(value).toBeGreaterThanOrEqual(10);
		for (const value of out) expect(value).toBeLessThanOrEqual(12);
	});

	test('负数区间可用', () => {
		const values = randomInts(20, -5, -1, seqSource([0, 2, 4, 8, 3]));
		expect(values).toHaveLength(20);
		expect(Math.min(...values)).toBeGreaterThanOrEqual(-5);
		expect(Math.max(...values)).toBeLessThanOrEqual(-1);
	});
});

describe('generateUuids', () => {
	const sample = '123e4567-e89b-12d3-a456-426614174000';

	test('默认保留小写与连字符', () => {
		const [id] = generateUuids(1, { upper: false, dashes: true }, () => sample);
		expect(id).toBe(sample);
	});

	test('大写且去连字符', () => {
		const [id] = generateUuids(1, { upper: true, dashes: false }, () => sample);
		expect(id).toBe('123E4567E89B12D3A456426614174000');
	});

	test('批量数量正确', () => {
		let calls = 0;
		const list = generateUuids(5, { upper: false, dashes: true }, () => {
			calls++;
			return sample;
		});
		expect(list).toHaveLength(5);
		expect(calls).toBe(5);
	});
});

describe('generatePassword', () => {
	test('长度一致且所有字符都在勾选池内', () => {
		const password = generatePassword({
			length: 24,
			lower: true,
			upper: true,
			digits: true,
			symbols: false,
			avoidAmbiguous: false
		});
		expect(password).toHaveLength(24);
		const pool = CHAR_LOWER + CHAR_UPPER + CHAR_DIGITS;
		for (const char of password) expect(pool).toContain(char);
	});

	test('长度等于类数时每类保底恰好出现', () => {
		const password = generatePassword({
			length: 4,
			lower: true,
			upper: true,
			digits: true,
			symbols: true,
			avoidAmbiguous: false
		});
		expect(password).toHaveLength(4);
		const inLower = [...password].filter((c) => CHAR_LOWER.includes(c)).length;
		const inUpper = [...password].filter((c) => CHAR_UPPER.includes(c)).length;
		const inDigits = [...password].filter((c) => CHAR_DIGITS.includes(c)).length;
		const inSymbols = [...password].filter((c) => CHAR_SYMBOLS.includes(c)).length;
		// 每类至少 1 个，且 4 个字符恰好分给 4 类 → 每类正好 1 个
		expect(inLower).toBe(1);
		expect(inUpper).toBe(1);
		expect(inDigits).toBe(1);
		expect(inSymbols).toBe(1);
	});

	test('排除易混淆字符后不含 0Oo1lI|', () => {
		const password = generatePassword({
			length: 64,
			lower: true,
			upper: true,
			digits: true,
			symbols: true,
			avoidAmbiguous: true
		});
		for (const char of password) expect(AMBIGUOUS_CHARS.includes(char)).toBe(false);
	});
});

describe('passwordPoolSize / entropy / strength', () => {
	test('池大小按勾选累加', () => {
		const opts = { lower: true, upper: true, digits: true, symbols: false, avoidAmbiguous: false };
		expect(passwordPoolSize(opts)).toBe(CHAR_LOWER.length + CHAR_UPPER.length + CHAR_DIGITS.length);
		expect(passwordPoolSize({ ...opts, upper: false })).toBe(CHAR_LOWER.length + CHAR_DIGITS.length);
	});

	test('排除易混淆字符会缩小池', () => {
		const opts = { lower: true, upper: false, digits: false, symbols: false, avoidAmbiguous: false };
		const withAmbiguous = passwordPoolSize(opts);
		const without = passwordPoolSize({ ...opts, avoidAmbiguous: true });
		expect(without).toBe(withAmbiguous - [...AMBIGUOUS_CHARS].filter((c) => CHAR_LOWER.includes(c)).length);
	});

	test('熵随长度线性增长；档位单调', () => {
		const opts = { lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false };
		const pool = passwordPoolSize(opts);
		expect(passwordEntropy({ ...opts, length: 8 })).toBe(Math.ceil(8 * Math.log2(pool)));
		expect(passwordEntropy({ ...opts, length: 16 })).toBeGreaterThan(passwordEntropy({ ...opts, length: 8 }));
		expect(strengthLabel(0)).toBe('极弱');
		expect(strengthLabel(28)).toBe('弱');
		expect(strengthLabel(36)).toBe('中等');
		expect(strengthLabel(60)).toBe('强');
		expect(strengthLabel(128)).toBe('极强');
	});
});

describe('generateNumbers', () => {
	test('整数落在范围内', () => {
		const values = generateNumbers(
			{ min: 5, max: 8, count: 30, decimals: 0, unique: false, sorted: false },
			seqSource([0, 1, 2, 3])
		);
		expect(values).toHaveLength(30);
		for (const text of values) {
			const value = Number(text);
			expect(value).toBeGreaterThanOrEqual(5);
			expect(value).toBeLessThanOrEqual(8);
			expect(Number.isInteger(value)).toBe(true);
		}
	});

	test('去重：个数不超范围时结果互不相同', () => {
		const values = generateNumbers({ min: 1, max: 10, count: 10, decimals: 0, unique: true, sorted: false });
		expect(new Set(values).size).toBe(10);
	});

	test('去重但范围装不下：抛中文错误', () => {
		expect(() => generateNumbers({ min: 1, max: 3, count: 5, decimals: 0, unique: true, sorted: false })).toThrowError(
			/装不下/
		);
	});

	test('sorted 升序输出', () => {
		const values = generateNumbers({ min: 1, max: 1000, count: 20, decimals: 0, unique: false, sorted: true });
		const numbers = values.map(Number);
		for (let i = 1; i < numbers.length; i++) {
			expect(numbers[i]!).toBeGreaterThanOrEqual(numbers[i - 1]!);
		}
	});

	test('小数模式：位数正确且在范围内', () => {
		const values = generateNumbers({ min: 0, max: 1, count: 10, decimals: 2, unique: true, sorted: false });
		expect(values).toHaveLength(10);
		for (const text of values) {
			expect(text).toMatch(/^\d+\.\d{2}$/);
			expect(Number(text)).toBeGreaterThanOrEqual(0);
			expect(Number(text)).toBeLessThanOrEqual(1);
		}
	});
});

describe('generateLorem', () => {
	test('拉丁句子模式以经典开头起手', () => {
		const text = generateLorem({ lang: 'latin', mode: 'sentences', count: 3 }, seqSource([1, 2, 3]));
		expect(text.startsWith(`${LATIN_OPENING}.`)).toBe(true);
		expect(text).toContain(' ');
	});

	test('中文模式句号收尾、无空格', () => {
		const text = generateLorem({ lang: 'zh', mode: 'sentences', count: 4 }, seqSource([5, 6, 7]));
		expect(text).toContain('。');
		expect(text.endsWith('。')).toBe(true);
		expect(text.includes(' ')).toBe(false);
	});

	test('段落模式：段数正确、段间空行', () => {
		const text = generateLorem({ lang: 'latin', mode: 'paragraphs', count: 3 }, seqSource([2, 4, 6]));
		const paragraphs = text.split('\n\n');
		expect(paragraphs).toHaveLength(3);
		for (const paragraph of paragraphs) expect(paragraph.length).toBeGreaterThan(0);
	});

	test('count 为 0 返回空串', () => {
		expect(generateLorem({ lang: 'latin', mode: 'sentences', count: 0 })).toBe('');
	});
});
