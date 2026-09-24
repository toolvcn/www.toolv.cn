// 字节 ↔ 字符串：hex / Base64 / UTF-8 三条互转，加解密工具箱的五个工作区共用。
//
// 这里只收「把用户粘进来的串读成字节」与「把字节写回串」这两件事；
// crypto.subtle 的调用一律留在 core/aes.ts / rsa.ts / hmac.ts。
// btoa / atob 与 TextEncoder / TextDecoder 在浏览器与 node 里都是全局的，单测能直接跑。
import { fail, ok, type Result } from '$lib/utils/result';
import { type ByteFormat, type Bytes, type OutFormat } from './types.ts';

const HEX_ONLY = /^[0-9a-fA-F]+$/;
/** 标准 Base64 与 base64url 都收：URL 场景里 '-' '_' 很常见，不认就得让用户自己换 */
const BASE64_ONLY = /^[A-Za-z0-9+/_-]*={0,2}$/;

export function textToBytes(text: string): Bytes {
	return new TextEncoder().encode(text);
}

/**
 * 字节 → 文本。非 UTF-8 字节**不报错**，用 U+FFFD 代替 —— 解出来是二进制时至少能看到内容，
 * 是不是合法 UTF-8 由 `decodableAsText` 单独判（AES 解密靠它给一句提示）。
 */
export function bytesToText(bytes: Uint8Array): string {
	return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** 字节是否是合法 UTF-8 文本 */
export function decodableAsText(bytes: Uint8Array): boolean {
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return true;
	} catch {
		return false;
	}
}

export function bytesToHex(bytes: Uint8Array): string {
	let hex = '';
	for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
	return hex;
}

/** 十六进制 → 字节。空白照收（hex dump 里常有空格与换行） */
export function hexToBytes(text: string): Result<Bytes> {
	const cleaned = text.replace(/\s+/g, '');
	if (cleaned === '') return fail('十六进制内容是空的');
	if (cleaned.length % 2 !== 0) return fail(`十六进制是奇数位（${cleaned.length} 位），每两个字符一个字节`);
	if (!HEX_ONLY.test(cleaned)) return fail('含非十六进制字符，只能是 0-9 / a-f');
	const bytes = new Uint8Array(cleaned.length / 2);
	for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
	return ok(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	// 分块拼：String.fromCharCode 的参数个数有上限，整块展开会在长内容上栈溢出
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** Base64 → 字节。base64url 的 '-' '_' 与结尾缺填充都收 */
export function base64ToBytes(text: string): Result<Bytes> {
	const cleaned = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
	if (cleaned === '') return fail('Base64 内容是空的');
	if (!BASE64_ONLY.test(cleaned)) return fail('含非 Base64 字符');
	if (cleaned.length % 4 === 1) return fail('Base64 长度不合法（缺字符或多字符）');
	try {
		const binary = atob(cleaned);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return ok(bytes);
	} catch {
		return fail('Base64 解不出来，请检查内容是否完整');
	}
}

/** 按用户选的口径把输入串读成字节 */
export function readBytes(text: string, format: ByteFormat): Result<Bytes> {
	if (format === 'hex') return hexToBytes(text);
	if (format === 'base64') return base64ToBytes(text);
	return ok(textToBytes(text));
}

/** 按用户选的口径把字节写成串 */
export function writeBytes(bytes: Uint8Array, format: OutFormat): string {
	return format === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes);
}

/** 随机字节（随机密钥 / 随机 IV 用），走平台 CSPRNG */
export function randomBytes(length: number): Bytes {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}
