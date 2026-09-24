// CSV ↔ JSON 纯函数的单测：解析器、序列化、类型推断、两个方向的转换与错误路径。
import { describe, expect, it } from 'vitest';
import { csvToJson, inferValue, jsonToCsv, normalizeHeaders, parseCsv, toCsv } from './csv.ts';
import type { CsvToJsonOptions, JsonToCsvOptions } from './types.ts';

const csvOpts = (overrides: Partial<CsvToJsonOptions> = {}): CsvToJsonOptions => ({
	delimiter: ',',
	headerRow: true,
	inferTypes: true,
	...overrides
});

const jsonOpts = (overrides: Partial<JsonToCsvOptions> = {}): JsonToCsvOptions => ({
	delimiter: ',',
	writeHeader: true,
	...overrides
});

describe('parseCsv', () => {
	it('基础拆分：逗号分隔、\r\n 与 \n 都算换行', () => {
		expect(parseCsv('a,b\nc,d', ',')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
		expect(parseCsv('a,b\r\nc,d', ',')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('引号字段：内嵌逗号、换行、双引号转义', () => {
		expect(parseCsv('"a,b",c', ',')).toEqual([['a,b', 'c']]);
		expect(parseCsv('"a\nb",c', ',')).toEqual([['a\nb', 'c']]);
		expect(parseCsv('"a""b",c', ',')).toEqual([['a"b', 'c']]);
	});

	it('尾随换行不产生空行，中间全空行保留（转换层过滤）', () => {
		expect(parseCsv('a,b\n', ',')).toEqual([['a', 'b']]);
		expect(parseCsv('a,b\n\nc,d', ',')).toEqual([['a', 'b'], [''], ['c', 'd']]);
	});

	it('自定义分隔符：分号、Tab、竖线', () => {
		expect(parseCsv('a;b', ';')).toEqual([['a', 'b']]);
		expect(parseCsv('a\tb', '\t')).toEqual([['a', 'b']]);
		expect(parseCsv('a|b', '|')).toEqual([['a', 'b']]);
	});

	it('引号字段里放分隔符不会被拆开', () => {
		expect(parseCsv('"a;b";c', ';')).toEqual([['a;b', 'c']]);
	});

	it('空输入返回空数组', () => {
		expect(parseCsv('', ',')).toEqual([]);
	});

	it('空字段保留：",a" 与 ""', () => {
		expect(parseCsv(',a', ',')).toEqual([['', 'a']]);
		expect(parseCsv('"",a', ',')).toEqual([['', 'a']]);
	});
});

describe('toCsv', () => {
	it('含分隔符 / 引号 / 换行的字段自动加引号并转义', () => {
		expect(toCsv([['a', 'b,c']], ',')).toBe('a,"b,c"');
		expect(toCsv([['a"b']], ',')).toBe('"a""b"');
		expect(toCsv([['a\nb']], ',')).toBe('"a\nb"');
	});

	it('普通字段不加引号，行尾 \\r\\n', () => {
		expect(
			toCsv(
				[
					['a', 'b'],
					['c', 'd']
				],
				','
			)
		).toBe('a,b\r\nc,d');
	});
});

describe('inferValue', () => {
	it('数字：整数与小数，拒绝前导零与科学计数法', () => {
		expect(inferValue('42')).toBe(42);
		expect(inferValue('-3.5')).toBe(-3.5);
		expect(inferValue('007')).toBe('007');
		expect(inferValue('1e5')).toBe('1e5');
	});

	it('布尔与 null 字面量；空串保持空串', () => {
		expect(inferValue('true')).toBe(true);
		expect(inferValue('false')).toBe(false);
		expect(inferValue('null')).toBeNull();
		expect(inferValue('')).toBe('');
	});

	it('其余一律原样字符串', () => {
		expect(inferValue('NaN')).toBe('NaN');
		expect(inferValue('无情')).toBe('无情');
		expect(inferValue(' 42 ')).toBe(' 42 ');
	});
});

describe('normalizeHeaders', () => {
	it('空表头补 colN，重复表头加序号', () => {
		expect(normalizeHeaders(['name', '', 'name'])).toEqual(['name', 'col2', 'name_2']);
		expect(normalizeHeaders(['', ''])).toEqual(['col1', 'col2']);
	});
});

describe('csvToJson', () => {
	it('有表头：每行变对象，值推断生效', () => {
		const result = csvToJson('id,name,active\n1,无情,true', csvOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(JSON.parse(result.text)).toEqual([{ id: 1, name: '无情', active: true }]);
		expect(result.rows).toBe(1);
		expect(result.columns).toBe(3);
	});

	it('关闭推断：全部保持字符串', () => {
		const result = csvToJson('id,name\n1,x', csvOpts({ inferTypes: false }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(JSON.parse(result.text)).toEqual([{ id: '1', name: 'x' }]);
	});

	it('无表头：输出二维数组，短行右侧补空', () => {
		const result = csvToJson('a,b\nc', csvOpts({ headerRow: false }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(JSON.parse(result.text)).toEqual([
			['a', 'b'],
			['c', '']
		]);
	});

	it('引号字段与内嵌换行被正确解析进对象', () => {
		const result = csvToJson('name,notes\n无情,"多行\n备注"', csvOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(JSON.parse(result.text)).toEqual([{ name: '无情', notes: '多行\n备注' }]);
	});

	it('跳过全空行；空表头与重复表头不丢列', () => {
		const result = csvToJson('name,,name\n无情,1,2', csvOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(JSON.parse(result.text)).toEqual([{ name: '无情', col2: 1, name_2: 2 }]);
	});

	it('空输入返回空结果', () => {
		const result = csvToJson('   \n', csvOpts());
		expect(result).toEqual({ ok: true, text: '', rows: 0, columns: 0 });
	});
});

describe('jsonToCsv', () => {
	it('对象数组：键并集当列、缺键留空、带表头', () => {
		const result = jsonToCsv('[{"name":"a","x":1},{"name":"b"}]', jsonOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.text).toBe('name,x\r\na,1\r\nb,');
		expect(result.rows).toBe(2);
		expect(result.columns).toBe(2);
	});

	it('不写表头：只输出数据行', () => {
		const result = jsonToCsv('[{"a":1},{"a":2}]', jsonOpts({ writeHeader: false }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.text).toBe('1\r\n2');
	});

	it('对象 / 数组值转 JSON 文本，null 与 undefined 留空', () => {
		const result = jsonToCsv('[{"a":{"b":1},"c":[1,2],"d":null}]', jsonOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.text).toBe('a,c,d\r\n"{""b"":1}","[1,2]",');
	});

	it('二维数组：按行转，writeHeader 不适用', () => {
		const result = jsonToCsv('[[1,2],[3,4]]', jsonOpts());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.text).toBe('1,2\r\n3,4');
	});

	it('JSON 解析失败带行列', () => {
		const result = jsonToCsv('{\n  bad', jsonOpts());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/第 2 行/);
	});

	it('非数组输入报错并说明要求', () => {
		expect(jsonToCsv('{"a":1}', jsonOpts()).ok).toBe(false);
		expect(jsonToCsv('[1,2]', jsonOpts()).ok).toBe(false);
		expect(jsonToCsv('[{"a":1},[2]]', jsonOpts()).ok).toBe(false);
	});

	it('空输入返回空结果', () => {
		expect(jsonToCsv('', jsonOpts())).toEqual({ ok: true, text: '', rows: 0, columns: 0 });
	});
});

describe('往返转换', () => {
	it('CSV → JSON → CSV 保留字段内容（含特殊字符）', () => {
		const csv = 'name,notes,active\r\n无情,"含,逗号与""引号""",true\r\nbob,"多行\n备注",false';
		const mid = csvToJson(csv, csvOpts());
		expect(mid.ok).toBe(true);
		if (!mid.ok) return;
		const back = jsonToCsv(mid.text, jsonOpts());
		expect(back.ok).toBe(true);
		if (!back.ok) return;
		// 值推断把 true/false 变回布尔 → 序列化回相同字面量
		expect(back.text).toBe(csv);
	});
});
