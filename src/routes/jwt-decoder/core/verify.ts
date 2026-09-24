// JWT 验签：算法映射与密钥解析是纯函数（node 环境可直接单测），
// crypto.subtle 只在文件末尾的 verifyToken 里出现一次。
//
// 两条不可动摇的口径：
//   1. 待签原文必须是 token 里 `${header}.${payload}` 的**原始子串**，绝不能 JSON 重新序列化 ——
//      键序与空格跟签发方不一致时验签必失败，且不报错，是最难排查的一类错。
//   2. 算法只按 header 的 alg 选，不从密钥反推 —— 那是 alg 混淆攻击的经典入口；
//      不在六档内的 alg 一律不进 crypto。
import { base64UrlDecode } from './jwt.ts';

/** 目前支持验签的六档：HS 走 HMAC 共享密钥，RS 走 RSA 公钥 */
export const SUPPORTED_ALGS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'] as const;

export type VerifyFamily = 'hmac' | 'rsa';
export type VerifyStatus = 'valid' | 'invalid' | 'unsupported' | 'error';

/** 与 $lib/ui/styles 的 StatusTone 同集，避免这里自创一档配色 */
export type VerifyTone = 'neutral' | 'info' | 'ok' | 'warn' | 'error';

export interface VerifyRequest {
	/** header 的 alg 原文（未校验） */
	alg: string;
	/** `${header}.${payload}`，必须是原 token 的子串 */
	signingInput: string;
	/** 第三段原文（base64url）；空串代表 alg=none */
	signature: string;
	/** HS 的共享密钥 / RS 的公钥 PEM */
	key: string;
	/** HS 档：密钥文本是 Base64，先解成字节再做 HMAC */
	base64Secret: boolean;
	/** payload 的 exp（Unix 秒）；不是数字就没有过期结论 */
	exp?: number;
	/** 当前时间（毫秒）；0 表示未知（SSR / hydration 前） */
	now: number;
}

export interface VerifyOutcome {
	status: VerifyStatus;
	message: string;
	/** true 已过期 / false 有效期内 / null 没给 exp 或时间未知 */
	expired: boolean | null;
}

/** store 里存的那份结果：带上当时验签用的 token 与密钥，供 UI 判「结果是否已过时」 */
export interface VerifySnapshot extends VerifyOutcome {
	alg: string;
	token: string;
	key: string;
	base64Secret: boolean;
}

/** 密钥解析的失败原因，用 'error' in x 区分成功与失败 */
type KeyError = { error: string };

export function isSupportedAlg(alg: string): boolean {
	return (SUPPORTED_ALGS as readonly string[]).includes(alg);
}

export function algFamily(alg: string): VerifyFamily | null {
	if (!isSupportedAlg(alg)) return null;
	return alg.startsWith('HS') ? 'hmac' : 'rsa';
}

export function hashName(alg: string): 'SHA-256' | 'SHA-384' | 'SHA-512' | null {
	if (!isSupportedAlg(alg)) return null;
	if (alg.endsWith('256')) return 'SHA-256';
	if (alg.endsWith('384')) return 'SHA-384';
	return 'SHA-512';
}

/**
 * 拆出待签原文与签名段。只按 '.' 切三段的**原文**拼回前两段，不做任何 JSON 处理。
 * 段数不是 3 返回 null。
 */
export function splitToken(token: string): { signingInput: string; signature: string } | null {
	const parts = token.trim().split('.');
	if (parts.length !== 3) return null;
	return { signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

/** exp 与当前时间的比较；now 为 0（SSR / 未 hydration）时不下结论 */
export function expiryVerdict(exp: unknown, now: number): boolean | null {
	if (now === 0) return null;
	if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
	return exp * 1000 <= now;
}

/**
 * PEM → DER。base64UrlDecode 会拒绝任意 '='，而 PEM 的填充只出现在末尾，
 * 先剥掉尾部 '=' 再复用它，不必再写一套 base64 解码。
 */
export function pemToDer(pem: string): Uint8Array | null {
	const match = /-----BEGIN ((?:RSA )?PUBLIC KEY)-----([\s\S]*?)-----END \1-----/.exec(pem);
	if (!match) return null;
	const body = match[2].replace(/\s+/g, '').replace(/=+$/, '');
	return base64UrlDecode(body);
}

// PKCS#1 的 RSA 公钥包成 SPKI：SEQUENCE { AlgorithmIdentifier, BIT STRING }
// （AlgorithmIdentifier = SEQUENCE { OID 1.2.840.113549.1.1.1, NULL }）。
// 手写这十几个字节是为了不引 DER 库；浏览器只认 SPKI，不认裸 PKCS#1。
const RSA_ALGORITHM_ID = new Uint8Array([
	0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
]);

function concat(...parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** DER 长度字段：小于 0x80 走短格式，否则长格式（首字节 = 0x80 | 字节数） */
function derLength(n: number): number[] {
	if (n < 0x80) return [n];
	const bytes: number[] = [];
	let value = n;
	while (value > 0) {
		bytes.unshift(value & 0xff);
		value >>= 8;
	}
	return [0x80 | bytes.length, ...bytes];
}

function der(tag: number, body: Uint8Array): Uint8Array {
	return new Uint8Array([tag, ...derLength(body.length), ...body]);
}

export function wrapPkcs1ToSpki(pkcs1: Uint8Array): Uint8Array {
	// BIT STRING 的首字节是「未使用的比特数」，RSA 公钥恒为 0
	const bits = der(0x03, new Uint8Array([0x00, ...pkcs1]));
	return der(0x30, concat(RSA_ALGORITHM_ID, bits));
}

const PEM_HINT = '公钥要写成 PEM（-----BEGIN PUBLIC KEY----- 或 -----BEGIN RSA PUBLIC KEY-----）';

/** 公钥文本 → SPKI DER。SPKI 直用，PKCS#1 现场包一层 */
export function publicKeyDer(text: string): Uint8Array | KeyError {
	const label = /-----BEGIN ((?:RSA )?PUBLIC KEY)-----/.exec(text)?.[1];
	if (label === undefined) {
		return { error: `${PEM_HINT}；只有 PKCS#1 时也可 openssl rsa -RSAPublicKey_in -pubout 转成 SPKI` };
	}
	const der = pemToDer(text);
	if (!der || der.length === 0) return { error: 'PEM 内容解不出来，请检查公钥是否复制完整' };
	return label === 'RSA PUBLIC KEY' ? wrapPkcs1ToSpki(der) : der;
}

/**
 * HS 的共享密钥 → 字节。默认按 UTF-8 明文取（多数项目的 secret 就是明文随机串）；
 * 勾了 Base64 才先解 Base64 —— 自动嗅探不可取："abc123" 既是合法明文也是合法 Base64，
 * 猜错就是一句「签名无效」，最难排查。
 */
export function parseSecret(text: string, base64: boolean): Uint8Array | KeyError {
	const trimmed = text.trim();
	if (trimmed === '') return { error: '请先填入共享密钥' };
	if (!base64) return new TextEncoder().encode(trimmed);
	const bytes = base64UrlDecode(trimmed.replace(/\s+/g, '').replace(/=+$/, ''));
	if (!bytes || bytes.length === 0) return { error: '密钥按 Base64 解不出来；明文密钥不要勾这个开关' };
	return bytes;
}

/** 结果文案与配色：七个态收在一处，UI 不自己拼字符串（改文案只动这里） */
export function describeVerify(input: { outcome: VerifySnapshot | null; verifying: boolean; stale: boolean }): {
	text: string;
	tone: VerifyTone;
} {
	if (input.verifying) return { text: '正在验签…', tone: 'info' };
	if (!input.outcome) return { text: '填入密钥后点「验签」，全程在本机计算', tone: 'neutral' };
	if (input.stale) return { text: 'token 或密钥已改动，结果可能不是最新的，请重新验签', tone: 'warn' };

	const { status, message, expired } = input.outcome;
	if (status === 'unsupported') return { text: message, tone: 'neutral' };
	if (status === 'invalid' || status === 'error') return { text: message, tone: 'error' };
	if (expired === null) return { text: message, tone: 'ok' };
	return { text: `${message} · ${expired ? '已过期' : '有效期内'}`, tone: 'ok' };
}

/** 验签：全站唯一一处 crypto.subtle 验签调用。失败一律返回文案，不抛给调用方 */
export async function verifyToken(req: VerifyRequest): Promise<VerifyOutcome> {
	const expired = expiryVerdict(req.exp, req.now);
	const family = algFamily(req.alg);
	if (family === null) {
		return {
			status: 'unsupported',
			message: `暂不支持 ${req.alg === '' ? '未知算法' : req.alg}，目前只验 HS256/384/512 与 RS256/384/512`,
			expired
		};
	}
	if (req.signature === '') {
		return { status: 'invalid', message: '这段 token 没有签名段（alg 为 none），无从验签', expired };
	}
	const signature = base64UrlDecode(req.signature);
	if (!signature || signature.length === 0) {
		return { status: 'error', message: '签名段不是合法的 base64url，无法验签', expired };
	}
	const hash = hashName(req.alg);
	if (hash === null) {
		return { status: 'unsupported', message: `暂不支持 ${req.alg}`, expired };
	}

	let key: CryptoKey;
	try {
		if (family === 'hmac') {
			const secret = parseSecret(req.key, req.base64Secret);
			if ('error' in secret) return { status: 'error', message: secret.error, expired };
			// Uint8Array.from 过一道：strict 下 BufferSource 的泛型不接受带偏移的视图
			key = await crypto.subtle.importKey('raw', Uint8Array.from(secret), { name: 'HMAC', hash }, false, ['verify']);
		} else {
			const der = publicKeyDer(req.key);
			if ('error' in der) return { status: 'error', message: der.error, expired };
			key = await crypto.subtle.importKey(
				'spki',
				Uint8Array.from(der),
				{ name: 'RSASSA-PKCS1-v1_5', hash }, // RS256 是 PKCS#1 v1.5，不是 RSA-PSS
				false,
				['verify']
			);
		}
	} catch {
		return {
			status: 'error',
			message: family === 'hmac' ? '密钥导入失败，请检查密钥内容' : '公钥导入失败，请确认贴的是 RSA 公钥的 PEM',
			expired
		};
	}

	const ok = await crypto.subtle.verify(
		family === 'hmac' ? { name: 'HMAC' } : { name: 'RSASSA-PKCS1-v1_5' },
		key,
		Uint8Array.from(signature),
		new TextEncoder().encode(req.signingInput)
	);
	return ok
		? { status: 'valid', message: `签名有效（${req.alg}）`, expired }
		: { status: 'invalid', message: '签名无效：密钥不匹配，或内容被改动过', expired };
}
