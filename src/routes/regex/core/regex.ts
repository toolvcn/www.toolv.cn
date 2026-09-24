// 正则测试的核心纯函数：编译校验、匹配执行（防死循环、限量截断）、高亮分词。
// 不依赖 DOM，全部可在 node 端单测。
import type { MatchGroup, MatchItem, TestResult, Token } from './types.ts';
import { MAX_MATCHES } from '../config.ts';

/** 空结果壳：非法正则时用，界面按 error 分支展示 */
const EMPTY_RESULT: TestResult = { error: null, matches: [], tokens: [], truncated: false };

/**
 * 把测试文本切成「未匹配 + 匹配」交替的分词序列，匹配段带序号（交替配色用）。
 * 只切到截断点为止，剩余文本并入末尾的普通段，保证渲染量与 matches 同级。
 */
function tokenize(input: string, matches: MatchItem[]): Token[] {
	const tokens: Token[] = [];
	let cursor = 0;
	for (let i = 0; i < matches.length; i += 1) {
		const match = matches[i]!;
		if (match.index > cursor) tokens.push({ text: input.slice(cursor, match.index), matchIndex: null });
		tokens.push({ text: match.text, matchIndex: i });
		cursor = match.index + match.text.length;
	}
	if (cursor < input.length) tokens.push({ text: input.slice(cursor), matchIndex: null });
	return tokens;
}

/** 收集一个 match 的捕获组：编号组在前（组 1 起），命名组在后；未参与的组标 empty */
function collectGroups(match: RegExpExecArray): MatchGroup[] {
	const groups: MatchGroup[] = [];
	for (let i = 1; i < match.length; i += 1) {
		const value = match[i];
		groups.push({ name: String(i), value: value === undefined ? '' : value, empty: value === undefined });
	}
	// 命名组再列一遍 —— 名字本身就是信息，重复展示换来的可读性划算
	if (match.groups) {
		for (const [name, value] of Object.entries(match.groups)) {
			groups.push({ name, value: value === undefined ? '' : value, empty: value === undefined });
		}
	}
	return groups;
}

/**
 * 执行正则并整理结果。pattern / flags 非法时 error 给出消息，不抛异常。
 * 防线：
 * - 零宽匹配把 lastIndex 前进一格，绝不原地打转；
 * - 命中 MAX_MATCHES 即停并标 truncated，文本再大渲染量也有界。
 */
export function testRegex(pattern: string, flags: string, input: string): TestResult {
	let regex: RegExp;
	try {
		regex = new RegExp(pattern, flags);
	} catch (error) {
		return { ...EMPTY_RESULT, error: error instanceof Error ? error.message : '正则语法错误' };
	}

	const global = flags.includes('g') || flags.includes('y');
	const matches: MatchItem[] = [];
	let truncated = false;

	if (global) {
		regex.lastIndex = 0;
		let executed: RegExpExecArray | null;
		while ((executed = regex.exec(input)) !== null) {
			if (matches.length >= MAX_MATCHES) {
				truncated = true;
				break;
			}
			matches.push({ index: executed.index, text: executed[0], groups: collectGroups(executed) });
			// 零宽匹配（如 a* 匹配到空串）必须手动前进，否则 exec 永远停在原地
			if (executed[0] === '') regex.lastIndex += 1;
		}
	} else {
		const executed = regex.exec(input);
		if (executed) matches.push({ index: executed.index, text: executed[0], groups: collectGroups(executed) });
	}

	return { error: null, matches, tokens: tokenize(input, matches), truncated };
}
