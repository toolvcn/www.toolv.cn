// 七张通用速查表的注册处：Workspace 的标签条与 ReferenceTable 组件都从这一份读。
// 加一张表 = 加一个数据模块 + 在这里注册一行（顺序即标签顺序）。
import { ANDROID_PERMISSIONS_TABLE } from './android-permissions.ts';
import { CALLING_CODES_TABLE } from './calling-codes.ts';
import { DYNASTIES_TABLE } from './dynasties.ts';
import { HTTP_HEADERS_TABLE } from './http-headers.ts';
import { PORTS_TABLE } from './ports.ts';
import type { ReferenceTable, ReferenceTableId } from './reference.ts';
import { SYMBOLS_TABLE } from './symbols.ts';
import { USER_AGENTS_TABLE } from './user-agents.ts';

/** 顺序即标签顺序：排错 → 请求 → 客户端 → 符号 → 移动 → 号码 → 历史 */
export const REFERENCE_TABLES: readonly ReferenceTable[] = [
	PORTS_TABLE,
	HTTP_HEADERS_TABLE,
	USER_AGENTS_TABLE,
	SYMBOLS_TABLE,
	ANDROID_PERMISSIONS_TABLE,
	CALLING_CODES_TABLE,
	DYNASTIES_TABLE
];

const BY_ID = new Map<ReferenceTableId, ReferenceTable>(REFERENCE_TABLES.map((table) => [table.id, table]));

/** 按 id 取表；id 来自标签条，取不到属于编程错误，直接抛 */
export function referenceTable(id: ReferenceTableId): ReferenceTable {
	const found = BY_ID.get(id);
	if (!found) throw new Error(`没有注册这张速查表：${id}`);
	return found;
}

/** 七张表的空搜索词表，store 初始化用 */
export function emptyQueries(): Record<ReferenceTableId, string> {
	const entries = REFERENCE_TABLES.map((table) => [table.id, ''] as const);
	return Object.fromEntries(entries) as Record<ReferenceTableId, string>;
}
