// 预设 CSV 的单测：导出→导入能原样回来、结果列与参数列各就各位、坏文件逐类拒掉。
// 跟 presets.test.ts 同一路数 —— 只测纯函数，下载与文件选择在 ui 层，不在这里。
import { describe, expect, it } from 'vitest';
import { buildPresetCsv, parsePresetCsv } from './csv.ts';
import { EXAMPLE_INPUTS, UNIT_EXAMPLE_INPUTS, UNIT_EMPTY_INPUTS } from '../config.ts';
import type { RoiPresetFile } from './presets.ts';

/** 一条整盘预设（示例参数） */
function batchPreset(name = '示例盘'): RoiPresetFile {
	return {
		name,
		mode: 'batch',
		inputs: { ...EXAMPLE_INPUTS },
		unitInputs: { ...UNIT_EXAMPLE_INPUTS },
		targetMargin: '20'
	};
}

/** 一条单件预设 */
function unitPreset(name = '示例款'): RoiPresetFile {
	return { ...batchPreset(name), mode: 'unit' };
}

/** CSV 文本 → 行（去掉 BOM，按 \r\n 切） */
function records(text: string): string[][] {
	return text
		.replace(/^\uFEFF/, '')
		.split('\r\n')
		.filter((line) => line !== '')
		.map((line) => line.split(','));
}

/** 表头 → 列号 */
function columnIndex(header: string[]): Map<string, number> {
	const map = new Map<string, number>();
	header.forEach((name, i) => map.set(name, i));
	return map;
}

const FALLBACK = { inputs: { ...EXAMPLE_INPUTS }, unitInputs: { ...UNIT_EMPTY_INPUTS } };

describe('预设 CSV 导出', () => {
	it('一行一条预设，表头带参数列与结果列', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset('A'), batchPreset('B')]));
		expect(rows).toHaveLength(3);
		const header = rows[0]!;
		expect(header[0]).toBe('名称');
		expect(header).toContain('广告填法');
		expect(header).toContain('保本 ROAS');
		expect(header).toContain('净利润（元）');
		expect(header).toContain('净货品成本（元）');
		expect(rows[1]![0]).toBe('A');
		expect(rows[2]![0]).toBe('B');
	});

	it('结果列是算出来的数（示例盘保本 ROAS 3.93、净利 615.49）', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset()]));
		const at = columnIndex(rows[0]!);
		const value = (name: string): string => rows[1]![at.get(name)!]!;
		expect(value('保本 ROAS')).toBe('3.93');
		expect(value('净利润（元）')).toBe('615.49');
		expect(value('广告费（元）')).toBe('1165.00');
		expect(value('广告 ROAS')).toBe('6.00');
	});

	it('参数列回显用户填的原始值，并另给一列说明填法', () => {
		const rows = records(
			buildPresetCsv('batch', [{ ...batchPreset(), inputs: { ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' } }])
		);
		const at = columnIndex(rows[0]!);
		expect(rows[1]![at.get('广告（按填法）')!]).toBe('6');
		expect(rows[1]![at.get('广告填法')!]).toBe('按 ROAS');
		// 换算后的元数在结果列里另有一份
		expect(rows[1]![at.get('广告费（元）')!]).toBe('1165.00');
	});

	it('单件口径的表里没有广告列，有「每件利润」', () => {
		const rows = records(buildPresetCsv('unit', [unitPreset()]));
		const header = rows[0]!;
		expect(header).not.toContain('广告费（元）');
		expect(header).toContain('每件利润（元）');
		expect(rows[1]![columnIndex(header).get('每件利润（元）')!]).toBe('17.77');
	});

	it('参数解析不过时那一行只留参数，结果列留空（不写 NaN / undefined）', () => {
		const broken: RoiPresetFile = { ...batchPreset(), inputs: { ...EXAMPLE_INPUTS, gmv: '六千九' } };
		const rows = records(buildPresetCsv('batch', [broken]));
		const at = columnIndex(rows[0]!);
		expect(rows[1]![at.get('客单价（元/单）')!]).toBe('');
		expect(rows[1]![at.get('名称')!]).toBe('示例盘');
	});
});

describe('预设 CSV 导入', () => {
	it('导出再导入能原样回来（参数与填法都不丢）', () => {
		const source = batchPreset('成本率五成的盘');
		const parsed = parsePresetCsv('batch', buildPresetCsv('batch', [source]), FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets).toHaveLength(1);
		expect(parsed.presets[0]!.name).toBe('成本率五成的盘');
		expect(parsed.presets[0]!.inputs).toEqual(source.inputs);
		expect(parsed.presets[0]!.targetMargin).toBe('20');
	});

	it('另一套口径沿用传入的当前输入（跟保存预设存两套同一个理由）', () => {
		const parsed = parsePresetCsv('batch', buildPresetCsv('batch', [batchPreset()]), FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]!.unitInputs).toEqual(FALLBACK.unitInputs);
	});

	it('结果列改过也不影响导入（那是算出来的）', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset()]));
		const at = columnIndex(rows[0]!);
		rows[1]![at.get('净利润（元）')!] = '99999';
		const parsed = parsePresetCsv('batch', '﻿' + rows.map((r) => r.join(',')).join('\r\n') + '\r\n', FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]!.inputs.gmv).toBe(EXAMPLE_INPUTS.gmv);
	});

	it('没有「名称」列时按行号补名字', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset()]));
		const at = columnIndex(rows[0]!);
		const withoutName = rows.map((row) => row.filter((_, i) => i !== at.get('名称')!));
		const parsed = parsePresetCsv('batch', withoutName.map((r) => r.join(',')).join('\r\n'), FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]!.name).toBe('导入预设 1');
	});

	it('认不出来的填法值整份拒绝（不静默回落）', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset()]));
		const at = columnIndex(rows[0]!);
		rows[1]![at.get('广告填法')!] = '按心情';
		const parsed = parsePresetCsv('batch', rows.map((r) => r.join(',')).join('\r\n'), FALLBACK);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('广告填法');
		expect(parsed.error).toContain('按花费 / 按 ROAS');
	});

	it('参数列填了非数字整份拒绝', () => {
		const rows = records(buildPresetCsv('batch', [batchPreset()]));
		const at = columnIndex(rows[0]!);
		rows[1]![at.get('成交额（元）')!] = '六千九百九十';
		const parsed = parsePresetCsv('batch', rows.map((r) => r.join(',')).join('\r\n'), FALLBACK);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('第 1 行');
	});

	it('表头里一个本工具的列名都没有时拒绝', () => {
		const parsed = parsePresetCsv('batch', '编号,备注\r\n1,随便一份表\r\n', FALLBACK);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('表头');
	});

	it('只有表头没有数据行时拒绝', () => {
		const parsed = parsePresetCsv('batch', buildPresetCsv('batch', []), FALLBACK);
		expect(parsed.ok).toBe(false);
	});

	it('单件口径按单件的列读（不含广告列）', () => {
		const parsed = parsePresetCsv('unit', buildPresetCsv('unit', [unitPreset('一款货')]), FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]!.unitInputs.price).toBe(UNIT_EXAMPLE_INPUTS.price);
		expect(parsed.presets[0]!.inputs).toEqual(FALLBACK.inputs);
	});

	it('引号里带逗号的名称能原样回来（Excel 会给字段加引号）', () => {
		// 必须用**半角**逗号：它是 CSV 的分隔符，导出时得用引号包起来；
		// 中文全角「，」不是分隔符、不需要引号 —— 拿全角测这条会永远失败
		const text = buildPresetCsv('batch', [batchPreset('春夏款,含运费')]);
		// 这一行不能用 records() 按逗号切 —— 引号里的逗号不是分隔符
		const lines = text.replace(/^\uFEFF/, '').split('\r\n');
		expect(lines[1]!.startsWith('"春夏款,含运费"')).toBe(true);
		const parsed = parsePresetCsv('batch', text, FALLBACK);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]!.name).toBe('春夏款,含运费');
	});
});
