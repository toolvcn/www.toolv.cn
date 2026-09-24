// 电商 ROI 的**可配置参数**：默认值、示例与空盘数据、敏感性档位与步长、输入上限、本地存储。
// 后期要调这一页的行为，先改这里 —— 不必去 core/ 与 ui/ 里翻。
//
// 边界（免得这个文件越长越杂，也免得下一个人不知道某样东西该不该放进来）：
//   - 只放**业务数值与开关**。类型在 `core/types.ts`、界面文案在各 ui 组件的 label / hint、
//     样式在 `ui/styles.ts`、格式化的位数在 `core/format.ts` —— 都不进这里。
//   - 纯数据、不碰 DOM：`core/*`、`ui/*` 与 `+page.svelte` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找；
// 与 STRUCTURE §1「逻辑进 core/」的偏离是有意的，理由是「让人一眼看到去哪改」。
import type { RoiTextInputs, UnitTextInputs } from './core/types.ts';

// ---------------------------------------------------------------- 默认值

/** 目标净利率（对售价）：反推最低售价与最高成本时用，默认 20% */
export const DEFAULT_TARGET_MARGIN = '20';

/** 规模试算的默认销量（单）：「卖多少单」那格留空时按这个算 */
export const DEFAULT_SCALE_QUANTITY = 100;

// ---------------------------------------------------------------- 示例与空盘数据

/**
 * 示例数据：一款成本率 50%、退款总额 35%（未发货 20 + 在途 2 + 签收后 13）、
 * 签收退货能收回 98%、单均退货成本 1 元的商品盘（也是首页卡片与单测共用的基准）。
 *
 * 三类都给了非零值，是为了让首屏就能看出「同一笔退款，三类承担的成本完全不同」——
 * 只填一个总退货率的话，这个工具最大的能力在示例里根本看不见。
 * 收回比例取 98% 而不是 100%：现实里退回来的货多少有一点折损（二次销售要降价），
 * 但**不给 0 或很低的值** —— 示例要展示的是「退货不等于全损」，不是「退货就是亏」。
 * 数字已在 README 里逐项算过，改这里要同步改那篇。
 */
export const EXAMPLE_INPUTS: RoiTextInputs = {
	adCost: '1165',
	adMode: 'cost',
	gmv: '6990',
	orders: '100',
	ordersMode: 'count',
	costRate: '50',
	costMode: 'rate',
	commissionRate: '5',
	shipCost: '3',
	refundMode: 'rate',
	unshippedRefundRate: '20',
	shippedRefundRate: '15',
	inTransitRefundRate: '2',
	recoverRate: '98',
	returnShipCost: '1',
	otherCost: '0',
	commissionRefunded: true
};

/** 空盘：清空按钮用，比把 example 逐项置空更不容易漏字段 */
export const EMPTY_INPUTS: RoiTextInputs = {
	adCost: '',
	adMode: 'cost',
	gmv: '',
	orders: '',
	ordersMode: 'count',
	costRate: '',
	costMode: 'rate',
	commissionRate: '',
	shipCost: '',
	refundMode: 'rate',
	unshippedRefundRate: '',
	shippedRefundRate: '',
	inTransitRefundRate: '',
	recoverRate: '',
	returnShipCost: '',
	otherCost: '',
	commissionRefunded: true
};

/**
 * 单件口径的示例：跟整盘示例是同一盘生意的两条读法。
 * 换算关系必须逐项对得上（单测里有断言）：售价 69.9 × 100 单 = 成交额 6990、
 * 单件成本 35 ÷ 售价 69.9 ≈ 成本率 **50.07%**（不是整数 50% —— 示例取 35 而不是 34.95，
 * 就是要让「按金额填」这条路的成本率除不尽，那正是这个填法存在的理由，见 README 的输入项一节）。
 *
 * 广告费不在这边 —— 单件口径只算广告费之前的账，所以它跟整盘示例一致的是
 * 保本 ROAS 与毛利率，而不是净利润（整盘的净利还要再扣掉那 1165 元广告费）。
 */
export const UNIT_EXAMPLE_INPUTS: UnitTextInputs = {
	price: '69.9',
	unitCost: '35',
	shipCost: '3',
	commissionRate: '5',
	refundMode: 'rate',
	unshippedRefundRate: '20',
	shippedRefundRate: '15',
	inTransitRefundRate: '2',
	recoverRate: '98',
	returnShipCost: '1',
	commissionRefunded: true
};

/** 单件口径的空盘：清空按钮用，理由同 `EMPTY_INPUTS` */
export const UNIT_EMPTY_INPUTS: UnitTextInputs = {
	price: '',
	unitCost: '',
	shipCost: '',
	commissionRate: '',
	refundMode: 'rate',
	unshippedRefundRate: '',
	shippedRefundRate: '',
	inTransitRefundRate: '',
	recoverRate: '',
	returnShipCost: '',
	commissionRefunded: true
};

// ---------------------------------------------------------------- 敏感性档位与步长

/**
 * 退货率敏感性表的档位（两种口径共用），改档位只改这里。
 * 10 档铺到 90%：这张表要回答的是「退货率涨到多少这盘就不赚钱了」，
 * 只铺到 40% 的话最坏的那几档看不到，边界落在表外。
 *
 * 扫的是**退款总额**（未发货 + 已发货），三类的**相对结构保持不变** ——
 * 现实中「退货率涨了」涨的是整体，不会只涨某一类。
 */
export const RETURN_RATE_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * 整盘口径敏感性表的 ROAS 档位：用户填了「现在的 ROAS」，所以用一组固定档位、把当前值标出来。
 * 单件口径**不填** ROAS，没有「当前值」可标，档位围着保本线现算 —— 见下面那两条档位常量。
 * 同样 10 档，跟退货率表等高。
 */
export const ROAS_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** 单件口径 ROAS 表的档位数：跟退货率表同为 10 行（两张表上下排时高度对得上） */
export const UNIT_ROAS_STEP_COUNT = 10;

/** 中心（保本线向上取整那一档）**往下**留几档：往下只是重复「亏」，位置多给上面更有用 */
export const UNIT_ROAS_STEPS_BELOW_CENTER = 3;

/**
 * 「最该盯的一项」里每个变量的试动幅度：有值时按 ±10%。
 * 相对量乘不出东西的（当前值为 0）改按下面两条绝对值试 —— 不是跳过，跳过等于漏掉它。
 */
export const SENSITIVE_RELATIVE_STEP = 0.1;

/** 值为 0 的比率变量按 +5 个百分点试 */
export const SENSITIVE_ZERO_PERCENT_STEP = 0.05;

/** 值为 0 的金额变量按 +5 元试 */
export const SENSITIVE_ZERO_AMOUNT_STEP = 5;

// ---------------------------------------------------------------- 输入校验

/**
 * 金额 / 单数的上限：不是业务限制，是拦住「把时间戳 / 订单号粘进金额框」这类误操作 ——
 * 超过上限后乘法会溢出成 Infinity，减出来是 NaN，结果卡会静默变成一句「本期是亏的」。
 */
export const MAX_INPUT_AMOUNT = 1e12;

// ---------------------------------------------------------------- 本地存储

/** 参数预设的 localStorage 键（+page.svelte 读写） */
export const PRESETS_STORAGE_KEY = 'toolv:ecommerce-roi-presets';

/** 当前输入的 localStorage 键：自动存、刷新后接着算 */
export const SESSION_STORAGE_KEY = 'toolv:ecommerce-roi-inputs';

/**
 * 当前输入写回 localStorage 的防抖时长（ms）。
 * 它跟着**每一次击键**变（不像预设只在保存 / 删除时才动），所以必须防抖。
 */
export const SESSION_WRITE_DELAY_MS = 300;
