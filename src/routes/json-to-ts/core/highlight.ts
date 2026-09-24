// TypeScript 代码高亮分词：给 json-to-ts 的输出上色。
//
// 只认本工具自己生成的那几种结构（export / interface / type、字段名、类型名、原始类型、标点），
// 不是完整的 TS 语法解析器 —— 输入是本工具产出的声明代码，结构可预期，够用即可。
// 结构与 `$lib/utils/json` 的 JsonToken 同构（kind 交给渲染方映射成颜色类），
// 但 TS 的 kind 跟 JSON 对不上（多了关键字与类型名），所以单独一份、留在工具内。
//
// 配色是 `ui/Panel.svelte` 里的 TS_TOKEN_CLASS（沿用 UI-STYLE §14 的六档色，深色主题自动跟随），
// 渲染交给共享的 `$lib/components/CodeView`。

export type TsTokenKind = 'keyword' | 'type' | 'property' | 'primitive' | 'punct' | 'plain';

/** 高亮的最小单元；渲染时按 kind 映射成 Tailwind 颜色类 */
export interface TsToken {
	/** 片段原文 */
	text: string;
	kind: TsTokenKind;
}

/** 声明关键字 */
const KEYWORDS = new Set(['export', 'declare', 'interface', 'type']);

/**
 * 内置类型。本工具只会产出 string / number / boolean / null / unknown 五种，
 * 多列几个是为了以后生成逻辑扩展时不至于把新增的类型名当成接口名上色。
 */
const PRIMITIVES = new Set([
	'string',
	'number',
	'boolean',
	'null',
	'undefined',
	'unknown',
	'any',
	'never',
	'void',
	'bigint',
	'symbol',
	'object'
]);

/** 引号字符串 / 标识符 / 标点 / 空白；其余（如数字）走间隙补 plain */
const TOKEN_PATTERN = /("(?:\\.|[^"\\])*")|([A-Za-z_$][A-Za-z0-9_$]*)|([{}[\]();:,?=|<>])|(\s+)/g;

/** 从 pos 起跳过空白，返回下一个可见字符；到末尾了返回 '' */
function nextVisible(source: string, pos: number): string {
	return source.slice(pos).match(/\S/)?.[0] ?? '';
}

/**
 * 标识符的归类：
 * - 关键字 → keyword
 * - 内置类型 → primitive
 * - 后面跟 `?` 或 `:` 的是字段名（`name?:`）→ property
 * - 其余是类型名（`interface Root {`、`owner: RootOwner;` 里的 Root / RootOwner）→ type
 */
function identKind(word: string, source: string, end: number): TsTokenKind {
	if (KEYWORDS.has(word)) return 'keyword';
	if (PRIMITIVES.has(word)) return 'primitive';
	const next = nextVisible(source, end);
	return next === '?' || next === ':' ? 'property' : 'type';
}

/** 把 TypeScript 源码切成带类型的片段；相邻同类型会合并，减少渲染出来的 <span> */
export function tokenizeTypeScript(source: string): TsToken[] {
	const tokens: TsToken[] = [];
	let cursor = 0;

	const push = (text: string, kind: TsTokenKind): void => {
		if (text === '') return;
		const last = tokens.at(-1);
		if (last && last.kind === kind) last.text += text;
		else tokens.push({ text, kind });
	};

	for (const match of source.matchAll(TOKEN_PATTERN)) {
		const [whole, quoted, ident, punct, space] = match;
		const start = match.index ?? 0;
		if (start > cursor) push(source.slice(cursor, start), 'plain');
		if (quoted) {
			// 本工具的引号里只可能是字段名（不合法键名）
			push(quoted, 'property');
		} else if (ident) {
			push(ident, identKind(ident, source, start + whole.length));
		} else if (punct) {
			push(punct, 'punct');
		} else if (space) {
			// 空白单独成 token：渲染在 <pre> 里靠它排版
			push(space, 'plain');
		}
		cursor = start + whole.length;
	}
	if (cursor < source.length) push(source.slice(cursor), 'plain');
	return tokens;
}
