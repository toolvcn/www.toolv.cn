// 参数预设的序列化 / 校验纯函数：导出文本、导入文本与 localStorage 恢复共用同一份解析。
// 不依赖 DOM，可单测。导入的 id 由 store 重新分配，这里统一给 0。

import { HTTP_METHODS } from './types.ts';
import type { AuthConfig, AuthType, ContentType, HttpMethod, HttpPreset, KeyValueRow } from './types.ts';
// 缺省超时的兜底值在根层的 config.ts，跟表单初值同源
import { DEFAULT_TIMEOUT_MS } from '../config.ts';

const CONTENT_TYPES: ContentType[] = ['none', 'application/json', 'application/x-www-form-urlencoded', 'text/plain'];
const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'basic', 'apikey'];

/** 取字符串字段，非字符串一律空串 */
function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/**
 * 参数行与认证是**后加的字段**，所以按「可选」处理：缺了、或形状不对，都当作没这一项
 * （由 store 回落到从 url 解析 / 按「无认证」处理）。
 *
 * 这一处刻意**不跟上面一样严格** —— 上面那些老字段缺失意味着文件坏了，该整份拒绝；
 * 而这两个新字段缺失只是「旧版本导出的文件」，用它拒绝整份导入是没道理的。
 */
function parseParamRows(raw: unknown): KeyValueRow[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const out: KeyValueRow[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const row = item as Partial<KeyValueRow>;
		if (typeof row.name !== 'string' || typeof row.value !== 'string') continue;
		out.push({ id: 0, enabled: row.enabled !== false, name: row.name, value: row.value });
	}
	return out;
}

/** 认证：只认已知的 type，其余一律落到「无认证」 */
function parseAuth(raw: unknown): AuthConfig | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const auth = raw as Partial<AuthConfig>;
	return {
		type: AUTH_TYPES.includes(auth.type as AuthType) ? (auth.type as AuthType) : 'none',
		token: str(auth.token),
		username: str(auth.username),
		password: str(auth.password),
		keyName: str(auth.keyName),
		keyValue: str(auth.keyValue),
		keyIn: auth.keyIn === 'query' ? 'query' : 'header'
	};
}

/** 预设导出文本：JSON 美化输出，可直接下载成文件 */
export function serializePresets(presets: HttpPreset[]): string {
	return JSON.stringify(presets, null, 2);
}

/**
 * 解析导入 / 恢复用的预设文本。逐条校验字段，任一条不合法即整体失败（不给用户半套数据）；
 * timeoutMs 缺失或非法时回落到默认 10 秒。
 */
export function parsePresets(text: string): { ok: true; presets: HttpPreset[] } | { ok: false; error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: '文件不是合法的 JSON' };
	}
	if (!Array.isArray(raw)) return { ok: false, error: '文件内容应为预设数组' };

	const out: HttpPreset[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) return { ok: false, error: '存在非对象的预设条目' };
		const p = item as Partial<HttpPreset>;
		if (typeof p.name !== 'string' || p.name.trim() === '') return { ok: false, error: '存在没有名称的预设' };
		if (typeof p.url !== 'string' || p.url.trim() === '') return { ok: false, error: '存在没有 URL 的预设' };
		if (typeof p.method !== 'string' || !HTTP_METHODS.includes(p.method as HttpMethod)) {
			return { ok: false, error: `预设方法不合法：${String(p.method)}` };
		}
		if (typeof p.headersText !== 'string') return { ok: false, error: '预设请求头格式不合法' };
		if (typeof p.body !== 'string') return { ok: false, error: '预设请求体必须是字符串' };
		if (typeof p.contentType !== 'string' || !CONTENT_TYPES.includes(p.contentType as ContentType)) {
			return { ok: false, error: '预设 Content-Type 不合法' };
		}
		const timeoutMs = typeof p.timeoutMs === 'number' && p.timeoutMs > 0 ? p.timeoutMs : DEFAULT_TIMEOUT_MS;
		const entry: HttpPreset = {
			id: 0,
			name: p.name.trim(),
			url: p.url.trim(),
			method: p.method as HttpMethod,
			headersText: p.headersText,
			body: p.body,
			contentType: p.contentType as ContentType,
			timeoutMs
		};
		// 缺了就干脆不带这几个键（而不是给 undefined），导出的 JSON 里才不会多出 null
		const params = parseParamRows(p.params);
		if (params) entry.params = params;
		const auth = parseAuth(p.auth);
		if (auth) entry.auth = auth;
		// 凭证模式只认三个值：旧预设（与手写的文件）没有这一项，恢复时按 same-origin 兜底
		if (p.credentials === 'omit' || p.credentials === 'same-origin' || p.credentials === 'include') {
			entry.credentials = p.credentials;
		}
		out.push(entry);
	}
	return { ok: true, presets: out };
}
