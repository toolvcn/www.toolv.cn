// .htaccess 的行级解析（纯函数，不依赖 DOM）。模块名里的 `-htaccess` 指**输入格式**。
//
// .htaccess 是「一行一条指令」，但有三样东西会把行与行连起来，解析器只负责把这三件事拆平：
//   ① 行尾 `\` 续行；② `<IfModule>` / `<Files>` 这类容器（用 containers 记路径）；③ RewriteCond 要挂到后面的 RewriteRule 上。
// 「怎么翻成 nginx」全部在 convert-htaccess.ts，两边各自可单测。
import type { Directive, RewriteCondition } from './types.ts';

export interface LogicalLine {
	/** 源文件行号（1 起；续行取首行） */
	line: number;
	/** 已 trim 与合并续行的文本（注释行则是不带 `#` 的正文） */
	text: string;
	/** 整行注释 */
	comment: boolean;
}

/**
 * 把源码切成逻辑行。
 * Apache 的 `#` 注释必须独占一行（不像 shell 能写在行尾），所以这里不做行内剥注释 ——
 * 剥了反而会把 URL 里的 `#` 锚点、正则里的 `#` 一起吃掉。
 */
export function readLogicalLines(source: string): LogicalLine[] {
	const raw = source.split(/\r?\n/);
	const lines: LogicalLine[] = [];
	let index = 0;

	while (index < raw.length) {
		const line = index + 1;
		let text = raw[index].trim();
		index += 1;

		if (text === '') continue;
		if (text.startsWith('#')) {
			lines.push({ line, text: text.slice(1).trim(), comment: true });
			continue;
		}

		// 续行：行尾的 `\` 表示「下一行还是这条指令」
		while (text.endsWith('\\') && index < raw.length) {
			text = `${text.slice(0, -1).trim()} ${raw[index].trim()}`;
			index += 1;
		}
		lines.push({ line, text, comment: false });
	}

	return lines;
}

/** 引号感知分词：`Header set X "a b"` 里带空格的引号段算一个 token，引号本身剥掉 */
export function tokenize(text: string): string[] {
	const tokens: string[] = [];
	let current = '';
	let quoted = false;
	let started = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];

		// 只还原 `\"` 与 `\\`：Apache 的正则要靠 `\.` 这类转义表达字面点，
		// 无条件吃掉反斜杠会把 `^www\.example\.com$` 变成 `^www.example.com$`（语义直接错）
		if (char === '\\' && index + 1 < text.length) {
			const next = text[index + 1];
			if (next === '"' || next === '\\') {
				current += next;
				index += 1;
			} else {
				current += char;
			}
			started = true;
			continue;
		}
		if (char === '"') {
			quoted = !quoted;
			started = true;
			continue;
		}
		if (!quoted && /\s/.test(char)) {
			if (started) {
				tokens.push(current);
				current = '';
				started = false;
			}
			continue;
		}
		current += char;
		started = true;
	}

	if (started) tokens.push(current);
	return tokens;
}

/** 把 `[R=301,L]` 拆成 ['R=301', 'L']：方括号剥掉，标记名大写（等号右边的值保持原样） */
export function parseFlagList(raw: string): string[] {
	const trimmed = raw.trim();
	if (!trimmed.startsWith('[')) return [];
	return trimmed
		.replace(/^\[/, '')
		.replace(/\]$/, '')
		.split(',')
		.map((flag) => flag.trim())
		.filter((flag) => flag !== '')
		.map((flag) => {
			const equal = flag.indexOf('=');
			return equal === -1 ? flag.toUpperCase() : `${flag.slice(0, equal).toUpperCase()}${flag.slice(equal)}`;
		});
}

/** 把 .htaccess 解析成「扁平的一行一条」，容器与条件都收进字段里 */
export function parseHtaccess(source: string): Directive[] {
	const directives: Directive[] = [];
	const containers: string[] = [];
	let pending: RewriteCondition[] = [];

	/** RewriteCond 没等到它的 RewriteRule（后面是别的指令或文件结束）时，让它单独成条去报错 */
	function flushConditions(): void {
		for (const condition of pending) {
			directives.push({
				line: condition.line,
				text: condition.source,
				kind: 'directive',
				name: 'RewriteCond',
				args: [],
				containers: [...containers],
				conditions: []
			});
		}
		pending = [];
	}

	for (const logical of readLogicalLines(source)) {
		if (logical.comment) {
			directives.push({
				line: logical.line,
				text: logical.text,
				kind: 'comment',
				name: '',
				args: [],
				containers: [...containers],
				conditions: []
			});
			continue;
		}

		// 容器标签：<IfModule x> / </IfModule>
		if (logical.text.startsWith('<')) {
			flushConditions();
			const isClose = logical.text.startsWith('</');
			const tokens = tokenize(logical.text.replace(/^<\/?/, '').replace(/>$/, ''));
			const [name = '', ...args] = tokens;
			const kind = isClose ? 'close' : 'open';
			directives.push({
				line: logical.line,
				text: [name, ...args].join(' '),
				kind,
				name,
				args,
				containers: [...containers],
				conditions: []
			});
			if (isClose) {
				if (containers.length > 0) containers.pop();
			} else {
				containers.push([name, ...args].join(' '));
			}
			continue;
		}

		const tokens = tokenize(logical.text);
		if (tokens.length === 0) continue;
		const [name, ...args] = tokens;
		const lower = name.toLowerCase();

		if (lower === 'rewritecond') {
			const [testString = '', pattern = '', flagsRaw = ''] = args;
			pending.push({
				line: logical.line,
				testString,
				pattern,
				flags: parseFlagList(flagsRaw),
				source: logical.text
			});
			continue;
		}

		// 别的指令一出现，前面攒着的条件就没人接手了
		if (lower !== 'rewriterule') flushConditions();
		const conditions = lower === 'rewriterule' ? pending : [];
		pending = [];

		directives.push({
			line: logical.line,
			text: logical.text,
			kind: 'directive',
			name,
			args,
			containers: [...containers],
			conditions
		});
	}

	flushConditions();
	return directives;
}
