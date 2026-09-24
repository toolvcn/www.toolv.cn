// cURL 相关的纯函数：表单 ↔ curl 命令双向互转，外加 shell 词法切分。
// 不依赖 DOM，可单测。

import { HTTP_METHODS } from './types.ts';
import type { ContentType, CurlForm, HttpMethod, ParsedCurl } from './types.ts';

/** 带请求体才能发 body 的方法；GET/HEAD 按 HTTP 语义不带（生成 PowerShell / fetch 时也要判一次） */
export function isBodyMethod(method: HttpMethod): boolean {
	return method !== 'GET' && method !== 'HEAD';
}

/** 把所有请求头过滤成要发送的列表；缺 Content-Type 时按 contentType 自动补一条 */
export function resolveHeaders(form: Pick<CurlForm, 'headers' | 'contentType' | 'body' | 'method'>): {
	name: string;
	value: string;
}[] {
	const out: { name: string; value: string }[] = [];
	let hasContentType = false;
	for (const row of form.headers) {
		const name = row.name.trim();
		if (name === '') continue;
		if (name.toLowerCase() === 'content-type') hasContentType = true;
		out.push({ name, value: row.value });
	}
	if (!hasContentType && form.contentType !== 'none' && form.body !== '' && isBodyMethod(form.method)) {
		out.push({ name: 'Content-Type', value: form.contentType });
	}
	return out;
}

/**
 * 把请求头多行文本解析成发送列表。每行一条「名称: 值」（在第一个冒号处切分）；
 * 空行与 # 开头的注释行忽略，没有冒号的行忽略（提示用户但不报错）。
 */
export function parseHeadersText(text: string): { name: string; value: string }[] {
	const out: { name: string; value: string }[] = [];
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#')) continue;
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		const name = line.slice(0, colon).trim();
		if (name === '') continue;
		out.push({ name, value: line.slice(colon + 1).trim() });
	}
	return out;
}

/** 把请求头列表还原成多行文本（cURL 工具写回表单用） */
export function formatHeadersText(headers: { name: string; value: string }[]): string {
	return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

/**
 * cURL 的输出方言：bash（单引号 + `\` 续行）/ cmd（双引号 + `^` 续行）。
 * 这与 DevTools 的 `Copy as cURL` 与 `Copy as cURL (cmd)` 两档对应。
 */
export type CurlStyle = 'bash' | 'cmd';

/** 按方言把值包起来：bash 的单引号内单引号要写成 `'"'"'`；cmd 的双引号内双引号写成 `\"` */
function quoteFor(value: string, style: CurlStyle): string {
	if (style === 'cmd') return `"${value.replace(/"/g, '\\"')}"`;
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/** 表单 → curl 命令。multiline 时每个选项一行、行尾续行符，其余单行 */
export function buildCurl(form: CurlForm, opts: { multiline?: boolean; style?: CurlStyle } = {}): string {
	const style = opts.style ?? 'bash';
	const continuation = style === 'cmd' ? '^' : '\\';
	const head = `curl${form.method !== 'GET' ? ` --request ${form.method}` : ''} ${quoteFor(form.url, style)}`;
	const headerLines = resolveHeaders(form).map((h) => `  --header ${quoteFor(`${h.name}: ${h.value}`, style)}`);
	const hasBody = isBodyMethod(form.method) && form.body !== '';
	const dataLine = hasBody ? `  --data-raw ${quoteFor(form.body, style)}` : null;

	if (opts.multiline) {
		const lines = [head, ...headerLines, ...(dataLine ? [dataLine] : [])];
		return lines.map((line, index) => (index < lines.length - 1 ? `${line} ${continuation}` : line)).join('\n');
	}

	const flat = [head, ...headerLines.map((l) => l.trim()), ...(dataLine ? [dataLine.trim()] : [])];
	return flat.join(' ');
}

/** UTF-8 文本 → Base64（-u 转 Authorization Basic 用；btoa 直接吃中文会抛异常） */
export function base64EncodeUtf8(text: string): string {
	return btoa(unescape(encodeURIComponent(text)));
}

/**
 * shell 词法切分：空白分隔；单引号内逐字；双引号内支持 \" 与 \\；
 * 引号外反斜杠转义下一个字符；未闭合引号报错。
 *
 * 为了同时吃下 cmd 与 PowerShell 的 cURL 输出，多认两条：
 * ① 行尾的 `^`（cmd）与反引号（PowerShell）是**续行**，当空白处理（引号内的不算）；
 * ② 单引号里连着两个单引号算一个**字面单引号** —— 那是 PowerShell 的转义写法；
 *    bash 里 `'a''b'` 是两段拼接、结果同样是 `ab`，而 Chrome 的 Copy as cURL 从不发 `''`，
 *    所以这一条对两种方言都安全，且让我们生成的 PowerShell 能原样解析回来。
 */
export function splitShellTokens(text: string): { ok: true; tokens: string[] } | { ok: false; error: string } {
	const tokens: string[] = [];
	let current = '';
	let hasToken = false;
	let i = 0;
	const len = text.length;
	while (i < len) {
		const ch = text[i];
		if (ch === "'") {
			// 单引号：逐字直到下一个单引号（两个连续单引号算一个字面单引号）
			const start = i;
			i += 1;
			let closed = false;
			while (i < len) {
				if (text[i] === "'") {
					if (text[i + 1] === "'") {
						current += "'";
						i += 2;
						continue;
					}
					closed = true;
					i += 1;
					break;
				}
				current += text[i];
				i += 1;
			}
			if (!closed) return { ok: false, error: `未闭合的单引号（第 ${start + 1} 个字符）` };
			hasToken = true;
		} else if (ch === '"') {
			// 双引号：支持 \" 与 \\
			i += 1;
			while (i < len && text[i] !== '"') {
				if (text[i] === '\\') {
					const next = text[i + 1];
					if (next === '"' || next === '\\') {
						current += next;
						i += 2;
						continue;
					}
					current += text[i];
					i += 1;
					continue;
				}
				current += text[i];
				i += 1;
			}
			if (i >= len) return { ok: false, error: '未闭合的双引号' };
			hasToken = true;
			i += 1;
		} else if ((ch === '^' || ch === '`') && (text[i + 1] === '\n' || (text[i + 1] === '\r' && text[i + 2] === '\n'))) {
			// 续行：当成空白，顺便把上一段收进 token
			if (hasToken) {
				tokens.push(current);
				current = '';
				hasToken = false;
			}
			i += text[i + 1] === '\r' ? 3 : 2;
		} else if (ch === '\\') {
			if (i + 1 >= len) return { ok: false, error: '末尾的反斜杠没有可转义的字符' };
			current += text[i + 1];
			hasToken = true;
			i += 2;
		} else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
			if (hasToken) {
				tokens.push(current);
				current = '';
				hasToken = false;
			}
			i += 1;
		} else {
			current += ch;
			hasToken = true;
			i += 1;
		}
	}
	if (hasToken) tokens.push(current);
	return { ok: true, tokens };
}

/** 从 Content-Type 头值反推枚举；不在枚举里返回 'none'（该头仍保留在 headers 里） */
export function contentTypeFromValue(value: string): ContentType {
	const v = value.trim().toLowerCase();
	if (v === 'application/json' || v === 'application/x-www-form-urlencoded' || v === 'text/plain') {
		return v;
	}
	return 'none';
}

/** curl 文本 → 表单。未知方法原样保留（发送时交给 fetch，报错归网络类） */
export function parseCurl(text: string): { ok: true; form: ParsedCurl } | { ok: false; error: string } {
	const lex = splitShellTokens(text);
	if (!lex.ok) return lex;

	const tokens = lex.tokens;
	let url = '';
	let method: HttpMethod = 'GET';
	const headers: { name: string; value: string }[] = [];
	let body = '';
	let contentType: ContentType = 'none';
	const added = new Set<string>();

	let i = 0;
	// 跳过开头的 curl 可执行名（在 PowerShell 里复制出来的是 curl.exe）
	if (/^curl(\.exe)?$/i.test(tokens[0] ?? '')) i = 1;

	for (; i < tokens.length; i++) {
		const t = tokens[i];
		const next = (): string | null => tokens[i + 1] ?? null;
		const takeValue = (): string | null => {
			const value = next();
			if (value === null) return null;
			i += 1;
			return value;
		};

		if (t === '-X' || t === '--request') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少方法名` };
			method = (HTTP_METHODS.includes(value as HttpMethod) ? value : value.toUpperCase()) as HttpMethod;
		} else if (t.startsWith('-X') && t.length > 2) {
			method = t.slice(2).toUpperCase() as HttpMethod;
		} else if (t === '-H' || t === '--header') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少 Header 值` };
			const colon = value.indexOf(':');
			if (colon <= 0) return { ok: false, error: `Header 缺少冒号分隔：${value}` };
			const name = value.slice(0, colon).trim();
			const headerValue = value.slice(colon + 1).trim();
			if (name.toLowerCase() === 'content-type' && contentTypeFromValue(headerValue) !== 'none') {
				contentType = contentTypeFromValue(headerValue);
				continue;
			}
			headers.push({ name, value: headerValue });
		} else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-ascii') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少请求体` };
			body = body === '' ? value : `${body}&${value}`;
			// curl 约定：-d 未显式指定 Content-Type 时默认表单编码；显式 -H 会覆盖
			if (contentType === 'none') contentType = 'application/x-www-form-urlencoded';
		} else if (t === '--data-urlencode') {
			const value = takeValue();
			if (value === null) return { ok: false, error: '--data-urlencode 缺少值' };
			body = body === '' ? value : `${body}&${value}`;
			if (contentType === 'none') contentType = 'application/x-www-form-urlencoded';
		} else if (t === '-u' || t === '--user') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少 user:pass` };
			const colon = value.indexOf(':');
			const user = colon === -1 ? value : value.slice(0, colon);
			const pass = colon === -1 ? '' : value.slice(colon + 1);
			if (!added.has('authorization')) {
				headers.push({ name: 'Authorization', value: `Basic ${base64EncodeUtf8(`${user}:${pass}`)}` });
				added.add('authorization');
			}
		} else if (t === '-b' || t === '--cookie') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少 Cookie` };
			if (!added.has('cookie')) {
				headers.push({ name: 'Cookie', value });
				added.add('cookie');
			}
		} else if (t === '-A' || t === '--user-agent') {
			const value = takeValue();
			if (value === null) return { ok: false, error: `${t} 缺少 User-Agent` };
			if (!added.has('user-agent')) {
				headers.push({ name: 'User-Agent', value });
				added.add('user-agent');
			}
		} else if (t === '--') {
			// -- 之后全是位置参数，第一个是 URL
			for (let j = i + 1; j < tokens.length; j++) {
				if (url === '') url = tokens[j];
			}
			break;
		} else if (t.startsWith('-') && t !== '-') {
			// 展示性 / 行为性 flag（-s -i -L -k --compressed 等）：忽略，不假装执行
			continue;
		} else if (url === '') {
			url = t;
		}
	}

	if (url === '') return { ok: false, error: '没有找到 URL' };
	// curl 约定：带 -d 但没显式写方法时，默认方法从 GET 提升为 POST
	if (body !== '' && method === 'GET') method = 'POST';

	return { ok: true, form: { method, url, headers, body, contentType } };
}
