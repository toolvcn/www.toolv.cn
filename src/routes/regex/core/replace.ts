// 文本替换的核心纯函数：把当前正则对测试文本做全局替换，并统计替换次数。
// 替换串交给 String.prototype.replace 原生处理，$1 / $<name> / $& / $` / $' 全部可用。
// 不依赖 DOM，可在 node 端单测。
import type { ReplaceResult } from './types.ts';

/** 空结果壳：非法正则时用，界面按 error 分支展示 */
const EMPTY_RESULT: ReplaceResult = { error: null, output: '', count: 0 };

/**
 * 全局替换。无论 flags 是否带 g 都强制全局（替换的语义就是「全部换掉」），
 * 保留原有 i/m/s/u/y 等修饰符；y（粘性）叠加 g 后仍按粘性语义只替换 lastIndex 处。
 */
export function replaceAll(pattern: string, flags: string, input: string, replacement: string): ReplaceResult {
	let regex: RegExp;
	try {
		regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
	} catch (error) {
		return { ...EMPTY_RESULT, error: error instanceof Error ? error.message : '正则语法错误' };
	}

	// 先数一遍替换次数：replacement 为空串时 replace 也会「换掉」匹配，
	// 但替换次数只能自己数；零宽匹配手动推进，避免 exec 原地打转。
	let count = 0;
	regex.lastIndex = 0;
	let executed: RegExpExecArray | null;
	while ((executed = regex.exec(input)) !== null) {
		count += 1;
		if (executed[0] === '') regex.lastIndex += 1;
	}

	// String.replace 会先把 lastIndex 归零再从头替换，与上面的计数循环互不干扰。
	const output = input.replace(regex, replacement);
	return { error: null, output, count };
}
