// JSON 相关的纯函数：解析助手 + 高亮分词。被 json-to-ts / csv-json / json-formatter /
// jwt-decoder / websocket / http 等多个工具共用。
//
// 高亮分词原先在四处各写一份（websocket/core/json.ts 与 http/core/highlight.ts 逐字节相同，
// json-formatter 与 jwt-decoder 是同一套正则的两个副本），现在收成下面这一份。

/** 判断是不是「真对象」——排除 null 与数组 */
export function isPlainObject(value: unknown): value is { [key: string]: unknown } {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 从 V8 风格的错误消息里抠出 position，换算成行列；没有 position 就原样返回消息 */
export function describeParseError(input: string, raw: Error): string {
	const match = raw.message.match(/position (\d+)/i);
	if (match) {
		const pos = Number(match[1]);
		const before = input.slice(0, pos);
		const line = before.split('\n').length;
		const column = pos - before.lastIndexOf('\n');
		return `第 ${line} 行第 ${column} 列附近：${raw.message}`;
	}
	return raw.message;
}

// ---------------------------------------------------------------- JSON 高亮分词

export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'plain';

/** JSON 高亮的最小单元，渲染时按 kind 映射成 Tailwind 颜色类（见 UI-STYLE §14） */
export interface JsonToken {
	/** 片段原文 */
	text: string;
	kind: JsonTokenKind;
}

/** 文本是不是合法 JSON */
export function isJson(text: string): boolean {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * 分词：字符串（后面跟冒号的算 key）、数字、字面量、标点、空白。
 * 连续的同类型片段会合并，减少渲染出来的 <span> 数量。
 * 标点与空白都单独成 token —— 空白要单独出来，因为渲染在 <pre> 里靠它排版。
 */
const TOKEN_PATTERN =
	/("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])|(\s+)/g;

/** 把已排好版的 JSON 源切成带类型的片段 */
export function tokenizeSource(source: string): JsonToken[] {
	const tokens: JsonToken[] = [];
	let cursor = 0;

	const push = (text: string, kind: JsonTokenKind): void => {
		if (text === '') return;
		const last = tokens.at(-1);
		// 相邻同类型直接拼起来：省掉大量只有一个字符的 <span>
		if (last && last.kind === kind) last.text += text;
		else tokens.push({ text, kind });
	};

	for (const match of source.matchAll(TOKEN_PATTERN)) {
		const [whole, quoted, colon, numeric, literal, punct, space] = match;
		const start = match.index ?? 0;
		if (start > cursor) push(source.slice(cursor, start), 'plain');
		if (quoted) {
			push(quoted, colon ? 'key' : 'string');
			// JSON 里冒号只跟在 key 后出现，归进 punct 一起上色
			if (colon) push(colon, 'punct');
		} else if (numeric) {
			push(numeric, 'number');
		} else if (literal) {
			push(literal, 'literal');
		} else if (punct) {
			push(punct, 'punct');
		} else if (space) {
			push(space, 'plain');
		}
		cursor = start + whole.length;
	}
	if (cursor < source.length) push(source.slice(cursor), 'plain');
	return tokens;
}

/**
 * 校验 + 按 2 空格重排后分词；不是 JSON 返回 null。
 * 日志消息、HTTP 响应体常是一行紧凑 JSON，得先美化再上色，用这个入口。
 * 要保留用户自己选的缩进（json-formatter）就直接调 tokenizeSource。
 */
export function tokenizeJson(text: string): JsonToken[] | null {
	if (!isJson(text)) return null;
	try {
		return tokenizeSource(JSON.stringify(JSON.parse(text), null, 2));
	} catch {
		return null;
	}
}
