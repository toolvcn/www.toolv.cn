// nginx 配置的行级解析（纯函数，不依赖 DOM）。模块名里的 `-nginx` 指**输入格式**。
//
// nginx 的行结构与 .htaccess 完全不同：指令以 `;` 结尾、块用 `{ }` 包起来，一条指令还能跨行写。
// 解析器只做三件事，其余（怎么翻成 .htaccess）全部在 convert-nginx.ts：
//   ① 把跨行的指令接成一条；② 用 containers 记下它属于哪些块（server / location / if…）；
//   ③ 注释单独成条原样带过去 —— 输出与源文件仍然逐条对应。
//
// `text` 与 `condition` 都是**源文件切片**而不是把 token 拼回去：token 已经剥掉引号，
// `if ($x != "y")` 拼回去会变成 `("y")` 这种把括号并进引号的怪样子，切片才能保住原文。
import type { NginxDirective } from './types.ts';

type TokenKind = 'word' | 'semi' | 'open' | 'close' | 'comment';

interface Token {
	kind: TokenKind;
	/** 原样文本（引号与正则里的转义都保留）；注释是去掉 `#` 的正文 */
	text: string;
	/** 剥掉外层引号后的值（只有 word 有意义，其余与 `text` 相同） */
	value: string;
	/** 源文件行号（1 起） */
	line: number;
	/** 在源文件里的起止下标 `[start, end)` */
	start: number;
	end: number;
}

/**
 * 把配置扫成 token 流。三处容易踩的地方：
 *
 * ① `#` 只在引号外才是注释 —— 行内剥注释会把 `return 301 "https://a/#x"` 这类写法切坏；
 * ② `{` / `}` 只在**词首**才是块分隔符 —— `^/a{2}$` 里的花括号属于词本身（nginx 也是这么切的），
 *    一律当分隔符会把正则拆成两半；
 * ③ 反斜杠只还原 `\\` 与 `\"` / `\'`，其余原样留着 —— `\.(php)$` 的转义一吃掉就成了另一个正则。
 */
export function tokenizeNginx(source: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;
	let line = 1;
	let raw = '';
	let value = '';
	let started = false;
	let wordStart = 0;
	let startLine = 1;
	let quote: '"' | "'" | '' = '';

	const start = (): void => {
		if (started) return;
		started = true;
		wordStart = index;
		startLine = line;
	};

	const flush = (): void => {
		if (!started) return;
		tokens.push({ kind: 'word', text: raw, value, line: startLine, start: wordStart, end: index });
		raw = '';
		value = '';
		started = false;
	};

	while (index < source.length) {
		const char = source[index];

		if (char === '\n') {
			// 换行只在引号里算内容（nginx 允许字符串跨行），否则当空白
			if (quote !== '') {
				raw += char;
				value += char;
			} else {
				flush();
			}
			line += 1;
			index += 1;
			continue;
		}

		if (char === '\\' && index + 1 < source.length) {
			const next = source[index + 1];
			start();
			raw += char + next;
			value += next === '\\' || next === '"' || next === "'" ? next : char + next;
			index += 2;
			continue;
		}

		if (quote === '') {
			if (char === '#') {
				flush();
				let end = source.indexOf('\n', index);
				if (end === -1) end = source.length;
				const body = source.slice(index + 1, end).trim();
				tokens.push({ kind: 'comment', text: body, value: body, line, start: index, end });
				index = end;
				continue;
			}
			if (char === '"' || char === "'") {
				start();
				quote = char;
				raw += char;
				index += 1;
				continue;
			}
			if (char === ';' || char === '{' || char === '}') {
				// 词中间的花括号属于这个词，只有落在词首才是块分隔符
				if (started && char !== ';') {
					raw += char;
					value += char;
					index += 1;
					continue;
				}
				flush();
				tokens.push({
					kind: char === ';' ? 'semi' : char === '{' ? 'open' : 'close',
					text: char,
					value: char,
					line,
					start: index,
					end: index + 1
				});
				index += 1;
				continue;
			}
			if (/\s/.test(char)) {
				flush();
				index += 1;
				continue;
			}
		} else if (char === quote) {
			raw += char;
			quote = '';
			index += 1;
			continue;
		}

		start();
		raw += char;
		value += char;
		index += 1;
	}

	flush();
	return tokens;
}

/** 源文件切片 → 单行文本：引号外的连续空白压成一个空格（跨行指令压成一行），引号里的空白原样 */
function sliceLine(source: string, start: number, end: number): string {
	let result = '';
	let quote: '"' | "'" | '' = '';
	let pending = false;

	const separate = (): void => {
		if (pending && result !== '') result += ' ';
		pending = false;
	};

	for (let index = start; index < end; index += 1) {
		const char = source[index];

		if (char === '\\' && index + 1 < end) {
			separate();
			result += char + source[index + 1];
			index += 1;
			continue;
		}
		if (quote === '') {
			if (char === '"' || char === "'") {
				separate();
				quote = char;
				result += char;
				continue;
			}
			if (/\s/.test(char)) {
				pending = true;
				continue;
			}
			separate();
			result += char;
			continue;
		}
		if (char === quote) quote = '';
		result += char;
	}

	return result;
}

/** 把 token 流收成「一条语句一行」的扁平列表，容器路径收进 `containers` */
export function parseNginx(source: string): NginxDirective[] {
	const directives: NginxDirective[] = [];
	const containers: string[] = [];
	const words: Token[] = [];
	let startLine = 1;

	for (const token of tokenizeNginx(source)) {
		if (token.kind === 'comment') {
			directives.push({
				line: token.line,
				text: token.text,
				kind: 'comment',
				name: '',
				args: [],
				containers: [...containers]
			});
			continue;
		}
		if (token.kind === 'word') {
			if (words.length === 0) startLine = token.line;
			words.push(token);
			continue;
		}

		const first = words[0];
		const args = words.slice(1).map((word) => word.value);
		const text = first === undefined ? token.text : sliceLine(source, first.start, token.end);

		if (token.kind === 'semi') {
			// 光秃秃一个 `;` 直接忽略；有内容就成一条指令
			if (first !== undefined) {
				directives.push({
					line: startLine,
					text,
					kind: 'directive',
					name: first.value,
					args,
					containers: [...containers]
				});
			}
		} else if (token.kind === 'open') {
			const directive: NginxDirective = {
				line: startLine,
				text,
				kind: 'open',
				name: first?.value ?? '',
				args,
				containers: [...containers]
			};
			// `if` 的条件取自 `if` 与 `{` 之间的原文切片，引号与括号都保持原样
			if (first !== undefined && first.value.toLowerCase() === 'if') {
				directive.condition = source.slice(first.end, token.start).trim();
			}
			directives.push(directive);
			containers.push(first === undefined ? '' : [first.value, ...args].join(' '));
		} else {
			// 该闭合了却还有没写完的词：先把它们当一条指令留下，再闭合（不静默丢）
			if (first !== undefined) {
				directives.push({
					line: startLine,
					text: sliceLine(source, first.start, words[words.length - 1].end),
					kind: 'directive',
					name: first.value,
					args,
					containers: [...containers]
				});
			}
			// 闭合条目的 containers 含它自己（与 htaccess 侧一致），所以先 push 再 pop
			directives.push({ line: token.line, text: '}', kind: 'close', name: '', args: [], containers: [...containers] });
			if (containers.length > 0) containers.pop();
		}
		words.length = 0;
	}

	// 文件末尾没写 `;` 的半条指令：原样留一条，让它走 ⚠️ 分支而不是无声消失
	if (words.length > 0) {
		directives.push({
			line: startLine,
			text: sliceLine(source, words[0].start, words[words.length - 1].end),
			kind: 'directive',
			name: words[0].value,
			args: words.slice(1).map((word) => word.value),
			containers: [...containers]
		});
	}

	return directives;
}
