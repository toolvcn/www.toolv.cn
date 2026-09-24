// JSON 转换的纯函数：解析、序列化、错误定位。
// 不碰 DOM、不读 UI 状态，可以直接在 node 环境里跑单测。
import { tokenizeSource } from '$lib/utils/json';
import { INDENT_VALUE, type IndentKind, type JsonError, type JsonMode, type JsonResult } from './types.ts';

/** 空态时「载入示例」按钮填的内容：覆盖对象、数组、数字、布尔、null 五种类型 */
export const SAMPLE_JSON = `{
  "name": "微工具",
  "url": "https://www.toolv.cn",
  "tools": [
    { "id": 1, "name": "WebSocket 在线调试", "online": true },
    { "id": 2, "name": "Base64 编解码", "online": true, "alias": null }
  ],
  "stars": 4.5
}`;

/**
 * 按模式转换一次。
 * 只 parse 一遍：成功就序列化（顺带分词），失败就把错误翻译成行列。
 * 不做「先校验再转」的两遍解析 —— 大文本白跑一次。
 */
export function transformJson(input: string, mode: JsonMode, indent: IndentKind): JsonResult {
	if (input.trim() === '') return { output: '', error: null, tokens: [] };
	try {
		const parsed: unknown = JSON.parse(input);
		const space = mode === 'minify' ? undefined : INDENT_VALUE[indent];
		const output = JSON.stringify(parsed, null, space) ?? '';
		// 用 tokenizeSource 而不是 tokenizeJson：output 已经按用户选的缩进排好版，
		// 不能再被 JSON.stringify(…, 2) 重排一遍（见 $lib/utils/json 的两个入口说明）
		return { output, error: null, tokens: tokenizeSource(output) };
	} catch (error) {
		return { output: '', error: describeError(error, input), tokens: [] };
	}
}

function describeError(error: unknown, input: string): JsonError {
	return locateJsonError(error instanceof Error ? error.message : String(error), input);
}

/**
 * 从 SyntaxError 的 message 里取出位置，换算成 1 基行列。
 * V8 的报错文案改过三回，这里逐一兜：
 * - 新版 A：`Expected ',' or '}' after property value in JSON at position 27 (line 3 column 5)`
 * - 新版 B：`Unexpected token '}', ..."1, "b": } }" is not valid JSON`（没有数字位置，只有上下文摘录）
 * - 旧版：`Unexpected token } in JSON at position 27`
 * A、C 从 message 里拿位置；B 类拿不到就用自己的语法扫描器定位（见 findFirstJsonError）。
 */
export function locateJsonError(message: string, input: string): JsonError {
	const line = /line (\d+)/.exec(message);
	const column = /column (\d+)/.exec(message);
	if (line && column) {
		return { message: cleanMessage(message), line: Number(line[1]), column: Number(column[1]) };
	}
	const position = /position (\d+)/.exec(message);
	if (position) {
		const spot = positionToLineColumn(input, Number(position[1]));
		return { message: cleanMessage(message), line: spot.line, column: spot.column };
	}
	const found = findFirstJsonError(input);
	if (found !== null) {
		const spot = positionToLineColumn(input, found);
		return { message: cleanMessage(message), line: spot.line, column: spot.column };
	}
	return { message: cleanMessage(message), line: null, column: null };
}

/**
 * 砍掉 message 里的位置尾巴与上下文摘录。
 * 新版 B 的 `, ..."1, "b": } }"` 摘录既长又没信息量，从这里截断只留前面的原因。
 */
function cleanMessage(message: string): string {
	const ellipsis = message.indexOf(', ...');
	const trimmed = ellipsis === -1 ? message : message.slice(0, ellipsis);
	return trimmed.replace(/\s*at position \d+(\s*\(line \d+ column \d+\))?\s*$/, '').trim();
}

/**
 * 独立走一遍 JSON 文法（RFC 8259），返回第一个语法错误的位置；没发现错误返回 null。
 * 只在 JSON.parse 已经抛错之后调用，合法输入零开销 —— 它存在的意义是 V8 新版文案
 * 不给数字位置，错误定位不能依赖引擎心情。
 */
export function findFirstJsonError(input: string): number | null {
	const depthLimit = 512;
	let i = 0;
	const length = input.length;

	/** 嵌套过深直接报当前位置：给个明确错误，别爆调用栈 */
	class ScanStop {
		constructor(readonly pos: number) {}
	}

	const error = (): never => {
		throw new ScanStop(i);
	};

	const isDigit = (c: string): boolean => c >= '0' && c <= '9';
	const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';

	const skipWs = (): void => {
		while (i < length && isWs(input[i])) i += 1;
	};

	const parseString = (): void => {
		i += 1; // 跳过开头的 "
		while (i < length) {
			const c = input[i];
			if (c === '"') {
				i += 1;
				return;
			}
			if (c === '\\') {
				i += 1;
				if (i >= length) error();
				const escape = input[i];
				if (escape === 'u') {
					if (i + 4 >= length) error();
					for (let k = 1; k <= 4; k += 1) {
						const hex = input[i + k];
						if (!((hex >= '0' && hex <= '9') || (hex >= 'a' && hex <= 'f') || (hex >= 'A' && hex <= 'F'))) {
							error();
						}
					}
					i += 5;
				} else if ('"\\/bfnrt'.includes(escape)) {
					i += 1;
				} else {
					error();
				}
			} else {
				if (c.charCodeAt(0) < 0x20) error(); // 未转义的控制字符非法
				i += 1;
			}
		}
		error(); // 字符串没闭合
	};

	const parseNumber = (): void => {
		if (input[i] === '-') i += 1;
		if (i >= length) error();
		if (input[i] === '0') {
			i += 1;
		} else if (input[i] >= '1' && input[i] <= '9') {
			while (i < length && isDigit(input[i])) i += 1;
		} else {
			error(); // 前导不能是 0 之外的怪东西，-0 只在 int 是 0 时合法
		}
		if (i < length && input[i] === '.') {
			i += 1;
			if (i >= length || !isDigit(input[i])) error();
			while (i < length && isDigit(input[i])) i += 1;
		}
		if (i < length && (input[i] === 'e' || input[i] === 'E')) {
			i += 1;
			if (i < length && (input[i] === '+' || input[i] === '-')) i += 1;
			if (i >= length || !isDigit(input[i])) error();
			while (i < length && isDigit(input[i])) i += 1;
		}
	};

	const parseValue = (depth: number): void => {
		if (depth > depthLimit) error();
		skipWs();
		if (i >= length) error();
		const c = input[i];
		if (c === '{') {
			i += 1;
			skipWs();
			if (i < length && input[i] === '}') {
				i += 1;
				return;
			}
			for (;;) {
				skipWs();
				if (i >= length || input[i] !== '"') error(); // 成员必须以字符串键开头
				parseString();
				skipWs();
				if (i >= length || input[i] !== ':') error();
				i += 1;
				parseValue(depth + 1);
				skipWs();
				if (i >= length) error();
				if (input[i] === ',') {
					i += 1;
					continue;
				}
				if (input[i] === '}') {
					i += 1;
					return;
				}
				error();
			}
		}
		if (c === '[') {
			i += 1;
			skipWs();
			if (i < length && input[i] === ']') {
				i += 1;
				return;
			}
			for (;;) {
				parseValue(depth + 1);
				skipWs();
				if (i >= length) error();
				if (input[i] === ',') {
					i += 1;
					continue;
				}
				if (input[i] === ']') {
					i += 1;
					return;
				}
				error();
			}
		}
		if (c === '"') {
			parseString();
			return;
		}
		if (c === '-' || isDigit(c)) {
			parseNumber();
			return;
		}
		if (input.startsWith('true', i)) {
			i += 4;
			return;
		}
		if (input.startsWith('false', i)) {
			i += 5;
			return;
		}
		if (input.startsWith('null', i)) {
			i += 4;
			return;
		}
		error();
	};

	try {
		parseValue(0);
		skipWs();
		if (i !== length) error(); // 顶层后面还跟着东西
		return null;
	} catch (stopped) {
		if (stopped instanceof ScanStop) return stopped.pos;
		throw stopped;
	}
}

/** 字符下标 → 行列（都是 1 基），下标越界时按末尾算 */
export function positionToLineColumn(text: string, position: number): { line: number; column: number } {
	const safe = Math.max(0, Math.min(position, text.length));
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < safe; i += 1) {
		if (text[i] === '\n') {
			line += 1;
			lineStart = i + 1;
		}
	}
	return { line, column: safe - lineStart + 1 };
}

// 分词不再在这里：四处各写一份的实现已收到 $lib/utils/json（tokenizeSource 保留排版、
// tokenizeJson 先美化再分词）。本工具要保住用户选的缩进，走 tokenizeSource。
// 单测见 src/lib/utils/json.test.ts。
