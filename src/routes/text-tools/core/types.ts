// 文本统计 & 清理的类型、选项元数据与示例。与纯逻辑放一起便于单测引用。
import type { CleanOptions, TextStats } from './text.ts';

export type { CleanOptions, TextStats };

/** 统计卡片元数据：value 从 TextStats 里取同名字段 */
export interface StatItem {
	key: keyof TextStats;
	label: string;
	/** 口径说明，放进 title 悬浮可见 */
	description: string;
}

export const STAT_ITEMS: ReadonlyArray<StatItem> = [
	{ key: 'chars', label: '字符数', description: '按 Unicode 码点计，emoji 算 1 个字符' },
	{ key: 'charsNoSpace', label: '非空白字符', description: '去掉空格、换行、Tab 等所有空白后剩下的字符' },
	{ key: 'words', label: '字数', description: '中文汉字 + 英文单词 + 数字串的总和' },
	{ key: 'cjk', label: '中文汉字', description: 'CJK 统一汉字区（U+4E00–U+9FFF）内的字符' },
	{ key: 'latinWords', label: '英文单词', description: '连续英文字母算 1 个单词' },
	{ key: 'digitRuns', label: '数字串', description: '连续数字算 1 个，如 2026 是 1 个' },
	{ key: 'lines', label: '行数', description: '按换行符切分，最后一段没换行也算 1 行' },
	{ key: 'nonEmptyLines', label: '非空行', description: '去掉空行与只含空白的行' },
	{ key: 'paragraphs', label: '段落数', description: '以空行分隔的文本块' },
	{ key: 'bytes', label: 'UTF-8 字节', description: '按 UTF-8 编码后的字节数，中文一般每字 3 字节' }
];

/** 清理选项的中文说明，渲染复选框用 */
export interface CleanItem {
	key: Exclude<keyof CleanOptions, 'sort'>;
	label: string;
	description: string;
}

export const CLEAN_ITEMS: ReadonlyArray<CleanItem> = [
	{ key: 'trimLines', label: '每行去首尾空白', description: '行首行尾的空格、Tab 一并去掉' },
	{ key: 'removeEmpty', label: '删除空行', description: '空行与只含空白的行都删掉' },
	{ key: 'collapseEmpty', label: '合并连续空行', description: '连续多个空行压成 1 个（勾了删除空行则本项不生效）' },
	{ key: 'unique', label: '删除重复行', description: '重复行只保留第一次出现' },
	{ key: 'reverse', label: '反转行序', description: '最后一行排到最前' }
];

/** 首屏示例（统计）：覆盖中英文、数字、多行多段落 */
export const EXAMPLE_STATS_INPUT = `微工具（www.toolv.cn）提供 12 个在线小工具，全部本地运行。
Every tool runs 100% in your browser, no upload.

WebSocket 调试支持多连接并行。`;

/** 首屏示例（清理）：带重复行、空行、首尾空白 */
export const EXAMPLE_CLEAN_INPUT = `  banana
apple
  banana

apple
cherry
`;
