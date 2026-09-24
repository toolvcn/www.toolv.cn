// 查询参数的纯函数：URL 文本 ↔ 参数行双向转换。不依赖 DOM，可单测。
//
// 这里刻意**不用 URL 对象**：`new URL()` 会顺手规范化（补斜杠、转义路径里的字符），
// 用户看到的 URL 会悄悄变样。所以只做「切出查询串 → URLSearchParams → 拼回去」，
// 前缀与 `#fragment` 原样保留。
//
// 两个方向都用 URLSearchParams，口径因此自洽：`+` 与空格互相转换、重复键保留顺序。
// 已知的副作用：手写的 `%20` 在第一次经参数表写回后会变成 `+`（两者等价，见单测）。

/** 参与拼装的一行；`enabled === false` 的行不写进 URL（缺省视为启用） */
export interface ParamInput {
	name: string;
	value: string;
	enabled?: boolean;
}

/** 把 URL 切成「查询串之前 / 查询串 / `#fragment`」三段 */
function splitQuery(url: string): { head: string; query: string; tail: string } {
	const hashAt = url.indexOf('#');
	const tail = hashAt === -1 ? '' : url.slice(hashAt);
	const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
	const questionAt = beforeHash.indexOf('?');
	if (questionAt === -1) return { head: beforeHash, query: '', tail };
	return { head: beforeHash.slice(0, questionAt), query: beforeHash.slice(questionAt + 1), tail };
}

/**
 * 解析 URL 里的查询参数，**保留原始顺序与重复键**（`?a=1&a=2` 就是两行）。
 * 没有 `=` 的片段按「值为空字符串」处理，与 URLSearchParams 一致。
 */
export function parseParams(url: string): { name: string; value: string }[] {
	const { query } = splitQuery(url);
	if (query === '') return [];
	return [...new URLSearchParams(query).entries()].map(([name, value]) => ({ name, value }));
}

/**
 * 用给定的行重建 URL 的查询串：启用且键名非空的行按顺序写回，其余丢弃；
 * 一行都不剩时连 `?` 一起去掉。`#fragment` 始终留在最后。
 */
export function applyParams(url: string, rows: readonly ParamInput[]): string {
	const { head, tail } = splitQuery(url);
	const search = new URLSearchParams();
	for (const row of rows) {
		if (row.enabled === false) continue;
		const name = row.name.trim();
		if (name === '') continue;
		search.append(name, row.value);
	}
	const query = search.toString();
	return query === '' ? `${head}${tail}` : `${head}?${query}${tail}`;
}
