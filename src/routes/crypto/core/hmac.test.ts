// HMAC 的单测，跑在 vitest 的 server project（node 环境，自带 WebCrypto）。
// 用例里的期望值取 RFC 4231 / RFC 2202 的标准向量，不是自己算出来再抄一份。
import { describe, expect, it } from 'vitest';
import { computeHmac, HMAC_BYTES } from './hmac.ts';

const RFC_KEY_HEX = '0b'.repeat(20);
const RFC_DATA = 'Hi There';

describe('标准测试向量（RFC 4231 / RFC 2202）', () => {
	it('HMAC-SHA-256 与 RFC 4231 Test Case 1 一致', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-256',
			message: RFC_DATA,
			keyText: RFC_KEY_HEX,
			keyFormat: 'hex',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.output).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
	});

	it('HMAC-SHA-1 与 RFC 2202 Test Case 1 一致', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-1',
			message: RFC_DATA,
			keyText: RFC_KEY_HEX,
			keyFormat: 'hex',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.output).toBe('b617318655057264e28bc0b6fb378c8ef146be00');
	});

	it('HMAC-SHA-512 与 RFC 4231 Test Case 1 一致', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-512',
			message: RFC_DATA,
			keyText: RFC_KEY_HEX,
			keyFormat: 'hex',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.output).toBe(
				'87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854'
			);
		}
	});
});

describe('输出格式与长度', () => {
	it('四种算法的摘要长度与 HMAC_BYTES 一致', async () => {
		for (const algorithm of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const) {
			const result = await computeHmac({
				algorithm,
				message: '微工具',
				keyText: 'secret',
				keyFormat: 'text',
				outputFormat: 'hex'
			});
			expect(result.ok && result.value.byteLength).toBe(HMAC_BYTES[algorithm]);
			if (result.ok) expect(result.value.output).toHaveLength(HMAC_BYTES[algorithm] * 2);
		}
	});

	it('Base64 输出能在 Hex 输出之间往返（同一串字节两种写法）', async () => {
		const hex = await computeHmac({
			algorithm: 'SHA-256',
			message: 'same',
			keyText: 'k',
			keyFormat: 'text',
			outputFormat: 'hex'
		});
		const base64 = await computeHmac({
			algorithm: 'SHA-256',
			message: 'same',
			keyText: 'k',
			keyFormat: 'text',
			outputFormat: 'base64'
		});
		expect(hex.ok && base64.ok).toBe(true);
		if (hex.ok && base64.ok) {
			expect(Buffer.from(base64.value.output, 'base64').toString('hex')).toBe(hex.value.output);
		}
	});
});

describe('参数校验', () => {
	it('消息为空时报错', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-256',
			message: '',
			keyText: 'secret',
			keyFormat: 'text',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('还没有消息');
	});

	it('密钥为空时报错，并说明空密钥没有认证意义', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-256',
			message: 'x',
			keyText: '   ',
			keyFormat: 'text',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('空密钥算出来没有认证意义');
	});

	it('密钥按 Hex 读不出来时把原因说清楚', async () => {
		const result = await computeHmac({
			algorithm: 'SHA-256',
			message: 'x',
			keyText: 'zz',
			keyFormat: 'hex',
			outputFormat: 'hex'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('密钥读不出来');
	});
});
