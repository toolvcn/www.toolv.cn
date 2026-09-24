// SQL 词法高亮：把一段 SQL 切成「关键字 / 字符串 / 注释 / 数字 / 函数 / 标点 / 其他」七类片段，
// 交给共享的 `$lib/components/CodeView` 上色（配色在 `ui/styles.ts`）。
//
// **刻意只做词法、不做语法分析**：本页要的是「读起来清楚」，不是「报错」。
// 「缺 FROM」「括号不配对」这类结构告警属于语义层，不在本轮（见 README 的「暂不支持」）。
//
// 三条硬约束：
//   1. **无损**：`tokens.map(t => t.text).join('') === 输入`。高亮只改颜色，不改一个字符 ——
//      否则用户从编辑器里复制出去的东西与屏幕上看到的不是同一段（这条有单测兜）。
//   2. **只依赖字符串**：不碰 DOM、不读全局，node 环境直接可测。
//   3. **超长输入降级**：超过 `MAX_HIGHLIGHT_CHARS` 整段当一个 plain 片段返回 ——
//      粘一整个 dump 进来时，逐 token 生成 `<span>` 会把页面卡死。
//
// 覆盖的边界：单引号串（`''` 双写与反斜杠两种转义）、双引号 / 反引号标识符、
// `--` 行注释、**可嵌套**的 `/* */` 块注释、小数与 `.5` / `0x1F` / 指数、`$1` 参数位、
// `::`、`->>`、`||`、`%` 等运算符、大小写不敏感的关键字、后跟 `(` 的标识符判为函数名。

import { MAX_HIGHLIGHT_CHARS } from '../config.ts';

export type SqlTokenKind = 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'punct' | 'plain';

/** 高亮的最小单元；渲染时按 kind 映射成 Tailwind 颜色类 */
export interface SqlToken {
	/** 片段原文 */
	text: string;
	kind: SqlTokenKind;
}

/**
 * 关键字表（大小写不敏感）。收的是**标准 SQL 的核心词 + 各库通用扩展**，
 * 不按方言细分：同一个词在 MySQL / Postgres 里大概率都是关键字，细分只会让这张表难以维护。
 */
const KEYWORDS = new Set([
	// 查询
	'SELECT',
	'FROM',
	'WHERE',
	'GROUP',
	'BY',
	'HAVING',
	'ORDER',
	'LIMIT',
	'OFFSET',
	'FETCH',
	'FIRST',
	'NEXT',
	'ROWS',
	'ONLY',
	'DISTINCT',
	'ALL',
	'AS',
	'UNION',
	'INTERSECT',
	'EXCEPT',
	'WITH',
	'RECURSIVE',
	'LATERAL',
	'WINDOW',
	'OVER',
	'PARTITION',
	'FILTER',
	'INTO',
	'RETURNING',
	'VALUES',
	'DEFAULT',
	// 连接
	'JOIN',
	'INNER',
	'LEFT',
	'RIGHT',
	'FULL',
	'OUTER',
	'CROSS',
	'USING',
	'ON',
	'NATURAL',
	// 谓词与运算
	'AND',
	'OR',
	'NOT',
	'IN',
	'BETWEEN',
	'LIKE',
	'ILIKE',
	'SIMILAR',
	'IS',
	'NULL',
	'EXISTS',
	'ANY',
	'SOME',
	'TRUE',
	'FALSE',
	'CASE',
	'WHEN',
	'THEN',
	'ELSE',
	'END',
	'CAST',
	'ESCAPE',
	// 写入
	'INSERT',
	'UPDATE',
	'DELETE',
	'MERGE',
	'SET',
	'CONFLICT',
	'DUPLICATE',
	'IGNORE',
	'REPLACE',
	'TRUNCATE',
	'UPSERT',
	// 结构（DDL）
	'CREATE',
	'ALTER',
	'DROP',
	'RENAME',
	'ADD',
	'COLUMN',
	'CONSTRAINT',
	'PRIMARY',
	'FOREIGN',
	'UNIQUE',
	'CHECK',
	'REFERENCES',
	'CASCADE',
	'RESTRICT',
	'INDEX',
	'CONCURRENTLY',
	'TABLE',
	'VIEW',
	'MATERIALIZED',
	'SEQUENCE',
	'SCHEMA',
	'DATABASE',
	'EXTENSION',
	'COMMENT',
	'IF',
	'TYPE',
	'TEMP',
	'TEMPORARY',
	'EXPLAIN',
	'ANALYZE',
	'VERBOSE',
	'VACUUM',
	'OPTIMIZE',
	'GRANT',
	'REVOKE',
	'TO',
	'SHOW',
	'DESC',
	'DESCRIBE',
	'USE',
	// 事务与锁
	'BEGIN',
	'START',
	'TRANSACTION',
	'COMMIT',
	'ROLLBACK',
	'SAVEPOINT',
	'RELEASE',
	'ISOLATION',
	'LEVEL',
	'READ',
	'WRITE',
	'COMMITTED',
	'UNCOMMITTED',
	'REPEATABLE',
	'SERIALIZABLE',
	'FOR',
	'UPDATE',
	'SHARE',
	'SKIP',
	'LOCKED',
	// 其他常用词
	'ASC',
	'DESC',
	'NULLS',
	'LAST',
	'INTERVAL',
	'CURRENT_DATE',
	'CURRENT_TIME',
	'CURRENT_TIMESTAMP',
	'LOCALTIME',
	'EXTRACT',
	'PRECISION',
	'VARYING',
	'CHARACTER'
]);

/** 词（标识符 / 关键字）：首字符不能是数字 */
const WORD = /[A-Za-z_][A-Za-z0-9_$]*/y;

/** 数字：十六进制、小数、`.5`，整数与小数都允许指数（`1e3` / `1.5e-3`） */
const NUMBER = /0[xX][0-9a-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;

/** 运算符与标点：长的写在前面（`->>` 要优先于 `->` 匹配） */
const OPERATOR = /->>|->|::|<>|!=|>=|<=|\|\||&&|[=<>+\-*/%,;()[\]{}.]/y;

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';
const isWordStart = (ch: string): boolean => /[A-Za-z_]/.test(ch);
const isSpace = (ch: string): boolean => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';

/** 词后面紧跟 `(` 就当成函数名（`count(` / `now(` / `coalesce(`），不看内置函数表 */
function isCall(source: string, from: number): boolean {
	let i = from;
	while (i < source.length && isSpace(source[i]!)) i++;
	return source[i] === '(';
}

export function tokenizeSql(source: string): SqlToken[] {
	if (source === '') return [];
	// 超长输入不做高亮：整段当一个 plain 片段（无损，只是没颜色）
	if (source.length > MAX_HIGHLIGHT_CHARS) return [{ text: source, kind: 'plain' }];

	const tokens: SqlToken[] = [];
	const push = (text: string, kind: SqlTokenKind): void => {
		if (text === '') return;
		const last = tokens[tokens.length - 1];
		// 相邻同类合并：空白与连续标点会各成一段，合并后 <span> 少一大截
		if (last !== undefined && last.kind === kind) last.text += text;
		else tokens.push({ text, kind });
	};

	let i = 0;
	while (i < source.length) {
		const ch = source[i]!;

		// ---- 注释
		if (ch === '-' && source[i + 1] === '-') {
			const lineEnd = source.indexOf('\n', i);
			const stop = lineEnd === -1 ? source.length : lineEnd;
			push(source.slice(i, stop), 'comment');
			i = stop;
			continue;
		}
		if (ch === '/' && source[i + 1] === '*') {
			let depth = 1;
			let j = i + 2;
			while (j < source.length && depth > 0) {
				if (source[j] === '/' && source[j + 1] === '*') {
					depth += 1;
					j += 2;
					continue;
				}
				if (source[j] === '*' && source[j + 1] === '/') {
					depth -= 1;
					j += 2;
					continue;
				}
				j += 1;
			}
			push(source.slice(i, j), 'comment');
			i = j;
			continue;
		}

		// ---- 字符串与带引号的标识符：三种引号同一套扫描
		if (ch === "'" || ch === '"' || ch === '`') {
			let j = i + 1;
			while (j < source.length) {
				const c = source[j]!;
				if (c === '\\') {
					j += 2;
					continue;
				}
				if (c === ch) {
					if (source[j + 1] === ch) {
						j += 2; // '' / "" / `` 双写是转义，不算结束
						continue;
					}
					j += 1;
					break;
				}
				j += 1;
			}
			const stop = Math.min(j, source.length);
			push(source.slice(i, stop), 'string');
			i = stop;
			// 引号没闭合时上面已把剩下的整段吃掉，不再往下扫
			continue;
		}

		// ---- 空白
		if (isSpace(ch)) {
			let j = i;
			while (j < source.length && isSpace(source[j]!)) j += 1;
			push(source.slice(i, j), 'plain');
			i = j;
			continue;
		}

		// ---- 数字
		if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1]))) {
			NUMBER.lastIndex = i;
			const match = NUMBER.exec(source);
			if (match !== null) {
				push(match[0], 'number');
				i += match[0].length;
				continue;
			}
		}

		// ---- 参数位（Postgres 的 $1 / $2）
		if (ch === '$' && isDigit(source[i + 1])) {
			let j = i + 1;
			while (j < source.length && isDigit(source[j]!)) j += 1;
			push(source.slice(i, j), 'number');
			i = j;
			continue;
		}

		// ---- 词：关键字 / 函数名 / 标识符
		if (isWordStart(ch)) {
			WORD.lastIndex = i;
			const match = WORD.exec(source);
			if (match !== null) {
				const word = match[0];
				const kind: SqlTokenKind = KEYWORDS.has(word.toUpperCase())
					? 'keyword'
					: isCall(source, i + word.length)
						? 'function'
						: 'plain';
				push(word, kind);
				i += word.length;
				continue;
			}
		}

		// ---- 运算符与标点
		OPERATOR.lastIndex = i;
		const op = OPERATOR.exec(source);
		if (op !== null) {
			push(op[0], 'punct');
			i += op[0].length;
			continue;
		}

		// ---- 兜底：认不出来的单个字符原样归 plain（保证无损）
		push(ch, 'plain');
		i += 1;
	}

	return tokens;
}
