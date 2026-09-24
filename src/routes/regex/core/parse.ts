// 正则 → 抽象语法树（AST）的递归下降解析器，给「正则图解」提供结构。
// 不追求覆盖全部语法：遇到内联修饰符 / 原子组 / 条件组这类写法抛出带说明的
// 错误，界面显示「暂不支持图解」的兜底文案。纯函数、无 DOM，可在 node 端单测。
export type GroupKind =
	'capture' | 'named' | 'nonCapture' | 'lookahead' | 'negativeLookahead' | 'lookbehind' | 'negativeLookbehind';

export type RegexNode =
	| { type: 'sequence'; items: RegexNode[] }
	| { type: 'alternation'; branches: RegexNode[] }
	| { type: 'literal'; value: string }
	/** 转义序列：token 是原始写法（如 \d），label 是给图解的说明（如「数字」） */
	| { type: 'escape'; token: string; label: string }
	| { type: 'charClass'; negated: boolean; token: string; label: string }
	| { type: 'dot' }
	| { type: 'anchor'; token: string; label: string }
	/** 捕获 / 命名组带编号，图解上标「组 1 / 组 name」 */
	| { type: 'group'; kind: GroupKind; name?: string; number?: number; child: RegexNode }
	/** min / max 用 Infinity 表示无上限；lazy 为惰性量词（*? 等） */
	| { type: 'quantified'; child: RegexNode; min: number; max: number; lazy: boolean }
	| { type: 'backref'; token: string; label: string };

export type ParseResult = { ok: true; node: RegexNode } | { ok: false; reason: string };

export class ParseError extends Error {}

/** 解析入口：失败不抛异常，返回带原因的结果对象 */
export function parsePattern(source: string): ParseResult {
	try {
		const node = new Parser(source).parse();
		return { ok: true, node };
	} catch (error) {
		return { ok: false, reason: error instanceof Error ? error.message : '无法解析该写法' };
	}
}

class Parser {
	private pos = 0;
	/** 捕获组编号（命名组也算捕获），用于图解标注 */
	private groupCounter = 0;

	constructor(private source: string) {}

	parse(): RegexNode {
		const node = this.parseAlternation();
		if (this.pos < this.source.length) {
			this.fail(`无法理解这里的写法：${this.source.slice(this.pos, this.pos + 12)}`);
		}
		return node;
	}

	// ------------------------------------------------------------ 基本工具

	private peek(offset = 0): string {
		return this.source[this.pos + offset] ?? '';
	}

	private consume(): string {
		return this.source[this.pos++] ?? '';
	}

	private eof(): boolean {
		return this.pos >= this.source.length;
	}

	private fail(message: string): never {
		throw new ParseError(message);
	}

	private expect(expected: string): void {
		if (this.consume() !== expected) this.fail(`缺少 ${expected}`);
	}

	// ------------------------------------------------------------ 语法层

	/** 交替：a|b|c，遇 ) 或结尾停止 */
	private parseAlternation(): RegexNode {
		const branches: RegexNode[] = [this.parseSequence()];
		while (this.peek() === '|') {
			this.consume();
			branches.push(this.parseSequence());
		}
		return branches.length === 1 ? branches[0]! : { type: 'alternation', branches };
	}

	/** 序列：多个元素排成一行，遇 | / ) 或结尾停止 */
	private parseSequence(): RegexNode {
		const items: RegexNode[] = [];
		while (!this.eof() && this.peek() !== '|' && this.peek() !== ')') {
			items.push(this.parseQuantifiedAtom());
		}
		return items.length === 1 ? items[0]! : { type: 'sequence', items };
	}

	/** 一个可带量词的原子；{ 不是合法量词时按字面量留给下一轮处理 */
	private parseQuantifiedAtom(): RegexNode {
		const atom = this.parseAtom();
		const ch = this.peek();
		if (ch === '*') {
			this.consume();
			return this.wrapQuantified(atom, 0, Infinity);
		}
		if (ch === '+') {
			this.consume();
			return this.wrapQuantified(atom, 1, Infinity);
		}
		if (ch === '?') {
			this.consume();
			return this.wrapQuantified(atom, 0, 1);
		}
		if (ch === '{') {
			const parsed = this.tryParseBraceQuantifier();
			if (parsed) return this.wrapQuantified(atom, parsed.min, parsed.max);
		}
		return atom;
	}

	/** {n} / {n,} / {n,m}；不是合法量词时回退指针返回 null */
	private tryParseBraceQuantifier(): { min: number; max: number } | null {
		const start = this.pos;
		this.consume(); // {
		let digits = '';
		while (/[0-9]/.test(this.peek())) digits += this.consume();
		if (digits === '') {
			this.pos = start;
			return null;
		}
		const min = Number(digits);
		let max = min;
		if (this.peek() === ',') {
			this.consume();
			let maxDigits = '';
			while (/[0-9]/.test(this.peek())) maxDigits += this.consume();
			max = maxDigits === '' ? Infinity : Number(maxDigits);
		}
		if (this.consume() !== '}') {
			this.pos = start;
			return null;
		}
		if (max !== Infinity && max < min) {
			this.pos = start;
			return null;
		}
		return { min, max };
	}

	/** 量词后的 ? 是惰性标记，吸进节点里 */
	private wrapQuantified(child: RegexNode, min: number, max: number): RegexNode {
		let lazy = false;
		if (this.peek() === '?') {
			this.consume();
			lazy = true;
		}
		return { type: 'quantified', child, min, max, lazy };
	}

	/** 一个不带量词的原子 */
	private parseAtom(): RegexNode {
		const ch = this.peek();
		if (ch === '(') return this.parseGroup();
		if (ch === '[') return this.parseCharClass();
		if (ch === '\\') return this.parseEscape();
		if (ch === '.') {
			this.consume();
			return { type: 'dot' };
		}
		if (ch === '^') {
			this.consume();
			return { type: 'anchor', token: '^', label: '开头' };
		}
		if (ch === '$') {
			this.consume();
			return { type: 'anchor', token: '$', label: '结尾' };
		}
		if (ch === '') {
			this.fail('意外的结尾');
		}
		if ('*+?})|'.includes(ch)) {
			this.fail(`「${ch}」前面缺少可量词化的内容`);
		}
		this.consume();
		return { type: 'literal', value: ch };
	}

	// ------------------------------------------------------------ 组与类

	private parseGroup(): RegexNode {
		this.consume(); // (
		if (this.peek() !== '?') {
			this.groupCounter += 1;
			const child = this.parseAlternation();
			this.expect(')');
			return { type: 'group', kind: 'capture', number: this.groupCounter, child };
		}
		this.consume(); // ?
		const ch = this.peek();
		if (ch === ':') {
			this.consume();
			const child = this.parseAlternation();
			this.expect(')');
			return { type: 'group', kind: 'nonCapture', child };
		}
		if (ch === '=') {
			this.consume();
			const child = this.parseAlternation();
			this.expect(')');
			return { type: 'group', kind: 'lookahead', child };
		}
		if (ch === '!') {
			this.consume();
			const child = this.parseAlternation();
			this.expect(')');
			return { type: 'group', kind: 'negativeLookahead', child };
		}
		if (ch === '<') {
			this.consume();
			const next = this.peek();
			if (next === '=' || next === '!') {
				this.consume();
				const child = this.parseAlternation();
				this.expect(')');
				return { type: 'group', kind: next === '=' ? 'lookbehind' : 'negativeLookbehind', child };
			}
			// 命名捕获组 (?<name>…)
			this.groupCounter += 1;
			let name = '';
			while (!this.eof() && this.peek() !== '>') name += this.consume();
			if (this.peek() !== '>') this.fail('命名组缺少闭合的 >');
			this.consume();
			const child = this.parseAlternation();
			this.expect(')');
			return { type: 'group', kind: 'named', name, number: this.groupCounter, child };
		}
		this.fail('不支持的组写法（内联修饰符 / 原子组 / 条件组等）');
	}

	private parseCharClass(): RegexNode {
		this.consume(); // [
		let negated = false;
		if (this.peek() === '^') {
			negated = true;
			this.consume();
		}
		let token = negated ? '[^' : '[';
		while (!this.eof() && this.peek() !== ']') {
			const c = this.consume();
			token += c;
			if (c === '\\' && !this.eof()) token += this.consume();
		}
		if (this.peek() !== ']') this.fail('字符类缺少闭合的 ]');
		this.consume();
		token += ']';
		return { type: 'charClass', negated, token, label: negated ? '排除集合' : '字符集合' };
	}

	// ------------------------------------------------------------ 转义与引用

	private parseEscape(): RegexNode {
		this.consume(); // 反斜杠
		if (this.eof()) this.fail('结尾的反斜杠没有意义');
		const ch = this.consume();

		if (ch >= '1' && ch <= '9') {
			let digits = ch;
			while (/[0-9]/.test(this.peek())) digits += this.consume();
			return { type: 'backref', token: `\\${digits}`, label: `引用第 ${Number(digits)} 组` };
		}
		if (ch === '0') return { type: 'escape', token: '\\0', label: 'NUL 空字符' };
		if (ch === 'k') {
			if (this.consume() !== '<') this.fail('\\k 后应为 \\k<名字>');
			let name = '';
			while (!this.eof() && this.peek() !== '>') name += this.consume();
			if (this.peek() !== '>') this.fail('命名组引用缺少闭合的 >');
			this.consume();
			return { type: 'backref', token: `\\k<${name}>`, label: `引用命名组 ${name}` };
		}
		if (ch === 'p' || ch === 'P') {
			if (this.peek() === '{') {
				this.consume();
				let inner = '';
				while (!this.eof() && this.peek() !== '}') inner += this.consume();
				if (this.peek() === '}') this.consume();
				return { type: 'escape', token: `\\${ch}{${inner}}`, label: 'Unicode 属性' };
			}
			return { type: 'escape', token: `\\${ch}`, label: 'Unicode 属性' };
		}
		if (ch === 'x') {
			const hex = this.peek(0) + this.peek(1);
			if (/[0-9a-fA-F]{2}/.test(hex)) {
				this.consume();
				this.consume();
				return { type: 'escape', token: `\\x${hex}`, label: '十六进制转义' };
			}
			return { type: 'escape', token: '\\x', label: '转义' };
		}
		if (ch === 'u') {
			if (this.peek() === '{') {
				this.consume();
				let hex = '';
				while (!this.eof() && this.peek() !== '}') hex += this.consume();
				if (this.peek() === '}') this.consume();
				return { type: 'escape', token: `\\u{${hex}}`, label: '按码点字符' };
			}
			const hex = this.peek(0) + this.peek(1) + this.peek(2) + this.peek(3);
			if (/[0-9a-fA-F]{4}/.test(hex)) {
				for (let i = 0; i < 4; i += 1) this.consume();
				return { type: 'escape', token: `\\u${hex}`, label: '按码点字符' };
			}
			return { type: 'escape', token: '\\u', label: '转义' };
		}
		if (ch === 'c') {
			const c = this.consume();
			return { type: 'escape', token: `\\c${c}`, label: '控制字符' };
		}

		const META: Record<string, string> = {
			d: '数字',
			D: '非数字',
			w: '字母数字下划线',
			W: '非单词字符',
			s: '空白字符',
			S: '非空白',
			b: '单词边界',
			B: '非单词边界',
			n: '换行符',
			r: '回车符',
			t: '制表符',
			f: '换页符',
			v: '垂直制表符',
			'\\': '反斜杠',
			'/': '斜杠',
			'.': '点号',
			'^': '插入符',
			$: '美元符',
			'[': '左方括号',
			']': '右方括号',
			'(': '左括号',
			')': '右括号',
			'{': '左花括号',
			'}': '右花括号',
			'|': '竖线',
			'*': '星号',
			'+': '加号',
			'?': '问号',
			'-': '连字符',
			"'": '单引号'
		};
		return { type: 'escape', token: `\\${ch}`, label: META[ch] ?? '转义字符' };
	}
}
