// Base64 工具独有的 UI 样式常量。
// 版式常量（TOOLBAR / TOOLBAR_GROUP / TOOLBAR_LABEL / SEG_BTN / FOOTER_BAR /
// TAB_BAR / TAB_BTN / INPUT_TEXTAREA / OUTPUT_TEXTAREA / OUTPUT_EMPTY / PANEL_HINT 等）是全站
// 工具共用的，已提升到 `$lib/ui/styles.ts`，这里只留本工具独有的开关与缩略图。

/** URL-safe 复选框标签的两种态：选中蓝边蓝底，未选灰描边 */
export const TOGGLE_OFF =
	'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors';
export const TOGGLE_ON =
	'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors';

/** 缩略图容器：盒子常驻 h-20，有图没图高度一样 */
export const THUMB_BOX =
	'flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2';
