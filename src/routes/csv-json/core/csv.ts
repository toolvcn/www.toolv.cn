// CSV ↔ JSON 的纯函数：RFC 4180 状态机解析 / 序列化、两个方向的转换。
// 不碰 DOM、不读 UI 状态，node 环境可直接单测。
import { describeParseError, isPlainObject } from '$lib/utils/json';
import type { ConvertResult, CsvToJsonOptions, Delimiter, JsonToCsvOptions } from './types.ts';

/**
 * RFC 4180 状态机解析：引号字段里可以放分隔符、换行，"" 转义成一个引号。
 * 宽松处理引号后的垃圾字符（RFC 未定义，按普通字符拼进字段）；
 * 尾随换行不产生空行，中间的全空行交给调用方（csvToJson 会过滤）。
 */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	// 引号字段即使在引号结束后没有任何内容（如 "a",""），也要算一个字段；
	// 用「本行是否已开始」区分尾随的空行
	let rowStarted = false;

	let i = 0;
	while (i < text.length) {
		const ch = text[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += ch;
			rowStarted = true;
			i++;
			continue;
		}
		if (ch === '"' && field === '') {
			inQuotes = true;
			rowStarted = true;
			i++;
			continue;
		}
		if (ch === delimiter) {
			row.push(field);
			field = '';
			rowStarted = true;
			i++;
			continue;
		}
		if (ch === '\r' || ch === '\n') {
			// \r\n 算一个换行；引号字段内的换行走上面 inQuotes 分支，不会到这里
			if (ch === '\r' && text[i + 1] === '\n') i += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			rowStarted = false;
			i++;
			continue;
		}
		field += ch;
		rowStarted = true;
		i++;
	}
	// 收尾：换行结尾不再补一行，有残留字段才算
	if (rowStarted || field !== '') {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/** 字段里出现分隔符、引号或换行时必须加引号包起来 */
function needsQuote(field: string, delimiter: Delimiter): boolean {
	return field.includes(delimiter) || field.includes('"') || /[\r\n]/.test(field);
}

/** 序列化成 RFC 4180 风格的 CSV：需要时加引号，内部引号双写；行尾统一 \r\n */
export function toCsv(rows: string[][], delimiter: Delimiter): string {
	return rows
		.map((row) =>
			row.map((field) => (needsQuote(field, delimiter) ? `"${field.replace(/"/g, '""')}"` : field)).join(delimiter)
		)
		.join('\r\n');
}

/**
 * 值类型推断（对齐主流工具的习惯）：
 * - '42'、'-3.5' → 数字；'007'、'1e5' 有歧义，保持字符串
 * - 'true' / 'false' / 'null' → 对应字面量；空串保持空串（比 null 忠实）
 */
export function inferValue(raw: string): string | number | boolean | null {
	if (raw === 'null') return null;
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(raw)) return Number(raw);
	return raw;
}

/** 生成不重复的表头：空表头补 colN，重复的加 _2、_3 后缀 */
export function normalizeHeaders(raw: string[]): string[] {
	const used = new Set<string>();
	return raw.map((name, i) => {
		let key = name.trim() === '' ? `col${i + 1}` : name.trim();
		let suffix = 2;
		while (used.has(key)) {
			key = `${name.trim() === '' ? `col${i + 1}` : name.trim()}_${suffix}`;
			suffix += 1;
		}
		used.add(key);
		return key;
	});
}

/** CSV 文本 → JSON 数组（对象数组或二维数组，随 headerRow 选项） */
export function csvToJson(text: string, options: CsvToJsonOptions): ConvertResult {
	if (text.trim() === '') return { ok: true, text: '', rows: 0, columns: 0 };

	// 全空行（所有字段都空）跳过：Excel 复制出来的尾随换行、模板空行都会带
	const rows = parseCsv(text, options.delimiter).filter((row) => !row.every((f) => f === ''));
	if (rows.length === 0) return { ok: true, text: '', rows: 0, columns: 0 };

	const convert = (raw: string) => (options.inferTypes ? inferValue(raw) : raw);

	if (options.headerRow) {
		const headers = normalizeHeaders(rows[0]!);
		const dataRows = rows.slice(1);
		const objects = dataRows.map((row) => {
			const obj: Record<string, unknown> = {};
			for (const [i, header] of headers.entries()) obj[header] = convert(row[i] ?? '');
			return obj;
		});
		return {
			ok: true,
			text: JSON.stringify(objects, null, '\t'),
			rows: objects.length,
			columns: headers.length
		};
	}

	// 无表头：按二维数组输出，列数取最宽的一行，短行右侧补空
	const width = Math.max(...rows.map((row) => row.length));
	const arrays = rows.map((row) => Array.from({ length: width }, (_, i) => convert(row[i] ?? '')));
	return { ok: true, text: JSON.stringify(arrays, null, '\t'), rows: arrays.length, columns: width };
}

/** 单元格字符串化：对象 / 数组转 JSON 文本，null 与缺键留空，其余 String() */
function stringifyCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/** JSON 数组 → CSV 文本。接受对象数组（键并集当列）或二维数组 */
export function jsonToCsv(text: string, options: JsonToCsvOptions): ConvertResult {
	if (text.trim() === '') return { ok: true, text: '', rows: 0, columns: 0 };

	let root: unknown;
	try {
		root = JSON.parse(text);
	} catch (error) {
		return { ok: false, error: describeParseError(text, error as Error) };
	}

	if (!Array.isArray(root) || root.length === 0) {
		return { ok: false, error: '需要非空数组：如 [{ "id": 1 }] 或 [[1, 2], [3, 4]]' };
	}

	// 二维数组：直接按行转，writeHeader 不适用
	if (root.every(Array.isArray)) {
		const rows = (root as unknown[][]).map((row) => row.map(stringifyCell));
		const columns = Math.max(...rows.map((row) => row.length));
		return { ok: true, text: toCsv(rows, options.delimiter), rows: rows.length, columns };
	}

	// 对象数组：所有键按首次出现顺序并集当列，缺键留空
	if (root.every(isPlainObject)) {
		const objects = root as Array<Record<string, unknown>>;
		const columns: string[] = [];
		const seen = new Set<string>();
		for (const obj of objects) {
			for (const key of Object.keys(obj)) {
				if (!seen.has(key)) {
					seen.add(key);
					columns.push(key);
				}
			}
		}
		const rows: string[][] = [];
		if (options.writeHeader) rows.push(columns);
		for (const obj of objects) rows.push(columns.map((key) => stringifyCell(obj[key])));
		return { ok: true, text: toCsv(rows, options.delimiter), rows: objects.length, columns: columns.length };
	}

	return { ok: false, error: '元素类型混杂：需要全部是对象或全部是数组的数组' };
}
