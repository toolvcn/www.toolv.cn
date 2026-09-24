// 参数预设的序列化 / 校验纯函数：导出文本、导入文本与 localStorage 恢复共用同一份解析。
// 不依赖 DOM，可单测。id 只用于列表渲染 key，不参与导出（导入时由 store 重新分配）。
//
// 一条预设是**整组快照**：口径 + 两套输入 + 目标净利率。
// 存两套输入而不是只存当前口径那一套 —— 「存的时候在看整盘、切到单件试完价再切回来」
// 是这工具最常见的用法，只存一套的话另一套参数会在切换口径时丢掉。
//
// **试算 ROAS 不进预设**：它有一个由保本线自动推出来的默认值，属于「临时试算」而不是商品参数，
// 存下来的话下次应用预设会对着一个旧商品的保本线说话。留空就永远跟着当前输入走。

import { formatNumber } from './format.ts';
import { summaryInputGroups, summaryUnitGroups, type SummaryGroup } from './summary.ts';
import { DEFAULT_TARGET_MARGIN } from '../config.ts';
import {
	type AdMode,
	type CostMode,
	type OrdersMode,
	type RefundMode,
	type RoiMode,
	type RoiTextInputs,
	type UnitTextInputs
} from './types.ts';

/** 一条参数预设：整组快照 + 名字 */
export interface RoiPreset {
	/** 自增 id，仅用于列表渲染 key */
	id: number;
	name: string;
	mode: RoiMode;
	inputs: RoiTextInputs;
	unitInputs: UnitTextInputs;
	/** 反推用的目标净利率（对售价，百分数） */
	targetMargin: string;
}

/** 导出 / 导入的文件格式：就是去掉 id 的预设数组 */
export type RoiPresetFile = Omit<RoiPreset, 'id'>;

const MODES: RoiMode[] = ['batch', 'unit'];

/** 整盘口径要校验的字符串字段（commissionRefunded 是布尔，单独处理） */
const BATCH_FIELDS = [
	'adCost',
	'gmv',
	'orders',
	'costRate',
	'commissionRate',
	'shipCost',
	'unshippedRefundRate',
	'shippedRefundRate',
	'inTransitRefundRate',
	'recoverRate',
	'returnShipCost',
	'otherCost'
] as const;

/**
 * 单件口径要校验的字符串字段。
 * **老文件里多出来的 `roas` 会被忽略**：它不在这个名单里，`readTexts` 只挑名单上的字段读，
 * 多出来的键不影响校验也不进结果 —— 单件口径现在不填投产比（见 `UnitTextInputs`），
 * 所以老预设导进来算出的数与当时会不同，但文件不会整份作废。
 */
const UNIT_FIELDS = [
	'price',
	'unitCost',
	'shipCost',
	'commissionRate',
	'unshippedRefundRate',
	'shippedRefundRate',
	'inTransitRefundRate',
	'recoverRate',
	'returnShipCost'
] as const;

type TextValues =
	{ ok: true; values: Record<string, string>; commissionRefunded: boolean } | { ok: false; error: string };

/** 逐字段读字符串：缺任何一个、或类型不是字符串都不通过（不给用户半套数据） */
function readTexts(raw: unknown, fields: readonly string[], group: string): TextValues {
	if (typeof raw !== 'object' || raw === null) return { ok: false, error: `${group}不是对象` };
	const src = raw as Record<string, unknown>;
	const values: Record<string, string> = {};
	for (const field of fields) {
		const value = src[field];
		if (typeof value !== 'string') return { ok: false, error: `${group}的字段「${field}」缺失或不是字符串` };
		values[field] = value;
	}
	// 手写或早期版本的文件可能没有这个开关，按「平台退还佣金」这个更常见的规则补上
	const commissionRefunded = typeof src.commissionRefunded === 'boolean' ? src.commissionRefunded : true;
	return { ok: true, values, commissionRefunded };
}

/**
 * 老版本导出的文件里这一项叫 `resaleRate`（那时只想到「自己再上架」一条出路）。
 * 语义没变 —— 都是「退回来的货按成本价能收回多少」—— 所以搬个名字继续走同一套校验，
 * 不让老预设因为改了个字段名就整份读不进来。
 */
function migrateRecoverField(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null) return raw;
	const src = raw as Record<string, unknown>;
	if (src.recoverRate !== undefined || src.resaleRate === undefined) return raw;
	return { ...src, recoverRate: src.resaleRate };
}

/**
 * 退款三分类的字段迁移。**这是老预设算出来能跟当时逐位相同的关键**：
 *
 * 最早的文件只有一个 `returnRate` —— 那时所有退款都按「发货之后退回」处理，
 * 所以它整份落进 `shippedRefundRate`（已发货退款率），未发货与在途各补 0；
 * 于是三类退化成一类，新旧公式给出同一组数，老预设不会因为这次拆分而变值。
 *
 * 缺在途率（选填项）的文件补空串：空串在 `parsePercent` 里就是 0，等于「不区分在途」。
 * 字段类型不对（不是字符串）时**不补**，留给 `readTexts` 去报那句「缺失或不是字符串」。
 */
function migrateRefundFields(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null) return raw;
	const src = raw as Record<string, unknown>;
	const out: Record<string, unknown> = { ...src };
	if (typeof out.shippedRefundRate !== 'string' && typeof out.returnRate === 'string') {
		out.shippedRefundRate = out.returnRate;
	}
	if (typeof out.unshippedRefundRate !== 'string') out.unshippedRefundRate = '0';
	if (typeof out.inTransitRefundRate !== 'string') out.inTransitRefundRate = '';
	return out;
}

/**
 * 退款三格的填法。跟 costMode / adMode 同理：**老版本导出的文件里没有这个字段，一律按 `rate` 补上** ——
 * 那时三格只可能是百分数，补 rate 才能让老文件原样算回同一组数；
 * 认不出的值（手写文件写了别的东西）同样回落 `rate`，不给半套语义。
 *
 * 整盘与单件两套输入各有自己的这一格，所以两处各读一次。
 */
function readRefundMode(raw: unknown): RefundMode {
	if (typeof raw !== 'object' || raw === null) return 'rate';
	return (raw as Record<string, unknown>).refundMode === 'amount' ? 'amount' : 'rate';
}

/** 显式逐字段搬，不用展开 + 断言：漏写一个字段编译器会直接报错 */
function toBatchInputs(
	values: Record<string, string>,
	commissionRefunded: boolean,
	ordersMode: OrdersMode,
	costMode: CostMode,
	adMode: AdMode,
	refundMode: RefundMode
): RoiTextInputs {
	return {
		adCost: values.adCost,
		adMode,
		gmv: values.gmv,
		orders: values.orders,
		ordersMode,
		costRate: values.costRate,
		costMode,
		commissionRate: values.commissionRate,
		shipCost: values.shipCost,
		refundMode,
		unshippedRefundRate: values.unshippedRefundRate,
		shippedRefundRate: values.shippedRefundRate,
		inTransitRefundRate: values.inTransitRefundRate,
		recoverRate: values.recoverRate,
		returnShipCost: values.returnShipCost,
		otherCost: values.otherCost,
		commissionRefunded
	};
}

/**
 * 商品成本的填法。**老版本导出的文件里没有这个字段，一律按 `rate` 补上** ——
 * 那时 `costRate` 只可能是百分数，补 rate 才能让老文件原样算回同一组数；
 * 认不出的值（手写文件写了别的东西）同样回落 `rate`，不给半套语义。
 */
function readCostMode(raw: unknown): CostMode {
	if (typeof raw !== 'object' || raw === null) return 'rate';
	return (raw as Record<string, unknown>).costMode === 'unit' ? 'unit' : 'rate';
}

/**
 * 广告那格的填法。跟 costMode 同理：**老版本导出的文件里没有这个字段，一律按 `cost` 补上** ——
 * 那时 `adCost` 只可能是元，补 cost 才能让老文件原样算回同一组数；
 * 认不出的值（手写文件写了别的东西）同样回落 `cost`，不给半套语义。
 */
function readAdMode(raw: unknown): AdMode {
	if (typeof raw !== 'object' || raw === null) return 'cost';
	return (raw as Record<string, unknown>).adMode === 'roas' ? 'roas' : 'cost';
}

/**
 * 订单数那格的填法。跟 costMode 同理：**老版本导出的文件里没有这个字段，一律按 `count` 补上** ——
 * 那时 `orders` 只可能是订单数，补 count 才能让老文件原样算回同一组数；
 * 认不出的值同样回落 `count`，不给半套语义。
 */
function readOrdersMode(raw: unknown): OrdersMode {
	if (typeof raw !== 'object' || raw === null) return 'count';
	return (raw as Record<string, unknown>).ordersMode === 'aov' ? 'aov' : 'count';
}

function toUnitInputs(
	values: Record<string, string>,
	commissionRefunded: boolean,
	refundMode: RefundMode
): UnitTextInputs {
	return {
		price: values.price,
		unitCost: values.unitCost,
		shipCost: values.shipCost,
		commissionRate: values.commissionRate,
		refundMode,
		unshippedRefundRate: values.unshippedRefundRate,
		shippedRefundRate: values.shippedRefundRate,
		inTransitRefundRate: values.inTransitRefundRate,
		recoverRate: values.recoverRate,
		returnShipCost: values.returnShipCost,
		commissionRefunded
	};
}

/** 预设导出文本：JSON 美化输出，可直接下载成文件 */
export function serializePresets(presets: readonly RoiPreset[]): string {
	const file: RoiPresetFile[] = presets.map((preset) => ({
		name: preset.name,
		mode: preset.mode,
		inputs: { ...preset.inputs },
		unitInputs: { ...preset.unitInputs },
		targetMargin: preset.targetMargin
	}));
	return JSON.stringify(file, null, 2);
}

/**
 * 解析导入 / 恢复用的预设文本。逐条校验字段，任一条不合法即整体失败。
 * targetMargin 缺失或为空时回落到默认值（它只影响单件口径的反推，不值得为它整单失败）。
 */
export function parsePresets(text: string): { ok: true; presets: RoiPresetFile[] } | { ok: false; error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: '文件不是合法的 JSON' };
	}
	if (!Array.isArray(raw)) return { ok: false, error: '文件内容应为预设数组' };

	const out: RoiPresetFile[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) return { ok: false, error: '存在非对象的预设条目' };
		const preset = item as Record<string, unknown>;
		if (typeof preset.name !== 'string' || preset.name.trim() === '') {
			return { ok: false, error: '存在没有名称的预设' };
		}
		if (typeof preset.mode !== 'string' || !MODES.includes(preset.mode as RoiMode)) {
			return { ok: false, error: `预设口径不合法：${String(preset.mode)}` };
		}
		const batch = readTexts(migrateRefundFields(migrateRecoverField(preset.inputs)), BATCH_FIELDS, '整盘参数');
		if (!batch.ok) return batch;
		const unit = readTexts(migrateRefundFields(migrateRecoverField(preset.unitInputs)), UNIT_FIELDS, '单件参数');
		if (!unit.ok) return unit;

		const targetMargin =
			typeof preset.targetMargin === 'string' && preset.targetMargin.trim() !== ''
				? preset.targetMargin
				: DEFAULT_TARGET_MARGIN;

		out.push({
			name: preset.name.trim(),
			mode: preset.mode as RoiMode,
			inputs: toBatchInputs(
				batch.values,
				batch.commissionRefunded,
				readOrdersMode(preset.inputs),
				readCostMode(preset.inputs),
				readAdMode(preset.inputs),
				readRefundMode(preset.inputs)
			),
			unitInputs: toUnitInputs(unit.values, unit.commissionRefunded, readRefundMode(preset.unitInputs)),
			targetMargin
		});
	}
	return { ok: true, presets: out };
}

// ---------------------------------------------------------------- 会话快照（当前正在填的那组）

/**
 * 会话快照：口径 + 两套输入 + 目标净利率。
 *
 * 跟预设共用同一份字段校验（`readTexts` 那一套），所以「当前输入」的持久化**没有第二套读法**。
 * **试算类输入不进快照**（假设投产比 / 试算售价 / 试算销量 / 目标净利）—— 它们跟着当前输入推出来，
 * 存下来的话下次打开会对着一个不存在的盘说话（理由同预设）。
 */
export interface RoiSession {
	mode: RoiMode;
	inputs: RoiTextInputs;
	unitInputs: UnitTextInputs;
	targetMargin: string;
}

/** 会话快照 → 文本（localStorage 用；缩进与预设一致，出问题时人也看得懂） */
export function serializeSession(session: RoiSession): string {
	return JSON.stringify(
		{
			mode: session.mode,
			inputs: { ...session.inputs },
			unitInputs: { ...session.unitInputs },
			targetMargin: session.targetMargin
		},
		null,
		2
	);
}

/**
 * 文本 → 会话快照。任何一项不合法就**整份丢弃**（返回 null）：
 * 当前输入本来就是「丢了也能重新填」的东西，不值得为半套坏数据在启动时报错。
 */
export function parseSession(text: string): RoiSession | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof raw !== 'object' || raw === null) return null;
	const session = raw as Record<string, unknown>;
	if (typeof session.mode !== 'string' || !MODES.includes(session.mode as RoiMode)) return null;

	const batch = readTexts(migrateRefundFields(migrateRecoverField(session.inputs)), BATCH_FIELDS, '整盘参数');
	if (!batch.ok) return null;
	const unit = readTexts(migrateRefundFields(migrateRecoverField(session.unitInputs)), UNIT_FIELDS, '单件参数');
	if (!unit.ok) return null;

	const targetMargin =
		typeof session.targetMargin === 'string' && session.targetMargin.trim() !== ''
			? session.targetMargin
			: DEFAULT_TARGET_MARGIN;

	return {
		mode: session.mode as RoiMode,
		inputs: toBatchInputs(
			batch.values,
			batch.commissionRefunded,
			readOrdersMode(session.inputs),
			readCostMode(session.inputs),
			readAdMode(session.inputs),
			readRefundMode(session.inputs)
		),
		unitInputs: toUnitInputs(unit.values, unit.commissionRefunded, readRefundMode(session.unitInputs)),
		targetMargin
	};
}

// ---------------------------------------------------------------- 列表摘要

/** 字符串 → 数字；空串给 NaN（「没填」与「填了 0」要分开） */
function toNumber(raw: string): number {
	const text = raw.trim().replace(/,/g, '');
	return text === '' ? Number.NaN : Number(text);
}

/** 金额的显示：解析出来才格式化（两位小数、不带千分位，见 format.ts），否则给 — */
function amountLabel(raw: string): string {
	const value = toNumber(raw);
	return Number.isFinite(value) ? formatNumber(value) : '—';
}

/**
 * 预设条目的摘要行：只放**最能区分两条预设的两个数**。
 *
 * 整盘给「广告 + 成交额」—— 一头是这盘生意投进去的钱，一头是它换回来的成交额；
 * 单件给「售价 + 单件成本」—— 一款货的两个基本数。
 *
 * 其余参数不挤进这一行：悬浮条目会摊开全部（见 `presetDetail`），而这一行在 16rem 宽的
 * 左栏里是两行起步，塞三个数就变成四行，反倒看不出是两条里的哪一条。
 *
 * 广告那格按**用户填的**口径回显（填花费就写「广告 1,165.00 元」、填 ROAS 就写「广告 ROAS 6」）——
 * 跟复制摘要里那条同理，回显原始口径才对得上他看到的输入框。
 */
export function presetSummary(preset: RoiPresetFile): string {
	if (preset.mode === 'batch') {
		const ad = preset.inputs.adCost.trim();
		const adLabel =
			ad === '' ? '广告 —' : preset.inputs.adMode === 'roas' ? `广告 ROAS ${ad}` : `广告 ${amountLabel(ad)} 元`;
		return `${adLabel} · 成交额 ${amountLabel(preset.inputs.gmv)}`;
	}
	const unit = preset.unitInputs;
	return `售价 ${amountLabel(unit.price)} · 单件成本 ${amountLabel(unit.unitCost)} 元`;
}

/**
 * 悬浮条目时摊开的「全部参数」：**按面板分组、一字段一行**（左名右值）。
 *
 * 与复制摘要同一份数据（`summaryInputGroups` / `summaryUnitGroups`），只是呈现不同 ——
 * 摘要拼成一句句话贴到群里，卡片排成两列好扫。同一份数据两个出口，两处不会各说各的。
 *
 * 只摊开**该预设口径那一套**：另一套（给切换口径用的）也存着，但它跟这条预设的名字未必有关系，
 * 硬塞进来只会让卡片更长。应用预设时两套都会回填，不需要在卡片里预告。
 * 目标组不给（`targetProfit` 传空串）：卡片里那一项属于「这次试算」，不是存下来的参数。
 */
export function presetDetail(preset: RoiPresetFile): SummaryGroup[] {
	const groups =
		preset.mode === 'batch'
			? summaryInputGroups(preset.inputs, '')
			: summaryUnitGroups(preset.unitInputs, preset.targetMargin, '');
	// 一个字段都没填的组直接去掉（全空的一条预设给空数组，卡片就不出现）
	return groups.filter((group) => group.fields.length > 0);
}
