// 验签的单测：node 环境自带 WebCrypto（v20.19+ / v22.12+ 都有全局 crypto.subtle），
// 密钥对与签名都现场生成，不内联死向量。
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	algFamily,
	describeVerify,
	expiryVerdict,
	hashName,
	pemToDer,
	splitToken,
	verifyToken,
	wrapPkcs1ToSpki,
	type VerifySnapshot
} from './verify.ts';
import { jwtStore } from './store.svelte.ts';
import { EXAMPLE_TOKEN } from './types.ts';

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const segment = (value: unknown): string => b64url(encoder.encode(JSON.stringify(value)));
const makeToken = (header: unknown, payload: unknown, signature: Uint8Array): string =>
	`${segment(header)}.${segment(payload)}.${b64url(signature)}`;
const toPem = (der: Uint8Array, label: string): string => {
	const body = Buffer.from(der)
		.toString('base64')
		.replace(/(.{64})/g, '$1\n');
	return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
};

/** 只在测试侧用到：SPKI DER → 里面的 PKCS#1 DER，用来造 PKCS#1 fixture */
function unwrapSpki(spki: Uint8Array): Uint8Array {
	let i = 1; // 跳过外层 SEQUENCE 的 tag
	const readLength = (): number => {
		const first = spki[i++]!;
		if (first < 0x80) return first;
		let length = 0;
		for (let k = 0; k < (first & 0x7f); k++) length = length * 256 + spki[i++]!;
		return length;
	};
	readLength(); // 外层 SEQUENCE 的长度
	i++; // AlgorithmIdentifier 的 tag
	// 注意别写成 i += readLength()：复合赋值先读旧 i 再求值右侧，readLength 已经把 i 推走了
	const algorithmLength = readLength();
	i += algorithmLength;
	i++; // BIT STRING 的 tag
	const bitLength = readLength();
	i++; // BIT STRING 的首字节（未使用的比特数）
	return spki.slice(i, i + bitLength - 1);
}

async function hmacSign(alg: string, secret: Uint8Array, signingInput: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		Uint8Array.from(secret),
		{ name: 'HMAC', hash: hashName(alg)! },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
}

const SECRET = encoder.encode('a-plain-text-secret');
const HEADER_HS256 = { alg: 'HS256', typ: 'JWT' };
const PAYLOAD = { sub: '1234567890', name: '无情', iat: 1757000000, exp: 1793000000 };

let rsaPair: CryptoKeyPair;
let spkiDer: Uint8Array;
let pkcs1Der: Uint8Array;

beforeAll(async () => {
	rsaPair = await crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify']
	);
	spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', rsaPair.publicKey));
	pkcs1Der = unwrapSpki(spkiDer);
});

beforeEach(() => {
	jwtStore.token = EXAMPLE_TOKEN;
	jwtStore.key = '';
	jwtStore.base64Secret = false;
	jwtStore.verifySnapshot = null;
	jwtStore.now = Date.now();
});

describe('算法映射', () => {
	it('六档都能映射出族与 hash', () => {
		expect(algFamily('HS256')).toBe('hmac');
		expect(algFamily('RS512')).toBe('rsa');
		expect(hashName('HS256')).toBe('SHA-256');
		expect(hashName('HS384')).toBe('SHA-384');
		expect(hashName('HS512')).toBe('SHA-512');
		expect(hashName('RS256')).toBe('SHA-256');
		expect(hashName('RS384')).toBe('SHA-384');
		expect(hashName('RS512')).toBe('SHA-512');
	});

	it('六档之外一律不认识（ES256 也走不到 SHA-256）', () => {
		expect(algFamily('ES256')).toBeNull();
		expect(algFamily('none')).toBeNull();
		expect(algFamily('')).toBeNull();
		expect(hashName('ES256')).toBeNull();
	});
});

describe('splitToken', () => {
	it('待签原文是 token 的前两段子串，逐字符相等', () => {
		const token = `${segment(HEADER_HS256)}.${segment(PAYLOAD)}.${b64url(new Uint8Array([1, 2, 3]))}`;
		const parts = splitToken(`  ${token}  `);
		expect(parts).not.toBeNull();
		expect(parts!.signingInput).toBe(token.trim().split('.').slice(0, 2).join('.'));
		expect(token.startsWith(parts!.signingInput)).toBe(true);
	});

	it('段数不是 3 就没法验', () => {
		expect(splitToken('a.b')).toBeNull();
		expect(splitToken('a.b.c.d')).toBeNull();
	});
});

describe('HMAC 验签', () => {
	it('HS256 往返：现场签的 token 验得出', async () => {
		const signingInput = `${segment(HEADER_HS256)}.${segment(PAYLOAD)}`;
		const token = makeToken(HEADER_HS256, PAYLOAD, await hmacSign('HS256', SECRET, signingInput));
		const parts = splitToken(token)!;
		const outcome = await verifyToken({
			alg: 'HS256',
			signingInput: parts.signingInput,
			signature: parts.signature,
			key: 'a-plain-text-secret',
			base64Secret: false,
			exp: PAYLOAD.exp,
			now: Date.now()
		});
		expect(outcome.status).toBe('valid');
		expect(outcome.expired).toBe(false);
	});

	it('HS384 / HS512 各自成立', async () => {
		for (const alg of ['HS384', 'HS512']) {
			const header = { alg, typ: 'JWT' };
			const signingInput = `${segment(header)}.${segment(PAYLOAD)}`;
			const token = makeToken(header, PAYLOAD, await hmacSign(alg, SECRET, signingInput));
			const parts = splitToken(token)!;
			const outcome = await verifyToken({
				alg,
				signingInput: parts.signingInput,
				signature: parts.signature,
				key: 'a-plain-text-secret',
				base64Secret: false,
				now: Date.now()
			});
			expect(outcome.status).toBe('valid');
		}
	});

	it('密钥不对、内容被改、alg 错配都是 invalid', async () => {
		const signingInput = `${segment(HEADER_HS256)}.${segment(PAYLOAD)}`;
		const signature = await hmacSign('HS256', SECRET, signingInput);
		const base = {
			signingInput,
			signature: b64url(signature),
			base64Secret: false,
			now: Date.now()
		};
		expect((await verifyToken({ ...base, alg: 'HS256', key: 'another-secret' })).status).toBe('invalid');
		// 同一个签名，换个 payload —— 待签原文变了，验不过
		const tampered = `${segment(HEADER_HS256)}.${segment({ ...PAYLOAD, sub: 'hacker' })}`;
		expect(
			(await verifyToken({ ...base, alg: 'HS256', key: 'a-plain-text-secret', signingInput: tampered })).status
		).toBe('invalid');
		expect((await verifyToken({ ...base, alg: 'HS512', key: 'a-plain-text-secret' })).status).toBe('invalid');
	});

	it('Base64 开关：勾上才按 Base64 解密钥', async () => {
		const signingInput = `${segment(HEADER_HS256)}.${segment(PAYLOAD)}`;
		const signature = await hmacSign('HS256', SECRET, signingInput);
		const base = { alg: 'HS256', signingInput, signature: b64url(signature), now: Date.now() };
		const encoded = Buffer.from(SECRET).toString('base64');
		expect((await verifyToken({ ...base, key: encoded, base64Secret: true })).status).toBe('valid');
		expect((await verifyToken({ ...base, key: encoded, base64Secret: false })).status).toBe('invalid');
	});
});

describe('RSA 验签', () => {
	it('SPKI 的 PEM 与 PKCS#1 的 PEM 都能验', async () => {
		const header = { alg: 'RS256', typ: 'JWT' };
		const signingInput = `${segment(header)}.${segment(PAYLOAD)}`;
		const signature = new Uint8Array(
			await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsaPair.privateKey, encoder.encode(signingInput))
		);
		const base = { alg: 'RS256', signingInput, signature: b64url(signature), base64Secret: false, now: Date.now() };
		expect((await verifyToken({ ...base, key: toPem(spkiDer, 'PUBLIC KEY') })).status).toBe('valid');
		expect((await verifyToken({ ...base, key: toPem(pkcs1Der, 'RSA PUBLIC KEY') })).status).toBe('valid');
	});

	it('换一把公钥就是 invalid', async () => {
		const other = await crypto.subtle.generateKey(
			{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
			true,
			['sign', 'verify']
		);
		const otherPem = toPem(new Uint8Array(await crypto.subtle.exportKey('spki', other.publicKey)), 'PUBLIC KEY');
		const header = { alg: 'RS256', typ: 'JWT' };
		const signingInput = `${segment(header)}.${segment(PAYLOAD)}`;
		const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsaPair.privateKey, encoder.encode(signingInput));
		const outcome = await verifyToken({
			alg: 'RS256',
			signingInput,
			signature: b64url(new Uint8Array(signature)),
			key: otherPem,
			base64Secret: false,
			now: Date.now()
		});
		expect(outcome.status).toBe('invalid');
	});

	it('PKCS#1 包回 SPKI 与原 DER 逐字节相等', () => {
		expect(Array.from(wrapPkcs1ToSpki(pkcs1Der))).toEqual(Array.from(spkiDer));
	});
});

describe('失败路径都给得出中文原因', () => {
	const base = {
		alg: 'HS256',
		signingInput: `${segment(HEADER_HS256)}.${segment(PAYLOAD)}`,
		signature: b64url(new Uint8Array([1, 2, 3])),
		key: 'a-plain-text-secret',
		base64Secret: false,
		now: Date.now()
	};

	it('不支持的算法不进 crypto', async () => {
		const outcome = await verifyToken({ ...base, alg: 'ES256' });
		expect(outcome.status).toBe('unsupported');
		expect(outcome.message).toContain('ES256');
	});

	it('alg=none 的空签名说清「没有签名段」', async () => {
		const outcome = await verifyToken({ ...base, alg: 'HS256', signature: '' });
		expect(outcome.status).toBe('invalid');
		expect(outcome.message).toContain('没有签名段');
	});

	it('签名段不是 base64url 时报 error', async () => {
		const outcome = await verifyToken({ ...base, signature: 'not*base64url' });
		expect(outcome.status).toBe('error');
	});

	it('密钥空、公钥不是 PEM 各说各的', async () => {
		expect((await verifyToken({ ...base, key: '   ' })).message).toContain('共享密钥');
		const rsaOutcome = await verifyToken({ ...base, alg: 'RS256', key: '我是公钥' });
		expect(rsaOutcome.status).toBe('error');
		expect(rsaOutcome.message).toContain('PEM');
	});
});

describe('pemToDer', () => {
	it('带回车与折行的 PEM 也解得开，没有 BEGIN 标记就是 null', () => {
		expect(pemToDer(toPem(spkiDer, 'PUBLIC KEY').replace(/\n/g, '\r\n'))?.length).toBe(spkiDer.length);
		expect(pemToDer('just some text')).toBeNull();
	});
});

describe('expiryVerdict', () => {
	it('过去算过期、未来算有效、没 exp 或时间未知就不下结论', () => {
		const now = Date.now();
		expect(expiryVerdict(1, now)).toBe(true);
		expect(expiryVerdict(now / 1000 + 3600, now)).toBe(false);
		expect(expiryVerdict(undefined, now)).toBeNull();
		expect(expiryVerdict('1793000000', now)).toBeNull();
		expect(expiryVerdict(1, 0)).toBeNull();
	});
});

describe('describeVerify 的七个态', () => {
	const snapshot: VerifySnapshot = {
		status: 'valid',
		message: '签名有效（HS256）',
		expired: false,
		alg: 'HS256',
		token: 'x.y.z',
		key: 'k',
		base64Secret: false
	};

	it('进行中 / 没验过 / 结果过时', () => {
		expect(describeVerify({ outcome: null, verifying: true, stale: false })).toEqual({
			text: '正在验签…',
			tone: 'info'
		});
		expect(describeVerify({ outcome: null, verifying: false, stale: false }).tone).toBe('neutral');
		expect(describeVerify({ outcome: snapshot, verifying: false, stale: true }).tone).toBe('warn');
	});

	it('有效 / 无效 / 不支持 / 出错', () => {
		expect(describeVerify({ outcome: snapshot, verifying: false, stale: false }).text).toContain('有效期内');
		expect(describeVerify({ outcome: { ...snapshot, expired: true }, verifying: false, stale: false }).text).toContain(
			'已过期'
		);
		expect(describeVerify({ outcome: { ...snapshot, status: 'invalid' }, verifying: false, stale: false }).tone).toBe(
			'error'
		);
		expect(
			describeVerify({ outcome: { ...snapshot, status: 'unsupported' }, verifying: false, stale: false }).tone
		).toBe('neutral');
		expect(describeVerify({ outcome: { ...snapshot, status: 'error' }, verifying: false, stale: false }).tone).toBe(
			'error'
		);
	});
});

describe('store 的验签状态', () => {
	it('验完落快照，改了 token 就提示结果过时，清除后归零', async () => {
		const signingInput = `${segment(HEADER_HS256)}.${segment(PAYLOAD)}`;
		jwtStore.token = makeToken(HEADER_HS256, PAYLOAD, await hmacSign('HS256', SECRET, signingInput));
		jwtStore.key = 'a-plain-text-secret';
		await jwtStore.verify();

		expect(jwtStore.verifySnapshot?.status).toBe('valid');
		expect(jwtStore.verifyStale).toBe(false);

		jwtStore.token = `${jwtStore.token.slice(0, -1)}a`;
		expect(jwtStore.verifyStale).toBe(true);

		jwtStore.clearVerify();
		expect(jwtStore.verifySnapshot).toBeNull();
		expect(jwtStore.key).toBe('');
	});
});
