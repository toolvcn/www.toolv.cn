// 哈希计算工具的类型与常量。
// MD5 由自实现提供（见 `md5.ts`），其余四种走 WebCrypto 的 subtle.digest —— 它的算法名
// 与这里的字面量一一对应。列表顺序就是界面展示顺序。

/** 支持的摘要算法 */
export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

/** 界面展示用的算法顺序：MD5 排最前（查的人最多），后面按位长递增 */
export const ALGORITHMS: HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

/** 每种算法的位长，展示用 */
export const HASH_BITS: Record<HashAlgorithm, number> = {
	MD5: 128,
	'SHA-1': 160,
	'SHA-256': 256,
	'SHA-384': 384,
	'SHA-512': 512
};

/** 十六进制结果的大小写 */
export type HexCase = 'lower' | 'upper';

/**
 * 是否是要标注「已不安全」的算法 —— 这类算法只该用于兼容性校验，不能用于签名或口令。
 * MD5 与 SHA-1 都已被公开证明可构造碰撞（SHA-1 是 2017 年的 SHAttered）；
 * SHA-2 系列的 256 / 384 / 512 目前没有实用的碰撞攻击，不标。
 */
export function isInsecure(algorithm: HashAlgorithm): boolean {
	return algorithm === 'MD5' || algorithm === 'SHA-1';
}

/** 空输入时的初始结果：全部空串，渲染为「—」 */
export function emptyDigests(): Record<HashAlgorithm, string> {
	return { MD5: '', 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' };
}
