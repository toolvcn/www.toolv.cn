// MD5 自实现的单测，跑在 vitest 的 server project（node 环境）。
//
// 两层验证：
//   ① RFC 1321 公布的标准测试向量 —— 外部权威值，证明算的是**标准 MD5**而不是自洽的变体；
//   ② 用 node:crypto 的 createHash('md5')（openssl 口径）当对照，覆盖补齐边界与多块输入 ——
//      这两类错误（少补一块、位长写错字节序）只靠几个短字符串是测不出来的。
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { md5Bytes, md5Hex } from './md5.ts';

function nodeMd5(text: string): string {
	return createHash('md5').update(text, 'utf8').digest('hex');
}

describe('md5Hex：RFC 1321 标准测试向量', () => {
	// 这 7 条是 RFC 1321 附录 A.5 列出的测试套件，任何正确实现都必须一致
	const VECTORS: [string, string][] = [
		['', 'd41d8cd98f00b204e9800998ecf8427e'],
		['a', '0cc175b9c0f1b6a831c399e269772661'],
		['abc', '900150983cd24fb0d6963f7d28e17f72'],
		['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
		['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
		['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
		[
			'12345678901234567890123456789012345678901234567890123456789012345678901234567890',
			'57edf4a22be3c955ac49da2e2107b67a'
		]
	];

	for (const [input, expected] of VECTORS) {
		it(`md5Hex(${JSON.stringify(input.slice(0, 24))}${input.length > 24 ? '…' : ''}) 命中标准向量`, () => {
			expect(md5Hex(input)).toBe(expected);
		});
	}
});

describe('补齐边界：与 node:crypto 逐一对齐', () => {
	// 55 是「一个 0x80 后正好放得下位长」的上界、56 必须多补一块、64 是整块 —— 三处最易写错
	const LENGTHS = [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000];

	for (const length of LENGTHS) {
		it(`${length} 字节输入的摘要与 openssl 一致`, () => {
			const text = 'a'.repeat(length);
			expect(md5Hex(text)).toBe(nodeMd5(text));
		});
	}

	it('位长按小端写：多块输入（>64 字节）也对', () => {
		// 45 字符 × 5 = 225 字节，跨 4 个分组（4 × 64 = 256），补齐也要多一块
		const text = 'The quick brown fox jumps over the lazy dog. '.repeat(5);
		expect(text.length).toBeGreaterThan(192);
		expect(md5Hex(text)).toBe(nodeMd5(text));
	});
});

describe('字节入口与 UTF-8 口径', () => {
	it('md5Bytes 与 md5Hex 走同一份实现（md5Hex 就是 UTF-8 编码后调用它）', () => {
		const bytes = new TextEncoder().encode('你好，微工具 😀');
		expect(md5Bytes(bytes)).toBe(md5Hex('你好，微工具 😀'));
		expect(md5Bytes(bytes)).toBe(nodeMd5('你好，微工具 😀'));
	});

	it('多字节字符与 emoji 与 openssl 的 UTF-8 结果一致', () => {
		for (const text of ['中', '你好', '微工具 😀', 'áéíóú', 'ｆｕｌｌｗｉｄｔｈ']) {
			expect(md5Hex(text)).toBe(nodeMd5(text));
		}
	});

	it('输出恒为 32 位小写十六进制，同一输入结果稳定', () => {
		const hex = md5Hex('微工具');
		expect(hex).toMatch(/^[0-9a-f]{32}$/);
		expect(md5Hex('微工具')).toBe(hex);
	});

	it('空字节数组与空串等价', () => {
		expect(md5Bytes(new Uint8Array(0))).toBe('d41d8cd98f00b204e9800998ecf8427e');
	});
});
