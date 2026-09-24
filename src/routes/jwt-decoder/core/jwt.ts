// JWT 解码的纯函数：base64url 解码、三段拆分、声明表整理。
// 不碰 DOM、不读 UI 状态，node 环境可直接单测。
// 注意：验签在 ./verify.ts（需要密钥，由用户在页面里给），这里只解出内容展示。
import { CLAIMS, EXAMPLE_TOKEN, type ClaimInfo, type DecodedPart, type JwtResult } from './types.ts';
import { tokenizeSource } from '$lib/utils/json';

export { EXAMPLE_TOKEN };
export type { ClaimInfo, DecodedPart, JwtResult };

/**
 * base64url → 原始字节。查表解码，不依赖 atob（node 单测环境可用，也不踩 deprecated API）。
 * 长度对 4 取模为 1 属于不可能凑齐 6 位一组的非法输入；缺省的 = 补齐即可，段内出现 = 不合法。
 */
export function base64UrlDecode(input: string): Uint8Array | null {
	if (input === '') return new Uint8Array(0);
	if (/[=]/.test(input) || input.length % 4 === 1) return null;
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null;
	const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

	const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const lookup = new Map([...table].map((ch, i) => [ch, i]));
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;
	for (const ch of padded) {
		if (ch === '=') break; // 补齐的填充只出现在末尾
		const value = lookup.get(ch);
		if (value === undefined) return null;
		buffer = (buffer << 6) | value;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}
	return new Uint8Array(bytes);
}

/** 原始字节按 UTF-8 解成文本；字节序列非法时返回 null */
function bytesToText(bytes: Uint8Array): string | null {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

/** 解出并美化一段 JWT（header / payload）。任何一步不合法都给出中文原因 */
function decodePart(encoded: string, name: string): DecodedPart | { error: string } {
	const bytes = base64UrlDecode(encoded);
	if (bytes === null) return { error: `${name}不是有效的 Base64URL 编码` };
	const text = bytesToText(bytes);
	if (text === null) return { error: `${name}的字节序列不是有效的 UTF-8 文本` };
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { error: `${name}不是有效的 JSON` };
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return { error: `${name}应该是 JSON 对象` };
	}
	const json = JSON.stringify(data, null, 2) ?? '';
	// json 已按 2 空格排好版，直接分词即可（tokenizeJson 会再重排一次，没必要）
	return { json, tokens: tokenizeSource(json), data: data as Record<string, unknown> };
}

/**
 * 解码一个 JWT。空输入返回全空结果（error 为空串，UI 据此区分空态与错误态）。
 * 结构要求：两个点分开的三段；第三段（签名）允许为空串 —— 不安全 JWT（alg=none）长这样。
 * 相对时间（exp 是否过期）不在这一步算：解码是纯结构操作，「当前时间」由 claimRows 按需传入。
 */
export function decodeJwt(input: string): JwtResult {
	const token = input.trim();
	if (token === '') return { header: null, payload: null, signature: '', error: '' };

	const parts = token.split('.');
	if (parts.length !== 3) {
		return {
			header: null,
			payload: null,
			signature: '',
			error: `JWT 应由两个点分成三段（header.payload.signature），当前是 ${parts.length} 段`
		};
	}
	if (parts.some((part) => part !== part.trim())) {
		return { header: null, payload: null, signature: '', error: 'JWT 各段内部不应含有空白字符' };
	}

	const header = decodePart(parts[0], 'Header');
	if ('error' in header) return { header: null, payload: null, signature: '', error: header.error };
	const payload = decodePart(parts[1], 'Payload');
	if ('error' in payload) return { header: null, payload: null, signature: '', error: payload.error };

	if (parts[2] !== '' && base64UrlDecode(parts[2]) === null) {
		return { header, payload, signature: '', error: 'Signature 不是有效的 Base64URL 编码' };
	}
	return { header, payload, signature: parts[2], error: '' };
}

/**
 * 从 payload 里挑出注册声明（RFC 7519）整理成表：中文标签 + 格式化值。
 * 时间戳按 Unix 秒转本地时间；exp 额外给出「有效中 / 已过期」状态（以调用方传入的 now 为准）。
 * 未出现的声明不进表，自定义声明只看上面的 JSON 就行。
 */
export function claimRows(
	data: Record<string, unknown>,
	now: number
): Array<{ key: string; label: string; value: string; expired: boolean | null }> {
	const rows: Array<{ key: string; label: string; value: string; expired: boolean | null }> = [];
	for (const claim of CLAIMS) {
		if (!(claim.key in data)) continue;
		const raw = data[claim.key];
		let value: string;
		let expired: boolean | null = null;
		if (claim.time) {
			if (typeof raw !== 'number' || !Number.isFinite(raw)) {
				value = `${stringifyClaim(raw)}（不是 Unix 秒时间戳）`;
			} else {
				value = formatUnixSeconds(raw);
				if (claim.key === 'exp') expired = raw * 1000 <= now;
			}
		} else {
			value = stringifyClaim(raw);
		}
		rows.push({ key: claim.key, label: claim.label, value, expired });
	}
	return rows;
}

/** 声明值的字符串化：数组（aud、scope 这类）用中文顿号连接，其余 JSON 文本化 */
function stringifyClaim(raw: unknown): string {
	if (Array.isArray(raw)) return raw.map((item) => stringifyClaim(item)).join('、');
	if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
	return String(raw);
}

/** Unix 秒 → 本地时间 YYYY-MM-DD HH:mm:ss。固定格式便于测试，也避免依赖运行环境的 locale */
export function formatUnixSeconds(seconds: number): string {
	const d = new Date(seconds * 1000);
	if (Number.isNaN(d.getTime())) return '无效时间';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 分词不再在这里：四处各写一份的实现已收到 $lib/utils/json（tokenizeSource 保留排版、
// tokenizeJson 先美化再分词）。本工具拿到的是自己 stringify 好的 2 空格 JSON，
// 走 tokenizeSource 就够。单测见 src/lib/utils/json.test.ts。
