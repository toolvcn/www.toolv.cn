// 参数预设 ↔ CSV 的纯函数：导出（一行一条预设，列 = 参数 + 结果 + 利润明细）与导入（只回填参数）。
// 不碰 DOM、不读 store，node 环境可直接单测。
//
// **宽表而不是长表**：这份文件的用途是**横向对比** —— 存了几套参数，要摆在一起看
// 「哪一套保本线更低、净利更厚」。宽表里一条预设就是一行，结果列能直接排序 / 拉图表；
// 长表（一列一项）要对比就得先在 Excel 里透视一次，那一步不该由用户来做。
//
// **一次只导一种口径**：整盘问「成交额 + 订单数 + 广告费」、单件问「售价 + 单件成本」，
// 参数集合不一样，混在一张表里有半数列是空的 —— 所以导出 / 导入前由用户在预设面板头部的
// 下拉里选口径（`RoiMode`），导出的也只含该口径的预设。
//
// **导入只认参数列**：结果列是算出来的，写回去没有意义（改了也不影响计算），
// 而且用户很可能已经在 Excel 里动过那些单元格。另一套口径的输入沿用**当前**那一组 ——
// 跟「保存预设」一次存两套同一个理由（见 `core/presets.ts`）。
//
// **参数列回显用户填的原始值**（按 ROAS 填广告就写「6」），并附一列「广告填法」说明它是什么；
// 换算后的元 / 倍数在**结果列**里另有一份 —— 对比看结果、回填看参数，两边都不用猜。
import { formatMoney, formatTimes } from './format.ts';
import { parseInputs, parseUnitInputs } from './parse.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_TARGET_MARGIN, EMPTY_INPUTS, UNIT_EMPTY_INPUTS } from '../config.ts';
import type { RoiInputs, RoiMetrics, RoiMode, RoiTextInputs, UnitTextInputs } from './types.ts';
import type { RoiPresetFile } from './presets.ts';

// ---------------------------------------------------------------- 一组列定义

/** 一条预设算出来的东西：解析后的数值输入 + 指标；参数算不出结果时两个都是 null */
interface Ctx {
	preset: RoiPresetFile;
	inputs: RoiInputs | null;
	metrics: RoiMetrics | null;
}

/**
 * 一列的回填规则。**没有 `back` 的列是结果列**，导入时整列忽略。
 *
 * `text` / `mode` 的 `field` 是当前口径输入里的键（如 `adCost` / `price`），
 * 两种口径各认各的（`shipCost` 两边同名但单位不同，由导入时选的口径决定写进哪一套）。
 */
type Back =
	| { kind: 'name' }
	| { kind: 'text'; field: string }
	| { kind: 'bool' }
	/** `values`：CSV 里的写法 → 存储值 */
	| { kind: 'mode'; field: string; values: Readonly<Record<string, string>> }
	| { kind: 'margin' };

interface Column {
	/** 表头 */
	header: string;
	/** 导出：这个单元格写什么 */
	cell: (ctx: Ctx) => string;
	/** 导入：这个单元格回填到哪；省略即结果列 */
	back?: Back;
}

/**
 * 四种填法在 CSV 里的写法（导出写值、导入认值同一份）。
 *
 * 用字**故意不与页面上那几枚按钮逐字一致**：页面上的按钮是「花费 ⇄ / 单数 ⇄ / 比例 ⇄」这种
 * 贴字段名的短标签（见 InputPanel 的 `MODE_SWAP_BTN`，连字段名一起读才完整），
 * 而 CSV 是独立存下来的文件 —— 行与行之间没有字段名可依，值必须自己读得懂，
 * 所以这里保留「按花费 / 按 ROAS」这种带介词的完整说法。
 * 反过来说，这几个字符串一旦写进用户导出的文件就**不能再改**：导入是按文本认值的，
 * 认不出就整份拒绝，改一次会把已有的 CSV 全废掉（见各列的 `back`）。
 */
const MODE_LABEL = {
	ad: { cost: '按花费', roas: '按 ROAS' },
	orders: { count: '按单数', aov: '按客单价' },
	cost: { rate: '按比例', unit: '按金额' },
	refund: { rate: '按比例', amount: '按金额' }
} as const;

// ---------------------------------------------------------------- 取值助手

const money = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? '' : formatMoney(v));
const times = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? '' : formatTimes(v));
/** 百分数写成数字（`8.8`），表头里带（%）—— Excel 里能直接排序，又不至于看错量级 */
const percent = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? '' : (v * 100).toFixed(1));
const count = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? '' : v.toFixed(2));
const raw = (text: string): string => text.trim();
const yesNo = (flag: boolean): string => (flag ? '是' : '否');

/** 一条预设的指标：参数解析不过就两个 null（那一行只有参数列有值） */
function contextOf(mode: RoiMode, preset: RoiPresetFile): Ctx {
	const parsed = mode === 'batch' ? parseInputs(preset.inputs) : parseUnitInputs(preset.unitInputs);
	if (!parsed.ok) return { preset, inputs: null, metrics: null };
	return { preset, inputs: parsed.inputs, metrics: computeMetrics(parsed.inputs) };
}

// ---------------------------------------------------------------- 整盘口径的列

const BATCH_COLUMNS: readonly Column[] = [
	// ---- 参数（原值 + 填法）----
	{ header: '名称', cell: (c) => c.preset.name, back: { kind: 'name' } },
	{
		header: '广告（按填法）',
		cell: (c) => raw(c.preset.inputs.adCost),
		back: { kind: 'text', field: 'adCost' }
	},
	{
		header: '广告填法',
		cell: (c) => MODE_LABEL.ad[c.preset.inputs.adMode],
		back: { kind: 'mode', field: 'adMode', values: MODE_LABEL.ad }
	},
	{ header: '成交额（元）', cell: (c) => raw(c.preset.inputs.gmv), back: { kind: 'text', field: 'gmv' } },
	{
		header: '订单数（按填法）',
		cell: (c) => raw(c.preset.inputs.orders),
		back: { kind: 'text', field: 'orders' }
	},
	{
		header: '订单数填法',
		cell: (c) => MODE_LABEL.orders[c.preset.inputs.ordersMode],
		back: { kind: 'mode', field: 'ordersMode', values: MODE_LABEL.orders }
	},
	{
		header: '商品成本（按填法）',
		cell: (c) => raw(c.preset.inputs.costRate),
		back: { kind: 'text', field: 'costRate' }
	},
	{
		header: '商品成本填法',
		cell: (c) => MODE_LABEL.cost[c.preset.inputs.costMode],
		back: { kind: 'mode', field: 'costMode', values: MODE_LABEL.cost }
	},
	{
		header: '平台佣金率（%）',
		cell: (c) => raw(c.preset.inputs.commissionRate),
		back: { kind: 'text', field: 'commissionRate' }
	},
	{
		header: '单均发货成本（元/单）',
		cell: (c) => raw(c.preset.inputs.shipCost),
		back: { kind: 'text', field: 'shipCost' }
	},
	{
		header: '其他固定成本（元）',
		cell: (c) => raw(c.preset.inputs.otherCost),
		back: { kind: 'text', field: 'otherCost' }
	},
	{
		header: '退款填法',
		cell: (c) => MODE_LABEL.refund[c.preset.inputs.refundMode],
		back: { kind: 'mode', field: 'refundMode', values: MODE_LABEL.refund }
	},
	{
		header: '未发货退款（按填法）',
		cell: (c) => raw(c.preset.inputs.unshippedRefundRate),
		back: { kind: 'text', field: 'unshippedRefundRate' }
	},
	{
		header: '已发货退款（按填法）',
		cell: (c) => raw(c.preset.inputs.shippedRefundRate),
		back: { kind: 'text', field: 'shippedRefundRate' }
	},
	{
		header: '其中在途退款（按填法）',
		cell: (c) => raw(c.preset.inputs.inTransitRefundRate),
		back: { kind: 'text', field: 'inTransitRefundRate' }
	},
	{
		header: '退货能收回的货款（%）',
		cell: (c) => raw(c.preset.inputs.recoverRate),
		back: { kind: 'text', field: 'recoverRate' }
	},
	{
		header: '单均退货成本（元/单）',
		cell: (c) => raw(c.preset.inputs.returnShipCost),
		back: { kind: 'text', field: 'returnShipCost' }
	},
	{
		header: '退款退还佣金',
		cell: (c) => yesNo(c.preset.inputs.commissionRefunded),
		back: { kind: 'bool' }
	},
	{
		header: '目标净利率（%）',
		cell: (c) => raw(c.preset.targetMargin),
		back: { kind: 'margin' }
	},

	// ---- 结果（换算后，可直接横向比）----
	{ header: '订单数（单）', cell: (c) => count(c.inputs?.orders) },
	{ header: '客单价（元/单）', cell: (c) => money(c.metrics?.aov) },
	{ header: '广告费（元）', cell: (c) => money(c.inputs?.adCost) },
	{ header: '广告 ROAS', cell: (c) => times(c.metrics?.adRoas) },
	{ header: '扣退货 ROAS', cell: (c) => times(c.metrics?.netRoas) },
	{ header: '广告 ROI（%）', cell: (c) => percent(c.metrics?.adRoi) },
	{ header: '生意 ROI（%）', cell: (c) => percent(c.metrics?.businessRoi) },
	{ header: '保本 ROAS', cell: (c) => times(c.metrics?.breakEvenRoas) },
	{ header: '广告费上限（元）', cell: (c) => money(c.metrics?.maxAdCost) },
	{ header: '净收入（元）', cell: (c) => money(c.metrics?.netRevenue) },
	{ header: '净利润（元）', cell: (c) => money(c.metrics?.netProfit) },
	{ header: '净利率（对成交额，%）', cell: (c) => percent(c.metrics?.netMarginOnGmv) },
	{ header: '商品成本率（%）', cell: (c) => percent(c.inputs?.costRate) },
	{ header: '退款总额（元）', cell: (c) => money(c.metrics?.returnedAmount) },
	{ header: '退货真损失（元）', cell: (c) => money(c.metrics?.returnLoss) },

	// ---- 利润明细（逐层扣到净利的那几行，跟结果卡 ③ 段同一套）----
	{ header: '净货品成本（元）', cell: (c) => money(c.metrics?.netGoodsCost) },
	{ header: '平台佣金（元）', cell: (c) => money(c.metrics?.commission) },
	{ header: '正向物流（元）', cell: (c) => money(c.metrics?.forwardShipping) },
	{ header: '逆向物流（元）', cell: (c) => money(c.metrics?.reverseShipping) },
	{ header: '能收回的货值（元）', cell: (c) => money(c.metrics?.recoveredGoodsValue) },
	{ header: '残损货值（元）', cell: (c) => money(c.metrics?.damagedGoodsCost) }
];

// ---------------------------------------------------------------- 单件口径的列

const UNIT_COLUMNS: readonly Column[] = [
	{ header: '名称', cell: (c) => c.preset.name, back: { kind: 'name' } },
	{
		header: '售价（元/件）',
		cell: (c) => raw(c.preset.unitInputs.price),
		back: { kind: 'text', field: 'price' }
	},
	{
		header: '单件成本（元/件）',
		cell: (c) => raw(c.preset.unitInputs.unitCost),
		back: { kind: 'text', field: 'unitCost' }
	},
	{
		header: '单件发货成本（元/件）',
		cell: (c) => raw(c.preset.unitInputs.shipCost),
		back: { kind: 'text', field: 'shipCost' }
	},
	{
		header: '平台佣金率（%）',
		cell: (c) => raw(c.preset.unitInputs.commissionRate),
		back: { kind: 'text', field: 'commissionRate' }
	},
	{
		header: '退款填法',
		cell: (c) => MODE_LABEL.refund[c.preset.unitInputs.refundMode],
		back: { kind: 'mode', field: 'refundMode', values: MODE_LABEL.refund }
	},
	{
		header: '未发货退款（按填法）',
		cell: (c) => raw(c.preset.unitInputs.unshippedRefundRate),
		back: { kind: 'text', field: 'unshippedRefundRate' }
	},
	{
		header: '已发货退款（按填法）',
		cell: (c) => raw(c.preset.unitInputs.shippedRefundRate),
		back: { kind: 'text', field: 'shippedRefundRate' }
	},
	{
		header: '其中在途退款（按填法）',
		cell: (c) => raw(c.preset.unitInputs.inTransitRefundRate),
		back: { kind: 'text', field: 'inTransitRefundRate' }
	},
	{
		header: '退货能收回的货款（%）',
		cell: (c) => raw(c.preset.unitInputs.recoverRate),
		back: { kind: 'text', field: 'recoverRate' }
	},
	{
		header: '单件退货成本（元/件）',
		cell: (c) => raw(c.preset.unitInputs.returnShipCost),
		back: { kind: 'text', field: 'returnShipCost' }
	},
	{
		header: '退款退还佣金',
		cell: (c) => yesNo(c.preset.unitInputs.commissionRefunded),
		back: { kind: 'bool' }
	},
	{
		header: '目标净利率（%）',
		cell: (c) => raw(c.preset.targetMargin),
		back: { kind: 'margin' }
	},

	// ---- 结果 ----
	{ header: '保本 ROAS', cell: (c) => times(c.metrics?.breakEvenRoas) },
	{ header: '每件利润（元）', cell: (c) => money(c.metrics?.contributionProfit) },
	{ header: '每件利润占售价（%）', cell: (c) => percent(c.metrics?.contributionMargin) },
	{ header: '商品毛利率（%）', cell: (c) => percent(c.metrics?.grossMargin) },
	{ header: '退货修正毛利率（%）', cell: (c) => percent(c.metrics?.returnAdjustedMargin) },
	{ header: '成本率（%）', cell: (c) => percent(c.inputs?.costRate) },
	{ header: '净收入（元/件）', cell: (c) => money(c.metrics?.netRevenue) },
	{ header: '退款金额（元/件）', cell: (c) => money(c.metrics?.returnedAmount) },
	{ header: '退货真损失（元）', cell: (c) => money(c.metrics?.returnLoss) },

	// ---- 利润明细 ----
	{ header: '净货品成本（元）', cell: (c) => money(c.metrics?.netGoodsCost) },
	{ header: '平台佣金（元）', cell: (c) => money(c.metrics?.commission) },
	{ header: '正向物流（元）', cell: (c) => money(c.metrics?.forwardShipping) },
	{ header: '逆向物流（元）', cell: (c) => money(c.metrics?.reverseShipping) },
	{ header: '能收回的货值（元）', cell: (c) => money(c.metrics?.recoveredGoodsValue) },
	{ header: '残损货值（元）', cell: (c) => money(c.metrics?.damagedGoodsCost) }
];

// ---------------------------------------------------------------- 序列化

/** 单元格里有分隔符、引号或换行才加引号；内部引号双写 */
function quote(field: string): string {
	return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/** 行尾统一 `\r\n`；**带 BOM** —— Excel 靠它认 UTF-8，否则中文表头全是乱码 */
export function toPresetCsv(rows: readonly string[][]): string {
	return '﻿' + rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

/** 一组预设 → CSV 文本。列按 `mode` 取（整盘 / 单件两套列） */
export function buildPresetCsv(mode: RoiMode, presets: readonly RoiPresetFile[]): string {
	const columns = mode === 'batch' ? BATCH_COLUMNS : UNIT_COLUMNS;
	const rows: string[][] = [columns.map((column) => column.header)];
	for (const preset of presets) {
		const ctx = contextOf(mode, preset);
		rows.push(columns.map((column) => column.cell(ctx)));
	}
	return toPresetCsv(rows);
}

// ---------------------------------------------------------------- 解析

/**
 * CSV 文本 → 记录数组（只认逗号，支持引号包裹与 `""` 转义）。
 *
 * **够用就行**：这份文件的列由本工具自己写（`parseCsv` 那份完整的 RFC 4180 状态机在
 * csv-json 里，带分隔符选项），这里不需要「一行里混着分号与 Tab」那种宽容度 ——
 * Excel 存出来的 CSV 顶多是「全字段加引号」与一个 BOM，两种都处理了。
 */
function parseRecords(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let started = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
					continue;
				}
				inQuotes = false;
				continue;
			}
			field += ch;
			continue;
		}
		if (ch === '"' && field === '') {
			inQuotes = true;
			started = true;
			continue;
		}
		if (ch === ',') {
			row.push(field);
			field = '';
			started = true;
			continue;
		}
		if (ch === '\r' || ch === '\n') {
			if (ch === '\r' && text[i + 1] === '\n') i += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			started = false;
			continue;
		}
		field += ch;
		started = true;
	}
	if (started || field !== '') {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/** 数字文本：允许空串、千分位与负号；其余（含「abc」「12.」）都不算数 */
function isNumberText(value: string): boolean {
	if (value === '') return true;
	return /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, ''));
}

/**
 * CSV 文本 → 一组预设（只回填参数列）。
 *
 * `fallback` 是**另一套口径**的当前输入：导入整盘时单件那套沿用当前值，反之同理
 * （跟「保存预设」一次存两套同一个理由）。当前口径那套从空盘起填，
 * 缺哪一列就是空 —— 不做「缺了就沿用当前值」，那样一份只有三列的 CSV 会混进无关的数。
 *
 * 任一行的任一格认不出来就**整份拒绝**（跟预设 JSON 的导入同一个口径）：
 * 半套参数比没有更麻烦，它会让人以为自己算的是导进去的那组数。
 */
export function parsePresetCsv(
	mode: RoiMode,
	text: string,
	fallback: { inputs: RoiTextInputs; unitInputs: UnitTextInputs }
): { ok: true; presets: RoiPresetFile[] } | { ok: false; error: string } {
	const body = text.replace(/^\uFEFF/, '');
	const records = parseRecords(body).filter((row) => row.some((field) => field.trim() !== ''));
	if (records.length === 0) return { ok: false, error: '文件是空的' };
	if (records.length === 1) return { ok: false, error: '文件里只有表头，没有数据行' };

	const header = records[0]!.map((field) => field.trim());
	const columns = mode === 'batch' ? BATCH_COLUMNS : UNIT_COLUMNS;
	const byHeader = new Map<string, Column>();
	for (const column of columns) byHeader.set(column.header, column);
	const slot = new Map<Column, number>();
	header.forEach((name, i) => {
		const column = byHeader.get(name);
		if (column !== undefined && !slot.has(column)) slot.set(column, i);
	});
	if (slot.size === 0) {
		return {
			ok: false,
			error: `表头里没有可识别的列名（${mode === 'batch' ? '整盘' : '单件'}口径至少要有「名称」或任一参数列）`
		};
	}
	const nameIndex = header.indexOf('名称');

	const presets: RoiPresetFile[] = [];
	for (let r = 1; r < records.length; r += 1) {
		const row = records[r]!;
		const line = `第 ${r} 行`;
		const name = (nameIndex >= 0 ? (row[nameIndex] ?? '') : '').trim() || `导入预设 ${r}`;
		// 当前口径这套从**空盘**起填：缺哪一列就是空，不做「缺了就沿用当前值」——
		// 那样一份只有三列的 CSV 会混进无关的数。
		// 走 `Object.assign` 而不是展开：接口没有隐式索引签名，
		// `{ ...EMPTY_INPUTS }` 直接赋给 `Record<string, …>` 过不了类型检查。
		const draft: Record<string, string | boolean> = {};
		Object.assign(draft, mode === 'batch' ? EMPTY_INPUTS : UNIT_EMPTY_INPUTS);
		let targetMargin = DEFAULT_TARGET_MARGIN;

		for (const [column, index] of slot) {
			const back = column.back;
			if (back === undefined || back.kind === 'name') continue;
			const value = (row[index] ?? '').trim();

			if (back.kind === 'text') {
				if (!isNumberText(value)) {
					return { ok: false, error: `${line}「${column.header}」不是数字：${value}` };
				}
				// 按列名赋值：列是动态的（两种口径两套列名），只能走键。
				// 键来自上面那两张列定义表，字段名与 `RoiTextInputs` / `UnitTextInputs` 对齐。
				draft[back.field!] = value;
				continue;
			}
			if (back.kind === 'margin') {
				if (!isNumberText(value)) {
					return { ok: false, error: `${line}「${column.header}」不是数字：${value}` };
				}
				targetMargin = value === '' ? DEFAULT_TARGET_MARGIN : value;
				continue;
			}
			if (back.kind === 'bool') {
				if (value === '') continue;
				if (value === '是' || value === 'true') draft.commissionRefunded = true;
				else if (value === '否' || value === 'false') draft.commissionRefunded = false;
				else return { ok: false, error: `${line}「${column.header}」应填「是」或「否」：${value}` };
				continue;
			}
			// mode：`values` 是「存储值 → CSV 里的写法」，所以这里是**反查写法的那一端**。
			// 认不出来就报，不静默回落 —— 回落会让「按 ROAS 填的 6」被当成 6 元
			if (value === '') continue;
			const matched = Object.entries(back.values).find(([, text]) => text === value);
			if (matched === undefined) {
				const allowed = Object.values(back.values).join(' / ');
				return { ok: false, error: `${line}「${column.header}」应填 ${allowed}：${value}` };
			}
			draft[back.field] = matched[0];
		}

		presets.push({
			name,
			mode,
			inputs: mode === 'batch' ? (draft as unknown as RoiTextInputs) : { ...fallback.inputs },
			unitInputs: mode === 'unit' ? (draft as unknown as UnitTextInputs) : { ...fallback.unitInputs },
			targetMargin
		});
	}
	return { ok: true, presets };
}
