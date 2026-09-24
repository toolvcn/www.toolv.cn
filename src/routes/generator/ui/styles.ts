// 随机生成器的 UI 样式常量。Button / Dropdown / Checkbox / Input 等公共组件在 $lib/ui，
// 工具条与版式常量在 $lib/ui/styles.ts，结果行的行骨架在 $lib/components/ResultRow。
// 这里只剩结果文本本身（三个面板共用）。

/** 结果文本：等宽、可断行（行骨架用 <ResultRow>，见 $lib/components/ResultRow） */
export const RESULT_TEXT = 'min-w-0 flex-1 font-mono text-sm break-all text-gray-900';
