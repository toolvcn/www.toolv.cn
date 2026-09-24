// JSON 格式化工具的类型与常量。
// 高亮的 JsonToken / JsonTokenKind 已是全站共用（$lib/utils/json），这里只引用不再自造一份。
import type { JsonToken } from '$lib/utils/json';

/** 输出模式：格式化（带缩进换行）或压缩（去掉无意义空白） */
export type JsonMode = 'format' | 'minify';

/** 格式化用的缩进；'tab' 直接给 JSON.stringify 传 '\t' */
export type IndentKind = '2' | '4' | 'tab';

/** 解析错误：老浏览器的 message 里没有位置信息，行列可能为 null */
export interface JsonError {
	message: string;
	line: number | null;
	column: number | null;
}

/** 一次转换的结果：output 与 error 互斥，tokens 是 output 的高亮分词 */
export interface JsonResult {
	output: string;
	error: JsonError | null;
	tokens: JsonToken[];
}

/**
 * 渲染 token 上限：超了只渲染前这么多，复制拿到的仍是完整内容。
 * 高亮是「一个 token 一个 <span>」，几百 KB 的 JSON 会炸出几十万节点，必须设上限。
 */
export const RENDER_TOKEN_LIMIT = 20_000;

/** 缩进选项 → JSON.stringify 的第三个参数 */
export const INDENT_VALUE: Record<IndentKind, string | number> = { '2': 2, '4': 4, tab: '\t' };
