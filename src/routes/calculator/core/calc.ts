// 表达式求值：词法 → 递归下降解析 → 求值。纯函数、不碰 DOM、不用 eval，node 环境直接单测。
//
// 三条刻意的选择：
//   1. **不 eval、不 new Function**：站内其它工具都坚持「不执行用户输入的字符串」，这一页更不能开这个口子；
//   2. **不引依赖**：表达式求值就那么点语法，自己写一个比拉进一个库好维护（也符合「不为单个工具引入大型依赖」）；
//   3. **浮点噪声在显示层收拾**（`formatNumber`）：`0.1 + 0.2` 的二进制误差不是 bug，但显示成
//      `0.30000000000000004` 就是在为难用户 —— 收敛到 12 位有效数字再去掉多余的 0。
import { fail, ok, type Result } from '$lib/utils/result';

/** 角度制：三角函数的入参与反三角函数的出参都按度算 */
export interface CalcOptions {
	deg: boolean;
}

type Token =
	| { kind: 'number'; text: string; pos: number }
	| { kind: 'name'; text: string; pos: number }
	| { kind: 'op'; text: string; pos: number }
	| { kind: 'lparen'; text: string; pos: number }
	| { kind: 'rparen'; text: string; pos: number }
	| { kind: 'comma'; text: string; pos: number };

interface Func {
	/** 参数个数；'variadic' 表示 1 个以上 */
	arity: number | 'variadic';
	apply: (args: number[], deg: boolean) => number;
}

/** 三角函数的入参：角度制下先把度转成弧度 */
const toRad = (value: number, deg: boolean): number => (deg ? (value * Math.PI) / 180 : value);
/** 反三角函数的出参：角度制下把弧度转成度 */
const fromRad = (value: number, deg: boolean): number => (deg ? (value * 180) / Math.PI : value);

const FUNCTIONS: Record<string, Func> = {
	sin: { arity: 1, apply: (a, deg) => Math.sin(toRad(a[0] ?? 0, deg)) },
	cos: { arity: 1, apply: (a, deg) => Math.cos(toRad(a[0] ?? 0, deg)) },
	tan: { arity: 1, apply: (a, deg) => Math.tan(toRad(a[0] ?? 0, deg)) },
	asin: { arity: 1, apply: (a, deg) => fromRad(Math.asin(a[0] ?? 0), deg) },
	acos: { arity: 1, apply: (a, deg) => fromRad(Math.acos(a[0] ?? 0), deg) },
	atan: { arity: 1, apply: (a, deg) => fromRad(Math.atan(a[0] ?? 0), deg) },
	ln: { arity: 1, apply: (a) => Math.log(a[0] ?? 0) },
	log10: { arity: 1, apply: (a) => Math.log10(a[0] ?? 0) },
	log2: { arity: 1, apply: (a) => Math.log2(a[0] ?? 0) },
	exp: { arity: 1, apply: (a) => Math.exp(a[0] ?? 0) },
	sqrt: { arity: 1, apply: (a) => Math.sqrt(a[0] ?? 0) },
	cbrt: { arity: 1, apply: (a) => Math.cbrt(a[0] ?? 0) },
	abs: { arity: 1, apply: (a) => Math.abs(a[0] ?? 0) },
	round: { arity: 1, apply: (a) => Math.round(a[0] ?? 0) },
	floor: { arity: 1, apply: (a) => Math.floor(a[0] ?? 0) },
	ceil: { arity: 1, apply: (a) => Math.ceil(a[0] ?? 0) },
	pow: { arity: 2, apply: (a) => Math.pow(a[0] ?? 0, a[1] ?? 0) },
	min: { arity: 'variadic', apply: (a) => Math.min(...a) },
	max: { arity: 'variadic', apply: (a) => Math.max(...a) }
};

export const CONSTANTS: Record<string, number> = {
	pi: Math.PI,
	e: Math.E
};

/** 界面上那一排函数按钮：点一下把片段插到表达式末尾 */
export const SNIPPETS: ReadonlyArray<{ text: string; label: string }> = [
	{ text: 'sin(', label: 'sin' },
	{ text: 'cos(', label: 'cos' },
	{ text: 'tan(', label: 'tan' },
	{ text: 'ln(', label: 'ln' },
	{ text: 'log10(', label: 'log₁₀' },
	{ text: 'sqrt(', label: '√' },
	{ text: 'abs(', label: '|x|' },
	{ text: '^2', label: 'x²' },
	{ text: '^', label: 'xʸ' },
	{ text: 'pi', label: 'π' },
	{ text: 'e', label: 'e' },
	{ text: '(', label: '(' }
];

function tokenize(source: string): Result<Token[]> {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const char = source[i] ?? '';
		if (char === ' ' || char === '\t') {
			i += 1;
			continue;
		}
		if (/[0-9.]/.test(char)) {
			const start = i;
			while (i < source.length && /[0-9.]/.test(source[i] ?? '')) i += 1;
			// 科学计数法：1e-3 / 2.5E+8
			const next = source[i] ?? '';
			if (next === 'e' || next === 'E') {
				i += 1;
				if (source[i] === '+' || source[i] === '-') i += 1;
				while (i < source.length && /[0-9]/.test(source[i] ?? '')) i += 1;
			}
			tokens.push({ kind: 'number', text: source.slice(start, i), pos: start });
			continue;
		}
		if (char === 'π') {
			tokens.push({ kind: 'name', text: 'pi', pos: i });
			i += 1;
			continue;
		}
		if (/[a-zA-Z_]/.test(char)) {
			const start = i;
			while (i < source.length && /[a-zA-Z_0-9]/.test(source[i] ?? '')) i += 1;
			tokens.push({ kind: 'name', text: source.slice(start, i).toLowerCase(), pos: start });
			continue;
		}
		if ('+-*/^%'.includes(char)) {
			tokens.push({ kind: 'op', text: char, pos: i });
			i += 1;
			continue;
		}
		// 中文全角符号：从别处粘过来的表达式里很常见，顺手认掉
		const folded = '（(）)＋+－-－−×*÷/，,'.includes(char)
			? (
					{ '（': '(', '）': ')', '＋': '+', '－': '-', '−': '-', '×': '*', '÷': '/', '，': ',' } as Record<
						string,
						string
					>
				)[char]
			: undefined;
		if (folded !== undefined) {
			tokens.push(
				folded === '('
					? { kind: 'lparen', text: '(', pos: i }
					: folded === ')'
						? { kind: 'rparen', text: ')', pos: i }
						: folded === ','
							? { kind: 'comma', text: ',', pos: i }
							: { kind: 'op', text: folded, pos: i }
			);
			i += 1;
			continue;
		}
		if (char === '(') {
			tokens.push({ kind: 'lparen', text: '(', pos: i });
			i += 1;
			continue;
		}
		if (char === ')') {
			tokens.push({ kind: 'rparen', text: ')', pos: i });
			i += 1;
			continue;
		}
		if (char === ',') {
			tokens.push({ kind: 'comma', text: ',', pos: i });
			i += 1;
			continue;
		}
		return fail(`第 ${i + 1} 个字符不认识：${char}`);
	}
	return ok(tokens);
}

class Parser {
	readonly #tokens: Token[];
	readonly #deg: boolean;
	#index = 0;

	constructor(tokens: Token[], deg: boolean) {
		this.#tokens = tokens;
		this.#deg = deg;
	}

	parse(): Result<number> {
		if (this.#tokens.length === 0) return fail('表达式是空的');
		const value = this.#expression();
		if (!value.ok) return value;
		if (this.#index < this.#tokens.length) {
			const token = this.#tokens[this.#index];
			return fail(`第 ${(token?.pos ?? 0) + 1} 个字符处多出来了「${token?.text ?? ''}」`);
		}
		return value;
	}

	#peek(): Token | undefined {
		return this.#tokens[this.#index];
	}

	// 下面三个方法都把「已经算出来的部分」收在一个 `number` 累加器里，而不是抱着 `Result<number>` 循环：
	// 循环里重新赋值之后 TS 会把类型放宽回 `Result<number>`，`.value` 就不再能读（联合的另一支没有这个字段）。

	#expression(): Result<number> {
		const first = this.#term();
		if (!first.ok) return first;
		let acc = first.value;
		while (true) {
			const token = this.#peek();
			if (token?.kind !== 'op' || (token.text !== '+' && token.text !== '-')) break;
			this.#index += 1;
			const right = this.#term();
			if (!right.ok) return right;
			acc = token.text === '+' ? acc + right.value : acc - right.value;
		}
		return ok(acc);
	}

	#term(): Result<number> {
		const first = this.#factor();
		if (!first.ok) return first;
		let acc = first.value;
		while (true) {
			const token = this.#peek();
			// 隐式乘法：2(3+4) / 2pi / 3sin(30) —— 只认「数字后面紧跟括号、常量或函数」。
			// 刻意不认「数字后面紧跟数字」（2 3）：那更像漏写了运算符，静默算成 6 会让人以为算对了
			if (token !== undefined && (token.kind === 'lparen' || token.kind === 'name')) {
				const right = this.#factor();
				if (!right.ok) return right;
				acc *= right.value;
				continue;
			}
			if (token?.kind !== 'op' || !'*/%'.includes(token.text)) break;
			this.#index += 1;
			const right = this.#factor();
			if (!right.ok) return right;
			const op = token.text;
			// 除零单独报错：让它落到 Infinity 再被「结果超出范围」兜住，用户看到的是个看不懂的词
			if (op === '/' && right.value === 0) return fail('除数是 0，这个式子没有结果');
			acc = op === '*' ? acc * right.value : op === '/' ? acc / right.value : acc % right.value;
		}
		return ok(acc);
	}

	/** 幂运算：右结合（2^3^2 = 2^(3^2)），所以这里递归而不是循环 */
	#factor(): Result<number> {
		const base = this.#unary();
		if (!base.ok) return base;
		const token = this.#peek();
		if (token?.kind === 'op' && token.text === '^') {
			this.#index += 1;
			const exponent = this.#factor();
			if (!exponent.ok) return exponent;
			return ok(Math.pow(base.value, exponent.value));
		}
		return base;
	}

	#unary(): Result<number> {
		const token = this.#peek();
		if (token?.kind === 'op' && (token.text === '-' || token.text === '+')) {
			this.#index += 1;
			const value = this.#unary();
			if (!value.ok) return value;
			return ok(token.text === '-' ? -value.value : value.value);
		}
		return this.#primary();
	}

	#primary(): Result<number> {
		const token = this.#peek();
		if (token === undefined) return fail('表达式没写完整');
		if (token.kind === 'number') {
			this.#index += 1;
			const value = Number(token.text);
			if (!Number.isFinite(value)) return fail(`「${token.text}」不是能算的数`);
			return ok(value);
		}
		if (token.kind === 'lparen') {
			this.#index += 1;
			const value = this.#expression();
			if (!value.ok) return value;
			const closing = this.#peek();
			if (closing?.kind !== 'rparen') return fail('括号没配对：少一个 )');
			this.#index += 1;
			return value;
		}
		if (token.kind === 'name') {
			this.#index += 1;
			const func = FUNCTIONS[token.text];
			if (func !== undefined) return this.#call(token.text, func);
			const constant = CONSTANTS[token.text];
			if (constant !== undefined) return ok(constant);
			return fail(`不认识「${token.text}」：它是常量 pi / e，或者是 ${Object.keys(FUNCTIONS).join(' / ')}`);
		}
		if (token.kind === 'rparen') return fail('括号没配对：多一个 )');
		return fail(`「${token.text}」这个位置不该出现`);
	}

	#call(name: string, func: Func): Result<number> {
		const open = this.#peek();
		if (open?.kind !== 'lparen') return fail(`${name} 后面要跟一个 (`);
		this.#index += 1;
		const args: number[] = [];
		if (this.#peek()?.kind === 'rparen' && func.arity !== 'variadic' && func.arity > 0) {
			return fail(`${name} 要 ${func.arity} 个参数，一个都没给`);
		}
		while (true) {
			const arg = this.#expression();
			if (!arg.ok) return arg;
			args.push(arg.value);
			const token = this.#peek();
			if (token?.kind === 'comma') {
				this.#index += 1;
				continue;
			}
			if (token?.kind === 'rparen') {
				this.#index += 1;
				break;
			}
			return fail(`${name}(...) 后面少一个 )`);
		}
		if (func.arity === 'variadic') {
			if (args.length === 0) return fail(`${name} 至少要一个参数`);
			return ok(func.apply(args, this.#deg));
		}
		if (args.length !== func.arity) {
			return fail(`${name} 要 ${func.arity} 个参数，给了 ${args.length} 个`);
		}
		return ok(func.apply(args, this.#deg));
	}
}

export function evaluate(source: string, options: CalcOptions): Result<number> {
	const tokens = tokenize(source);
	if (!tokens.ok) return tokens;
	const value = new Parser(tokens.value, options.deg).parse();
	if (!value.ok) return value;
	if (Number.isNaN(value.value)) return fail('算出来不是一个数（NaN）：检查一下参数范围');
	if (!Number.isFinite(value.value)) return fail('结果超出能表示的范围');
	return value;
}

/**
 * 结果格式化：先收敛浮点噪声，再决定用定点还是科学计数法。
 * 12 位有效数字足够挡掉 `0.1 + 0.2` 这类误差，又不会把真的高精度结果砍短。
 */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return '—';
	if (value === 0) return '0';
	const abs = Math.abs(value);
	if (abs >= 1e15 || abs < 1e-9) return value.toExponential(9).replace(/\.?0+e/, 'e');
	const rounded = Number(value.toPrecision(12));
	const text = String(rounded);
	return text;
}
