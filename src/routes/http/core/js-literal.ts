// 极小的 JS 字面量解析器：DevTools 的「Copy as fetch」给出的是一段
// `fetch("url", { "method": "POST" })` 形态的**字面量**文本，要把它读成表单就得有个能认对象的解析器。
//
// 刻意**不用 `eval` / `new Function`**：那是把用户粘贴进来的任意代码执行一遍 —— 既撞 CSP，
// 也是把「数据本地处理」的承诺变成「执行陌生代码」。这里只解析、不执行。
//
// 宽容度按「真实粘贴进来的样子」定：键可以不带引号、字符串可以用单引号与反引号
// （反引号里不含 `${}` 才收）、允许尾随逗号、允许 `//` 与 `/* */` 注释。
// **只认字面量** —— 变量、函数调用、模板插值一律报错并说清原因，不假装能解析
// （Postman 导出的 fetch 用的是 `var requestOptions = {…}` 再传变量，正是这一档）。

export type JsValue = string | number | boolean | null | JsValue[] | { [key: string]: JsValue };

export type JsParseResult = { ok: true; value: JsValue; end: number } | { ok: false; error: string };

/** 内部用：解析不下去就抛它，在公开函数边界统一转成结果对象（免得每个递归都判错） */
class LiteralError extends Error {}

interface Ctx {
	src: string;
	i: number;
}

/** 转义字符表（`\uXXXX` 单独处理） */
const ESCAPES: Record<string, string> = {
	n: '\n',
	t: '\t',
	r: '\r',
	b: '\b',
	f: '\f',
	v: '\v',
	'0': '\0',
	"'": "'",
	'"': '"',
	'`': '`',
	'\\': '\\',
	'/': '/'
};

function isSpace(ch: string): boolean {
	return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isWordChar(ch: string): boolean {
	return /[A-Za-z0-9_$]/.test(ch);
}

/** 跳过空白与注释 */
function skipTrivia(ctx: Ctx): void {
	while (ctx.i < ctx.src.length) {
		const ch = ctx.src[ctx.i];
		if (isSpace(ch)) {
			ctx.i += 1;
			continue;
		}
		if (ch === '/' && ctx.src[ctx.i + 1] === '/') {
			const lineEnd = ctx.src.indexOf('\n', ctx.i + 2);
			ctx.i = lineEnd === -1 ? ctx.src.length : lineEnd + 1;
			continue;
		}
		if (ch === '/' && ctx.src[ctx.i + 1] === '*') {
			const close = ctx.src.indexOf('*/', ctx.i + 2);
			if (close === -1) throw new LiteralError('块注释没有闭合');
			ctx.i = close + 2;
			continue;
		}
		return;
	}
}

/** `ctx.i` 指向开引号；返回字符串内容 */
function parseString(ctx: Ctx, quote: string): string {
	ctx.i += 1;
	let out = '';
	while (ctx.i < ctx.src.length) {
		const ch = ctx.src[ctx.i];
		if (ch === '\\') {
			const next = ctx.src[ctx.i + 1] ?? '';
			if (next === 'u') {
				const hex = ctx.src.slice(ctx.i + 2, ctx.i + 6);
				if (/^[0-9a-fA-F]{4}$/.test(hex)) {
					out += String.fromCharCode(parseInt(hex, 16));
					ctx.i += 6;
					continue;
				}
			}
			out += ESCAPES[next] ?? next;
			ctx.i += 2;
			continue;
		}
		// 模板字符串里出现 ${ 说明有插值 —— 那不是字面量，不猜
		if (quote === '`' && ch === '$' && ctx.src[ctx.i + 1] === '{') {
			throw new LiteralError('模板字符串里有 ${} 插值，不是字面量');
		}
		if (ch === quote) {
			ctx.i += 1;
			return out;
		}
		out += ch;
		ctx.i += 1;
	}
	throw new LiteralError('字符串没有闭合');
}

function parseWord(ctx: Ctx): string {
	const start = ctx.i;
	while (ctx.i < ctx.src.length && isWordChar(ctx.src[ctx.i])) ctx.i += 1;
	return ctx.src.slice(start, ctx.i);
}

function parseNumber(ctx: Ctx): number {
	const rest = ctx.src.slice(ctx.i);
	const match = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
	if (match === null) throw new LiteralError(`不是合法的数字：${rest.slice(0, 12)}`);
	ctx.i += match[0].length;
	return Number(match[0]);
}

function parseKey(ctx: Ctx): string {
	const ch = ctx.src[ctx.i];
	if (ch === '"' || ch === "'" || ch === '`') return parseString(ctx, ch);
	if (ch === '[') throw new LiteralError('计算属性名不是字面量，没法解析');
	if (ctx.src.startsWith('...', ctx.i)) throw new LiteralError('展开运算符不是字面量，没法解析');
	const word = parseWord(ctx);
	if (word === '') throw new LiteralError('对象的键必须是字符串');
	return word;
}

function parseObject(ctx: Ctx): { [key: string]: JsValue } {
	ctx.i += 1;
	const out: { [key: string]: JsValue } = {};
	for (;;) {
		skipTrivia(ctx);
		if (ctx.i >= ctx.src.length) throw new LiteralError('对象没有闭合');
		if (ctx.src[ctx.i] === '}') {
			ctx.i += 1;
			return out;
		}
		const key = parseKey(ctx);
		skipTrivia(ctx);
		if (ctx.src[ctx.i] !== ':') throw new LiteralError(`「${key}」后面缺少冒号`);
		ctx.i += 1;
		out[key] = parseValue(ctx);
		skipTrivia(ctx);
		if (ctx.src[ctx.i] === ',') {
			ctx.i += 1;
			continue;
		}
		if (ctx.src[ctx.i] === '}') {
			ctx.i += 1;
			return out;
		}
		throw new LiteralError(`「${key}」后面缺少逗号或右花括号`);
	}
}

function parseArray(ctx: Ctx): JsValue[] {
	ctx.i += 1;
	const out: JsValue[] = [];
	for (;;) {
		skipTrivia(ctx);
		if (ctx.i >= ctx.src.length) throw new LiteralError('数组没有闭合');
		if (ctx.src[ctx.i] === ']') {
			ctx.i += 1;
			return out;
		}
		out.push(parseValue(ctx));
		skipTrivia(ctx);
		if (ctx.src[ctx.i] === ',') {
			ctx.i += 1;
			continue;
		}
		if (ctx.src[ctx.i] === ']') {
			ctx.i += 1;
			return out;
		}
		throw new LiteralError('数组元素后面缺少逗号或右方括号');
	}
}

function parseValue(ctx: Ctx): JsValue {
	skipTrivia(ctx);
	const ch = ctx.src[ctx.i];
	if (ch === undefined) throw new LiteralError('内容意外结束');
	if (ch === '{') return parseObject(ctx);
	if (ch === '[') return parseArray(ctx);
	if (ch === '"' || ch === "'" || ch === '`') return parseString(ctx, ch);
	if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9')) return parseNumber(ctx);
	const word = parseWord(ctx);
	if (word === 'true') return true;
	if (word === 'false') return false;
	if (word === 'null') return null;
	if (word !== '') {
		throw new LiteralError(
			`这里是「${word}」—— 变量 / 函数调用不是字面量，解析不了（Postman 导出的 fetch 就是这种写法）`
		);
	}
	throw new LiteralError(`不认识的字符「${ch}」`);
}

/** 从 `from` 起跳过空白与注释，返回新下标（调用方在参数之间推进用） */
export function skipJsTrivia(source: string, from: number): number {
	const ctx: Ctx = { src: source, i: from };
	skipTrivia(ctx);
	return ctx.i;
}

/** 从 `start` 处解析一个 JS 字面量 */
export function parseJsValue(source: string, start = 0): JsParseResult {
	try {
		const ctx: Ctx = { src: source, i: start };
		const value = parseValue(ctx);
		return { ok: true, value, end: ctx.i };
	} catch (cause) {
		return { ok: false, error: cause instanceof LiteralError ? cause.message : '解析失败' };
	}
}
