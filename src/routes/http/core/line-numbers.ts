// 结果区**左侧行号槽**的纯函数：数「显示出来的行」并生成行号文本。
//
// 两种视图共用：
//   - 原始 / 非 JSON：内容就是一段文本，数它的换行；
//   - 美化：内容是重排过的 token 流，数 token 文本里的换行 ——
//     **不能**数源文本的行（紧凑 JSON 源文本只有一行，渲染出来可能两千行）。
//
// 行号能跟正文对齐，靠两条：① 两侧共用同一份字体与行高（见 ui/styles.ts 的 LINE_GUTTER / LINE_BODY）；
// ② 正文是 `whitespace-pre`（不折行），所以「源文本第 N 行 = 屏幕上的第 N 行」。
//
// 纯函数，不依赖 DOM，可单测。

import type { JsonToken } from '$lib/utils/json';

/** 一段文本里的换行数 */
function countBreaks(text: string): number {
	let count = 0;
	for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) count += 1;
	return count;
}

/** 文本按显示算有几行（空文本算 1 行；末尾那个换行也算出一行，与编辑器的口径一致） */
export function lineCountOfText(text: string): number {
	return countBreaks(text) + 1;
}

/** token 流按显示算有几行；口径与 `lineCountOfText` 完全一致 */
export function lineCountOfTokens(tokens: readonly JsonToken[]): number {
	return tokens.reduce((total, token) => total + countBreaks(token.text), 1);
}

/** 行号槽的文本：`1\n2\n…\ncount`（右对齐交给 CSS，不补零 —— 补了反而看不出真实行数） */
export function lineNumbers(count: number): string {
	const lines: string[] = [];
	for (let value = 1; value <= count; value += 1) lines.push(String(value));
	return lines.join('\n');
}
