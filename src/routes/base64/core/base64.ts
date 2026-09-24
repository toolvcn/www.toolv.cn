// Base64 编解码的纯函数：不碰 DOM、不读 UI 状态，可以直接在 Node 里跑单测。
// 编解码走 btoa / atob + TextEncoder / TextDecoder，不引任何第三方库。
import { DECODE_ERROR, type ConvertResult, type Mode, type Options } from './types.ts';

/** 标准与 URL-safe 两套字母表都算合法：校验时不区分方向，转换时才区分 */
const BASE64_PATTERN = /^[A-Za-z0-9+/\-_]+={0,2}$/;

/** 分块大小：String.fromCharCode 一次摊太多参数会爆栈 */
const CHUNK_SIZE = 0x8000;

/** 去掉所有空白：Base64 里的换行、缩进只是排版，不参与解码 */
export function stripWhitespace(text: string): string {
	return text.replace(/\s+/g, '');
}

/**
 * UTF-8 文本 → Base64。
 * 先过 TextEncoder 是为了让中文、emoji 这类多字节字符也能编码 —— 直接 btoa('你好')
 * 会因为码点超过 0xFF 抛 InvalidCharacterError。
 */
export function encodeUtf8ToBase64(str: string): string {
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
	}
	return btoa(binary);
}

/**
 * Base64 → UTF-8 文本。
 * 空白、缺 padding、URL-safe 字母表都先归一化，剩下的非法字符交给 atob 抛错（调用方 catch）。
 */
export function decodeBase64ToUtf8(base64: string): string {
	const binary = atob(fromUrlSafe(stripWhitespace(base64)));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

/** 能不能当 Base64 解：字母表合法、padding 最多两个、去掉 padding 后长度不是 4n+1 */
export function isValidBase64(str: string): boolean {
	const compact = stripWhitespace(str);
	if (compact.length === 0) return false;
	if (!BASE64_PATTERN.test(compact)) return false;
	return compact.replace(/=+$/, '').length % 4 !== 1;
}

/** 标准 → URL-safe：+ → -，/ → _，去掉末尾的 = */
export function toUrlSafe(base64: string): string {
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * URL-safe → 标准：反向替换并把 padding 补回去。
 * 长度是 4n+1 时补不出合法结果，原样返回，让 isValidBase64 去报错。
 */
export function fromUrlSafe(urlSafe: string): string {
	const standard = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
	const remainder = standard.length % 4;
	if (remainder === 0 || remainder === 1) return standard;
	return standard + '='.repeat(4 - remainder);
}

/**
 * 按模式转换一次。
 * 编码保留原文里所有空白（那是内容的一部分）；解码先归一化再算，不合法时只给错误文案、不抛异常。
 */
export function convert(input: string, mode: Mode, options: Options): ConvertResult {
	if (input === '') return { output: '', error: '' };
	if (mode === 'encode') {
		const encoded = encodeUtf8ToBase64(input);
		return { output: options.urlSafe ? toUrlSafe(encoded) : encoded, error: '' };
	}
	// 只有空白等于还没输入，不算解码失败
	if (stripWhitespace(input) === '') return { output: '', error: '' };
	if (!isValidBase64(input)) return { output: '', error: DECODE_ERROR };
	try {
		return { output: decodeBase64ToUtf8(input), error: '' };
	} catch {
		return { output: '', error: DECODE_ERROR };
	}
}

/** 读文件成 data:URL。只在被调用时才碰 FileReader，模块本身在 Node 里也能 import */
export function fileToDataURL(file: File): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = () => reject(new Error('文件读取失败'));
		reader.readAsDataURL(file);
	});
}

/** 体积的可读文案：体积超限提示与缩略图说明共用 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
