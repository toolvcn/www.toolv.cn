// AES 加解密纯函数与 store 的单测，跑在 vitest 的 server project（node 环境，自带 WebCrypto）。
//
// 除了往返，这里还做了一件平时不常做的事：用 node:crypto（openssl 口径）互相解一遍，
// 证明这页产出的密文在别的系统里能用 —— 加解密工具最容易出的错就是「自己自洽、别人解不开」。
import { createDecipheriv, createCipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { IV_LENGTH, randomIvHex, randomKeyHex, runAes, type AesRequest } from './aes.ts';

const KEY_128 = '2b7e151628aed2a6abf7158809cf4f3c';
const KEY_256 = '603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4';
const IV_16 = '000102030405060708090a0b0c0d0e0f';
const IV_12 = 'cafebabefacedbaddecaf888';

/** 请求的默认值：只写要测的那几个字段 */
function request(overrides: Partial<AesRequest>): AesRequest {
	return {
		direction: 'encrypt',
		mode: 'CBC',
		keyText: KEY_128,
		keyFormat: 'hex',
		ivText: IV_16,
		ivFormat: 'hex',
		dataFormat: 'hex',
		input: '',
		...overrides
	};
}

describe('三种模式的往返', () => {
	for (const mode of ['CBC', 'GCM', 'CTR'] as const) {
		it(`${mode}：加密再解密回到原文（含中文）`, async () => {
			const key = mode === 'GCM' ? KEY_256 : KEY_128;
			const iv = IV_LENGTH[mode] === 12 ? IV_12 : IV_16;
			const plaintext = '微工具 · toolv.cn · ABC-123 🎉';

			const encrypted = await runAes(request({ mode, keyText: key, ivText: iv, input: plaintext }));
			expect(encrypted.ok).toBe(true);
			if (!encrypted.ok) return;

			const decrypted = await runAes(
				request({ mode, direction: 'decrypt', keyText: key, ivText: iv, input: encrypted.value.output })
			);
			expect(decrypted.ok).toBe(true);
			if (decrypted.ok) expect(decrypted.value.output).toBe(plaintext);
		});
	}

	it('CBC 带 PKCS#7 填充：16 字节明文也补出完整一块密文', async () => {
		const encrypted = await runAes(request({ input: '1234567890abcdef' }));
		expect(encrypted.ok).toBe(true);
		if (encrypted.ok) expect(encrypted.value.byteLength).toBe(32);
	});

	it('CTR 是流式的：密文与明文等长', async () => {
		const encrypted = await runAes(request({ mode: 'CTR', input: '1234567890abcdef' }));
		expect(encrypted.ok).toBe(true);
		if (encrypted.ok) expect(encrypted.value.byteLength).toBe(16);
	});

	it('GCM 的密文比明文多 16 字节认证标签', async () => {
		const encrypted = await runAes(request({ mode: 'GCM', keyText: KEY_256, ivText: IV_12, input: '1234' }));
		expect(encrypted.ok).toBe(true);
		if (encrypted.ok) expect(encrypted.value.byteLength).toBe(20);
	});

	it('同一密钥与 IV 下结果稳定，换 IV 结果就变', async () => {
		const first = await runAes(request({ input: 'same input' }));
		const second = await runAes(request({ input: 'same input' }));
		const other = await runAes(request({ ivText: '0f0e0d0c0b0a09080706050403020100', input: 'same input' }));
		expect(first.ok && second.ok && other.ok).toBe(true);
		if (first.ok && second.ok && other.ok) {
			expect(first.value.output).toBe(second.value.output);
			expect(other.value.output).not.toBe(first.value.output);
		}
	});
});

describe('与 node:crypto 互通（openssl 口径）', () => {
	it('CBC：我们加的密，node 解得开', async () => {
		const plaintext = 'interop check';
		const encrypted = await runAes(request({ input: plaintext }));
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;

		const decipher = createDecipheriv('aes-128-cbc', Buffer.from(KEY_128, 'hex'), Buffer.from(IV_16, 'hex'));
		const opened = Buffer.concat([
			decipher.update(Buffer.from(encrypted.value.output, 'hex')),
			decipher.final()
		]).toString('utf8');
		expect(opened).toBe(plaintext);
	});

	it('CTR：node 加的密，我们解得开（整块 128 位计数器）', async () => {
		const plaintext = 'counter mode interop';
		const cipher = createCipheriv('aes-128-ctr', Buffer.from(KEY_128, 'hex'), Buffer.from(IV_16, 'hex'));
		const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('hex');

		const decrypted = await runAes(request({ mode: 'CTR', direction: 'decrypt', input: ciphertext }));
		expect(decrypted.ok).toBe(true);
		if (decrypted.ok) expect(decrypted.value.output).toBe(plaintext);
	});

	it('GCM：密文尾部就是 16 字节认证标签，node 能验能解', async () => {
		const plaintext = 'gcm interop';
		const encrypted = await runAes(request({ mode: 'GCM', keyText: KEY_256, ivText: IV_12, input: plaintext }));
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;

		const raw = Buffer.from(encrypted.value.output, 'hex');
		const decipher = createDecipheriv('aes-256-gcm', Buffer.from(KEY_256, 'hex'), Buffer.from(IV_12, 'hex'));
		decipher.setAuthTag(raw.subarray(raw.length - 16));
		const opened = Buffer.concat([decipher.update(raw.subarray(0, raw.length - 16)), decipher.final()]).toString(
			'utf8'
		);
		expect(opened).toBe(plaintext);
	});
});

describe('参数校验与失败提示', () => {
	it('密钥长度不是 16 / 24 / 32 字节时点名三种合法长度', async () => {
		const result = await runAes(request({ keyText: '00112233', input: 'x' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('16 / 24 / 32');
	});

	it('IV 长度按模式校验：CBC 要 16 字节、GCM 要 12 字节', async () => {
		const cbc = await runAes(request({ input: 'x', ivText: '000102030405060708090a0b' }));
		expect(cbc.ok).toBe(false);
		if (!cbc.ok) expect(cbc.error).toContain('CBC 的 IV 是 16 字节');

		const gcm = await runAes(request({ mode: 'GCM', keyText: KEY_256, ivText: IV_16, input: 'x' }));
		expect(gcm.ok).toBe(false);
		if (!gcm.ok) expect(gcm.error).toContain('GCM 的 IV 固定 12 字节');
	});

	it('CBC 密文长度不是 16 的倍数时提前拦下（不给 DOMException）', async () => {
		const result = await runAes(request({ direction: 'decrypt', input: '0011223344' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('16 的倍数');
	});

	it('GCM 密文被改动一个字节就解不开（认证标签不通过）', async () => {
		const encrypted = await runAes(request({ mode: 'GCM', keyText: KEY_256, ivText: IV_12, input: 'tamper me' }));
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;

		const bytes = encrypted.value.output;
		const flipped = (bytes[0] === '0' ? '1' : '0') + bytes.slice(1);
		const decrypted = await runAes(
			request({ mode: 'GCM', direction: 'decrypt', keyText: KEY_256, ivText: IV_12, input: flipped })
		);
		expect(decrypted.ok).toBe(false);
		if (!decrypted.ok) expect(decrypted.error).toContain('认证标签不通过');
	});

	it('内容为空时按方向给不同的提示', async () => {
		const encrypting = await runAes(request({ input: '  ' }));
		expect(encrypting.ok).toBe(false);
		if (!encrypting.ok) expect(encrypting.error).toBe('还没有明文');

		const decrypting = await runAes(request({ direction: 'decrypt', input: '' }));
		expect(decrypting.ok).toBe(false);
		if (!decrypting.ok) expect(decrypting.error).toBe('还没有密文');
	});

	it('解出来不是合法 UTF-8 时给一句说明，不报错', async () => {
		// CTR 是「密文 XOR 密钥流」，所以能反过来算：先加密一个已知明文拿到密钥流的第一字节，
		// 再把密文改成「必解出 0xff」的那一个字节 —— 这样这条用例是确定的，不靠随机撞。
		const encrypted = await runAes(request({ mode: 'CTR', input: 'A' }));
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;

		const keystream = Number.parseInt(encrypted.value.output.slice(0, 2), 16) ^ 0x41;
		const tampered = (0xff ^ keystream).toString(16).padStart(2, '0');
		const decrypted = await runAes(request({ mode: 'CTR', direction: 'decrypt', input: tampered }));
		expect(decrypted.ok).toBe(true);
		if (decrypted.ok) {
			expect(decrypted.value.byteLength).toBe(1);
			expect(decrypted.value.note).toContain('不是合法 UTF-8');
		}
	});
});

describe('随机密钥与随机 IV', () => {
	it('随机密钥的十六进制长度与字节数对应', () => {
		expect(randomKeyHex(16)).toHaveLength(32);
		expect(randomKeyHex(32)).toHaveLength(64);
	});

	it('随机 IV 按当前模式给出正确长度', () => {
		expect(randomIvHex('CBC')).toHaveLength(32);
		expect(randomIvHex('GCM')).toHaveLength(24);
		expect(randomIvHex('CTR')).toHaveLength(32);
	});
});
