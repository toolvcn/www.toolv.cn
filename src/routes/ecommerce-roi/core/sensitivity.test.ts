// 敏感性表的单测：退货率档位、ROAS 档位（含单件口径围着保本线现算）、
// 目标（净利 / 广告 ROI 两种口径）→ 需要的 ROAS、最该盯的一项。
import { describe, expect, it } from 'vitest';
import { parseInputs, parseUnitInputs } from './parse.ts';
import { computeMetrics } from './metrics.ts';
import {
	breakEvenByReturnRate,
	mostSensitive,
	profitByRoas,
	profitForTargetRoas,
	roasForTarget,
	roasForTargetProfit,
	roasStepsFor
} from './sensitivity.ts';
import { EXAMPLE_INPUTS, UNIT_EXAMPLE_INPUTS } from '../config.ts';
import type { RoiInputs } from './types.ts';

/** 示例用例的数值输入，供下面几组断言共用 */
function exampleInputs(): RoiInputs {
	const parsed = parseInputs(EXAMPLE_INPUTS);
	if (!parsed.ok) throw new Error('示例数据不该解析失败：' + parsed.error);
	return parsed.inputs;
}

describe('敏感性表', () => {
	it('退货率越高，保本 ROAS 越高、净利越低', () => {
		const rows = breakEvenByReturnRate(exampleInputs());
		expect(rows.map((row) => row.ratePercent)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i].breakEvenRoas).toBeGreaterThan(rows[i - 1].breakEvenRoas);
			expect(rows[i].netProfit).toBeLessThan(rows[i - 1].netProfit);
		}
		// 退货率归零时净利必然高于示例退货率下的净利
		expect(rows[0].netProfit).toBeGreaterThan(computeMetrics(exampleInputs()).netProfit);
	});

	it('退款率推到 80% 保本线已高到不可达，90% 净利直接转负', () => {
		const rows = breakEvenByReturnRate(exampleInputs());
		const base = computeMetrics(exampleInputs());
		// 档位扫的是退款总额，三类的相对结构按当前比例同比缩放
		expect(Number.isFinite(rows[8].breakEvenRoas)).toBe(true);
		// 80% 档的保本线已经高出示例完整口径好几倍 —— 这个退货率下现实中做不到
		expect(rows[8].breakEvenRoas).toBeGreaterThan(base.breakEvenRoas * 3);
		expect(rows[8].netProfit).toBeLessThan(base.netProfit);
		// 90% 档：净利转负。保本线这时还是一条有限值（贡献利润仍为正），再往上才是 Infinity
		expect(rows[9].netProfit).toBeLessThan(0);
	});

	it('贡献利润被吃成负数时，保本线报 Infinity 而不是一个假的有限值', () => {
		// 成本率 90% 再叠 90% 退款 —— 投多少都亏
		const rows = breakEvenByReturnRate({ ...exampleInputs(), costRate: 0.9 });
		expect(rows[9].breakEvenRoas).toBe(Number.POSITIVE_INFINITY);
	});

	it('ROAS 档位表：净利随 ROAS 单调上升，且 ROAS 等于保本线时归零', () => {
		const rows = profitByRoas(exampleInputs());
		expect(rows.map((row) => row.roas)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i].netProfit).toBeGreaterThan(rows[i - 1].netProfit);
		}
		// 每行的广告费确实是「成交额 ÷ ROAS」
		expect(rows[2].adCost).toBeCloseTo(6990 / 3, 6);
	});

	it('档位可以现传：profitByRoas 按传入的档位算，一行都不多', () => {
		const rows = profitByRoas(exampleInputs(), [2, 3, 4]);
		expect(rows.map((row) => row.roas)).toEqual([2, 3, 4]);
		expect(rows[0].adCost).toBeCloseTo(6990 / 2, 6);
		expect(rows[1].netProfit).toBeGreaterThan(rows[0].netProfit);
	});

	it('单件口径的档位围着保本线现算，且不会出现 0 或负数', () => {
		// 示例的保本线 4.838793… → 向上取整 5，档位就是 2…11（往下 3 档、往上 6 档，共 10 档）
		expect(roasStepsFor(4.838793416748871)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
		// 保本线正好是整数时中心就是它本身
		expect(roasStepsFor(4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		// 保本线很低时「中心减三」会落到 0 与负数，滤掉而不是留几行 ROAS ≤ 0
		expect(roasStepsFor(0.5)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		// 保本线不存在（贡献利润 ≤ 0）时没有中心可取，退回固定档位，由文案去说「投多少都亏」
		expect(roasStepsFor(Number.POSITIVE_INFINITY)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(roasStepsFor(0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('单件口径：整张表从保本线那档开始转正，往下看全是亏', () => {
		const parsed = parseUnitInputs(UNIT_EXAMPLE_INPUTS);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const base = computeMetrics(parsed.inputs);
		expect(Math.ceil(base.breakEvenRoas)).toBe(4);

		const rows = profitByRoas(parsed.inputs, roasStepsFor(base.breakEvenRoas));
		expect(rows.map((row) => row.roas)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		// 保本线 3.93：前三档（1/2/3）在它之下，全是亏的
		for (const row of rows.slice(0, 3)) expect(row.netProfit).toBeLessThan(0);
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i].netProfit).toBeGreaterThan(rows[i - 1].netProfit);
		}
		// 第一档过线的是 ROAS 4（也就是档位数组的下标 3），它是唯一「刚够保本」的那档
		expect(rows[3].roas).toBe(4);
		for (const row of rows.slice(3)) expect(row.netProfit).toBeGreaterThan(0);
		// 每件净利 = 每件贡献利润 − 售价 ÷ ROAS
		expect(rows[3].netProfit).toBeCloseTo(base.contributionProfit - 69.9 / 4, 10);
	});
});

describe('目标 → 需要的 ROAS', () => {
	/** 按反推出来的 ROAS 投放，净利应当正好等于目标（这是这条公式唯一该保证的事） */
	function profitAt(inputs: RoiInputs, roas: number): number {
		return computeMetrics({ ...inputs, adCost: inputs.gmv / roas }).netProfit;
	}

	it('目标填 0 就是保本线（两种口径填到同一个点）', () => {
		const inputs = exampleInputs();
		const byProfit = roasForTarget(inputs, 'profit', 0);
		expect(byProfit.error).toBe('');
		expect(byProfit.roas).toBeCloseTo(computeMetrics(inputs).breakEvenRoas, 10);

		// 投产比口径填的就是保本线本身 —— 两个口径在这一点重合
		const byRoas = roasForTarget(inputs, 'roas', byProfit.roas);
		expect(byRoas.error).toBe('');
		expect(byRoas.roas).toBeCloseTo(byProfit.roas, 10);
		// 这条线上广告费正好是天花板、净利归零
		expect(inputs.gmv / byRoas.roas).toBeCloseTo(byRoas.ceiling, 6);
	});

	it('按反推的 ROAS 投放，净利正好是目标值', () => {
		const inputs = exampleInputs();
		const target = roasForTarget(inputs, 'profit', 1000);
		expect(target.error).toBe('');
		expect(profitAt(inputs, target.roas)).toBeCloseTo(1000, 6);
		// 目标越高，需要的 ROAS 越高（示例盘的净利天花板是 1782.585，不能越过它）
		expect(roasForTarget(inputs, 'profit', 1200).roas).toBeGreaterThan(target.roas);
	});

	it('按投产比试算：要投入多少广告费、能赚多少，与按净利口径同源', () => {
		const inputs = exampleInputs();
		const byRoas = roasForTarget(inputs, 'roas', 6);
		expect(byRoas.error).toBe('');
		expect(byRoas.roas).toBe(6);

		// 广告费 = 成交额 ÷ 投产比；净利 = 天花板 − 广告费（就是界面那一行给的两个读数）
		const adCost = inputs.gmv / byRoas.roas;
		expect(adCost).toBeCloseTo(1165, 6);
		expect(byRoas.ceiling - adCost).toBeCloseTo(profitAt(inputs, 6), 6);
		// 同一条线按净利口径反推回来还是这个投产比
		expect(roasForTarget(inputs, 'profit', byRoas.ceiling - adCost).roas).toBeCloseTo(6, 10);
	});

	it('投产比填 0 或负数时给中文原因，不拿它去除成交额', () => {
		const inputs = exampleInputs();
		expect(roasForTarget(inputs, 'roas', 0).error).toContain('大于 0');
		expect(roasForTarget(inputs, 'roas', -2).error).toContain('大于 0');
	});

	it('目标超过天花板（贡献利润）时说清够不到，不给一个假数', () => {
		const inputs = exampleInputs();
		const ceiling = computeMetrics(inputs).contributionProfit;
		const target = roasForTarget(inputs, 'profit', ceiling + 1);
		expect(target.roas).toBeNaN();
		expect(target.error).toContain('天花板');
		expect(target.ceiling).toBeCloseTo(ceiling, 6);
	});

	it('两种口径互相换算：一个来回回到原值，越过天花板则无解', () => {
		const gmv = 6990;
		const ceiling = 1782.585;
		const roas = roasForTargetProfit(gmv, ceiling, 500);
		expect(roas).toBeCloseTo(5.45, 2);
		expect(profitForTargetRoas(gmv, ceiling, roas)).toBeCloseTo(500, 6);
		// 「打算亏」的负数目标也换得过来（投产比低于保本线）
		expect(roasForTargetProfit(gmv, ceiling, -500)).toBeLessThan(computeMetrics(exampleInputs()).breakEvenRoas);
		// 目标等于或高过天花板：广告费 ≤ 0，投产比无从谈起
		expect(roasForTargetProfit(gmv, ceiling, ceiling)).toBeNaN();
		expect(roasForTargetProfit(gmv, ceiling, ceiling + 1)).toBeNaN();
	});

	it('目标不是一个数字时按口径报错', () => {
		const inputs = exampleInputs();
		expect(roasForTarget(inputs, 'profit', Number.NaN).error).toContain('目标净利');
		expect(roasForTarget(inputs, 'roas', Number.NaN).error).toContain('投产比');
	});

	it('还没填成交额时不反推', () => {
		const target = roasForTarget({ ...exampleInputs(), gmv: 0 }, 'profit', 100);
		expect(target.roas).toBeNaN();
		expect(target.error).toContain('成交额');
	});
});

describe('最该盯的一项', () => {
	it('示例盘里最值的是商品成本率，降 10% 净利涨得最多', () => {
		const inputs = exampleInputs();
		const item = mostSensitive(inputs);
		expect(item).not.toBeNull();
		if (!item) return;
		expect(item.label).toBe('商品成本率');
		expect(item.direction).toBe('down');
		expect(item.next).toBeCloseTo(inputs.costRate * 0.9, 10);

		// 拿「改成这个值重算一遍」验证 gain 不是编出来的
		const base = computeMetrics(inputs).netProfit;
		const after = computeMetrics({ ...inputs, costRate: item.next }).netProfit;
		expect(after - base).toBeCloseTo(item.gain, 6);
		expect(item.gain).toBeGreaterThan(0);
	});

	it('每一项都已经在最优（全 0）时返回 null，不硬凑一个答案', () => {
		// 三类退款都要置 0：只清「总退货率」的话未发货那一类还留着 20%，
		// 把它降下来照样能多赚 —— 那是真的还有余量，不是函数硬凑答案
		const inputs: RoiInputs = {
			...exampleInputs(),
			costRate: 0,
			commissionRate: 0,
			unshippedRefundRate: 0,
			shippedRefundRate: 0,
			inTransitRefundRate: 0,
			recoverRate: 0,
			shipCost: 0,
			returnShipCost: 0,
			adCost: 0
		};
		expect(mostSensitive(inputs)).toBeNull();
	});
});
