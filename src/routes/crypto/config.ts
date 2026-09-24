// 「加解密工具箱」的可配置业务参数：五个工作区的默认值、示例数据与选项清单。
// 要调这一页的默认行为，改这里就够了。
//
// 边界（与 clock / color-converter 那两份同一个口径，免得文件越长越杂）：
//   - 只放**业务数值与选项**。类型在 `core/types.ts`；WebCrypto 的长度硬约束（AES 的 IV_LENGTH）在
//     `core/aes.ts` —— 那是算法要求、不是可调参数；组件里的提示文案在 `ui/*.svelte`，都不进这里。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找。

import type {
	AesMode,
	ByteFormat,
	CryptoTab,
	Direction,
	HmacAlgorithm,
	OutFormat,
	RsaModulus,
	RsaOperation
} from './core/types.ts';

/** 下拉 / 分段的选项形状（与 `$lib/ui/Dropdown` 的 `DropdownOption` 结构一致，这里不 import UI 类型） */
interface Option<V extends string> {
	value: V;
	label: string;
	description: string;
}

/** 首屏落在哪个工作区 */
export const DEFAULT_TAB: CryptoTab = 'aes';

// ---------------------------------------------------------------- AES（ID 45）

/** 示例：密钥与 IV 取 NIST 文档里的经典取值，方便与其它实现对照 */
export const EXAMPLE_AES = {
	input: '微工具 toolv.cn · 数据本地处理',
	key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
	iv: '000102030405060708090a0b0c0d0e0f'
} as const;

export const AES_MODE_OPTIONS: readonly Option<AesMode>[] = [
	{ value: 'CBC', label: 'CBC', description: '需要 16 字节 IV，自带 PKCS#7 填充；最通用，但不校验完整性' },
	{ value: 'GCM', label: 'GCM', description: '需要 12 字节 IV，带认证标签、能发现篡改；新项目首选' },
	{ value: 'CTR', label: 'CTR', description: '需要 16 字节计数器，流式加密；同样不校验完整性' }
];

export const KEY_FORMAT_OPTIONS: readonly Option<ByteFormat>[] = [
	{ value: 'text', label: '文本', description: '密钥按 UTF-8 文本取字节（多数项目的密钥就是明文随机串）' },
	{ value: 'hex', label: 'Hex', description: '密钥是十六进制串（每 2 个字符 1 字节）' },
	{ value: 'base64', label: 'Base64', description: '密钥是 Base64 串' }
];

export const DATA_FORMAT_OPTIONS: readonly { value: OutFormat; label: string }[] = [
	{ value: 'hex', label: 'Hex' },
	{ value: 'base64', label: 'Base64' }
];

/** 随机密钥档位：字节数 → AES 位数 */
export const KEY_BYTE_OPTIONS: readonly Option<string>[] = [
	{ value: '16', label: '16 字节', description: 'AES-128' },
	{ value: '24', label: '24 字节', description: 'AES-192' },
	{ value: '32', label: '32 字节', description: 'AES-256' }
];

// ---------------------------------------------------------------- HMAC（ID 47）

export const HMAC_ALGORITHM_OPTIONS: readonly Option<HmacAlgorithm>[] = [
	{ value: 'SHA-256', label: 'SHA-256', description: '32 字节摘要，最常用' },
	{ value: 'SHA-1', label: 'SHA-1', description: '20 字节摘要，只用于兼容老接口' },
	{ value: 'SHA-384', label: 'SHA-384', description: '48 字节摘要' },
	{ value: 'SHA-512', label: 'SHA-512', description: '64 字节摘要' }
];

export const EXAMPLE_HMAC = {
	key: 'toolv-secret',
	message: 'the quick brown fox jumps over the lazy dog'
} as const;

// ---------------------------------------------------------------- RSA（ID 46）

export const RSA_OPERATION_OPTIONS: readonly { value: RsaOperation; label: string }[] = [
	{ value: 'encrypt', label: '加密' },
	{ value: 'decrypt', label: '解密' },
	{ value: 'sign', label: '签名' },
	{ value: 'verify', label: '验签' }
];

export const RSA_MODULUS_OPTIONS: readonly Option<string>[] = [
	{ value: '2048', label: '2048 位', description: '最通用的一档，兼容性最好' },
	{ value: '3072', label: '3072 位', description: '更长一档，生成慢一些' },
	{ value: '4096', label: '4096 位', description: '最长，生成要几秒' }
];

export const DEFAULT_MODULUS: RsaModulus = 2048;

// ---------------------------------------------------------------- 凯撒 / 维吉尼亚（ID 48 / 49）

export const DEFAULT_DIRECTION: Direction = 'encrypt';

export const CAESAR_SHIFT_RANGE = { min: 0, max: 25 } as const;
export const DEFAULT_CAESAR_SHIFT = 3;
export const EXAMPLE_CAESAR = 'Hello, World!';

/** 维吉尼亚密钥的长度上限（只是防手滑贴进来一整段文本） */
export const VIGENERE_KEY_MAX = 64;
export const DEFAULT_VIGENERE_KEY = 'LEMON';
export const EXAMPLE_VIGENERE = 'ATTACK AT DAWN';
