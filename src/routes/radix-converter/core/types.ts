// 进制转换工具的类型与常量。

/** 支持的输入进制 */
export type SourceBase = 2 | 8 | 10 | 16 | 36;

/** 展示的进制顺序（输入进制本身也在这里，改输入会实时刷新） */
export const OUTPUT_BASES: SourceBase[] = [2, 8, 10, 16, 36];

/** 输入进制选项：下拉用 */
export const SOURCE_BASES: SourceBase[] = [2, 8, 10, 16, 36];

/** 各进制的展示名 */
export const BASE_LABEL: Record<SourceBase, string> = {
	2: '二进制',
	8: '八进制',
	10: '十进制',
	16: '十六进制',
	36: '三十六进制'
};

/** 解析/格式化统一的位数表，0-35 个字符 */
export const RADIX_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
