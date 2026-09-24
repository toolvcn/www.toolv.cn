// 哈希工具纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
// node 自带 WebCrypto（crypto.subtle），subtle.digest 可以直接用。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { byteLength, EXAMPLE_TEXT, formatHex, hexDigest } from './hash.ts';
import { hashStore } from './store.svelte.ts';
import { ALGORITHMS, emptyDigests, HASH_BITS, isInsecure } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

// store 是模块级单例，每个用例前重置
beforeEach(() => {
	hashStore.input = '';
	hashStore.hexCase = 'lower';
	hashStore.digests = emptyDigests();
	hashStore.unsupported = false;
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('hexDigest（标准测试向量）', () => {
	it("SHA-1('abc') 与公开向量一致", async () => {
		await expect(hexDigest('SHA-1', 'abc')).resolves.toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
	});

	it("SHA-256('abc') 与公开向量一致", async () => {
		await expect(hexDigest('SHA-256', 'abc')).resolves.toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});

	it("SHA-256('') 是空串的标准摘要", async () => {
		await expect(hexDigest('SHA-256', '')).resolves.toBe(
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
		);
	});

	it("SHA-384('abc') 与公开向量一致", async () => {
		await expect(hexDigest('SHA-384', 'abc')).resolves.toBe(
			'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7'
		);
	});

	it("SHA-512('abc') 与公开向量一致", async () => {
		await expect(hexDigest('SHA-512', 'abc')).resolves.toBe(
			'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
		);
	});

	it('同一文本重复计算结果稳定（UTF-8 多字节文本）', async () => {
		const a = await hexDigest('SHA-256', '你好，微工具 😀');
		const b = await hexDigest('SHA-256', '你好，微工具 😀');
		expect(a).toBe(b);
		expect(a.length).toBe(64);
	});

	it('五种算法结果长度对应位长', async () => {
		for (const algorithm of ALGORITHMS) {
			const hex = await hexDigest(algorithm, '微工具');
			expect(hex.length * 4).toBe(HASH_BITS[algorithm]);
		}
	});

	it("MD5('abc') 与公开向量一致（走自实现，不经 WebCrypto）", async () => {
		await expect(hexDigest('MD5', 'abc')).resolves.toBe('900150983cd24fb0d6963f7d28e17f72');
	});
});

describe('formatHex / byteLength', () => {
	it('大写与小写转换', () => {
		expect(formatHex('deadbeef', 'upper')).toBe('DEADBEEF');
		expect(formatHex('DEADBEEF', 'lower')).toBe('deadbeef');
		expect(formatHex('', 'upper')).toBe('');
	});

	it('字节数按 UTF-8 计：ASCII 1 字节、中文 3 字节、emoji 4 字节', () => {
		expect(byteLength('a')).toBe(1);
		expect(byteLength('你')).toBe(3);
		expect(byteLength('😀')).toBe(4);
	});
});

describe('store：结果跟随输入', () => {
	it('初始为空：五个算法都没有结果', () => {
		expect(hashStore.computedCount).toBe(0);
		for (const algorithm of ALGORITHMS) expect(hashStore.digestText(algorithm)).toBe('');
	});

	it("输入 'abc' 后五个算法都算出标准摘要", async () => {
		hashStore.input = 'abc';
		await hashStore.refresh();
		expect(hashStore.computedCount).toBe(ALGORITHMS.length);
		expect(hashStore.digestText('SHA-256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		expect(hashStore.digestText('MD5')).toBe('900150983cd24fb0d6963f7d28e17f72');
	});

	it('结果按当前大小写设置展示', async () => {
		hashStore.input = 'abc';
		await hashStore.refresh();
		hashStore.setHexCase('upper');
		expect(hashStore.digestText('SHA-256').slice(0, 4)).toBe('BA78');
	});

	it('清空输入后结果回到空', async () => {
		hashStore.input = 'abc';
		await hashStore.refresh();
		hashStore.clearInput();
		await hashStore.refresh();
		expect(hashStore.computedCount).toBe(0);
	});

	it('快速连续改输入时，只认最后一次的结果（竞态序号兜底）', async () => {
		hashStore.input = 'a';
		const stale = hashStore.refresh();
		hashStore.input = 'b';
		await hashStore.refresh();
		await stale;
		const sha256OfB = await hexDigest('SHA-256', 'b');
		expect(hashStore.digestText('SHA-256')).toBe(sha256OfB);
	});

	it('字符与字节计数随输入更新', () => {
		hashStore.input = '微工具';
		expect(hashStore.charCount).toBe(3);
		expect(hashStore.byteCount).toBe(9);
	});
});

describe('store：复制与提示', () => {
	it('结果为空时提示先输入内容', async () => {
		await hashStore.copyDigest('SHA-256');
		expect(toast.message).toBe('还没有可复制的结果，先输入内容');
	});

	it('复制成功时写当前大小写的结果', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		hashStore.input = 'abc';
		hashStore.setHexCase('upper');
		await hashStore.refresh();
		await hashStore.copyDigest('SHA-256');
		expect(writeText).toHaveBeenCalledWith('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
		expect(toast.message).toBe('已复制 SHA-256 结果');
	});

	it('剪贴板不可用时提示手动复制', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		hashStore.input = 'abc';
		await hashStore.refresh();
		await hashStore.copyDigest('SHA-1');
		expect(toast.tone).toBe('error');
	});

	it('载入示例后能算出结果', async () => {
		hashStore.loadExample();
		await hashStore.refresh();
		expect(hashStore.computedCount).toBe(ALGORITHMS.length);
		expect(hashStore.input).toBe(EXAMPLE_TEXT);
	});

	it('环境缺 WebCrypto 时 MD5 仍能算出，SHA 系列置空并标记 unsupported', async () => {
		vi.stubGlobal('crypto', {});
		hashStore.input = 'abc';
		await hashStore.refresh();
		expect(hashStore.unsupported).toBe(true);
		expect(hashStore.digestText('MD5')).toBe('900150983cd24fb0d6963f7d28e17f72');
		expect(hashStore.digestText('SHA-256')).toBe('');
	});
});

describe('isInsecure：界面上要标出来的算法', () => {
	it('标 MD5 与 SHA-1，SHA-2 系列不标', () => {
		expect(isInsecure('MD5')).toBe(true);
		expect(isInsecure('SHA-1')).toBe(true);
		expect(isInsecure('SHA-256')).toBe(false);
		expect(isInsecure('SHA-384')).toBe(false);
		expect(isInsecure('SHA-512')).toBe(false);
	});
});
