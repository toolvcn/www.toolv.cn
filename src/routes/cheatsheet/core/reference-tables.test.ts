// 七张通用速查表的单测：结构完整性（每行列数、空值、键不重复）+ 每张表的锚点条目 + 筛选口径。
// 数据表最容易出的错是「抄重一行」和「少写一列」，这两类都靠 validateReferenceTable 挡住。
import { describe, expect, it } from 'vitest';
import { filterReferenceRows, validateReferenceTable, type ReferenceTable } from './reference.ts';
import { REFERENCE_TABLES, emptyQueries, referenceTable } from './tables.ts';

/** 按第一列取值，测试里的取件工具 */
function rowOf(table: ReferenceTable, key: string): readonly string[] {
	const found = table.rows.find((row) => row[0] === key);
	expect(found, `${table.id} 里没有「${key}」这一条`).toBeDefined();
	return found ?? [];
}

describe('结构完整性', () => {
	it('七张表都注册了，id 不重复', () => {
		const ids = REFERENCE_TABLES.map((table) => table.id);
		expect(ids).toHaveLength(7);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('每张表都过 validateReferenceTable（列数、空单元格、第一列重复三项）', () => {
		const problems = REFERENCE_TABLES.flatMap((table) => validateReferenceTable(table));
		expect(problems).toEqual([]);
	});

	it('每张表的规模在下限之上（防止某次误删整段数据）', () => {
		const floors: Record<string, number> = {
			ports: 60,
			'http-headers': 50,
			'user-agents': 60,
			symbols: 100,
			'android-permissions': 60,
			'calling-codes': 200,
			dynasties: 25
		};
		for (const table of REFERENCE_TABLES) {
			expect(table.rows.length, `${table.id} 行数偏少`).toBeGreaterThanOrEqual(floors[table.id] ?? 1);
		}
	});

	it('referenceTable() 能按 id 取到同一份对象，emptyQueries() 覆盖全部 id', () => {
		for (const table of REFERENCE_TABLES) {
			expect(referenceTable(table.id)).toBe(table);
			expect(emptyQueries()[table.id]).toBe('');
		}
	});
});

describe('各表的锚点条目', () => {
	it('常见端口：3306 是 MySQL、443 是 HTTPS、22 与 21 都在', () => {
		const ports = referenceTable('ports');
		expect(rowOf(ports, '3306')[1]).toBe('MySQL / MariaDB');
		expect(rowOf(ports, '443')[1]).toBe('HTTPS');
		expect(rowOf(ports, '22')[1]).toBe('SSH / SFTP');
		expect(rowOf(ports, '21')[1]).toBe('FTP 控制');
	});

	it('HTTP 请求头：Cookie / Authorization / X-Forwarded-For 的说明对得上', () => {
		const headers = referenceTable('http-headers');
		expect(rowOf(headers, 'Cookie')[1]).toContain('分号分隔');
		expect(rowOf(headers, 'Authorization')[1]).toContain('Bearer');
		expect(rowOf(headers, 'X-Forwarded-For')[1]).toContain('非标准');
		expect(rowOf(headers, 'Content-Type')[2]).toContain('application/json');
	});

	it('User-Agent：Windows NT 10.0 分不出 10/11，Chrome 与 Gecko 各归各的', () => {
		const ua = referenceTable('user-agents');
		expect(rowOf(ua, 'Windows NT 10.0')[2]).toContain('11');
		expect(rowOf(ua, 'Chrome/')[1]).toBe('浏览器');
		expect(rowOf(ua, 'Gecko/')[1]).toBe('渲染引擎');
		expect(rowOf(ua, 'Googlebot')[1]).toBe('爬虫');
	});

	it('特殊符号：码点与实体能与符号对上', () => {
		const symbols = referenceTable('symbols');
		expect(rowOf(symbols, '∞')[2]).toBe('U+221E');
		expect(rowOf(symbols, '∞')[3]).toBe('&infin;');
		expect(rowOf(symbols, '→')[3]).toBe('&rarr;');
		// 没有具名实体的给十进制数字引用，不留「无」
		expect(rowOf(symbols, '⌘')[3]).toBe('&#8984;');
	});

	it('Android 权限：保护级别分档正确', () => {
		const permissions = referenceTable('android-permissions');
		expect(rowOf(permissions, 'INTERNET')[1]).toBe('普通');
		expect(rowOf(permissions, 'CAMERA')[1]).toBe('危险');
		expect(rowOf(permissions, 'SYSTEM_ALERT_WINDOW')[1]).toBe('特殊');
		expect(rowOf(permissions, 'POST_NOTIFICATIONS')[2]).toContain('Android 13');
	});

	it('世界区号：+86 中国、+81 日本、+1 是 NANP 主区', () => {
		const codes = referenceTable('calling-codes');
		expect(rowOf(codes, '+86')[1]).toBe('中国');
		expect(rowOf(codes, '+81')[1]).toBe('日本');
		expect(rowOf(codes, '+1')[1]).toContain('NANP');
		expect(rowOf(codes, '+886')[2]).toBe('TW');
	});

	it('历史朝代：秦的起止、清的终年、朝代不重名', () => {
		const dynasties = referenceTable('dynasties');
		expect(rowOf(dynasties, '秦')[1]).toBe('前 221 – 前 206');
		expect(rowOf(dynasties, '清')[1]).toContain('1912');
		expect(rowOf(dynasties, '唐')[2]).toContain('长安');
	});
});

describe('filterReferenceRows 的筛选口径', () => {
	const ports = referenceTable('ports');

	it('空词（含只有空格）返回全部行', () => {
		expect(filterReferenceRows(ports, '')).toHaveLength(ports.rows.length);
		expect(filterReferenceRows(ports, '   ')).toHaveLength(ports.rows.length);
	});

	it('子串匹配且大小写不敏感', () => {
		expect(filterReferenceRows(ports, 'mysql')).toHaveLength(1);
		expect(filterReferenceRows(ports, 'MySQL')).toHaveLength(1);
		expect(filterReferenceRows(ports, '6379')[0]?.[1]).toBe('Redis');
	});

	it('空格分隔的多个词要全部命中（AND）', () => {
		const hit = filterReferenceRows(ports, 'tcp redis');
		expect(hit).toHaveLength(1);
		expect(hit[0]?.[0]).toBe('6379');

		// AND 只要求每个词都出现，命中的行数由数据决定：好几行的说明里都有「数据库」
		expect(filterReferenceRows(ports, 'tcp 数据库').length).toBeGreaterThan(1);
		// 换成 UDP 就只剩时间同步那一条
		expect(filterReferenceRows(ports, 'udp 时间')[0]?.[0]).toBe('123');
	});

	it('搜不到时给空数组，不是原数据', () => {
		const miss = filterReferenceRows(ports, 'zzzz');
		expect(miss).toEqual([]);
		expect(ports.rows.length).toBeGreaterThan(0);
	});

	it('筛的是渲染结果，不动源数据', () => {
		const before = ports.rows.length;
		filterReferenceRows(ports, 'mysql');
		expect(ports.rows.length).toBe(before);
	});
});
