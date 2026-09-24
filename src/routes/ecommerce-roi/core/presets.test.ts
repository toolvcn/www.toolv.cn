// 参数预设的单测：导出→导入能原样回来、坏文件逐类拒掉、缺省字段有兜底、摘要行不会出 NaN。
// 跟 http 的 presets 一样，这里只管纯函数；localStorage 那一段在 +page.svelte，不在这里测。
import { describe, expect, it } from 'vitest';
import {
	parsePresets,
	parseSession,
	presetDetail,
	presetSummary,
	serializePresets,
	serializeSession,
	type RoiPreset,
	type RoiSession
} from './presets.ts';
import { EMPTY_INPUTS, EXAMPLE_INPUTS, UNIT_EXAMPLE_INPUTS } from '../config.ts';

/** 一条示例预设：整盘示例 + 单件示例 + 目标净利率 */
function examplePreset(id = 7): RoiPreset {
	return {
		id,
		name: '成本率五成的盘',
		mode: 'batch',
		inputs: { ...EXAMPLE_INPUTS },
		unitInputs: { ...UNIT_EXAMPLE_INPUTS },
		targetMargin: '20'
	};
}

/**
 * 悬浮卡是「组 + 字段名 + 值」的结构，测试按组名与字段名去取 —— 不靠拼好的字符串，
 * 免得「格式变了但内容对」时测试跟着一起改。
 */
function fieldValue(groups: ReturnType<typeof presetDetail>, group: string, label: string): string | undefined {
	return groups.find((item) => item.name === group)?.fields.find((field) => field.label === label)?.value;
}

// 「字段缺失」用「显式置 undefined」来模拟：JSON.stringify 会把 undefined 的键整个丢掉，
// 序列化出来的就是缺字段的文件，不用为测试再写一个删键的辅助函数。

describe('预设导出', () => {
	it('导出再导入能原样回来（口径、两套输入、目标净利率都不丢）', () => {
		const presets = [examplePreset(), { ...examplePreset(8), name: '单件试价', mode: 'unit' as const }];
		const parsed = parsePresets(serializePresets(presets));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets).toHaveLength(2);
		expect(parsed.presets[0]).toEqual({
			name: '成本率五成的盘',
			mode: 'batch',
			inputs: EXAMPLE_INPUTS,
			unitInputs: UNIT_EXAMPLE_INPUTS,
			targetMargin: '20'
		});
		expect(parsed.presets[1].mode).toBe('unit');
	});

	it('导出文本里不带 id（它只是列表渲染的 key）', () => {
		const file = JSON.parse(serializePresets([examplePreset(424242)])) as unknown[];
		expect(file).toHaveLength(1);
		expect(file[0]).not.toHaveProperty('id');
	});

	it('一条都没有时导出空数组，仍是能再导入回去的合法文件', () => {
		expect(parsePresets(serializePresets([]))).toEqual({ ok: true, presets: [] });
	});

	it('成本的填法跟着预设一起走：按金额存的，导入回来还是按金额、数字不变', () => {
		const preset = {
			...examplePreset(),
			inputs: { ...EXAMPLE_INPUTS, costMode: 'unit' as const, costRate: '34.95' }
		};
		const parsed = parsePresets(serializePresets([preset]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.costMode).toBe('unit');
		expect(parsed.presets[0].inputs.costRate).toBe('34.95');
	});

	it('退款填法跟着预设一起走：按金额存的，导入回来还是按金额、三格的数不变', () => {
		const preset = {
			...examplePreset(),
			inputs: {
				...EXAMPLE_INPUTS,
				refundMode: 'amount' as const,
				unshippedRefundRate: '1398',
				shippedRefundRate: '1048.5',
				inTransitRefundRate: '349.5'
			}
		};
		const parsed = parsePresets(serializePresets([preset]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.refundMode).toBe('amount');
		expect(parsed.presets[0].inputs.unshippedRefundRate).toBe('1398');
		expect(parsed.presets[0].inputs.shippedRefundRate).toBe('1048.5');
		expect(parsed.presets[0].inputs.inTransitRefundRate).toBe('349.5');
	});
});

describe('会话快照（当前正在填的那组）', () => {
	it('存进去再读回来，口径、两套输入、目标净利率都不丢', () => {
		const session: RoiSession = {
			mode: 'unit',
			inputs: { ...EXAMPLE_INPUTS },
			unitInputs: { ...UNIT_EXAMPLE_INPUTS },
			targetMargin: '25'
		};
		expect(parseSession(serializeSession(session))).toEqual(session);
	});

	it('填法跟着回来：按 ROAS 的广告、按金额的退款', () => {
		const session: RoiSession = {
			mode: 'batch',
			inputs: {
				...EXAMPLE_INPUTS,
				adMode: 'roas',
				adCost: '6',
				refundMode: 'amount',
				unshippedRefundRate: '1398'
			},
			unitInputs: { ...UNIT_EXAMPLE_INPUTS },
			targetMargin: '20'
		};
		const parsed = parseSession(serializeSession(session));
		expect(parsed?.inputs.adMode).toBe('roas');
		expect(parsed?.inputs.adCost).toBe('6');
		expect(parsed?.inputs.refundMode).toBe('amount');
		expect(parsed?.inputs.unshippedRefundRate).toBe('1398');
	});

	it('坏数据整份丢弃（返回 null），不恢复成半套参数', () => {
		expect(parseSession('{oops')).toBeNull();
		expect(parseSession('[]')).toBeNull();
		expect(
			parseSession(JSON.stringify({ mode: 'weekly', inputs: EXAMPLE_INPUTS, unitInputs: UNIT_EXAMPLE_INPUTS }))
		).toBeNull();
		// 少一个字段也整份丢弃
		expect(
			parseSession(
				JSON.stringify({
					mode: 'batch',
					inputs: { ...EXAMPLE_INPUTS, gmv: undefined },
					unitInputs: { ...UNIT_EXAMPLE_INPUTS },
					targetMargin: '20'
				})
			)
		).toBeNull();
	});

	it('老快照没有 costMode / adMode / refundMode 时回落默认，数字原样算回', () => {
		const legacy = JSON.stringify({
			mode: 'batch',
			inputs: { ...EXAMPLE_INPUTS, costMode: undefined, adMode: undefined, refundMode: undefined },
			unitInputs: { ...UNIT_EXAMPLE_INPUTS, refundMode: undefined },
			targetMargin: '20'
		});
		const parsed = parseSession(legacy);
		expect(parsed?.inputs.costMode).toBe('rate');
		expect(parsed?.inputs.adMode).toBe('cost');
		expect(parsed?.inputs.refundMode).toBe('rate');
		expect(parsed?.unitInputs.refundMode).toBe('rate');
		expect(parsed?.inputs.unshippedRefundRate).toBe('20');
	});

	it('缺 targetMargin 时回落到默认 20（它只影响单件反推，不值得整份丢弃）', () => {
		const parsed = parseSession(
			JSON.stringify({ mode: 'batch', inputs: EXAMPLE_INPUTS, unitInputs: UNIT_EXAMPLE_INPUTS })
		);
		expect(parsed?.targetMargin).toBe('20');
	});
});

describe('预设导入的校验', () => {
	it('老文件里没有 costMode 字段，按「按比例」补 —— 那时 costRate 只可能是百分数', () => {
		const legacy = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, costMode: undefined } }];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.costMode).toBe('rate');
	});

	it('costMode 写了认不出的值也回落「按比例」，不给半套语义', () => {
		const weird = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, costMode: 'per_kg' } }];
		const parsed = parsePresets(JSON.stringify(weird));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.costMode).toBe('rate');
	});

	it('广告的填法跟着预设一起走：按 ROAS 存的，导入回来还是按 ROAS、数字不变', () => {
		const preset = { ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, adMode: 'roas' as const, adCost: '6' } };
		const parsed = parsePresets(serializePresets([preset]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.adMode).toBe('roas');
		expect(parsed.presets[0].inputs.adCost).toBe('6');
	});

	it('老文件里没有 adMode 字段，按「填的是元」补 —— 那时 adCost 只可能是广告花费', () => {
		const legacy = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, adMode: undefined } }];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.adMode).toBe('cost');
		expect(parsed.presets[0].inputs.adCost).toBe('1165');
	});

	it('adMode 写了认不出的值也回落「填的是元」，不给半套语义', () => {
		const weird = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, adMode: 'gmv' } }];
		const parsed = parsePresets(JSON.stringify(weird));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.adMode).toBe('cost');
	});

	it('订单数的填法跟着预设一起走：按客单价存的，导入回来还是按客单价、数字不变', () => {
		const preset = { ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, ordersMode: 'aov' as const, orders: '69.9' } };
		const parsed = parsePresets(serializePresets([preset]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.ordersMode).toBe('aov');
		expect(parsed.presets[0].inputs.orders).toBe('69.9');
	});

	it('老文件里没有 ordersMode，按「按单数」补 —— 那时这一格只可能是单数', () => {
		const legacy = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, ordersMode: undefined } }];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.ordersMode).toBe('count');
		expect(parsed.presets[0].inputs.orders).toBe('100');
	});

	it('ordersMode 写了认不出的值也回落「按单数」，不给半套语义', () => {
		const weird = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, ordersMode: 'aov2' } }];
		const parsed = parsePresets(JSON.stringify(weird));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.ordersMode).toBe('count');
	});

	it('老文件里没有 refundMode，按「按比例」补 —— 那时三格只可能是百分数', () => {
		const legacy = [
			{
				...examplePreset(),
				inputs: { ...EXAMPLE_INPUTS, refundMode: undefined },
				unitInputs: { ...UNIT_EXAMPLE_INPUTS, refundMode: undefined }
			}
		];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.refundMode).toBe('rate');
		expect(parsed.presets[0].unitInputs.refundMode).toBe('rate');
		// 三格的数原样算回同一组：补 rate 不改数字
		expect(parsed.presets[0].inputs.unshippedRefundRate).toBe('20');
	});

	it('refundMode 写了认不出的值也回落「按比例」，不给半套语义', () => {
		const weird = [
			{
				...examplePreset(),
				inputs: { ...EXAMPLE_INPUTS, refundMode: 'yuan' },
				unitInputs: { ...UNIT_EXAMPLE_INPUTS, refundMode: 'yuan' }
			}
		];
		const parsed = parsePresets(JSON.stringify(weird));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.refundMode).toBe('rate');
		expect(parsed.presets[0].unitInputs.refundMode).toBe('rate');
	});
	it('不是 JSON、不是数组都拒掉', () => {
		expect(parsePresets('{oops')).toEqual({ ok: false, error: '文件不是合法的 JSON' });
		expect(parsePresets('{"a":1}')).toEqual({ ok: false, error: '文件内容应为预设数组' });
	});

	it('没有名称、口径不合法的条目拒掉', () => {
		expect(parsePresets(JSON.stringify([{ ...examplePreset(), name: '  ' }]))).toEqual({
			ok: false,
			error: '存在没有名称的预设'
		});
		expect(parsePresets(JSON.stringify([{ ...examplePreset(), mode: 'weekly' }]))).toEqual({
			ok: false,
			error: '预设口径不合法：weekly'
		});
	});

	it('整盘少一个字段就整单失败，不给用户半套数据', () => {
		const broken = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, gmv: undefined } }];
		expect(parsePresets(JSON.stringify(broken))).toEqual({
			ok: false,
			error: '整盘参数的字段「gmv」缺失或不是字符串'
		});
	});

	it('字段类型不对（数字塞进字符串位）也拒掉', () => {
		const broken = [{ ...examplePreset(), unitInputs: { ...UNIT_EXAMPLE_INPUTS, shipCost: 6 } }];
		expect(parsePresets(JSON.stringify(broken))).toEqual({
			ok: false,
			error: '单件参数的字段「shipCost」缺失或不是字符串'
		});
	});

	it('老文件里多出来的 roas 被忽略：单件口径不再填投产比，但老预设不会整份作废', () => {
		// roas 不在单件字段名单里，readTexts 只挑名单上的字段读 —— 多出来的键既不参与校验、
		// 也不进结果。老预设导进来算出的数会变（当年那个 ROAS 现在由结果卡临时给），
		// 但文件照样能读，不至于让人重新填一遍。
		const legacy = [{ ...examplePreset(), unitInputs: { ...UNIT_EXAMPLE_INPUTS, roas: '6' } }];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].unitInputs).toEqual(UNIT_EXAMPLE_INPUTS);
	});

	it('老文件里这一项叫 resaleRate，搬成 recoverRate 继续用，不让老预设整份作废', () => {
		const legacy = [
			{
				name: '上个版本存的',
				mode: 'batch',
				inputs: { ...EXAMPLE_INPUTS, recoverRate: undefined, resaleRate: '80' },
				unitInputs: { ...UNIT_EXAMPLE_INPUTS, recoverRate: undefined, resaleRate: '60' }
			}
		];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.recoverRate).toBe('80');
		expect(parsed.presets[0].unitInputs.recoverRate).toBe('60');
	});

	it('两个名字都在时以新名字为准，老名字不会把新值顶掉', () => {
		const both = [{ ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, resaleRate: '80' } }];
		const parsed = parsePresets(JSON.stringify(both));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		// 新名字在场就不该被 resaleRate 覆盖（值取自示例，改示例不会让这条失真）
		expect(parsed.presets[0].inputs.recoverRate).toBe(EXAMPLE_INPUTS.recoverRate);
	});

	it('拆分前的老文件只有一个 returnRate：整份落进「已发货退款率」，另两类补 0', () => {
		// 这是老预设导入后算出的数与当时一致的关键：三类退化成一类，公式给出同一组结果
		const legacy = [
			{
				name: '拆分前存的',
				mode: 'batch',
				inputs: {
					...EXAMPLE_INPUTS,
					shippedRefundRate: undefined,
					unshippedRefundRate: undefined,
					inTransitRefundRate: undefined,
					returnRate: '35'
				},
				unitInputs: {
					...UNIT_EXAMPLE_INPUTS,
					shippedRefundRate: undefined,
					unshippedRefundRate: undefined,
					inTransitRefundRate: undefined,
					returnRate: '35'
				}
			}
		];
		const parsed = parsePresets(JSON.stringify(legacy));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.unshippedRefundRate).toBe('0');
		expect(parsed.presets[0].inputs.shippedRefundRate).toBe('35');
		expect(parsed.presets[0].inputs.inTransitRefundRate).toBe('');
		expect(parsed.presets[0].unitInputs.shippedRefundRate).toBe('35');
	});

	it('缺 commissionRefunded 按「退还」补，缺 targetMargin 按默认 20 补', () => {
		const parsed = parsePresets(
			JSON.stringify([
				{
					name: '手写的',
					mode: 'unit',
					inputs: { ...EXAMPLE_INPUTS, commissionRefunded: undefined },
					unitInputs: { ...UNIT_EXAMPLE_INPUTS, commissionRefunded: undefined }
				}
			])
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].inputs.commissionRefunded).toBe(true);
		expect(parsed.presets[0].unitInputs.commissionRefunded).toBe(true);
		expect(parsed.presets[0].targetMargin).toBe('20');
	});

	it('名称首尾空白会被裁掉', () => {
		const parsed = parsePresets(JSON.stringify([{ ...examplePreset(), name: '  成本率五成  ' }]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].name).toBe('成本率五成');
	});
});

describe('预设条目的摘要行', () => {
	it('整盘给 广告 + 成交额，单件给 售价 + 单件成本', () => {
		const batch = presetSummary(examplePreset());
		expect(batch).toContain('广告 1165.00 元');
		expect(batch).toContain('成交额 6990.00');

		// 广告那格跟着**填法**走：填的是 ROAS 就回显 ROAS，不换算成钱（换算过的数跟输入框对不上）
		const byRoas = presetSummary({
			...examplePreset(),
			inputs: { ...EXAMPLE_INPUTS, adMode: 'roas', adCost: '6' }
		});
		expect(byRoas).toContain('广告 ROAS 6');
		expect(byRoas).not.toContain('1165');

		const unit = presetSummary({ ...examplePreset(), mode: 'unit' });
		expect(unit).toContain('售价 69.90');
		expect(unit).toContain('单件成本 35.00 元');
	});

	it('字段空着或不是数字时给占位，而不是 NaN', () => {
		const blank = { ...examplePreset(), mode: 'unit' as const, unitInputs: { ...UNIT_EXAMPLE_INPUTS, price: '' } };
		expect(presetSummary(blank)).toContain('售价 —');
		const garbage = { ...blank, unitInputs: { ...UNIT_EXAMPLE_INPUTS, price: '十二' } };
		expect(presetSummary(garbage)).toContain('售价 —');
	});

	it('广告没填时给占位，不摆一个「广告 0 元」', () => {
		const noAd = { ...examplePreset(), inputs: { ...EXAMPLE_INPUTS, adCost: '' } };
		expect(presetSummary(noAd)).toContain('广告 —');
		expect(presetSummary(noAd)).toContain('成交额 6990.00');
	});

	it('悬浮卡摊开该预设口径那一套的全部参数，一字段一行', () => {
		const batch = presetDetail(examplePreset());
		expect(fieldValue(batch, '成交与广告', '成交额')).toBe('6990 元');
		expect(fieldValue(batch, '退货', '未发货退款率')).toBe('20%');
		expect(fieldValue(batch, '成本项', '单均发货成本')).toBe('3 元');
		// 目标净利属于「这次试算」而不是存下来的参数 —— 卡片里没有这一组
		expect(batch.map((group) => group.name)).not.toContain('目标');
		// 空组不画：剩下的每组都得有字段
		expect(batch.every((group) => group.fields.length > 0)).toBe(true);

		// 单件口径摊的是另一套，两套互不串味
		const unit = presetDetail({ ...examplePreset(), mode: 'unit' });
		expect(fieldValue(unit, '商品', '售价')).toBe('69.9 元/件');
		expect(fieldValue(unit, '目标', '目标净利率')).toBe('20%');
		expect(unit.map((group) => group.name)).not.toContain('成交与广告');
	});

	it('全空的预设不给卡片（一组字段都没有）', () => {
		expect(presetDetail({ ...examplePreset(), inputs: { ...EMPTY_INPUTS } })).toEqual([]);
	});
});
