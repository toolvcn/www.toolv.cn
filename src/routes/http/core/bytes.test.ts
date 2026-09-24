// 字节计数的单测；高亮分词统一测在 src/lib/utils/json.test.ts。
import { describe, expect, it } from 'vitest';
import { byteLength } from './bytes.ts';

describe('byteLength', () => {
	it('ASCII 按 1 字节、中文按 3 字节', () => {
		expect(byteLength('abc')).toBe(3);
		expect(byteLength('中')).toBe(3);
		expect(byteLength('a中b')).toBe(5);
	});
});
