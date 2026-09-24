// AES 加解密：CBC / GCM / CTR 三种模式，密钥 16 / 24 / 32 字节（AES-128 / 192 / 256）。
//
// 全站唯一一处 AES 的 crypto.subtle 调用。密钥、IV 的长度校验都在这里做完，
// UI 只负责把 `error` 展示出来 —— 三种模式对 IV 长度的要求各不相同，
// 让 WebCrypto 抛异常再翻译，用户看到的就是一句看不懂的 DOMException。
import {
	bytesToText,
	bytesToHex,
	decodableAsText,
	randomBytes,
	readBytes,
	textToBytes,
	writeBytes
} from './encoding.ts';
import { fail, ok, type Result } from '$lib/utils/result';
import { type AesMode, type ByteFormat, type Direction, type OutFormat } from './types.ts';

/**
 * 三种模式对 IV / 计数器长度的硬要求。
 * GCM 只收 12 字节：非 96 位的 IV 要走一遍 GHASH，各语言实现的默认行为不一致，
 * 与其让人以为「随便多少位都行」，不如在这里拦下来（README 的「暂不支持」里写了）。
 */
export const IV_LENGTH: Record<AesMode, number> = { CBC: 16, GCM: 12, CTR: 16 };

/** 三种模式的 IV 说明（错误文案与界面提示共用一句） */
export const IV_HINT: Record<AesMode, string> = {
	CBC: 'CBC 的 IV 是 16 字节（正好一个分组）',
	GCM: 'GCM 的 IV 固定 12 字节（96 位）',
	CTR: 'CTR 的计数器块是 16 字节'
};

const ALGORITHM: Record<AesMode, string> = { CBC: 'AES-CBC', GCM: 'AES-GCM', CTR: 'AES-CTR' };

type AesParams = AesCbcParams | AesGcmParams | AesCtrParams;

export interface AesRequest {
	direction: Direction;
	mode: AesMode;
	keyText: string;
	keyFormat: ByteFormat;
	ivText: string;
	ivFormat: OutFormat;
	/** 加密方向是输出格式，解密方向是输入格式 */
	dataFormat: OutFormat;
	input: string;
}

export interface AesOutcome {
	output: string;
	/** 换算后的密钥位数：128 / 192 / 256 */
	bits: number;
	/** 结果的字节数 */
	byteLength: number;
	/** 需要额外提醒时的一句话（目前只有「解密结果不是 UTF-8」） */
	note: string;
}

/** 按模式拼 WebCrypto 的参数对象 */
function paramsFor(mode: AesMode, iv: Uint8Array): AesParams {
	if (mode === 'CTR') {
		// length 取 128：整块 16 字节都当计数器，与 openssl 的 aes-ctr 一致
		return { name: 'AES-CTR', counter: Uint8Array.from(iv), length: 128 };
	}
	return mode === 'CBC' ? { name: 'AES-CBC', iv: Uint8Array.from(iv) } : { name: 'AES-GCM', iv: Uint8Array.from(iv) };
}

export async function runAes(request: AesRequest): Promise<Result<AesOutcome>> {
	if (request.input.trim() === '') {
		return fail(request.direction === 'encrypt' ? '还没有明文' : '还没有密文');
	}

	const key = readBytes(request.keyText, request.keyFormat);
	if (!key.ok) return fail(`密钥读不出来：${key.error}`);
	if (![16, 24, 32].includes(key.value.length)) {
		return fail(`密钥 ${key.value.length} 字节，AES 只接受 16 / 24 / 32 字节（AES-128 / 192 / 256）`);
	}

	const iv = readBytes(request.ivText, request.ivFormat);
	if (!iv.ok) return fail(`IV 读不出来：${iv.error}`);
	if (iv.value.length !== IV_LENGTH[request.mode]) {
		return fail(`IV 是 ${iv.value.length} 字节，${IV_HINT[request.mode]}`);
	}

	let keyHandle: CryptoKey;
	try {
		keyHandle = await crypto.subtle.importKey('raw', Uint8Array.from(key.value), ALGORITHM[request.mode], false, [
			'encrypt',
			'decrypt'
		]);
	} catch {
		return fail('密钥导入失败：AES 密钥只能是 16 / 24 / 32 字节');
	}

	const bits = key.value.length * 8;
	const params = paramsFor(request.mode, iv.value);

	if (request.direction === 'encrypt') {
		try {
			const buffer = await crypto.subtle.encrypt(params, keyHandle, textToBytes(request.input));
			const bytes = new Uint8Array(buffer);
			return ok({ output: writeBytes(bytes, request.dataFormat), bits, byteLength: bytes.length, note: '' });
		} catch {
			return fail('加密失败：请检查密钥与 IV 是否符合上面说的长度');
		}
	}

	const data = readBytes(request.input, request.dataFormat);
	if (!data.ok) return fail(`密文读不出来：${data.error}`);
	// CBC 的长度不对时 WebCrypto 只会甩一句 OperationError，提前给一句能懂的
	if (request.mode === 'CBC' && data.value.length % 16 !== 0) {
		return fail(`CBC 密文长度必须是 16 的倍数，当前 ${data.value.length} 字节`);
	}

	try {
		const buffer = await crypto.subtle.decrypt(params, keyHandle, Uint8Array.from(data.value));
		const bytes = new Uint8Array(buffer);
		const note = decodableAsText(bytes) ? '' : '解密结果不是合法 UTF-8，已用替换字符展示（可能是二进制数据）';
		return ok({ output: bytesToText(bytes), bits, byteLength: bytes.length, note });
	} catch {
		return fail(
			request.mode === 'GCM'
				? '解密失败：GCM 认证标签不通过（密钥 / IV / 密文哪一处对不上）'
				: '解密失败：密钥或 IV 不对，密文也不完整（CBC 填充不合法）'
		);
	}
}

/** 随机密钥（Hex 串），UI 的「随机密钥」用它 */
export function randomKeyHex(bytes: number): string {
	return bytesToHex(randomBytes(bytes));
}

/** 按当前模式随机一个长度正确的 IV（Hex 串） */
export function randomIvHex(mode: AesMode): string {
	return bytesToHex(randomBytes(IV_LENGTH[mode]));
}
