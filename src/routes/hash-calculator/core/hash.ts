// 哈希计算的纯函数：MD5 走自实现（`md5.ts`），其余走 WebCrypto 的 subtle.digest，均不引第三方库。
// node 环境（vitest）自带全局 crypto，这些函数可以直接跑单测。
import { md5Bytes } from './md5.ts';
import type { HashAlgorithm, HexCase } from './types.ts';

/**
 * 计算文本的摘要，返回小写十六进制串。
 * 先 TextEncoder 成 UTF-8 字节再哈希：中文、emoji 与文件内容口径一致。
 *
 * MD5 单独分出来：`subtle.digest` 不提供它（标准刻意排除了这个已可碰撞的算法），
 * 所以这一支走自实现，也因此**不依赖 WebCrypto**。
 */
export async function hexDigest(algorithm: HashAlgorithm, text: string): Promise<string> {
	const data = new TextEncoder().encode(text);
	if (algorithm === 'MD5') return md5Bytes(data);
	const buffer = await crypto.subtle.digest(algorithm, data);
	return bytesToHex(new Uint8Array(buffer));
}

function bytesToHex(bytes: Uint8Array): string {
	// 摘要最长 64 字节，逐个拼没问题；不用 join 是为了少一次数组分配
	let hex = '';
	for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
	return hex;
}

/** 结果的大小写转换；空串转完还是空串 */
export function formatHex(hex: string, hexCase: HexCase): string {
	return hexCase === 'upper' ? hex.toUpperCase() : hex.toLowerCase();
}

/** 文本按 UTF-8 编码后的字节数：比 input.length 更能说明「多大」 */
export function byteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

/** 载入示例：覆盖常见消息形态，也让首屏有东西看 */
export const EXAMPLE_TEXT = '{"type":"ping","message":"hello","time":1704067200000}';
