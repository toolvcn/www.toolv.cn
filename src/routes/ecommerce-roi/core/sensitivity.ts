// 「动一个变量会怎样」：目标净利 → 需要的 ROAS、最该盯的一项、两张敏感性表。
// 纯函数、不碰 DOM，node 环境可直接单测。
//
// 两张表的档位来自 `config.ts` 的常量（`RETURN_RATE_STEPS` / `ROAS_STEPS` 与单件那两条），改档位只改那里；
// 单件口径的 ROAS 档位不写死 —— 它没有「现在的 ROAS」，档位得围着保本线现算。
import { computeMetrics } from './metrics.ts';
import { formatMoney } from './format.ts';
import {
	RETURN_RATE_STEPS,
	ROAS_STEPS,
	SENSITIVE_RELATIVE_STEP,
	SENSITIVE_ZERO_AMOUNT_STEP,
	SENSITIVE_ZERO_PERCENT_STEP,
	UNIT_ROAS_STEP_COUNT,
	UNIT_ROAS_STEPS_BELOW_CENTER
} from '../config.ts';
import {
	type ReturnRateRow,
	type RoiInputs,
	type RoasRow,
	type SensitiveItem,
	type TargetBasis,
	type TargetRoasResult
} from './types.ts';

// ---------------------------------------------------------------- 试算那条线：目标净利 ↔ 投产比

/**
 * 试算那条线上的三个数由**一个**自由度决定：广告费 = 成交额 ÷ 投产比 = 净利天花板 − 净利。
 * 给定其中任一个，另外两个就定了 —— 所以界面上「目标净利 / 投产比」是二选一的两种填法，
 * 切换时按下面这一对函数换算数字。
 */
export function roasForTargetProfit(gmv: number, ceiling: number, targetProfit: number): number {
	if (!(gmv > 0) || !Number.isFinite(targetProfit) || !(ceiling > targetProfit)) return Number.NaN;
	return gmv / (ceiling - targetProfit);
}

/** `roasForTargetProfit` 的反解：按这个投产比投，净利 = 天花板 − 成交额 ÷ 投产比 */
export function profitForTargetRoas(gmv: number, ceiling: number, roas: number): number {
	if (!(gmv > 0) || !(roas > 0)) return Number.NaN;
	return ceiling - gmv / roas;
}

/**
 * 试算那条线的投产比。目标有两种口径（`TargetBasis`）：
 *
 * - `profit`：想赚 T 元 → 广告费只花得下 ⑨ − T，于是 t = G ÷ (⑨ − T)。
 *   目标填 0 时算出来就是保本 ROAS，所以这行跟保本线共用一套说法，不必另讲一遍道理。
 * - `roas`：投产比本来就是填的那个数，反解一遍等于原样返回 ——
 *   真正要算的是它对应的广告费与净利，由调用方从 `roas` 与 `ceiling` 除出来。
 *
 * 两种口径填空（0）时都是保本线：净利填 0 是「不赚不亏」，投产比填 0 在本函数里按
 * 「没填」处理会有歧义，所以投产比口径要求 > 0，由校验消息说清。
 */
export function roasForTarget(input: RoiInputs, basis: TargetBasis, value: number): TargetRoasResult {
	const ceiling = computeMetrics(input).contributionProfit;
	if (input.gmv <= 0) return { error: '先填成交额，这条线才算得出来', roas: Number.NaN, ceiling };
	if (!Number.isFinite(value)) {
		return { error: `${basis === 'roas' ? '投产比' : '目标净利'}要填一个数字`, roas: Number.NaN, ceiling };
	}

	if (basis === 'roas') {
		if (!(value > 0)) return { error: '投产比要填一个大于 0 的数', roas: Number.NaN, ceiling };
		return { error: '', roas: value, ceiling };
	}

	if (value >= ceiling) {
		return {
			error: `净利天花板是 ${formatMoney(ceiling)} 元（贡献利润），目标 ${formatMoney(value)} 元够不到`,
			roas: Number.NaN,
			ceiling
		};
	}
	return { error: '', roas: input.gmv / (ceiling - value), ceiling };
}

// ---------------------------------------------------------------- 最该盯的一项

/**
 * 参与「最敏感」比拼的变量：只放经营上真能动的，成交额（规模）不算。
 * 退款三类各自单列 —— 它们能动的方向不一样（压未发货退款、提在途占比、提签收后的收回比例），
 * 合并成一个「退货率」的话，报出来的那一条没法照着做。
 */
const SENSITIVE_FIELDS: ReadonlyArray<{ key: keyof RoiInputs; label: string; kind: 'percent' | 'amount' }> = [
	{ key: 'costRate', label: '商品成本率', kind: 'percent' },
	{ key: 'commissionRate', label: '平台佣金率', kind: 'percent' },
	{ key: 'unshippedRefundRate', label: '未发货退款率', kind: 'percent' },
	{ key: 'shippedRefundRate', label: '已发货退款率', kind: 'percent' },
	{ key: 'inTransitRefundRate', label: '在途退款率', kind: 'percent' },
	{ key: 'recoverRate', label: '退货收回比例', kind: 'percent' },
	{ key: 'shipCost', label: '单均发货成本', kind: 'amount' },
	{ key: 'returnShipCost', label: '单均退货成本', kind: 'amount' },
	{ key: 'adCost', label: '广告花费', kind: 'amount' }
];

/**
 * 把每个变量各往两头试一遍（有值时 ±10%，档位见 `config.ts` 的 `SENSITIVE_RELATIVE_STEP`），
 * 返回「改善它净利涨得最多」的那一项。
 * 只报一个数，是因为新手面对十几个输入根本不知道先动哪个 —— 给一个答案比给一张表有用。
 *
 * 变量当前为 0 时改用绝对值档（`SENSITIVE_ZERO_*_STEP`，默认 +5 个百分点 / +5 元）——
 * 相对量乘不出东西，跳过等于漏掉它。
 * 一项都改善不了（全是最优值）时返回 null，由调用方决定说不说。
 *
 * 「在途退款率」往上试时会超过「已发货退款率」—— `computeMetrics` 里那记 `Math.min`
 * 会把它钳回去，于是 gain 为 0，不会报出一个其实做不到的收益。
 */
export function mostSensitive(input: RoiInputs): SensitiveItem | null {
	const base = computeMetrics(input).netProfit;
	let best: SensitiveItem | null = null;

	for (const field of SENSITIVE_FIELDS) {
		const current = input[field.key] as number;
		const step =
			current !== 0
				? current * SENSITIVE_RELATIVE_STEP
				: field.kind === 'percent'
					? SENSITIVE_ZERO_PERCENT_STEP
					: SENSITIVE_ZERO_AMOUNT_STEP;
		for (const direction of ['up', 'down'] as const) {
			const next = direction === 'up' ? current + step : current - step;
			if (next < 0) continue;
			if (field.kind === 'percent' && next > 1) continue;
			const gain = computeMetrics({ ...input, [field.key]: next }).netProfit - base;
			if (best === null || gain > best.gain) {
				best = { label: field.label, direction, current, next, kind: field.kind, gain };
			}
		}
	}
	return best !== null && best.gain > 0 ? best : null;
}

// ---------------------------------------------------------------- 敏感性表

/**
 * 退货率档位 → 保本 ROAS 与净利：卖易退货的品类（服装）最该看这张。
 *
 * 扫的是**退款总额**，三类的**相对结构保持不变**（同乘一个系数）——
 * 现实中「退货率涨了」涨的是整体，不会只涨某一类；保持结构才能回答
 * 「按我这盘生意的退款构成，退款率涨到几成会吃掉全部利润」。
 *
 * 一类都没填（退款总额 0）时没有结构可缩放，退化成「全部按已发货退款算」——
 * 已发货退款的成本更高，是保守的那一边，不会给出一条过于乐观的曲线。
 */
export function breakEvenByReturnRate(input: RoiInputs): ReturnRateRow[] {
	const baseTotal = input.unshippedRefundRate + input.shippedRefundRate;
	const hasStructure = baseTotal > 0;
	return RETURN_RATE_STEPS.map((ratePercent) => {
		const scale = hasStructure ? ratePercent / 100 / baseTotal : 0;
		const metrics = computeMetrics({
			...input,
			unshippedRefundRate: hasStructure ? input.unshippedRefundRate * scale : 0,
			shippedRefundRate: hasStructure ? input.shippedRefundRate * scale : ratePercent / 100,
			inTransitRefundRate: hasStructure ? input.inTransitRefundRate * scale : 0
		});
		return { ratePercent, breakEvenRoas: metrics.breakEvenRoas, netProfit: metrics.netProfit };
	});
}

/**
 * ROAS 档位 → 净利：反推每个 ROAS 对应的广告费，再算净利。
 * 广告费只进入 netProfit 的线性项，所以直接用贡献利润减掉即可，不必整段重算。
 *
 * `steps` 默认是整盘口径那组固定档位；单件口径没有「当前 ROAS」可标，
 * 档位由 `roasStepsFor` 围着保本线现算后传进来。
 */
export function profitByRoas(input: RoiInputs, steps: readonly number[] = ROAS_STEPS): RoasRow[] {
	const base = computeMetrics(input);
	return steps.map((roas) => {
		const adCost = input.gmv / roas;
		return { roas, adCost, netProfit: base.contributionProfit - adCost };
	});
}

/**
 * 单件口径的 ROAS 档位：围着保本线现算，而不是用固定档位。
 *
 * 整盘口径填了「现在的 ROAS」，固定档位配一行高亮就够用；单件口径没有这个值
 * （输入里压根没有广告费），固定 1~6 会在保本线超过 6 时**整张表全红** ——
 * 用户问的是「ROAS 到多少能赚多少」，一张全是亏的表等于没回答。
 *
 * 取保本线**向上取整**当中心：往上取整保证中心那一档已经过线（净利为正，
 * 不会退化成一个「保本售价 = 现价」的恒等式），往下一档看「差一点会怎样」，
 * 再往上几档看「越做越高能多赚多少」。
 * 保本线不存在（贡献利润 ≤ 0）时没有中心可取，退回固定档位，由文案去说明「投多少都亏」。
 *
 * 一共 `UNIT_ROAS_STEP_COUNT` 档、围着中心取连续的整数（往下 `UNIT_ROAS_STEPS_BELOW_CENTER` 档，其余往上）：
 * 往下多留几档只是重复「亏」这件事，多出来的位置给上面更有用 —— 用户问的是「做到多少能赚多少」。
 * 跟退货率表同为 10 行（两张表上下排时高度对得上）。
 */
export function roasStepsFor(breakEvenRoas: number): number[] {
	if (!Number.isFinite(breakEvenRoas) || breakEvenRoas <= 0) return [...ROAS_STEPS];
	const center = Math.ceil(breakEvenRoas);
	return Array.from({ length: UNIT_ROAS_STEP_COUNT }, (_, i) => center - UNIT_ROAS_STEPS_BELOW_CENTER + i).filter(
		(value) => value >= 1
	);
}
