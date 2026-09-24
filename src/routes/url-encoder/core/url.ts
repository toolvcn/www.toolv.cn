// URL 编解码的纯函数：encodeURIComponent / encodeURI / decodeURIComponent + URLSearchParams 手写解析。
// 不碰 DOM，node 环境可直接单测。
import type { EncodeStrategy, ParsedParam, UrlDirection, UrlResult } from './types.ts';

/** 编码：严格转义所有保留字符，或只处理整链里该转的字符 */
export function encodeText(text: string, strategy: EncodeStrategy): string {
	return strategy === 'component' ? encodeURIComponent(text) : encodeURI(text);
}

/** 解码：整链/组件策略都统一 decodeURIComponent，详见 types.ts 的说明 */
export function decodeText(text: string): string {
	return decodeURIComponent(text);
}

/** 转换一次：解码失败只给错误文案，不抛异常 */
export function transformUrl(input: string, direction: UrlDirection, strategy: EncodeStrategy): UrlResult {
	if (input === '') return { output: '', error: '' };
	if (direction === 'encode') return { output: encodeText(input, strategy), error: '' };
	try {
		return { output: decodeText(input), error: '' };
	} catch {
		return { output: '', error: describeDecodeFailure(input) };
	}
}

/**
 * 找第一个「坏掉的百分号编码」：
 * - % 后面不是两位十六进制（含 % 在结尾），直接指出位置
 * - 两位都是十六进制但字节不是合法 UTF-8（如 %FF），decodeURIComponent 也会抛，给通用提示
 */
export function firstBadPercent(text: string): number | null {
	for (let i = 0; i < text.length; i += 1) {
		if (text[i] !== '%') continue;
		const high = text[i + 1];
		const low = text[i + 2];
		const isHex = (c: string | undefined): boolean => !!c && /[0-9a-fA-F]/.test(c);
		if (!isHex(high) || !isHex(low)) return i;
	}
	return null;
}

function describeDecodeFailure(text: string): string {
	const at = firstBadPercent(text);
	if (at === null) return '解码失败：内容含无法解码的字节序列（如 %FF 之类非 UTF-8 字节）';
	return `解码失败：存在非法的 % 编码（${positionToDisplay(at, text)}）`;
}

/** 报错位置换算成行列，界面上能一眼找到 */
export function positionToDisplay(position: number, text: string): string {
	const prefix = text.slice(0, position);
	const line = prefix.split('\n').length;
	const column = prefix.length - prefix.lastIndexOf('\n');
	return `第 ${line} 行第 ${column} 列`;
}

/**
 * 把输入串拆成查询段与它两侧的非查询部分，供参数表**原样保留 URL 的域名 / 路径与 # 片段**。
 * - 有 `?`：前缀 = 到 `?`（含）为止，查询段 = `?` 之后、其后第一个 `#` 之前，后缀 = `#` 起
 * - 没有 `?`：整串都当查询段（这时 `#` 只是字面字符，不当片段截断）
 */
export function splitQueryInput(text: string): { prefix: string; query: string; suffix: string } {
	const queryAt = text.indexOf('?');
	if (queryAt === -1) return { prefix: '', query: text, suffix: '' };
	const prefix = text.slice(0, queryAt + 1);
	const rest = text.slice(queryAt + 1);
	const hashAt = rest.indexOf('#');
	if (hashAt === -1) return { prefix, query: rest, suffix: '' };
	return { prefix, query: rest.slice(0, hashAt), suffix: rest.slice(hashAt) };
}

/**
 * 查询段 → 参数行。手写解析而不是 new URLSearchParams：
 * 一是要「坏的值保持原样」，二是连无等号的裸键也要能进表。
 * 只认查询段本身（允许一个开头的 `?`）；整条 URL 先用 splitQueryInput 拆出查询段再传进来。
 * 行为说明：& 切分、空段忽略；没有 = 的值记空串；+ 与 # 都按字面（空格按 %20 编码）。
 */
export function parseQueryString(text: string): ParsedParam[] {
	const body = text.startsWith('?') ? text.slice(1) : text;
	const rows: ParsedParam[] = [];
	for (const segment of body.split('&')) {
		if (segment === '') continue;
		const equal = segment.indexOf('=');
		if (equal === -1) {
			rows.push({ key: tryDecode(segment), value: '' });
		} else {
			rows.push({
				key: tryDecode(segment.slice(0, equal)),
				value: tryDecode(segment.slice(equal + 1))
			});
		}
	}
	return rows;
}

/** 单独一段解码：解不开就原样返回，别让一行坏数据毁掉整张表 */
function tryDecode(part: string): string {
	try {
		return decodeURIComponent(part);
	} catch {
		return part;
	}
}

/** 参数行 → 查询串：键值都 encodeURIComponent，空格因此按 %20 处理 */
export function composeQuery(params: Array<{ key: string; value: string }>): string {
	return params
		.filter((param) => param.key !== '' || param.value !== '')
		.map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
		.join('&');
}

/** 输出高亮的分词类型：内容四类各一色，结构分隔符归 delim（中性灰） */
export type UrlTokenKind = 'scheme' | 'host' | 'path' | 'query' | 'fragment' | 'delim' | 'plain';

/** 一段带类型的输出文本 */
export interface UrlToken {
	kind: UrlTokenKind;
	text: string;
}

/** 从 from 起找这几个字符里最先出现的那个；都没有就给 text.length */
function indexOfAny(text: string, from: number, chars: readonly string[]): number {
	let found = text.length;
	for (const char of chars) {
		const at = text.indexOf(char, from);
		if (at !== -1 && at < found) found = at;
	}
	return found;
}

/** 路径按 `/` 切：分隔符中性，只有段名上色 */
function pushPathTokens(tokens: UrlToken[], path: string): void {
	path.split('/').forEach((segment, index) => {
		if (index > 0) tokens.push({ kind: 'delim', text: '/' });
		if (segment !== '') tokens.push({ kind: 'path', text: segment });
	});
}

/** 键值串（查询段 / 片段段通用）：`=` `&` 中性，键与值同色 */
function pushPairTokens(tokens: UrlToken[], body: string, kind: UrlTokenKind): void {
	body.split('&').forEach((part, index) => {
		if (index > 0) tokens.push({ kind: 'delim', text: '&' });
		const equal = part.indexOf('=');
		if (equal === -1) {
			if (part !== '') tokens.push({ kind, text: part });
			return;
		}
		if (equal > 0) tokens.push({ kind, text: part.slice(0, equal) });
		tokens.push({ kind: 'delim', text: '=' });
		const value = part.slice(equal + 1);
		if (value !== '') tokens.push({ kind, text: value });
	});
}

/** 按 URL 结构切一段文本；认不出结构（既没 scheme 又不含 ? / #）时返回 null */
function tokenizeUrlStructure(text: string): UrlToken[] | null {
	if (text === '') return null;
	const tokens: UrlToken[] = [];
	let cursor = 0;

	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.exec(text);
	if (scheme !== null) {
		tokens.push({ kind: 'scheme', text: scheme[0] });
		cursor = scheme[0].length;
		const hostEnd = indexOfAny(text, cursor, ['/', '?', '#']);
		if (hostEnd > cursor) {
			tokens.push({ kind: 'host', text: text.slice(cursor, hostEnd) });
			cursor = hostEnd;
		}
	} else if (!text.includes('?') && !text.includes('#')) {
		return null;
	}

	const queryAt = text.indexOf('?', cursor);
	const hashAt = text.indexOf('#', cursor);
	const pathEnd = Math.min(queryAt === -1 ? text.length : queryAt, hashAt === -1 ? text.length : hashAt);
	pushPathTokens(tokens, text.slice(cursor, pathEnd));

	if (queryAt !== -1) {
		tokens.push({ kind: 'delim', text: '?' });
		pushPairTokens(tokens, text.slice(queryAt + 1, hashAt === -1 ? text.length : hashAt), 'query');
	}
	if (hashAt !== -1) {
		tokens.push({ kind: 'delim', text: '#' });
		pushPairTokens(tokens, text.slice(hashAt + 1), 'fragment');
	}
	return tokens;
}

/**
 * 「整串被 encodeURIComponent 过」的 URL（文本视图选组件策略时的输出）也要能上色。
 *
 * 做法：逐单元解码出等价文本用于切段，再把段边界**映回原串** —— 不是重新编码，
 * 所以原串里十六进制的大小写、混编状态都原样保留，高亮层与真实内容永远逐字一致。
 * 解不开（非法 % 序列）或解出来没有结构时返回 null，交回调用方按 plain 处理。
 */
function tokenizeEncodedUrl(text: string): UrlToken[] | null {
	if (!text.includes('%')) return null;
	let decoded = '';
	// origAt[k] = 解出的第 k 个码元在原串里的起始下标；末尾多一个哨兵，便于按下标切片
	const origAt: number[] = [];
	for (let i = 0; i < text.length;) {
		const start = i;
		let char: string;
		if (text[i] === '%') {
			try {
				char = decodeURIComponent(text.slice(i, i + 3));
			} catch {
				return null;
			}
			if (char === '') return null;
			i += 3;
		} else {
			char = text[i];
			i += 1;
		}
		decoded += char;
		// 一个 %XX 可能解出一个代理对（两个码元），两个码元都指向同一段原串
		for (let unit = 0; unit < char.length; unit += 1) origAt.push(start);
	}
	origAt.push(text.length);

	const tokens = tokenizeUrlStructure(decoded);
	if (tokens === null) return null;

	const mapped: UrlToken[] = [];
	let cursor = 0;
	for (const token of tokens) {
		const start = origAt[cursor];
		cursor += token.text.length;
		mapped.push({ kind: token.kind, text: text.slice(start, origAt[cursor]) });
	}
	return mapped;
}

/**
 * 把输出文本按 URL 结构切成带类型的片段，供输出区「分词 + span」上色（AGENTS §12 A 层的第 3 条）。
 *
 * 上色的是**内容**，结构分隔符（`://` `/` `?` `=` `&` `#`）一律中性灰：
 * 域名 / 路径段 / 查询的键与值 / 片段，四类各一色。
 *
 * 文本视图的输出（整串被组件编码过）也走同一条路：先解码出结构、再把边界映回原串（见 `tokenizeEncodedUrl`）。
 * 真正认不出结构的（如没填地址的裸查询串 `a=1&b=2`）整段算 plain、不上色，不做臆测。
 */
export function tokenizeUrl(text: string): UrlToken[] {
	if (text === '') return [];
	return tokenizeUrlStructure(text) ?? tokenizeEncodedUrl(text) ?? [{ kind: 'plain', text }];
}

/**
 * # 片段行 → 片段串：与参数段同一套编码（键与值各自 `encodeURIComponent`）、`&` 连接、空行剔除。
 * 解析侧直接复用 `parseQueryString`（片段串与查询串的语法本就一样）。
 * **唯一的差别：值为空时只输出键** —— `#结果` 这类锚点不该被补成 `#结果=`。
 */
export function composeFragmentParams(params: readonly { key: string; value: string }[]): string {
	return params
		.filter((param) => param.key !== '' || param.value !== '')
		.map((param) =>
			param.value === ''
				? encodeURIComponent(param.key)
				: `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`
		)
		.join('&');
}
