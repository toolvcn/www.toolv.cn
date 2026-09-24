// 颜色转换的类型定义。全站只用 RGB 与 HSL 两种内部表示，
// HEX / rgb() / hsl() 三种字符串格式都能落到这两个表示上互转。
//
// 可配置的业务参数（示例色 / 预设背景 / WCAG 四档阈值）在**根层的 `config.ts`**，不在这里。

/** RGB 颜色：分量 0-255（整数），alpha 0-1 */
export interface Rgb {
	r: number;
	g: number;
	b: number;
	a: number;
}

/** HSL 颜色：h 0-360、s / l 0-100（百分比数值），alpha 0-1 */
export interface Hsl {
	h: number;
	s: number;
	l: number;
	a: number;
}

/** 输出列表的一行：格式标签 + 可直接复制的 CSS 字符串 */
export interface FormatRow {
	label: string;
	value: string;
}

/** WCAG 2.x 四档达标判定（四档的阈值数字在 `config.ts` 的 `WCAG_THRESHOLDS`） */
export interface WcagCheck {
	aaNormal: boolean;
	aaLarge: boolean;
	aaaNormal: boolean;
	aaaLarge: boolean;
}
