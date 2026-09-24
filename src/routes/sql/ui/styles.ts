// SQL 工具独有的 UI 样式常量。
// 版式常量（TAB_TOOLBAR / FOOTER_BAR / OUTPUT_EMPTY / PANEL_HINT 等）是全站共用的，
// 已提升到 `$lib/ui/styles.ts`；这里只留两样本工具独有的东西：SQL 高亮配色与编辑器镜像层的排版。
//
// 建这个文件的门槛（STRUCTURE §0 硬约束 2）：下面几条都在本目录里重复 2 处以上 ——
// 高亮配色被编辑器镜像层与 README 里的色表两处引用、EDITOR_TYPE 被输入层与镜像层共用。

import type { SqlTokenKind } from '../core/highlight.ts';

/**
 * SQL 高亮的七档配色，沿用 UI-STYLE §14 的六档色（白底全部 ≥4.5:1，深色主题由 layout.css 自动换档）：
 * 关键字紫、字符串绿、数字琥珀、函数蓝、其余中性。
 *
 * 注释与标点**都落在 gray-500**（白底 4.83:1）—— 想再浅一档到 gray-400 就会低于 4.5:1，
 * 那是 axe 会报的正文对比度问题，注释再「次要」也是正文。两者的区分靠斜体。
 * 注释的斜体在等宽字体里不改变字符宽度，所以镜像层与输入层仍然逐字对齐。
 */
export const SQL_TOKEN_CLASS: Record<SqlTokenKind, string> = {
	keyword: 'text-violet-700',
	string: 'text-emerald-700',
	comment: 'text-gray-500 italic',
	number: 'text-amber-700',
	function: 'text-blue-700',
	punct: 'text-gray-500',
	plain: 'text-gray-900'
};

/**
 * 编辑区与镜像层的共用排版。两层必须**逐字对齐**（字体、字号、行高、内边距、断行规则、
 * 滚动条占位），差一点高亮就会整片飘走。
 * `[scrollbar-gutter:stable]` 让两层同时预留（或同时不预留）滚动条宽度。
 * 内边距 8px：两层共用这一条，改一处两边同步；与 `EditorBox` 框内其它编辑层同档。
 * 外框在 `$lib/components/EditorBox`（边框 / 底色 / 聚焦转蓝），这里只管编辑器内部排版。
 */
export const EDITOR_TYPE =
	'w-full p-2 font-mono text-xs leading-5 break-words break-all whitespace-pre-wrap [scrollbar-gutter:stable] sm:text-sm sm:leading-6';

/** 真正的输入层：文字透明，看到的字来自镜像层；光标与选区仍然可见 */
export const EDITOR_INPUT =
	EDITOR_TYPE +
	' relative h-full resize-none bg-transparent text-transparent caret-gray-900 placeholder:text-gray-500 focus:outline-none';

/** 只读镜像层：同样的排版，只负责上色。里面放的 `CodeView` 不带 class（排版靠继承） */
export const EDITOR_MIRROR = EDITOR_TYPE + ' pointer-events-none absolute inset-0 overflow-hidden text-gray-900';
