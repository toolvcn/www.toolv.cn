// 速查表的通用形状与筛选：七张新表（端口 / 请求头 / User-Agent / 特殊符号 / Android 权限 /
// 世界区号 / 历史朝代）长得一样 —— 一眼表头 + 若干行字符串 + 一个搜索框，所以只写一份渲染组件
// （`ui/ReferenceTable.svelte`），每张表各自只提供一个纯数据模块（`core/<topic>.ts`）。
//
// MIME 与 ASCII 两张老表**不改**：它们各有专属的展示形态（前者的扩展名徽章 + 双向搜索、
// 后者的字符预览块 + 转义写法），硬套进通用表只会把两边的长处都磨掉。

/** 七张通用速查表的 id */
export type ReferenceTableId =
	'ports' | 'http-headers' | 'user-agents' | 'symbols' | 'android-permissions' | 'calling-codes' | 'dynasties';

/**
 * 一张速查表。
 * 行是**字符串数组**而不是对象：表里全是静态短文本，用元组写起来一眼能对齐，
 * 加一行不会带一堆 `note:` / `value:` 键名（那是给会变的业务数据用的）。
 */
export interface ReferenceTable {
	id: ReferenceTableId;
	/** 标签条与面板标题上的名字 */
	label: string;
	/** 面板标题右侧的一句口径说明 */
	hint: string;
	/** 搜索框的 placeholder：写几个「搜了会命中」的样例 */
	searchHint: string;
	/** 表头；每行的字段顺序与它严格一致 */
	columns: readonly string[];
	/** 行数据：字符串数组，长度必须等于 columns.length */
	rows: readonly (readonly string[])[];
}

/** 把一行拼成一句用于搜索的文本：列之间塞一个空格，避免跨列连成假命中 */
function rowText(row: readonly string[]): string {
	return row.join(' ').toLowerCase();
}

/**
 * 按关键词筛行：大小写不敏感的子串匹配，空格分隔的多个词**全部命中**才算（AND）。
 * 只影响渲染，不动源数据 —— 与 MIME / ASCII 两张老表同一个口径。
 */
export function filterReferenceRows(table: ReferenceTable, query: string): readonly (readonly string[])[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return table.rows;
	return table.rows.filter((row) => {
		const text = rowText(row);
		return terms.every((term) => text.includes(term));
	});
}

/** 结构校验：给单测用的最小检查，返回问题列表（空数组 = 没问题） */
export function validateReferenceTable(table: ReferenceTable): string[] {
	const problems: string[] = [];
	if (table.columns.length === 0) problems.push(`${table.id} 没有表头`);
	if (table.rows.length === 0) problems.push(`${table.id} 没有数据行`);

	const width = table.columns.length;
	const badWidth = table.rows
		.map((row, index) => (row.length === width ? '' : `${index + 1} 行有 ${row.length} 列（应为 ${width}）`))
		.filter(Boolean);
	if (badWidth.length > 0) problems.push(`${table.id} 列数对不上的行：${badWidth.join('、')}`);

	// 只判真正的空串：符号表里可能有「本身就是空白字符」的值（可见记号那几条），不该被当成缺数据
	const emptyCells = table.rows.flatMap((row, index) => (row.some((cell) => cell === '') ? [`${index + 1} 行`] : []));
	if (emptyCells.length > 0) problems.push(`${table.id} 有空单元格的行：${emptyCells.join('、')}`);

	// 第一列是「查什么」的键，重复了说明数据抄重了
	const keys = table.rows.map((row) => row[0]);
	const duplicated = keys.filter((key, index) => keys.indexOf(key) !== index);
	if (duplicated.length > 0) problems.push(`${table.id} 第一列有重复：${[...new Set(duplicated)].join('、')}`);

	return problems;
}
