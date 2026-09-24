// URL 编解码工具的类型与常量。

/** 输入区的两种视图：文本（直接编解码）与参数表（分三段编辑输入串） */
export type UrlInputView = 'text' | 'params';

/** 参数表里的两段可排序列表：参数（`?` 之后的键值行）与 # 片段（`#` 之后的键值行） */
export type UrlSegment = 'query' | 'fragment';

/** 编解码方向 */
export type UrlDirection = 'encode' | 'decode';

/**
 * 编码策略：
 * - component = encodeURIComponent：连 :/?# 都转义，适合拼参数值
 * - full = encodeURI：保留 URL 结构字符，适合整条 URL 转义非法字符
 * 解码统一走 decodeURIComponent（decodeURI 会故意不解 %2F 这类，容易让人以为没解干净）。
 */
export type EncodeStrategy = 'component' | 'full';

/** 查询字符串解析出来的一行参数 */
export interface ParsedParam {
	key: string;
	value: string;
}

/** 参数表里的一行键值对（可编辑）：each 的 key 用 id，key 允许重复 */
export interface QueryParamRow {
	id: number;
	key: string;
	value: string;
}

/** 转换结果 */
export interface UrlResult {
	output: string;
	error: string;
}

/** 「示例」按钮用的编码输入 */
export const EXAMPLE_ENCODE_TEXT = 'https://www.toolv.cn/search?q=在线 微工具&lang=zh#结果';

/** 「示例」按钮用的查询串：空格、中文、缺值都要覆盖 */
export const EXAMPLE_QUERY_TEXT = 'name=微工具&tag=url%20encode&featured';
