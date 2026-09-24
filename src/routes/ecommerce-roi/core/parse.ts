// 输入解析：用户填的字符串 → 数值输入（比率统一换算成 0~1 的小数）。
// 两种口径各一个入口（`parseInputs` / `parseUnitInputs`），另有两处「填法切换时的数字换算」。
// 纯函数、不碰 DOM，node 环境可直接单测。
//
// 单件口径**没有另写一套公式**：`parseUnitInputs` 把它换算成「订单数 = 1、成交额 = 售价、
// 成本率 = 单件成本 ÷ 售价、广告费 = 0」的等价整盘输入，指标与敏感性表全部复用 ——
// 单件口径本来就是同一套公式的特例。
import { EXAMPLE_INPUTS, MAX_INPUT_AMOUNT, UNIT_EXAMPLE_INPUTS } from '../config.ts';
import {
	type CostMode,
	type RefundMode,
	type RefundTexts,
	type RoiInputs,
	type RoiTextInputs,
	type UnitTextInputs
} from './types.ts';

/** 整盘那套里真正的**数值**文本框（排除佣金退还开关，以及订单数 / 成本 / 广告 / 退款四处的填法开关） */
type BatchKey = Exclude<
	keyof RoiTextInputs,
	'commissionRefunded' | 'ordersMode' | 'costMode' | 'adMode' | 'refundMode'
>;

/**
 * 解析错误指回**哪一格**：键名就是输入框那一格的 key，页面据此把红字挂到那一格上
 * （见 `ui/NumberField.svelte` 的 `field` prop）。
 * 两种口径取并集 —— 校验器是共用的，键空间也合并。
 */
export type ParsedField = BatchKey | 'price' | 'unitCost';

type Parsed = { ok: true; value: number } | { ok: false; error: string; field: ParsedField };

/** 去掉千分位逗号与首尾空白：用户常直接粘「9,900」 */
function normalize(text: string): string {
	return text.trim().replace(/,/g, '');
}

/**
 * 拼「<标签>要…」这类消息。标签以拉丁字母 / 数字结尾时补一个空格 ——
 * 「广告 ROAS」直接接「要填」会粘成「ROAS要填一个…」；中文标签不加（「成交额 要填」反而别扭）。
 */
function messageFor(label: string, rest: string): string {
	return /[A-Za-z0-9]$/.test(label) ? `${label} ${rest}` : `${label}${rest}`;
}

/**
 * 去千分位后转数字：转不出来给 NaN，让调用方自己决定「空串 / 非法值」分别怎么办。
 * 试算框（假设投产比、试算售价与销量、目标净利率）都走这一条 ——
 * 它们留空是「用默认值」，填错才需要报出来，两种情形得分开判。
 */
export function toNumber(text: string): number {
	const raw = normalize(text);
	return raw === '' ? Number.NaN : Number(raw);
}

/**
 * 金额 / 单数：不小于 0 的数字，空串按 0（没填就是没有这笔）。
 * 上限见 `config.ts` 的 `MAX_INPUT_AMOUNT`（那里说明了它是拦误操作、不是业务限制）。
 */
function parseAmount(text: string, label: string, field: ParsedField): Parsed {
	const raw = normalize(text);
	if (raw === '') return { ok: true, value: 0 };
	if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: messageFor(label, '要填一个不小于 0 的数字'), field };
	const value = Number(raw);
	if (value > MAX_INPUT_AMOUNT) return { ok: false, error: messageFor(label, '数值过大，请检查是否填错字段'), field };
	return { ok: true, value };
}

/** 比率：0~100 的百分数，内部换算成小数 */
function parsePercent(text: string, label: string, field: ParsedField): Parsed {
	const raw = normalize(text);
	if (raw === '') return { ok: true, value: 0 };
	if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: messageFor(label, '要填 0-100 之间的百分数'), field };
	const value = Number(raw);
	if (value > 100) return { ok: false, error: messageFor(label, '不能超过 100%'), field };
	return { ok: true, value: value / 100 };
}

/** 把 0~1 的小数写回百分数文本，只用在错误消息里（顺手去掉没意义的小数尾巴） */
function toPercentText(value: number): string {
	return `${Number((value * 100).toFixed(2))}%`;
}

/**
 * 订单数：两种填法（`ordersMode`）。
 * - `count`：直接就是订单数（单）。
 * - `aov`：填的是客单价（元/单），按 `订单数 = 成交额 ÷ 客单价` 换算 —— 成交额是前提，
 *   但**拿不到成交额时不报错**：没成交额就是没订单，0 单是对的（跟「按金额填成本」那种
 *   `0 ÷ 0` 的无解不同）。客单价本身填了 0 才拦 —— 那会除出 Infinity。
 */
function parseOrders(texts: RoiTextInputs, gmv: number): Parsed {
	if (texts.ordersMode !== 'aov') return parseAmount(texts.orders, '订单数', 'orders');

	const aov = parseAmount(texts.orders, '客单价', 'orders');
	if (!aov.ok) return aov;
	// 空串 = 没填，按 0 处理（全站一致）；填了 0 才需要一句原因
	if (normalize(texts.orders) === '') return { ok: true, value: 0 };
	if (aov.value <= 0) return { ok: false, error: '客单价要大于 0', field: 'orders' };
	return { ok: true, value: gmv / aov.value };
}

/**
 * 商品成本：两种填法（`costMode`）。
 * - `rate`：直接就是成本率（%），上限 100 —— 超过必然是笔误。
 * - `unit`：填的是元/件，按客单价（成交额 ÷ 订单数）换算成成本率。
 *   **这一路不设 100% 上限**：进价高过售价是真实存在的经营状况，该让它算出一条
 *   「投多少都亏」的负毛利率，而不是弹个错把人拦住。
 *
 * 换算本身**精确等价于直接按金额算**（成本率 × 成交额 = 单件成本 × 订单数），
 * 归一化只是为了让下游那四处（毛利率、保本第一层、敏感性、规模试算）都拿到同一个数。
 *
 * 客单价取自 **`parseOrders` 折算后的订单数**（`gmv ÷ orders`），不是订单数那一格的原始文本 ——
 * 那一格可能填的是客单价（`ordersMode === 'aov'`），照原始文本除会除反。
 */
function parseCost(texts: RoiTextInputs, gmv: number, orders: number): Parsed {
	if (texts.costMode !== 'unit') return parsePercent(texts.costRate, '商品成本率', 'costRate');

	const cost = parseAmount(texts.costRate, '单件成本', 'costRate');
	if (!cost.ok) return cost;
	if (cost.value === 0) return { ok: true, value: 0 };

	// 成交额与订单数上面那轮已经校验过，走到这里只可能是「合法但是 0」
	if (!(gmv > 0) || !(orders > 0)) {
		// 红字挂在**成本这一格**：用户是在这里填的「按金额」，要修的那两项在别的格
		const need = texts.ordersMode === 'aov' ? '成交额与客单价' : '成交额与订单数';
		return {
			ok: false,
			error: `按「元/件」填成本时，要先把${need}填好 —— 客单价就是成交额 ÷ 订单数`,
			field: 'costRate'
		};
	}
	return { ok: true, value: cost.value / (gmv / orders) };
}

/**
 * 广告：两种填法（`adMode`）最终都要归到**广告花费（元）**，下游只认这一个数。
 * - `cost`：直接就是广告花费。
 * - `roas`：填的是投产比，按 广告费 = 成交额 ÷ ROAS 换算。**成交额是前提**，
 *   拿不到就报错而不是算个 0 —— 静默算成 0 会让结果卡报「填入广告花费后即可给出结论」，
 *   用户明明填了 ROAS 却被说成没填。
 *
 * ROAS 填 0（或空）按「没有这笔广告费」处理，跟金额口径的空串同义，不单独报错。
 */
function parseAd(texts: RoiTextInputs): Parsed {
	if (texts.adMode !== 'roas') return parseAmount(texts.adCost, '广告花费', 'adCost');

	const roas = parseAmount(texts.adCost, '广告 ROAS', 'adCost');
	if (!roas.ok) return roas;
	if (roas.value === 0) return { ok: true, value: 0 };

	// 成交额上面那轮循环已经校验过，走到这里只可能是「合法但是 0」
	const gmv = parseAmount(texts.gmv, '成交额', 'adCost');
	if (!gmv.ok || gmv.value <= 0) {
		return {
			ok: false,
			error: '按「广告 ROAS」填广告时，要先把成交额填好 —— 广告费就是成交额 ÷ ROAS',
			field: 'adCost'
		};
	}
	return { ok: true, value: gmv.value / roas.value };
}

/**
 * 退款三格的键与中文名：率（%）与金额（元）两种填法共用一套名字。
 * 名字**照抄页面上的 label**（「其中在途退款」也一样）—— 错误消息的用处是「指回哪一格去改」，
 * 跟那格的可见文案对不上就得多想一步。
 */
const REFUND_FIELDS = [
	['unshippedRefundRate', '未发货退款'],
	['shippedRefundRate', '已发货退款'],
	['inTransitRefundRate', '其中在途退款']
] as const;

/** 退款三格在**用户填的那个单位**下的写法：率带 %、金额带 元 —— 错误消息用它才对得上输入框 */
function refundUnitValue(value: number, asAmount: boolean): string {
	return asAmount ? `${Number(value.toFixed(2))} 元` : toPercentText(value / 100);
}

/**
 * 退款三分类的解析。
 *
 * `refundMode` 决定三格填的是**退款率（%）**还是**退款金额（元）**。金额的口径是
 * 「退掉的成交额」，所以要按 `率 = 金额 ÷ 成交额` 折回 —— **成交额是前提**，
 * 拿不到就报错而不是算个 0（跟「按金额填成本要客单价」「按 ROAS 填广告要成交额」同一套路）。
 *
 * 「在途 ≤ 已发货」的校验放在这里：两种口径共用一份，而且**在同一单位里比**
 * （率比率、金额比金额），错误消息也按用户填的单位拼 —— 不把「20 元」换算成百分比再报给他。
 */
function parseRefund(
	texts: RefundTexts,
	gmv: number,
	gmvLabel: string
):
	| { ok: true; unshipped: number; shipped: number; inTransit: number }
	| { ok: false; error: string; field: ParsedField } {
	const asAmount = texts.refundMode === 'amount';
	const suffix = asAmount ? '金额' : '率';
	/** 用户填的那个数（率是百分数、金额是元），只用于错误消息 */
	const typed: Record<string, number> = {};
	/** 折回后的比率（0~1 小数），下游只认这个 */
	const rate: Record<string, number> = {};

	for (const [key, label] of REFUND_FIELDS) {
		const parsed = asAmount
			? parseAmount(texts[key], `${label}金额`, key)
			: parsePercent(texts[key], `${label}率`, key);
		if (!parsed.ok) return parsed;

		if (!asAmount) {
			typed[key] = parsed.value * 100;
			rate[key] = parsed.value;
			continue;
		}

		typed[key] = parsed.value;
		// 填 0 与没填同义，不需要成交额就能定下来
		if (parsed.value === 0) {
			rate[key] = 0;
			continue;
		}
		if (!(gmv > 0)) {
			return {
				ok: false,
				error: `按「退款金额」填时要先把${gmvLabel}填好 —— 退款金额就是${gmvLabel} × 退款率`,
				field: key
			};
		}
		// 率口径的 100% 上限由 parsePercent 挡；金额口径要在这里挡出「退款金额比成交额还大」
		if (parsed.value > gmv) return { ok: false, error: `${label}金额不能超过${gmvLabel}`, field: key };
		rate[key] = parsed.value / gmv;
	}

	const unshipped = rate.unshippedRefundRate;
	const shipped = rate.shippedRefundRate;
	const inTransit = rate.inTransitRefundRate;
	// 超过已发货退款意味着有订单既没发货又发了货 —— 一定是填串了。
	// 不拦的话结果只会悄悄变成一个负的签收后退货率，比报错难查得多。
	if (inTransit > shipped) {
		return {
			ok: false,
			// 红字挂在**在途**那一格：它是超限的那一个，改它就行
			field: 'inTransitRefundRate',
			error: `在途退款${suffix}不能高于已发货退款${suffix}（${refundUnitValue(typed.inTransitRefundRate, asAmount)} > ${refundUnitValue(typed.shippedRefundRate, asAmount)}）—— 在途件是已发货退款里的一部分`
		};
	}
	return { ok: true, unshipped, shipped, inTransit };
}

/**
 * 把退款三格里的数字在两种填法之间换算：率（%）↔ 退款金额（元）。
 *
 * 整组一个开关，所以三格一起换算。跟商品成本、广告那两处同理：**换算数字**而不是只换单位 ——
 * 只换单位的话，「20」会从 20% 静悄悄变成 20 元，同一串字符含义全变。
 * 成交额拿不到（= 0）时返回原文本，不猜；由 `parseRefund` 的消息说明要先填它。
 */
export function convertRefundTexts(
	texts: RefundTexts,
	next: RefundMode,
	gmv: number
): { unshippedRefundRate: string; shippedRefundRate: string; inTransitRefundRate: string } {
	const convert = (raw: string): string => {
		const text = normalize(raw);
		const value = Number(text);
		if (text === '' || !Number.isFinite(value) || !(gmv > 0)) return raw;
		const converted = next === 'amount' ? (value / 100) * gmv : (value / gmv) * 100;
		return String(Number(converted.toFixed(2)));
	};
	return {
		unshippedRefundRate: convert(texts.unshippedRefundRate),
		shippedRefundRate: convert(texts.shippedRefundRate),
		inTransitRefundRate: convert(texts.inTransitRefundRate)
	};
}

/**
 * 把退款三格从**一个口径**搬到**另一个口径**（页面上的「带入整盘的退款参数」）。
 *
 * 跨口径不能直接搬字符串：两边的成交额不是一个量级（整盘是成交额、单件是售价），
 * 而且两边各自的填法还可能不同（一个按率、一个按金额）。所以走「源 → 率 → 目标」两跳：
 * 率与口径无关，目标再按**它自己的**填法写回。
 *
 * 搬不动时返回原因而不是硬塞一个值：源三格没填、源本身有非法值、
 * 或目标按金额填却没有成交额（折不出金额）—— 三种都宁可不动手。
 */
export function carryRefundTexts(
	from: RefundTexts,
	fromGmv: number,
	to: RefundTexts,
	toGmv: number
):
	| { ok: true; unshippedRefundRate: string; shippedRefundRate: string; inTransitRefundRate: string }
	| { ok: false; error: string } {
	if ([from.unshippedRefundRate, from.shippedRefundRate, from.inTransitRefundRate].every((raw) => raw.trim() === '')) {
		return { ok: false, error: '另一套口径里还没填退款参数' };
	}
	const asAmount = to.refundMode === 'amount';
	if (asAmount && !(toGmv > 0)) {
		return { ok: false, error: '这一套是按金额填的，得先有成交额（单件口径是售价）才折得出金额' };
	}
	const source = parseRefund(from, fromGmv, '成交额');
	if (!source.ok) return { ok: false, error: `另一套口径那三格有问题：${source.error}` };

	const write = (rate: number): string =>
		asAmount ? String(Number((rate * toGmv).toFixed(2))) : String(Number((rate * 100).toFixed(2)));
	return {
		ok: true,
		unshippedRefundRate: write(source.unshipped),
		shippedRefundRate: write(source.shipped),
		inTransitRefundRate: write(source.inTransit)
	};
}

/**
 * 把「广告」输入框里的数字在两种填法之间换算：元 ↔ ROAS。
 *
 * 跟成本那格同理：切换填法时**换算数字**而不是原样留着 —— 只换单位的话，
 * 「1165」会从 1165 元广告费静悄悄变成 ROAS 1165，同一串字符含义全变。
 *
 * 跟 `convertCostText` 的差别是**不需要知道要切到哪个填法**：
 * 广告费 = 成交额 ÷ ROAS、ROAS = 成交额 ÷ 广告费，两个方向都是 `成交额 ÷ 当前值`。
 * 成交额拿不到、或当前值不是正数时返回原文本，不猜。
 */
export function convertAdText(texts: RoiTextInputs): string {
	const raw = normalize(texts.adCost);
	const value = Number(raw);
	if (raw === '' || !Number.isFinite(value) || value <= 0) return texts.adCost;
	const gmv = Number(normalize(texts.gmv));
	if (!(gmv > 0)) return texts.adCost;

	return String(Number((gmv / value).toFixed(2)));
}

/**
 * 把「订单数」输入框里的数字在两种填法之间换算：单 ↔ 元/单。
 *
 * 跟广告那格一模一样：两个方向都是 `成交额 ÷ 当前值` ——
 * 订单数 = 成交额 ÷ 客单价、客单价 = 成交额 ÷ 订单数，所以**不需要知道要切到哪个填法**。
 * 成交额拿不到、或当前值不是正数时返回原文本，不猜。
 */
export function convertOrdersText(texts: RoiTextInputs): string {
	const raw = normalize(texts.orders);
	const value = Number(raw);
	if (raw === '' || !Number.isFinite(value) || value <= 0) return texts.orders;
	const gmv = Number(normalize(texts.gmv));
	if (!(gmv > 0)) return texts.orders;

	return String(Number((gmv / value).toFixed(2)));
}

/**
 * 把「商品成本」输入框里的数字在两种填法之间换算：% ↔ 元/件。
 *
 * 切换填法时**换算数字**而不是原样留着 —— 只换单位的话，「50」会从 50% 静悄悄变成
 * 50 元/件，同一串字符含义全变。客单价（成交额 ÷ 订单数）拿不到时返回原文本，不猜。
 *
 * 客单价按 `ordersMode` 两种读法取：订单数口径是 `成交额 ÷ 订单数`，
 * 客单价口径**那一格本身就是客单价**（订单数才是被推出来的那个）。
 */
export function convertCostText(texts: RoiTextInputs, next: CostMode): string {
	const raw = normalize(texts.costRate);
	const value = Number(raw);
	const gmv = Number(normalize(texts.gmv));
	const orders = Number(normalize(texts.orders));
	if (raw === '' || !Number.isFinite(value)) return texts.costRate;
	// 两种口径下这一格都得是个正数：按订单数填时是单数、按客单价填时是元/单
	if (!(gmv > 0) || !(orders > 0)) return texts.costRate;

	const aov = texts.ordersMode === 'aov' ? orders : gmv / orders;
	const converted = next === 'unit' ? (value / 100) * aov : (value / aov) * 100;
	// 留两位：换过去再换回来有零点几的漂移，但比在框里留一串 34.9499999 干净
	return String(Number(converted.toFixed(2)));
}

/**
 * 把用户填的字符串解析成数值输入。
 * 任何一项不合格就整体不通过 —— 只报第一条错误，避免一屏红字。
 */
export function parseInputs(
	texts: RoiTextInputs
): { ok: true; inputs: RoiInputs } | { ok: false; error: string; field: ParsedField } {
	/** 走通用循环的字段；订单数、成本、广告与退款三格都要读别的字段，单独放在后面 */
	type LoopKey = Exclude<
		BatchKey,
		'orders' | 'costRate' | 'adCost' | 'unshippedRefundRate' | 'shippedRefundRate' | 'inTransitRefundRate'
	>;
	const fields: ReadonlyArray<readonly [LoopKey, string, 'amount' | 'percent']> = [
		['gmv', '成交额', 'amount'],
		['commissionRate', '平台佣金率', 'percent'],
		['shipCost', '单均发货成本', 'amount'],
		['recoverRate', '退货能收回的货款比例', 'percent'],
		['returnShipCost', '单均退货成本', 'amount'],
		['otherCost', '其他固定成本', 'amount']
	];

	const values: Partial<Record<BatchKey, number>> = {};
	for (const [key, label, kind] of fields) {
		const parsed = kind === 'amount' ? parseAmount(texts[key], label, key) : parsePercent(texts[key], label, key);
		// 直接返回 Parsed 的错误分支：它已经带着 field，形制与这里的返回类型一致
		if (!parsed.ok) return parsed;
		values[key] = parsed.value;
	}
	// 订单数、成本、广告与退款三格都放最后一轮：它们都可能要读上面的值 —— 订单数按「客单价」填、
	// 成本按「元/件」填时要客单价（成交额 ÷ 订单数），广告按「ROAS」填、退款按「金额」填时要成交额。
	// 先让循环把这几项校验干净，错误消息才不会互相顶掉。
	const orders = parseOrders(texts, values.gmv ?? 0);
	if (!orders.ok) return orders;
	values.orders = orders.value;
	const cost = parseCost(texts, values.gmv ?? 0, values.orders ?? 0);
	if (!cost.ok) return cost;
	values.costRate = cost.value;
	const ad = parseAd(texts);
	if (!ad.ok) return ad;
	values.adCost = ad.value;
	// 退款三格：率与金额两种填法在这里分流，在途 ≤ 已发货 的校验也在里面（按用户填的单位报）
	const refund = parseRefund(texts, values.gmv ?? 0, '成交额');
	if (!refund.ok) return refund;
	values.unshippedRefundRate = refund.unshipped;
	values.shippedRefundRate = refund.shipped;
	values.inTransitRefundRate = refund.inTransit;
	// 上面每个键都赋过值（fields 列全了 + costRate + adCost + 退款三格），集中断言一次，
	// 省掉下面十处非空断言
	const v = values as Record<BatchKey, number>;

	return {
		ok: true,
		inputs: {
			adCost: v.adCost,
			gmv: v.gmv,
			orders: v.orders,
			costRate: v.costRate,
			commissionRate: v.commissionRate,
			shipCost: v.shipCost,
			unshippedRefundRate: v.unshippedRefundRate,
			shippedRefundRate: v.shippedRefundRate,
			inTransitRefundRate: v.inTransitRefundRate,
			recoverRate: v.recoverRate,
			returnShipCost: v.returnShipCost,
			otherCost: v.otherCost,
			commissionRefunded: texts.commissionRefunded
		}
	};
}

/** 是否还没开始填：三个主字段都空就按空态处理，不去报「成交额要填」这种废话错 */
export function isEmptyInputs(texts: RoiTextInputs): boolean {
	return normalize(texts.gmv) === '' && normalize(texts.adCost) === '' && normalize(texts.orders) === '';
}

/**
 * 单件输入 → 等价的整盘输入（订单数 = 1、成交额 = 售价、成本率 = 单件成本 ÷ 售价、**广告费 = 0**）。
 * 这样上面那套指标、敏感性表、说明全都不用另写一份。
 *
 * 广告费固定 0 是**有意的**：单件口径回答的是「这款货的广告费上限是多少、保本 ROAS 是多少」，
 * 这两个数都在广告费之前就定了。真按某个 ROAS 投放的账（`⑩ 净利`）由结果卡上的「假设投产比」
 * 现算，不进输入 —— 见 `derive.ts` 的 `reverseFromMargin` 与 `profitByRoas`。
 * 于是单件口径下 `⑩ = ⑨`、`adRoas = Infinity`，凡是碰广告费的指标（广告 ROI、扣退货 ROAS）
 * 在单件口径里都没有意义，结果卡也不显示。
 */
export function parseUnitInputs(
	texts: UnitTextInputs
): { ok: true; inputs: RoiInputs } | { ok: false; error: string; field: ParsedField } {
	const price = parseAmount(texts.price, '售价', 'price');
	if (!price.ok) return price;
	// 空串与真的填了 0 给不同提示：空是「还没填」，0 是「填错了」
	if (price.value <= 0) {
		return {
			ok: false,
			field: 'price',
			error: normalize(texts.price) === '' ? '先填售价（元/件）' : '售价要大于 0'
		};
	}

	const unitCost = parseAmount(texts.unitCost, '单件成本', 'unitCost');
	if (!unitCost.ok) return unitCost;
	// 单件成本**不设**「不能高于售价」的上限：进价高过售价是真实存在的经营状况（清库存、引流款），
	// 整盘那格按金额填成本时也是这么处理的（见 parseCost 的 unit 分支，那里明确不卡 100%）。
	// 该给的是「这个价每件亏 X 元」「投多少都亏」这条结论，不是把输入拦在门外 ——
	// 下游三处都接得住：贡献利润转负后 defaultTrialRoas 取不到默认档、roasForTarget 报
	// 「投多少都亏」、roasStepsFor 退回固定档位；结果卡那句「成本已吃满：卖一件亏一件」
	// （ResultVerdict）本来就是为这个状态写的。

	const shipCost = parseAmount(texts.shipCost, '单件发货成本', 'shipCost');
	if (!shipCost.ok) return shipCost;
	const returnShipCost = parseAmount(texts.returnShipCost, '单件退货成本', 'returnShipCost');
	if (!returnShipCost.ok) return returnShipCost;
	const commissionRate = parsePercent(texts.commissionRate, '平台佣金率', 'commissionRate');
	if (!commissionRate.ok) return commissionRate;
	// 退款三格：率与金额两种填法在这里分流（单件口径的成交额就是售价），
	// 在途 ≤ 已发货 的校验也在里面，消息按用户填的那个单位说
	const refund = parseRefund(texts, price.value, '售价');
	if (!refund.ok) return refund;
	const recoverRate = parsePercent(texts.recoverRate, '退货能收回的货款比例', 'recoverRate');
	if (!recoverRate.ok) return recoverRate;

	return {
		ok: true,
		inputs: {
			adCost: 0,
			gmv: price.value,
			orders: 1,
			costRate: unitCost.value / price.value,
			commissionRate: commissionRate.value,
			shipCost: shipCost.value,
			unshippedRefundRate: refund.unshipped,
			shippedRefundRate: refund.shipped,
			inTransitRefundRate: refund.inTransit,
			recoverRate: recoverRate.value,
			returnShipCost: returnShipCost.value,
			otherCost: 0,
			commissionRefunded: texts.commissionRefunded
		}
	};
}

/** 单件口径是否还没开始填 */
export function isEmptyUnitInputs(texts: UnitTextInputs): boolean {
	return normalize(texts.price) === '' && normalize(texts.unitCost) === '';
}

// ---------------------------------------------------------------- 示例态

/**
 * 当前输入是否与示例**完全一致**。
 * 首屏就是示例数据，不标出来的话，用户改两个字段就可能把示例数当成自己的结果发出去。
 */
export function isExampleInputs(texts: RoiTextInputs): boolean {
	return (Object.keys(EXAMPLE_INPUTS) as Array<keyof RoiTextInputs>).every((key) => texts[key] === EXAMPLE_INPUTS[key]);
}

export function isExampleUnitInputs(texts: UnitTextInputs): boolean {
	return (Object.keys(UNIT_EXAMPLE_INPUTS) as Array<keyof UnitTextInputs>).every(
		(key) => texts[key] === UNIT_EXAMPLE_INPUTS[key]
	);
}
