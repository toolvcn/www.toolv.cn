// RSA：生成密钥对、加解密（RSA-OAEP + SHA-256）、签名验签（RSASSA-PKCS1-v1_5 + SHA-256）。
//
// 一个密钥对同时当两种算法用。WebCrypto 把算法绑在密钥对象上、generateKey 只能选一个，
// 所以流程是：按 RSA-OAEP 生成并导出 PKCS#8 / SPKI，要用签名时再把**同一份 DER** 按
// RSASSA-PKCS1-v1_5 重新 import 一遍。导出的 PEM 与 openssl 完全通用：
//   openssl rsa -in private.pem -pubout        → SPKI 公钥
//   openssl rsa -check -noout -in private.pem  → 校验私钥
//
// 只收 PKCS#8 私钥（-----BEGIN PRIVATE KEY-----）与 SPKI 公钥（-----BEGIN PUBLIC KEY-----）；
// PKCS#1 的两种老写法给一句转换命令，不在这里现场包 DER。
import { bytesToBase64, base64ToBytes, bytesToText, decodableAsText, textToBytes } from './encoding.ts';
import { fail, ok, type Result } from '$lib/utils/result';
import { type Bytes, type RsaModulus, type RsaOperation } from './types.ts';

/** 加解密与签名都用 SHA-256：与 JWT 的 RS256 同一套，导出到其它系统不用改口径 */
export const RSA_HASH = 'SHA-256';
/** OAEP 的填充开销是 2 × 摘要长度 + 2 字节，SHA-256 下即 66 字节 */
const OAEP_OVERHEAD = 2 * 32 + 2;

export interface RsaKeyPairPem {
	privateKey: string;
	publicKey: string;
	modulusLength: number;
}

export interface RsaRequest {
	operation: RsaOperation;
	input: string;
	/** 验签时的签名串（Base64） */
	signature: string;
	privateKey: string;
	publicKey: string;
}

export interface RsaOutcome {
	output: string;
	note: string;
	/** 只有验签方向有结论：true 有效 / false 无效 */
	valid?: boolean;
}

type RsaUsage = 'encrypt' | 'decrypt' | 'sign' | 'verify';

// ---------------------------------------------------------------- PEM

/** DER → PEM：Base64 按 64 列换行，与 openssl 的输出一致 */
export function derToPem(der: Uint8Array, label: string): string {
	const lines = bytesToBase64(der).match(/.{1,64}/g) ?? [];
	return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * PEM → DER。labels 给出可接受的标签，按顺序找第一个匹配的。
 * PKCS#1 的两种老写法单独点名，并给出转换命令 —— 只说「没找到」用户不知道该干什么。
 */
export function pemToDer(pem: string, labels: readonly string[]): Result<Bytes> {
	for (const label of labels) {
		const match = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`).exec(pem);
		if (!match) continue;
		const body = match[1].replace(/\s+/g, '').replace(/=+$/, '');
		if (body === '') return fail(`PEM 里 ${label} 的内容是空的`);
		return base64ToBytes(body);
	}
	if (/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) {
		return fail('这是 PKCS#1 私钥，先转成 PKCS#8：openssl pkcs8 -topk8 -nocrypt -in key.pem -out pkcs8.pem');
	}
	if (/-----BEGIN RSA PUBLIC KEY-----/.test(pem)) {
		return fail('这是 PKCS#1 公钥，先转成 SPKI：openssl rsa -RSAPublicKey_in -pubout -in pub.pem -out spki.pem');
	}
	return fail(`没找到 ${labels.map((label) => `-----BEGIN ${label}-----`).join(' 或 ')} 这一段`);
}

const PEM_HINT = {
	private: '私钥要贴 PKCS#8 的 PEM（-----BEGIN PRIVATE KEY----- 开头）',
	public: '公钥要贴 SPKI 的 PEM（-----BEGIN PUBLIC KEY----- 开头）'
} as const;

// ---------------------------------------------------------------- 生成与导入

export async function generateRsaKeyPair(modulusLength: RsaModulus): Promise<Result<RsaKeyPairPem>> {
	try {
		const pair = (await crypto.subtle.generateKey(
			{ name: 'RSA-OAEP', modulusLength, publicExponent: new Uint8Array([1, 0, 1]), hash: RSA_HASH },
			true,
			['encrypt', 'decrypt']
		)) as CryptoKeyPair;
		const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
		const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
		return ok({
			privateKey: derToPem(new Uint8Array(pkcs8), 'PRIVATE KEY'),
			publicKey: derToPem(new Uint8Array(spki), 'PUBLIC KEY'),
			modulusLength
		});
	} catch {
		return fail(`生成 ${modulusLength} 位密钥失败：WebCrypto 需要 HTTPS 或 localhost 环境`);
	}
}

/** 按用途导入密钥：加解密走 RSA-OAEP，签名验签走 RSASSA-PKCS1-v1_5 */
async function loadKey(kind: 'private' | 'public', pem: string, usage: RsaUsage): Promise<Result<CryptoKey>> {
	const der = pemToDer(pem, [kind === 'private' ? 'PRIVATE KEY' : 'PUBLIC KEY']);
	if (!der.ok) return fail(der.error);

	const hashed = usage === 'encrypt' || usage === 'decrypt' ? 'RSA-OAEP' : 'RSASSA-PKCS1-v1_5';
	try {
		const key = await crypto.subtle.importKey(
			kind === 'private' ? 'pkcs8' : 'spki',
			Uint8Array.from(der.value),
			{ name: hashed, hash: RSA_HASH },
			false,
			[usage]
		);
		return ok(key);
	} catch {
		return fail(`密钥导入失败：${PEM_HINT[kind]}，且要与本次用途匹配`);
	}
}

function modulusBytesOf(key: CryptoKey): number {
	return (key.algorithm as RsaHashedKeyAlgorithm).modulusLength / 8;
}

// ---------------------------------------------------------------- 四种操作

export async function runRsa(request: RsaRequest): Promise<Result<RsaOutcome>> {
	if (request.input.trim() === '') return fail('还没有内容：先填要处理的那一段');

	switch (request.operation) {
		case 'encrypt': {
			const key = await loadKey('public', request.publicKey, 'encrypt');
			if (!key.ok) return fail(key.error);
			const modulusBytes = modulusBytesOf(key.value);
			const limit = modulusBytes - OAEP_OVERHEAD;
			const data = textToBytes(request.input);
			if (data.length > limit) {
				return fail(
					`明文 ${data.length} 字节，超过这套密钥单次能封的上限 ${limit} 字节（RSA-OAEP + SHA-256）；长内容请改用 AES，或分段加密`
				);
			}
			try {
				const buffer = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key.value, data);
				const bytes = new Uint8Array(buffer);
				return ok({
					output: bytesToBase64(bytes),
					note: `RSA-OAEP · SHA-256 · ${modulusBytes * 8} 位 · 密文 ${bytes.length} 字节`
				});
			} catch {
				return fail('加密失败：这把公钥不能用于加密');
			}
		}

		case 'decrypt': {
			const key = await loadKey('private', request.privateKey, 'decrypt');
			if (!key.ok) return fail(key.error);
			const modulusBytes = modulusBytesOf(key.value);
			const data = base64ToBytes(request.input);
			if (!data.ok) return fail(`密文读不出来（只收 Base64）：${data.error}`);
			if (data.value.length !== modulusBytes) {
				return fail(
					`密文 ${data.value.length} 字节，与 ${modulusBytes * 8} 位密钥的密文长度 ${modulusBytes} 字节对不上`
				);
			}
			try {
				const buffer = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key.value, Uint8Array.from(data.value));
				const bytes = new Uint8Array(buffer);
				return ok({
					output: bytesToText(bytes),
					note: decodableAsText(bytes) ? '' : '解密结果不是合法 UTF-8，已用替换字符展示（可能是二进制数据）'
				});
			} catch {
				return fail('解密失败：私钥不对，或这段密文不是用配套公钥加的');
			}
		}

		case 'sign': {
			const key = await loadKey('private', request.privateKey, 'sign');
			if (!key.ok) return fail(key.error);
			try {
				const buffer = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key.value, textToBytes(request.input));
				const bytes = new Uint8Array(buffer);
				return ok({
					output: bytesToBase64(bytes),
					note: `RSASSA-PKCS1-v1_5 · SHA-256 · 签名 ${bytes.length} 字节（Base64 输出）`
				});
			} catch {
				return fail('签名失败：这把私钥不能用于签名');
			}
		}

		case 'verify': {
			const key = await loadKey('public', request.publicKey, 'verify');
			if (!key.ok) return fail(key.error);
			const signature = base64ToBytes(request.signature);
			if (!signature.ok) return fail(`签名读不出来（只收 Base64）：${signature.error}`);
			try {
				const valid = await crypto.subtle.verify(
					{ name: 'RSASSA-PKCS1-v1_5' },
					key.value,
					Uint8Array.from(signature.value),
					textToBytes(request.input)
				);
				return ok({
					output: valid ? '签名有效' : '签名无效',
					note: valid ? '原文与签名对得上，且确实由配套私钥签出' : '原文被改过，或签名不是这把私钥签的',
					valid
				});
			} catch {
				return fail('验签失败：公钥与签名不匹配（签名长度不对时也会走到这里）');
			}
		}
	}
}
