// 「我填了什么」那几行的数据源：按输入面板的分组回显用户填的原始字符串。
// 纯函数、不碰 DOM，node 环境可直接单测。
//
// **回显原始字符串，不做任何换算**：填的是「ROAS 6」就写「广告 ROAS 6」、
// 按金额填成本就写「单件成本 34.95 元/件」。换算过的数跟用户看到的输入框对不上，
// 而这份回显的用途就是让收到的人**照着这些数自己复算一遍**。
//
// 数据是**结构化**的（`SummaryGroup`：组名 + 左名右值的字段），两个出口各取所需：
// 复制摘要拼成一句句话（`summaryInputs`，贴到群里好读），
// 预设的悬浮卡排成两列（`core/presets.ts` 的 `presetDetail`，扫读快）。
// 同一份数据两个出口，不会各说各的。
import type { RoiTextInputs, TargetBasis, UnitTextInputs } from './types.ts';

/** 一条回显字段：左名右值 */
export interface SummaryField {
	label: string;
	value: string;
}

/** 一组回显：组名 + 组内字段（组名照输入面板的分组） */
export interface SummaryGroup {
	name: string;
	fields: SummaryField[];
}

/** 空串 = 没填。空串在计算里按 0 处理，但「没填」跟「填了 0」是两回事，回显里不写没填的 */
function filled(raw: string): boolean {
	return raw.trim() !== '';
}

/** 一组字段拼成复制摘要里的一行：`组名：a · b · c`；整组都没填就整组不出现（不摆一行空组名） */
function groupLines(groups: SummaryGroup[]): string[] {
	return groups
		.filter((group) => group.fields.length > 0)
		.map((group) => `${group.name}：${group.fields.map((field) => `${field.label} ${field.value}`).join(' · ')}`);
}

/** 退款三格的回显入参：两种口径的输入都满足它 */
type RefundEcho = Pick<
	RoiTextInputs,
	'refundMode' | 'unshippedRefundRate' | 'shippedRefundRate' | 'inTransitRefundRate'
>;

/**
 * 退款三格的回显（两种口径共用）。
 *
 * 名字跟着**用户填的填法**走：按率填就写「未发货退款率 20%」、按金额填就写
 * 「未发货退款金额 1398 元」—— 回显的仍是原始字符串，不做任何换算。
 * 在途**只有在填了的时候才写**，而且带一个「其中」—— 它是已发货退款里的一部分，
 * 平铺成三个并列的数会让收到的人以为是三个独立的量、加不到一起去。
 */
function refundFields(texts: RefundEcho, tail: SummaryField[]): SummaryField[] {
	const asAmount = texts.refundMode === 'amount';
	const name = (base: string): string => `${base}${asAmount ? '金额' : '率'}`;
	const suffix = asAmount ? ' 元' : '%';
	const stamped = (raw: string): string => `${raw.trim()}${suffix}`;
	const ret: SummaryField[] = [];
	if (filled(texts.unshippedRefundRate)) {
		ret.push({ label: name('未发货退款'), value: stamped(texts.unshippedRefundRate) });
	}
	if (filled(texts.shippedRefundRate)) {
		ret.push({ label: name('已发货退款'), value: stamped(texts.shippedRefundRate) });
	}
	if (filled(texts.inTransitRefundRate)) {
		ret.push({ label: `其中${name('在途退款')}`, value: stamped(texts.inTransitRefundRate) });
	}
	return [...ret, ...tail];
}

/**
 * 输入回显（整盘口径）：成交与广告 / 成本项 / 退货 / 目标四组。
 * 分组照输入面板的三块，照着面板找数更方便。
 *
 * `targetBasis` 说的是目标那一格按哪种口径填的 —— 同一个字符串「500」在两种口径下
 * 一个是「赚 500 元」、一个是「投产比 500」，回显必须跟着说，否则贴到群里别人会照着算错。
 */
export function summaryInputGroups(
	texts: RoiTextInputs,
	targetText: string,
	targetBasis: TargetBasis = 'profit'
): SummaryGroup[] {
	const deal: SummaryField[] = [];
	if (filled(texts.adCost)) {
		deal.push(
			texts.adMode === 'roas'
				? { label: '广告 ROAS', value: texts.adCost.trim() }
				: { label: '广告花费', value: `${texts.adCost.trim()} 元` }
		);
	}
	if (filled(texts.gmv)) deal.push({ label: '成交额', value: `${texts.gmv.trim()} 元` });
	// 订单数那格按填法换名字：按客单价填时它装的不是单数，回显写「订单数 69.9 单」会误导
	if (filled(texts.orders)) {
		deal.push(
			texts.ordersMode === 'aov'
				? { label: '客单价', value: `${texts.orders.trim()} 元/单` }
				: { label: '订单数', value: `${texts.orders.trim()} 单` }
		);
	}

	const cost: SummaryField[] = [];
	if (filled(texts.costRate)) {
		cost.push(
			texts.costMode === 'unit'
				? { label: '单件成本', value: `${texts.costRate.trim()} 元/件` }
				: { label: '商品成本率', value: `${texts.costRate.trim()}%` }
		);
	}
	// 佣金那格把「退不退」一起带上：它直接决定佣金是按成交额还是按净收入抽，
	// 只报一个 5% 收到的那边会算出另一个数
	if (filled(texts.commissionRate)) {
		cost.push({
			label: '平台佣金率',
			value: `${texts.commissionRate.trim()}%（${texts.commissionRefunded ? '退款退还' : '退款不退还'}）`
		});
	}
	if (filled(texts.shipCost)) cost.push({ label: '单均发货成本', value: `${texts.shipCost.trim()} 元` });
	if (filled(texts.otherCost)) cost.push({ label: '其他固定成本', value: `${texts.otherCost.trim()} 元` });

	const tail: SummaryField[] = [];
	if (filled(texts.recoverRate)) tail.push({ label: '能收回的货款', value: `${texts.recoverRate.trim()}%` });
	if (filled(texts.returnShipCost)) tail.push({ label: '单均退货成本', value: `${texts.returnShipCost.trim()} 元` });
	const ret = refundFields(texts, tail);

	const target: SummaryField[] = [];
	if (filled(targetText)) {
		target.push(
			targetBasis === 'roas'
				? { label: '假设投产比', value: targetText.trim() }
				: { label: '目标净利', value: `${targetText.trim()} 元` }
		);
	}

	return [
		{ name: '成交与广告', fields: deal },
		{ name: '成本项', fields: cost },
		{ name: '退货', fields: ret },
		{ name: '目标', fields: target }
	];
}

/** 输入回显（单件口径）：商品 / 平台 / 退货 / 目标四组 */
export function summaryUnitGroups(texts: UnitTextInputs, targetMargin: string, trialRoas: string): SummaryGroup[] {
	const goods: SummaryField[] = [];
	if (filled(texts.price)) goods.push({ label: '售价', value: `${texts.price.trim()} 元/件` });
	if (filled(texts.unitCost)) goods.push({ label: '单件成本', value: `${texts.unitCost.trim()} 元/件` });
	if (filled(texts.shipCost)) goods.push({ label: '单件发货成本', value: `${texts.shipCost.trim()} 元/件` });

	const platform: SummaryField[] = [];
	if (filled(texts.commissionRate)) {
		platform.push({
			label: '平台佣金率',
			value: `${texts.commissionRate.trim()}%（${texts.commissionRefunded ? '退款退还' : '退款不退还'}）`
		});
	}

	const tail: SummaryField[] = [];
	if (filled(texts.recoverRate)) tail.push({ label: '能收回的货款', value: `${texts.recoverRate.trim()}%` });
	if (filled(texts.returnShipCost)) tail.push({ label: '单件退货成本', value: `${texts.returnShipCost.trim()} 元/件` });
	const ret = refundFields(texts, tail);

	const target: SummaryField[] = [];
	if (filled(targetMargin)) target.push({ label: '目标净利率', value: `${targetMargin.trim()}%` });
	if (filled(trialRoas)) target.push({ label: '试算 ROAS', value: trialRoas.trim() });

	return [
		{ name: '商品', fields: goods },
		{ name: '平台', fields: platform },
		{ name: '退货', fields: ret },
		{ name: '目标', fields: target }
	];
}

/**
 * 复制摘要里那几行输入回显（整盘口径）。
 * 一句话一组，组内用 ` · ` 串起来 —— 贴到群里别人照着念得下去。
 */
export function summaryInputs(texts: RoiTextInputs, targetText: string, targetBasis: TargetBasis = 'profit'): string[] {
	return groupLines(summaryInputGroups(texts, targetText, targetBasis));
}

/** 复制摘要里那几行输入回显（单件口径） */
export function summaryUnitInputs(texts: UnitTextInputs, targetMargin: string, trialRoas: string): string[] {
	return groupLines(summaryUnitGroups(texts, targetMargin, trialRoas));
}
