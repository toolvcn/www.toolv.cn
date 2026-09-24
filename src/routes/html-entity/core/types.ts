// HTML 实体编解码的类型与常量。

/** 编码范围：仅 HTML 必需字符 / 常用符号也转 / 所有非 ASCII 一并转 */
export type EncodeScope = 'required' | 'symbols' | 'nonAscii';

/** 实体形式：命名实体优先 / 一律十进制数字实体 */
export type EncodeStyle = 'named' | 'numeric';

/** 页面方向：文本 → 实体 / 实体 → 文本 */
export type EntityDirection = 'encode' | 'decode';

/** 首屏示例：一段同时包含必需字符、常见符号与非 ASCII 文本的 HTML 片段 */
export const EXAMPLE_TEXT = '<a href="/search?q=微工具&page=2" title="搜索"结果">搜索 "微工具" © 2026…</a>';
