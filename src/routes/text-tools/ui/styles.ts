// 文本工具的 UI 样式常量。Button / Dropdown / Checkbox 等公共组件在 $lib/ui。
// 编辑区已改用 $lib/ui/styles 的 INPUT_TEXTAREA / OUTPUT_TEXTAREA，这里只留面板正文的滚动策略。

/** 面板内容区：桌面端吃掉卡片剩余高度并自己滚动，手机端自然撑开 */
export const PANEL_BODY_SCROLL = 'min-h-0 flex-1 overflow-y-auto';
