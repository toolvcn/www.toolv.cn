// 摩斯密码工具的类型与页面常量。
// 码表本身是领域数据（跟单位换算的单位表同理），放在 morse.ts；这里只放类型与首屏示例。

/** 点划与分隔符的当前设置（四个都能自定义） */
export interface MorseSymbols {
	/** 点，默认 `.` */
	dot: string;
	/** 划，默认 `-` */
	dash: string;
	/** 字母之间的分隔，默认单个空格；空串表示「没有字母分隔」，解码时整个词走自动分词 */
	letterSep: string;
	/** 词之间的分隔，默认 ` / ` */
	wordSep: string;
}

/** 默认符号：与国际惯例一致（`.` `-` 空格 `/`） */
export const DEFAULT_SYMBOLS: MorseSymbols = {
	dot: '.',
	dash: '-',
	letterSep: ' ',
	wordSep: ' / '
};

/** 页面方向：文本 → 摩斯 / 摩斯 → 文本 */
export type MorseDirection = 'encode' | 'decode';

/** 速查表的分组（顺序即渲染顺序） */
export type MorseGroupId = 'letter' | 'digit' | 'punct';

/** 首屏示例：纯 ASCII，正好演示「字母 + 标点 + 数字 + 词分隔」四种码 */
export const EXAMPLE_TEXT = 'SOS HELLO WORLD, 2026!';
