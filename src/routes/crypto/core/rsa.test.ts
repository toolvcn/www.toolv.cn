// RSA 的单测，跑在 vitest 的 server project（node 环境，自带 WebCrypto）。
// 只生成一次 2048 位密钥对给全部用例共用 —— 生成一次要几百毫秒，每个用例都生成会拖慢整轮。
import { beforeAll, describe, expect, it } from 'vitest';
import { derToPem, generateRsaKeyPair, pemToDer, runRsa, type RsaKeyPairPem } from './rsa.ts';

let keys: RsaKeyPairPem;

beforeAll(async () => {
	const generated = await generateRsaKeyPair(2048);
	if (!generated.ok) throw new Error(generated.error);
	keys = generated.value;
});

describe('密钥对的生成与 PEM 互转', () => {
	it('导出 PKCS#8 私钥与 SPKI 公钥，标签是 openssl 认的那两个', () => {
		expect(keys.privateKey.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
		expect(keys.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);
		expect(keys.modulusLength).toBe(2048);
	});

	it('PEM 的正文按 64 列换行（与 openssl 一致）', () => {
		const lines = keys.publicKey.split('\n');
		expect(lines.length).toBeGreaterThan(3);
		for (const line of lines.slice(1, -1)) expect(line.length).toBeLessThanOrEqual(64);
	});

	it('derToPem → pemToDer 回到同一串字节', () => {
		const der = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01]);
		const pem = derToPem(der, 'PRIVATE KEY');
		const back = pemToDer(pem, ['PRIVATE KEY']);
		expect(back.ok).toBe(true);
		if (back.ok) expect([...back.value]).toEqual([...der]);
	});

	it('PKCS#1 的老写法给转换命令，而不是只说「没找到」', () => {
		const result = pemToDer('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----', ['PRIVATE KEY']);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('openssl pkcs8 -topk8');
	});

	it('完全不是 PEM 时说明期望的标签', () => {
		const result = pemToDer('随便一段文本', ['PUBLIC KEY']);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('-----BEGIN PUBLIC KEY-----');
	});
});

describe('加解密', () => {
	it('公钥加密、私钥解密，中文与 emoji 都回得来', async () => {
		const plaintext = '微工具 toolv.cn 🎉';
		const encrypted = await runRsa({ operation: 'encrypt', input: plaintext, signature: '', ...keys });
		expect(encrypted.ok).toBe(true);
		if (!encrypted.ok) return;
		// 2048 位密钥的密文恒为 256 字节，Base64 后 344 个字符
		expect(encrypted.value.note).toContain('2048 位');

		const decrypted = await runRsa({
			operation: 'decrypt',
			input: encrypted.value.output,
			signature: '',
			...keys
		});
		expect(decrypted.ok).toBe(true);
		if (decrypted.ok) expect(decrypted.value.output).toBe(plaintext);
	});

	it('明文刚好到上限能封，超一个字节就明确拒绝', async () => {
		// 2048 位 + OAEP-SHA256 的上限 = 256 - 2 × 32 - 2 = 190 字节
		const atLimit = await runRsa({ operation: 'encrypt', input: 'a'.repeat(190), signature: '', ...keys });
		expect(atLimit.ok).toBe(true);

		const tooLong = await runRsa({ operation: 'encrypt', input: 'a'.repeat(191), signature: '', ...keys });
		expect(tooLong.ok).toBe(false);
		if (!tooLong.ok) expect(tooLong.error).toContain('上限 190 字节');
	});

	it('密文长度与密钥位数对不上时提前拦下', async () => {
		const result = await runRsa({ operation: 'decrypt', input: 'AAAA', signature: '', ...keys });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('对不上');
	});

	it('内容为空时报错', async () => {
		const result = await runRsa({ operation: 'encrypt', input: '  ', signature: '', ...keys });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('还没有内容');
	});
});

describe('签名与验签', () => {
	it('私钥签名、公钥验签通过，且签名长度等于模数长度', async () => {
		const signed = await runRsa({ operation: 'sign', input: '待签名的内容', signature: '', ...keys });
		expect(signed.ok).toBe(true);
		if (!signed.ok) return;
		expect(Buffer.from(signed.value.output, 'base64').length).toBe(256);

		const verified = await runRsa({
			operation: 'verify',
			input: '待签名的内容',
			signature: signed.value.output,
			...keys
		});
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.value.valid).toBe(true);
			expect(verified.value.output).toBe('签名有效');
		}
	});

	it('原文改一个字就验不过（结论是「无效」而不是报错）', async () => {
		const signed = await runRsa({ operation: 'sign', input: '原始内容', signature: '', ...keys });
		expect(signed.ok).toBe(true);
		if (!signed.ok) return;

		const verified = await runRsa({
			operation: 'verify',
			input: '原始内容（被改过）',
			signature: signed.value.output,
			...keys
		});
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.value.valid).toBe(false);
			expect(verified.value.output).toBe('签名无效');
		}
	});

	it('签名不是 Base64 时报错', async () => {
		const result = await runRsa({ operation: 'verify', input: 'x', signature: 'not base64!', ...keys });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('只收 Base64');
	});

	it('公钥留空时提示要贴 SPKI 的 PEM', async () => {
		const result = await runRsa({ operation: 'verify', input: 'x', signature: 'AAAA', privateKey: '', publicKey: '' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('BEGIN PUBLIC KEY');
	});
});
