// MD5 摘要（RFC 1321）的纯函数实现。
//
// 为什么自实现而不是引第三方包：WebCrypto 的 `subtle.digest` **刻意不提供 MD5**
// （它已可构造碰撞，被标准排除在安全算法之外），而「不为单个工具引入大型依赖」是本站硬约束。
// MD5 只是一段定长的位运算，自己写比引包更可控，也能直接在 node 环境的单测里用标准向量核对。
//
// ⚠️ MD5 只适合做**兼容性校验**（对端只认 MD5 的老接口、老文件的校验和），
// **不要用于签名、口令或任何安全用途** —— 界面上对这一条一并标出「已不安全」。

/**
 * 每轮的循环左移位数（RFC 1321 的四张位移表，按轮依次拼接）。
 * 前三轮 16 个一组分别用 7/12/17/22、5/9/14/20、4/11/16/23，末轮用 6/10/15/21。
 */
const SHIFTS = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4,
	11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

/**
 * 每轮的常量 `K[i] = floor(2^32 × |sin(i + 1)|)`。
 * 这里写死字面量而不是用 `Math.sin` 现算：现算依赖浮点库实现，边界上差 1 就会**静默**算出错的摘要，
 * 而字面量是标准里定死的值，不随运行环境变。
 */
const K = [
	0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8,
	0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
	0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87,
	0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
	0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039,
	0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
	0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
];

/** 循环左移；`value` 视作 32 位无符号，结果是有符号 32 位（与整段运算的口径一致） */
function rotl(value: number, bits: number): number {
	return (value << bits) | (value >>> (32 - bits));
}

/**
 * 按 MD5 规范补齐：先补一个 0x80，再补 0 到「长度 % 64 == 56」，最后 8 字节写小端位长。
 * `+ 8` 是给 0x80 与位长留位置，再向上取到 64 的整数倍 —— 补齐后必定比输入长。
 */
function pad(input: Uint8Array): Uint8Array {
	const bitLength = input.length * 8;
	const total = (Math.floor((input.length + 8) / 64) + 1) * 64;
	const bytes = new Uint8Array(total);
	bytes.set(input);
	bytes[input.length] = 0x80;
	// 位长是 64 位小端；先用 Number 算再拆高低 32 位，超过 2^32 字节的输入才用得上高 32 位
	const view = new DataView(bytes.buffer);
	view.setUint32(total - 8, bitLength >>> 0, true);
	view.setUint32(total - 4, Math.floor(bitLength / 0x100000000), true);
	return bytes;
}

/** 32 位字按小端写成 8 个十六进制字符（MD5 输出用的是小端序，不能直接 toString(16)） */
function wordToHex(word: number): string {
	let hex = '';
	for (let i = 0; i < 4; i += 1) hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
	return hex;
}

/**
 * 对已编码的字节算 MD5，返回 32 位小写十六进制串。
 * 分出来是为了给将来的文件哈希留口子（现在是文本进 `md5Hex`）。
 */
export function md5Bytes(input: Uint8Array): string {
	const bytes = pad(input);
	let a0 = 0x67452301;
	let b0 = 0xefcdab89;
	let c0 = 0x98badcfe;
	let d0 = 0x10325476;

	const words = new Uint32Array(16);
	const view = new DataView(bytes.buffer);
	for (let offset = 0; offset < bytes.length; offset += 64) {
		for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, true);

		let a = a0;
		let b = b0;
		let c = c0;
		let d = d0;

		for (let i = 0; i < 64; i += 1) {
			let f: number;
			let g: number;
			if (i < 16) {
				f = (b & c) | (~b & d);
				g = i;
			} else if (i < 32) {
				f = (d & b) | (~d & c);
				g = (5 * i + 1) % 16;
			} else if (i < 48) {
				f = b ^ c ^ d;
				g = (3 * i + 5) % 16;
			} else {
				f = c ^ (b | ~d);
				g = (7 * i) % 16;
			}
			// 标准轮函数：A←D←C←B，再把 B 加上 rotl(F + A + K[i] + M[g])
			const previousD = d;
			d = c;
			c = b;
			// 四项之和可能超过 32 位（最大约 2^34，仍在 double 的精确整数范围内），| 0 收回到有符号 32 位
			b = (b + rotl((f + a + K[i] + words[g]) | 0, SHIFTS[i])) | 0;
			a = previousD;
		}

		a0 = (a0 + a) | 0;
		b0 = (b0 + b) | 0;
		c0 = (c0 + c) | 0;
		d0 = (d0 + d) | 0;
	}

	return wordToHex(a0) + wordToHex(b0) + wordToHex(c0) + wordToHex(d0);
}

/** 文本按 UTF-8 编码后算 MD5 —— 与工具里其它算法同一个「先 TextEncoder 再哈希」的口径 */
export function md5Hex(text: string): string {
	return md5Bytes(new TextEncoder().encode(text));
}
