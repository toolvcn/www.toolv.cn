// 颜色转换的 UI 样式常量。Button / Dropdown / Input 等公共组件在 $lib/ui，
// 分段按钮常量在 $lib/ui/styles.ts，这里只留色板与对比度徽章这两个工具专属串。

/** 原生色板（input[type=color]）的外观：去默认边框内边距，只留一圈细边 */
export const SWATCH =
	'h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/** 对比度四档徽章的公共外壳 */
export const BADGE = 'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium';
