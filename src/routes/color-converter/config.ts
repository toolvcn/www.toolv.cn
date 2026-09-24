// 颜色转换的**可配置参数**：示例色、对比度卡的预设背景与初始自定义色、WCAG 四档阈值。
// 要调这一页的行为（换初始色、改达标线），改这里就够了 —— 不必去 core/ 与 ui/ 里翻。
//
// 边界（免得这个文件越长越杂，也免得下一个人不知道某样东西该不该放进来）：
//   - 只放**业务数值与开关**。颜色类型（`Rgb` / `Hsl` / `WcagCheck`）在 `core/types.ts`、
//     界面文案在各 `ui/` 组件、样式在 `ui/styles.ts`、比值的两位小数在 `core/color.ts` 的
//     `formatRatio` —— 都不进这里。
//   - 界面里的「≥ 4.5」这类提示**文案留在 ui、数字从这里拼**：改达标线不会再出现
//     「判定变了、提示没变」。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找；
// 与 STRUCTURE §1「逻辑进 core/」的偏离是有意的，理由是「让人一眼看到去哪改」。

import type { Rgb } from './core/types.ts';

// ---------------------------------------------------------------- 示例与预设背景

/** 页面初始示例色：blue-600，与站点主色呼应 */
export const EXAMPLE_INPUT = '#2563eb';

/** 对比度卡的预设背景（白 / 黑） */
export const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };

/**
 * 自定义背景的初始值：gray-800，深色示例一眼有区分度。
 * 色板的兜底值、输入框的 placeholder、非法输入时的提示句都引用它。
 */
export const DEFAULT_CUSTOM_BG = '#1f2937';

// ---------------------------------------------------------------- WCAG 四档阈值

/**
 * WCAG 2.x 的四档对比度下限（大字 = ≥18pt 约 24px，或 ≥14pt 粗体）。
 * 判定的唯一真值在 `core/color.ts` 的 `wcagPass`，对比度卡的徽章提示也从这里拼。
 */
export const WCAG_THRESHOLDS = {
	aaNormal: 4.5,
	aaLarge: 3,
	aaaNormal: 7,
	aaaLarge: 4.5
};
