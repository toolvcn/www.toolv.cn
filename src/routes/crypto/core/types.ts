// 「加解密工具箱」的共享类型。
//
// 五个工作区（AES / RSA / HMAC / 凯撒 / 维吉尼亚）共用同一套「字节怎么进、怎么出」的口径：
// 输入按 text / hex / base64 读成字节，输出按 hex / base64 写成字符串。
// 这里只放类型 —— 业务逻辑在各自的 core/<topic>.ts；成败结果用的是共享的 `$lib/utils/result`。

/** 输入字节的三种写法：明文 / 十六进制 / Base64 */
export type ByteFormat = 'text' | 'hex' | 'base64';

/**
 * 字节串。显式写成 `Uint8Array<ArrayBuffer>` 而不是默认的 `Uint8Array`：
 * WebCrypto 的入参类型是 `BufferSource`，TS 5.7 起默认的 `Uint8Array`（= `Uint8Array<ArrayBufferLike>`）
 * 不再满足它 —— 这一处别名省掉每个调用点上再包一层 `Uint8Array.from`。
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/** 密文与摘要的两种写法（加密方向是输出格式，解密方向同时也是输入格式） */
export type OutFormat = 'hex' | 'base64';

/** 加解密方向；古典密码复用同一对词（解密的位移取反） */
export type Direction = 'encrypt' | 'decrypt';

/** AES 的三种模式（对应 WebCrypto 的 AES-CBC / AES-GCM / AES-CTR） */
export type AesMode = 'CBC' | 'GCM' | 'CTR';

/** RSA 的四种操作 */
export type RsaOperation = 'encrypt' | 'decrypt' | 'sign' | 'verify';

/** RSA 模数长度（位） */
export type RsaModulus = 2048 | 3072 | 4096;

/** HMAC 的摘要算法 */
export type HmacAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

/** 五个工作区的标签值 */
export type CryptoTab = 'aes' | 'rsa' | 'hmac' | 'caesar' | 'vigenere';
