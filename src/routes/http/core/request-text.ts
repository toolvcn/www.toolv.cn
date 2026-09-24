// 「请求文本」的格式层：识别一段粘贴进来的文本是什么格式，并在几种格式之间转换。
// 覆盖的就是浏览器 DevTools 右键 Copy 菜单里那几项：
//   cURL（bash / Linux / macOS）、cURL（cmd / Windows）、PowerShell、fetch（浏览器）、fetch（Node.js）
//
// 依据（2026-09-20 查 devtools-frontend 的 NetworkLogView.ts 菜单注册与 generateFetchCall）：
//   - Copy as cURL (cmd) 只在 Windows 出现，与 bash 共用 generateCurlCommand(request, platform)
//   - Copy as PowerShell 是**独立**的 generatePowerShellCommand，出的是 PowerShell 原生写法，
//     不是 cURL 的第三种方言
//   - Copy as fetch / Node.js fetch 是构造对象后 `JSON.stringify(options, null, 2)`，
//     所以键一定带双引号；Node 版删掉 mode 与 credentials
//
// 一条分工原则：**解析一律宽容，生成一律贴 DevTools 的样子**。
// 宽容是因为用户是从好几个地方复制过来的（引号单双、续行 `^` / 反引号 / 反斜杠、`curl` 还是
// `curl.exe` 都得收）；生成要贴样子，是因为粘回去得能直接跑。
//
// 纯函数，不依赖 DOM，可单测。

import { buildCurl, contentTypeFromValue, isBodyMethod, parseCurl, resolveHeaders, splitShellTokens } from './curl.ts';
import { parseJsValue, skipJsTrivia, type JsValue } from './js-literal.ts';
import { HTTP_METHODS } from './types.ts';
import type { ContentType, CurlForm, HttpMethod } from './types.ts';

export type RequestTextFormat = 'curl-bash' | 'curl-cmd' | 'powershell' | 'fetch' | 'node-fetch';

/** 格式下拉的选项（结构兼容 $lib/ui/Dropdown 的 DropdownOption）；顺序即展示顺序 */
export const FORMAT_OPTIONS = [
	{ value: 'curl-bash', label: 'cURL（bash）', description: 'Linux / macOS 终端：单引号 + 反斜杠续行' },
	{ value: 'curl-cmd', label: 'cURL（cmd）', description: 'Windows 命令提示符：双引号 + ^ 续行' },
	{ value: 'powershell', label: 'PowerShell', description: 'Invoke-WebRequest，PowerShell 原生写法' },
	{ value: 'fetch', label: 'fetch（浏览器）', description: 'DevTools「Copy as fetch」的样子，带 mode / credentials' },
	{
		value: 'node-fetch',
		label: 'fetch（Node.js）',
		description: 'DevTools「Copy as Node.js fetch」的样子，去掉浏览器专属字段'
	}
] as const;

/** 格式的中文名（提示文案与 toast 共用一处） */
export function formatLabel(format: RequestTextFormat): string {
	return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format;
}

/** 导入区下面那行说明 */
export const SUPPORTED_FORMATS_HINT = 'cURL（bash / cmd）、PowerShell 的 Invoke-WebRequest、fetch（浏览器 / Node.js）';

// ---------------------------------------------------------------- 识别

/** 按开头特征猜格式；认不出来返回 null（不猜） */
export function detectFormat(text: string): RequestTextFormat | null {
	const head = text.trimStart();
	if (/^invoke-webrequest\b/i.test(head)) return 'powershell';
	if (/^curl(\.exe)?\b/i.test(head)) {
		// cmd 的续行是行尾的 `^`；反引号那种（在 PowerShell 里跑 curl.exe）也归到 cmd 一档显示，
		// 反正两者走的是同一个解析器，这里只影响提示文案
		return /^\s*[^\n]*\^\s*$/m.test(text) ? 'curl-cmd' : 'curl-bash';
	}
	if (/\bfetch\s*\(/.test(text)) {
		// 两种 fetch 的结构一样，只有浏览器那份才带 mode / credentials
		return /"(mode|credentials)"\s*:/.test(text) ? 'fetch' : 'node-fetch';
	}
	return null;
}

/** 解析任意受支持的文本 → 表单快照 */
export function parseRequestText(
	text: string
): { ok: true; format: RequestTextFormat; form: CurlForm } | { ok: false; error: string } {
	const format = detectFormat(text);
	if (format === null) {
		return {
			ok: false,
			error: `认不出这是什么格式。支持 ${SUPPORTED_FORMATS_HINT}。`
		};
	}
	if (format === 'curl-bash' || format === 'curl-cmd') {
		const parsed = parseCurl(text);
		return parsed.ok ? { ok: true, format, form: parsed.form } : parsed;
	}
	if (format === 'powershell') {
		const parsed = parseInvokeWebRequest(text);
		return parsed.ok ? { ok: true, format, form: parsed.form } : parsed;
	}
	const parsed = parseFetchCall(text);
	return parsed.ok ? { ok: true, format, form: parsed.form } : parsed;
}

// ---------------------------------------------------------------- PowerShell

/** 数一段文本里花括号的净深度（`@{…}` 可能被空格拆成多个 token，要拼回来） */
function braceDelta(text: string): number {
	let depth = 0;
	for (const ch of text) {
		if (ch === '{') depth += 1;
		else if (ch === '}') depth -= 1;
	}
	return depth;
}

/** 去掉两侧成对的引号，并还原 PowerShell 的转义（`''` → `'`、`` `x `` → `x`） */
function unquotePowerShell(value: string): string {
	const quote = value[0];
	if ((quote === "'" || quote === '"') && value.length >= 2 && value.at(-1) === quote) {
		const inner = value.slice(1, -1);
		return quote === "'" ? inner.replace(/''/g, "'") : inner.replace(/`([\s\S])/g, '$1');
	}
	return value;
}

/** 按分隔符切分，但**引号内的分隔符不算**（cookie 值里常见 `a=1; b=2`、`=` 也常见） */
function splitOutsideQuotes(text: string, separator: string): string[] {
	const out: string[] = [];
	let current = '';
	let quote = '';
	for (const ch of text) {
		if (quote !== '') {
			current += ch;
			if (ch === quote) quote = '';
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === separator) {
			out.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out;
}

/** 解析 `@{'a'='b'; 'c'='d'}` 里面的键值对。**必须给它带引号的原文**，见 `rawHashtableAfter` */
function parsePsHashtable(inner: string): { name: string; value: string }[] {
	const out: { name: string; value: string }[] = [];
	for (const part of splitOutsideQuotes(inner, ';')) {
		const pair = splitOutsideQuotes(part, '=');
		if (pair.length < 2) continue;
		const name = unquotePowerShell(pair[0].trim());
		if (name === '') continue;
		out.push({ name, value: unquotePowerShell(pair.slice(1).join('=').trim()) });
	}
	return out;
}

/**
 * 从**原始文本**里切出 `-参数` 后面那个 `@{…}` 的原文（引号还在），带引号感知的花括号配平。
 *
 * 为什么不复用词法分析出来的 token：`splitShellTokens` 会把引号去掉，而哈希表里的分隔符 `;`
 * 与值里的 `;`（`Cookie: a=1; b=2` 这种）**只能靠引号区分** —— 一旦掉了引号就再也分不清谁是谁，
 * 于是 cookie 的值被切成两条头。所以这一项走原文切片，其余参数继续用 token（那边不需要这种区分）。
 */
function rawHashtableAfter(text: string, param: string): string | null {
	const match = new RegExp(`-${param}\\b`, 'i').exec(text);
	if (match === null) return null;
	const open = text.indexOf('@{', match.index + match[0].length);
	if (open === -1) return null;
	let depth = 0;
	let quote = '';
	for (let i = open; i < text.length; i += 1) {
		const ch = text[i];
		if (quote !== '') {
			if (ch === quote) quote = '';
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch;
			continue;
		}
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			if (depth === 0) return text.slice(open + 2, i);
		}
	}
	return null;
}

/**
 * 把 PowerShell 命令拆成「参数名 → 原始值」。第一个 token 是命令名（Invoke-WebRequest / iwr / curl.exe），
 * 之后遇到 `-Name` 就取下一个值；值可能是引号字符串、`@{…}` 哈希表或裸词。
 */
function psArgs(text: string): { ok: true; args: Map<string, string> } | { ok: false; error: string } {
	const lex = splitShellTokens(text);
	if (!lex.ok) return { ok: false, error: lex.error };
	const tokens = lex.tokens;
	const args = new Map<string, string>();
	for (let i = 1; i < tokens.length; i += 1) {
		const token = tokens[i];
		if (!token.startsWith('-')) continue;
		const name = token.replace(/^-+/, '').toLowerCase();
		let value = tokens[i + 1];
		if (value === undefined) break;
		i += 1;
		if (value.startsWith('@{')) {
			// `@{ 'a' = 'b' }` 会被空格拆成好几个 token，按花括号配平拼回来再解析
			let depth = braceDelta(value);
			while (depth > 0 && i + 1 < tokens.length) {
				i += 1;
				value += tokens[i];
				depth += braceDelta(tokens[i]);
			}
		}
		args.set(name, value);
	}
	return { ok: true, args };
}

/** 解析 PowerShell 的 `Invoke-WebRequest -Uri … -Method … -Headers @{…} -Body …` */
function parseInvokeWebRequest(text: string): { ok: true; form: CurlForm } | { ok: false; error: string } {
	const parsed = psArgs(text);
	if (!parsed.ok) return parsed;
	const args = parsed.args;

	const rawUrl = args.get('uri');
	if (rawUrl === undefined) return { ok: false, error: '没找到 -Uri 参数' };
	const url = unquotePowerShell(rawUrl).trim();
	if (url === '') return { ok: false, error: '-Uri 是空的' };

	let method: HttpMethod = 'GET';
	const rawMethod = args.get('method');
	if (rawMethod !== undefined) {
		const upper = unquotePowerShell(rawMethod).trim().toUpperCase();
		if (!HTTP_METHODS.includes(upper as HttpMethod)) {
			return { ok: false, error: `-Method 的值「${upper}」不在支持的方法里` };
		}
		method = upper as HttpMethod;
	}

	const collected: { name: string; value: string }[] = [];
	// 哈希表取**原文**（引号要留着）：`;` 是它的分隔符，而值里的 `;` 只能靠引号区分 ——
	// 词法那一路已经把引号去掉了，用它会把 `Cookie: a=1; b=2` 切成两条头
	const headersTable = rawHashtableAfter(text, 'headers');
	if (headersTable !== null) collected.push(...parsePsHashtable(headersTable));
	const rawContentType = args.get('contenttype');
	if (rawContentType !== undefined) {
		collected.push({ name: 'Content-Type', value: unquotePowerShell(rawContentType).trim() });
	}

	const rawBody = args.get('body');
	const body = rawBody === undefined ? '' : unquotePowerShell(rawBody);

	// 与 parseCurl 同口径：认得出的 Content-Type 收进下拉、不留在请求头里（留着会和下拉打架）
	let contentType: ContentType = 'none';
	const headers: { name: string; value: string }[] = [];
	for (const header of collected) {
		const known = contentTypeFromValue(header.value);
		if (header.name.toLowerCase() === 'content-type' && known !== 'none') {
			contentType = known;
			continue;
		}
		headers.push(header);
	}

	return { ok: true, form: { method, url, headers, body, contentType } };
}

// ---------------------------------------------------------------- fetch

/** fetch 的 headers：对象或 `[名称, 值]` 数组都收 */
function jsHeaders(
	value: JsValue | undefined
): { ok: true; headers: { name: string; value: string }[] } | { ok: false; error: string } {
	if (value === undefined || value === null) return { ok: true, headers: [] };
	if (Array.isArray(value)) {
		const headers: { name: string; value: string }[] = [];
		for (const item of value) {
			if (!Array.isArray(item) || item.length < 2) {
				return { ok: false, error: 'headers 数组里每一项都应该是 [名称, 值]' };
			}
			headers.push({ name: String(item[0]), value: String(item[1]) });
		}
		return { ok: true, headers };
	}
	if (typeof value === 'object') {
		return { ok: true, headers: Object.entries(value).map(([name, item]) => ({ name, value: String(item) })) };
	}
	return { ok: false, error: 'headers 应该是对象或 [名称, 值] 数组' };
}

/** fetch 的 body：字符串直接用；对象 / 数组按 JSON 处理（fetch 里传对象本身是非法的，但意图很清楚） */
function jsBody(value: JsValue | undefined): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return JSON.stringify(value);
}

/** 解析 `fetch("url", { … })`（DevTools 的 Copy as fetch / Node.js fetch 都是这个形状） */
function parseFetchCall(text: string): { ok: true; form: CurlForm } | { ok: false; error: string } {
	const found = /\bfetch\s*\(/.exec(text);
	if (found === null) return { ok: false, error: '没找到 fetch( 调用' };

	const urlValue = parseJsValue(text, found.index + found[0].length);
	if (!urlValue.ok) return { ok: false, error: `fetch 的第一个参数读不出来：${urlValue.error}` };
	if (typeof urlValue.value !== 'string') return { ok: false, error: 'fetch 的第一个参数应该是一个字符串 URL' };
	const url = urlValue.value.trim();
	if (url === '') return { ok: false, error: 'fetch 的 URL 是空的' };

	let options: { [key: string]: JsValue } = {};
	const cursor = skipJsTrivia(text, urlValue.end);
	if (text[cursor] === ',') {
		const optionsValue = parseJsValue(text, cursor + 1);
		if (!optionsValue.ok) return { ok: false, error: `fetch 的第二个参数读不出来：${optionsValue.error}` };
		const value = optionsValue.value;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return { ok: false, error: 'fetch 的第二个参数应该是对象字面量' };
		}
		options = value;
	}

	const methodText = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET';
	if (!HTTP_METHODS.includes(methodText as HttpMethod)) {
		return { ok: false, error: `方法「${methodText}」不在支持的方法里` };
	}

	const parsedHeaders = jsHeaders(options.headers);
	if (!parsedHeaders.ok) return parsedHeaders;

	let contentType: ContentType = 'none';
	const headers: { name: string; value: string }[] = [];
	for (const header of parsedHeaders.headers) {
		const known = contentTypeFromValue(header.value);
		if (header.name.toLowerCase() === 'content-type' && known !== 'none') {
			contentType = known;
			continue;
		}
		headers.push(header);
	}

	return {
		ok: true,
		form: { method: methodText as HttpMethod, url, headers, body: jsBody(options.body), contentType }
	};
}

// ---------------------------------------------------------------- 生成

/** PowerShell 的单引号字面量：只有 `'` 要写成 `''`，`$`、双引号、反引号都不被解释 */
function psQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/**
 * 生成 `Invoke-WebRequest`。两个刻意的选择：
 * ① 值一律用**单引号** —— PowerShell 里单引号是字面量，JSON 正文里的 `"` 与 `$` 都不用转义；
 * ② GET 不写 `-Method`（Invoke-WebRequest 本来就默认 GET，与我们 cURL 输出的口径一致）。
 */
function buildPowerShell(form: CurlForm): string {
	const lines = [`Invoke-WebRequest -Uri ${psQuote(form.url)}`];
	if (form.method !== 'GET') lines.push(`-Method ${psQuote(form.method)}`);
	const headers = resolveHeaders(form);
	if (headers.length > 0) {
		const pairs = headers.map((header) => `${psQuote(header.name)}=${psQuote(header.value)}`).join('; ');
		lines.push(`-Headers @{${pairs}}`);
	}
	if (isBodyMethod(form.method) && form.body !== '') lines.push(`-Body ${psQuote(form.body)}`);
	// 续行符必须是行尾最后一个字符（后面跟空格就失效），所以先 trimEnd 再拼
	return lines.map((line, index) => (index < lines.length - 1 ? `${line.trimEnd()} \`` : line)).join('\n');
}

/**
 * 生成 fetch。与 DevTools 同一套做法：先构造对象再 `JSON.stringify(options, null, 2)`，
 * 所以键一定带双引号、值为 undefined 的字段会自动消失。
 * Node 版照 DevTools 删掉 `mode` 与 `credentials`（node-fetch 没实现这两个）。
 */
function buildFetch(form: CurlForm, style: 'browser' | 'node'): string {
	const headers: Record<string, string> = {};
	for (const header of resolveHeaders(form)) headers[header.name] = header.value;

	const options: Record<string, unknown> = {};
	if (Object.keys(headers).length > 0) options.headers = headers;
	if (form.body !== '') options.body = form.body;
	options.method = form.method;
	if (style === 'browser') {
		// DevTools 的口径：带 cookie / authorization 头才 include，否则 omit
		const hasCredential = Object.keys(headers).some((name) => {
			const lower = name.toLowerCase();
			return lower === 'cookie' || lower === 'authorization';
		});
		options.mode = 'cors';
		options.credentials = hasCredential ? 'include' : 'omit';
	}
	return `fetch(${JSON.stringify(form.url)}, ${JSON.stringify(options, null, 2)});`;
}

/** 表单快照 → 指定格式的请求文本 */
export function buildRequestText(form: CurlForm, format: RequestTextFormat): string {
	if (format === 'curl-bash') return buildCurl(form, { multiline: true, style: 'bash' });
	if (format === 'curl-cmd') return buildCurl(form, { multiline: true, style: 'cmd' });
	if (format === 'powershell') return buildPowerShell(form);
	if (format === 'fetch') return buildFetch(form, 'browser');
	return buildFetch(form, 'node');
}
