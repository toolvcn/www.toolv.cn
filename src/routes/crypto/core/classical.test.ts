// 凯撒与维吉尼亚的单测，跑在 vitest 的 server project（node 环境）。
// 两边的期望值都取公开的经典例（凯撒 shift 3、维吉尼亚 LEMON × ATTACKATDAWN），不是自己算完抄回来的。
import { describe, expect, it } from 'vitest';
import {
	caesarShift,
	caesarTable,
	cleanVigenereKey,
	normalizeShift,
	vigenereKeyFlow,
	vigenereShift,
	vigenereShifts
} from './classical.ts';

describe('凯撒：位移与大小写', () => {
	it('经典例：shift 3 把 Hello, World! 变成 Khoor, Zruog!', () => {
		expect(caesarShift('Hello, World!', 3, 'encrypt')).toBe('Khoor, Zruog!');
	});

	it('解密是加密的逆运算（含中文与 emoji）', () => {
		const plaintext = 'AbC XYZ 微工具 🎉 123';
		const encrypted = caesarShift(plaintext, 7, 'encrypt');
		expect(caesarShift(encrypted, 7, 'decrypt')).toBe(plaintext);
	});

	it('非字母原样穿过：数字、标点、空格都不动', () => {
		expect(caesarShift('a1-b c!', 1, 'encrypt')).toBe('b1-c d!');
	});

	it('shift 0 是恒等，shift 26 等价于 0', () => {
		expect(caesarShift('Test', 0, 'encrypt')).toBe('Test');
		expect(caesarShift('Test', 26, 'encrypt')).toBe('Test');
	});

	it('位移收敛到 0-25：29 → 3、-3 → 23、非数字 → 0', () => {
		expect(normalizeShift(29)).toBe(3);
		expect(normalizeShift(-3)).toBe(23);
		expect(normalizeShift(2.7)).toBe(2);
		expect(normalizeShift(Number.NaN)).toBe(0);
	});

	it('对照表按方向给出 26 条映射，解密方向是反过来', () => {
		const encrypt = caesarTable(3, 'encrypt');
		expect(encrypt).toHaveLength(26);
		expect(encrypt[0]).toEqual({ from: 'A', to: 'D' });
		expect(encrypt[23]).toEqual({ from: 'X', to: 'A' });
		expect(encrypt[25]).toEqual({ from: 'Z', to: 'C' });

		const decrypt = caesarTable(3, 'decrypt');
		expect(decrypt[0]).toEqual({ from: 'A', to: 'X' });
		expect(decrypt[3]).toEqual({ from: 'D', to: 'A' });
	});
});

describe('维吉尼亚：密钥与对齐', () => {
	it('经典例：LEMON × ATTACKATDAWN = LXFOPVEFRNHR', () => {
		const encrypted = vigenereShift('ATTACKATDAWN', 'LEMON', 'encrypt');
		expect(encrypted.ok).toBe(true);
		if (encrypted.ok) expect(encrypted.value).toBe('LXFOPVEFRNHR');
	});

	it('解密是加密的逆运算（带空格与标点）', () => {
		const plaintext = 'Attack at dawn! 2026 #42';
		const encrypted = vigenereShift(plaintext, 'Lemon', 'encrypt');
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;
		const decrypted = vigenereShift(encrypted.value, 'Lemon', 'decrypt');
		expect(decrypted.ok && decrypted.value).toBe(plaintext);
	});

	it('非字母不消耗密钥位：A-A 用 BC 解成 B-C', () => {
		const encrypted = vigenereShift('A-A', 'BC', 'encrypt');
		expect(encrypted.ok).toBe(true);
		if (encrypted.ok) expect(encrypted.value).toBe('B-C');
	});

	it('密钥先清洗：大小写与夹带的符号都去掉', () => {
		expect(cleanVigenereKey('le mon!')).toBe('LEMON');
		const shifts = vigenereShifts('le mon!');
		expect(shifts.ok).toBe(true);
		if (shifts.ok) expect(shifts.value).toEqual([11, 4, 12, 14, 13]);
	});

	it('短密钥按字母位置循环复用', () => {
		const shifty = vigenereShifts('AB');
		expect(shifty.ok).toBe(true);
		const encrypted = vigenereShift('AAAA', 'AB', 'encrypt');
		expect(encrypted.ok && encrypted.value).toBe('ABAB');
	});

	it('密钥里一个字母都没有时报错', () => {
		const result = vigenereShift('ABC', '123 !!!', 'encrypt');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('至少要有一个字母');
	});

	it('密钥预览与原文逐位对齐，非字母位置保留原字符', () => {
		expect(vigenereKeyFlow('ATTACK AT DAWN', 'LEMON')).toBe('LEMONL EM ONLE');
		expect(vigenereKeyFlow('没有任何字母', 'LEMON')).toBe('没有任何字母');
		expect(vigenereKeyFlow('ABC', '123')).toBe('');
	});
});
