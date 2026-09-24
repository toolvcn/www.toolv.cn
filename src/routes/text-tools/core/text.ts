// 文本统计 & 清理的纯函数：全部一次性遍历，不碰 DOM，node 环境可直接单测。

/** 统计口径（对齐主流「字数统计」工具的习惯）：
 *  - 字符数按 Unicode 码点数（emoji 算 1 个，不是 2 个 UTF-16 码元）
 *  - 字数 = 中文汉字 + 英文单词 + 数字串（连续数字算 1 个）
 *  - 行数按换行切分；段落数按空行（只含空白的行）分块 */
export interface TextStats {
	/** 字符数（Unicode 码点） */
	chars: number;
	/** 非空白字符 */
	charsNoSpace: number;
	/** 字数（汉字 + 英文单词 + 数字串） */
	words: number;
	/** 中文汉字数 */
	cjk: number;
	/** 英文单词数 */
	latinWords: number;
	/** 数字串数 */
	digitRuns: number;
	/** 行数 */
	lines: number;
	/** 非空行数 */
	nonEmptyLines: number;
	/** 段落数 */
	paragraphs: number;
	/** UTF-8 字节数 */
	bytes: number;
}

/** 空文本的统计结果（避免 UI 端写分支） */
export const EMPTY_STATS: TextStats = {
	chars: 0,
	charsNoSpace: 0,
	words: 0,
	cjk: 0,
	latinWords: 0,
	digitRuns: 0,
	lines: 0,
	nonEmptyLines: 0,
	paragraphs: 0,
	bytes: 0
};

/** 文本统计。空文本返回全 0 */
export function countTextStats(text: string): TextStats {
	if (text === '') return EMPTY_STATS;
	const chars = [...text].length;
	const charsNoSpace = [...text.replace(/\s/g, '')].length;
	const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
	const latinWords = (text.match(/[A-Za-z]+/g) ?? []).length;
	const digitRuns = (text.match(/\d+/g) ?? []).length;
	const lines = text.split(/\r\n|\r|\n/);
	const nonEmptyLines = lines.filter((line) => line.trim() !== '').length;
	const paragraphs = text
		.split(/\r\n|\r|\n/)
		.join('\n')
		.split(/\n\s*\n/)
		.filter((block) => block.trim() !== '').length;
	return {
		chars,
		charsNoSpace,
		words: cjk + latinWords + digitRuns,
		cjk,
		latinWords,
		digitRuns,
		lines: lines.length,
		nonEmptyLines,
		paragraphs,
		bytes: utf8Bytes(text)
	};
}

/** UTF-8 字节数。TextEncoder 在 node 与浏览器都是全局，无需条件引入 */
export function utf8Bytes(text: string): number {
	return new TextEncoder().encode(text).length;
}

/** 清理选项。sort 用码点比较（localeCompare 跨平台结果不稳定，单测没法断言） */
export interface CleanOptions {
	/** 每行去掉首尾空白 */
	trimLines: boolean;
	/** 删除空行 */
	removeEmpty: boolean;
	/** 连续空行合并为一行（与删除空行互斥，删除优先） */
	collapseEmpty: boolean;
	/** 删除重复行，保留首次出现 */
	unique: boolean;
	/** 按行排序：不排 / 升序 / 降序 */
	sort: 'none' | 'asc' | 'desc';
	/** 反转行序 */
	reverse: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
	trimLines: false,
	removeEmpty: false,
	collapseEmpty: false,
	unique: false,
	sort: 'none',
	reverse: false
};

/** 按选项流水线清理文本。顺序：trim → 删空行 / 合并空行 → 去重 → 排序 → 反转 */
export function cleanText(text: string, options: CleanOptions): string {
	if (text === '') return '';
	let lines = text.split(/\r\n|\r|\n/);

	if (options.trimLines) lines = lines.map((line) => line.trim());

	if (options.removeEmpty) {
		lines = lines.filter((line) => line.trim() !== '');
	} else if (options.collapseEmpty) {
		const collapsed: string[] = [];
		let prevBlank = false;
		for (const line of lines) {
			const blank = line.trim() === '';
			if (blank && prevBlank) continue;
			collapsed.push(line);
			prevBlank = blank;
		}
		lines = collapsed;
	}

	if (options.unique) lines = [...new Set(lines)];

	if (options.sort !== 'none') {
		const order = options.sort === 'asc' ? 1 : -1;
		lines = [...lines].sort((a, b) => (a < b ? -order : a > b ? order : 0));
	}

	if (options.reverse) lines = [...lines].reverse();

	return lines.join('\n');
}
