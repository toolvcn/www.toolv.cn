// HMAC：基于密钥的消息认证码，走 WebCrypto 的 subtle.sign('HMAC')。
//
// 和哈希工具（/hash-calculator）的关系：那边算的是无密钥摘要，这边是带密钥的认证码，
// 所以密钥非空是硬要求 —— 空密钥算出来的东西没有任何认证意义，直接拦下来。
import { bytesToHex, randomBytes, readBytes, textToBytes, writeBytes } from './encoding.ts';
import { fail, ok, type Result } from '$lib/utils/result';
import { type ByteFormat, type HmacAlgorithm, type OutFormat } from './types.ts';

/** 各算法的摘要字节数，给状态条报长度用 */
export const HMAC_BYTES: Record<HmacAlgorithm, number> = {
	'SHA-1': 20,
	'SHA-256': 32,
	'SHA-384': 48,
	'SHA-512': 64
};

export interface HmacRequest {
	algorithm: HmacAlgorithm;
	message: string;
	keyText: string;
	keyFormat: ByteFormat;
	outputFormat: OutFormat;
}

export interface HmacOutcome {
	output: string;
	/** 摘要字节数 */
	byteLength: number;
}

export async function computeHmac(request: HmacRequest): Promise<Result<HmacOutcome>> {
	if (request.message === '') return fail('还没有消息');
	// 先按「trim 后是不是空的」拦一道：只敲了几个空格的密钥，用户的意思就是没填
	if (request.keyText.trim() === '') return fail('密钥是空的：HMAC 必须有密钥，空密钥算出来没有认证意义');

	const key = readBytes(request.keyText, request.keyFormat);
	if (!key.ok) return fail(`密钥读不出来：${key.error}`);
	if (key.value.length === 0) return fail('密钥是空的：HMAC 必须有密钥，空密钥算出来没有认证意义');

	try {
		const handle = await crypto.subtle.importKey(
			'raw',
			Uint8Array.from(key.value),
			{ name: 'HMAC', hash: request.algorithm },
			false,
			['sign']
		);
		const buffer = await crypto.subtle.sign({ name: 'HMAC' }, handle, textToBytes(request.message));
		const bytes = new Uint8Array(buffer);
		return ok({ output: writeBytes(bytes, request.outputFormat), byteLength: bytes.length });
	} catch {
		return fail('HMAC 计算失败：请检查密钥格式与算法');
	}
}

/** 随机密钥（Hex 串），UI 的「随机密钥」用它 —— 默认 32 字节，与 SHA-256 的块长一致 */
export function randomHmacKeyHex(bytes = 32): string {
	return bytesToHex(randomBytes(bytes));
}
