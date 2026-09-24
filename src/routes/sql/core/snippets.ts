// 自定义 SQL 片段的序列化 / 校验纯函数：localStorage 落盘与恢复共用同一份解析。不依赖 DOM，可单测。
// 导入 / 恢复的 id 由 store 重新分配，这里统一给 0（即 `SnippetEntry`）。
//
// 与参数预设（`$lib/utils/command-cheatsheet` 那套）**刻意分开两份**：
// 预设存的是「一组变量值」（键值快照，形状固定、小），片段存的是「用户写的整段 SQL」（长文本）。
// 两者的字段、上限与校验口径都不同，合成一个 parse 会让两边都变得难读。
import { MAX_SNIPPETS, MAX_SNIPPET_NAME } from '../config.ts';

/** 一条自定义 SQL 片段；`id` 只用于列表渲染的 key，不进存储 */
export interface SqlSnippet {
	id: number;
	name: string;
	sql: string;
}

/** 落盘 / 导出时的形状：没有运行期的 id */
export type SnippetEntry = Omit<SqlSnippet, 'id'>;

export type ParseSnippetsResult = { ok: true; snippets: SnippetEntry[] } | { ok: false; error: string };

/**
 * 名称留空时的兜底：用 SQL 的第一行非空内容（注释行也算），太长截断。
 * 比「未命名片段 1」强的地方在于——用户自己一眼认得出那是哪段。
 */
export function fallbackSnippetName(sql: string): string {
	const firstLine = sql
		.split('\n')
		.map((line) => line.trim())
		.find((line) => line !== '');
	if (firstLine === undefined) return '未命名片段';
	return firstLine.length <= MAX_SNIPPET_NAME ? firstLine : `${firstLine.slice(0, MAX_SNIPPET_NAME - 1)}…`;
}

/** 落盘 / 导出文本：id 是运行期序号，不进存储 */
export function serializeSnippets(list: readonly SqlSnippet[]): string {
	return JSON.stringify(
		list.map(({ name, sql }) => ({ name, sql })),
		null,
		2
	);
}

/**
 * 解析落盘 / 导入文本。逐条校验，任一条不合法即整体失败（不给用户半套数据 —— 与 http 预设、
 * regex 存档同一口径）。名称缺失或为空时用 SQL 首行兜底，不算坏数据。
 */
export function parseSnippets(text: string): ParseSnippetsResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: '内容不是合法的 JSON' };
	}
	if (!Array.isArray(raw)) return { ok: false, error: '内容应为数组' };

	const out: SnippetEntry[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) return { ok: false, error: '存在非对象的片段条目' };
		const entry = item as Partial<SnippetEntry>;
		if (typeof entry.sql !== 'string' || entry.sql.trim() === '') {
			return { ok: false, error: '存在没有内容的片段条目' };
		}
		const named = typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : '';
		const name = (named === '' ? fallbackSnippetName(entry.sql) : named).slice(0, MAX_SNIPPET_NAME);
		out.push({ name, sql: entry.sql });
	}
	return { ok: true, snippets: out.slice(0, MAX_SNIPPETS) };
}
