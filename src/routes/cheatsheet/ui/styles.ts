// 编码速查表专属的样式常量：两张表（MIME / ASCII）的条目形态各写一次，故收在这里
// （STRUCTURE §0 门槛第 2 条）。
//
// 搜索条（`SEARCH_ROW` / `SEARCH_INPUT`）原先也在这里，已上提到 `$lib/ui/styles.ts` ——
// 同一串在 cheatsheet / http / morse / 命令速查 / dns 五处各写一份，属跨工具共用。

/** 分组标题（「图片（10）」这类） */
export const GROUP_TITLE = 'px-4 pt-3 pb-1 text-xs font-semibold text-gray-600';

/** 条目行主文本（MIME 串 / 十六进制） */
export const CELL_MAIN = 'truncate font-mono text-xs text-gray-900';

/** 条目行副文本（用途说明） */
export const CELL_NOTE = 'truncate text-[11px] leading-4 text-gray-600';

/** 字符预览块：等宽居中；控制字符放三字母缩写（NUL / DEL），故字号取 xs 才不溢出 */
export const CHAR_BOX =
	'flex size-7 shrink-0 items-center justify-center rounded bg-gray-100 font-mono text-xs text-gray-900';
