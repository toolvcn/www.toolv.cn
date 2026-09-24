// 电商 ROI 的编排层：一份输入、全部指标与两张敏感性表都是派生值，模块级单例。
//
// 两种口径（整盘 / 单件）共用同一套下游：因为「单件」等价于「订单数 = 1、成交额 = 售价」，
// 所以这里只做一次解析口径切换，指标、敏感性表、说明文案全都不用分两套写。
import {
	carryRefundTexts,
	convertAdText,
	convertCostText,
	convertOrdersText,
	convertRefundTexts,
	isEmptyInputs,
	isEmptyUnitInputs,
	isExampleInputs,
	isExampleUnitInputs,
	parseInputs,
	parseUnitInputs,
	toNumber
} from './parse.ts';
import { computeMetrics } from './metrics.ts';
import { reverseFromMargin, scaleToBatch, volumeFromFixedCost } from './derive.ts';
import {
	breakEvenByReturnRate,
	mostSensitive,
	profitByRoas,
	profitForTargetRoas,
	roasForTarget,
	roasForTargetProfit,
	roasStepsFor
} from './sensitivity.ts';
import { buildPresetCsv, parsePresetCsv } from './csv.ts';
import { summaryInputs, summaryUnitInputs } from './summary.ts';
import { formatCount, formatMoney, formatPercent, formatTimes } from './format.ts';
import {
	DEFAULT_SCALE_QUANTITY,
	DEFAULT_TARGET_MARGIN,
	EMPTY_INPUTS,
	EXAMPLE_INPUTS,
	UNIT_EMPTY_INPUTS,
	UNIT_EXAMPLE_INPUTS
} from '../config.ts';
import {
	type AdMode,
	type CostMode,
	type FixedCostPeriod,
	type OrdersMode,
	type ReverseResult,
	type RefundMode,
	type RoiInputs,
	type RoiMode,
	type RoiTextInputs,
	type ScaleResult,
	type SensitiveItem,
	type TargetBasis,
	type TargetRoasResult,
	type UnitTextInputs,
	type VolumeResult
} from './types.ts';
import {
	parsePresets,
	serializePresets,
	serializeSession,
	type RoiPreset,
	type RoiPresetFile,
	type RoiSession
} from './presets.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';
import { downloadText } from '$lib/utils/browser';

class EcommerceRoiStore {
	/** 当前口径：整盘（一段时间的总投放）还是单件（一款商品的经济账） */
	mode = $state<RoiMode>('batch');

	/** 整盘口径的输入 */
	inputs = $state<RoiTextInputs>({ ...EXAMPLE_INPUTS });

	/** 单件口径的输入 */
	unitInputs = $state<UnitTextInputs>({ ...UNIT_EXAMPLE_INPUTS });

	/** 反推用的目标净利率（对售价，百分数） */
	targetMargin = $state(DEFAULT_TARGET_MARGIN);

	/**
	 * 单件口径的**假设投产比**（原「试算 ROAS」）。
	 *
	 * 单件口径算的是广告费之前的账，输入里没有广告费；而「这个价卖不亏」「这批货一共能赚多少」
	 * 都得先说明按多少的投产比投 —— 所以它是 ② 段两块**共用**的前提，留空即取 `defaultTrialRoas`。
	 *
	 * 唯一的例外是同一段里的**保本销量**：那一格的口径恒为「不投广告」，不看这个数
	 * （`breakEvenVolume` 只吃固定成本与每件利润）—— 页面上写在它的注脚里。
	 *
	 * 原先它还有一个「本段覆盖」的孪生格（`reverseRoas`，供末尾那段单独试另一个投产比）。
	 * ⑤ 段并进 ② 段之后不存在「本段」了，那个覆盖格随之取消 —— 一段里只有一个投产比，
	 * 少一个「改了一个另一个不动」的坑。
	 */
	trialRoas = $state('');

	/**
	 * 「卖多少赚多少」的试算售价（元/件）。
	 * 留空 = 按当前售价；它属于**临时试算**（跟试算 ROAS 一样不进预设），
	 * 独立成一个框是因为想试的常常就是「我降到 59 会怎样」—— 改左边那个售价会连主结果一起改掉。
	 */
	scalePrice = $state('');

	/** 「卖多少赚多少」的试算销量（单）：留空按 `DEFAULT_SCALE_QUANTITY` */
	scaleQty = $state('');

	/**
	 * 「保本销量」的试算固定成本（元/「周期」）：人工、仓储、房租这类**不随销量变动**的开销。
	 * 留空 = 还没填（页面给一句承诺语，不当 0 算出一串没意义的数）。
	 *
	 * 它**不进输入面板**，也不进预设 / 会话快照 / CSV —— 跟上面那三个试算格同一个约定：
	 * 这是一次性试算，不是商品参数。所以它单独放这里，而不是加进 `UnitTextInputs`。
	 */
	trialFixedCost = $state('');

	/** 固定成本的周期：日还是月。只决定结果的读法与切换时的换算倍数，见 `setFixedCostPeriod` */
	trialFixedCostPeriod = $state<FixedCostPeriod>('day');

	/** 固定成本那格实际拿去算的数值：空串与非法值按 0（「没填」就不摊固定成本） */
	readonly trialFixedCostValue = $derived(toNumber(this.trialFixedCost) || 0);

	/**
	 * 规模试算实际采用的售价：留空或填了非法值时**回落成当前售价** ——
	 * 这一格的用途是「在这个基础上改一改」，留空时用现价比报错或直接算 0 都合理。
	 */
	readonly scalePriceValue = $derived.by(() => {
		const current = this.activeParsed.ok ? this.activeParsed.inputs.gmv : 0;
		const value = toNumber(this.scalePrice);
		return Number.isFinite(value) && value > 0 ? value : current;
	});

	/** 规模试算实际采用的销量：留空或填了非法值时回落成默认销量 */
	readonly scaleQtyValue = $derived.by(() => {
		const value = toNumber(this.scaleQty);
		return Number.isFinite(value) && value > 0 ? value : DEFAULT_SCALE_QUANTITY;
	});

	/** 售价填了却不是一个正数 —— 回落成现价这件事得说出来，否则用户以为自己填的数生效了 */
	readonly scalePriceInvalid = $derived(isInvalidPositiveNumber(this.scalePrice, this.mode));

	/** 销量填了却不是一个正数，同上 */
	readonly scaleQtyInvalid = $derived(isInvalidPositiveNumber(this.scaleQty, this.mode));

	/**
	 * 目标框里那一个数：按哪种口径填由 `targetMode` 决定 —— 目标净利时是元、目标广告 ROI 时是百分数。
	 * 空串按 0（两种口径下都是保本线）。
	 */
	targetProfit = $state('');

	/**
	 * 目标的填法：按净利（元）还是按广告 ROI（%）。
	 * 两者不是两个自由度（广告 ROI 由目标净利与成本结构唯一决定，见 `TargetBasis`），
	 * 所以跟成本 / 广告 / 退款那三处一样：一个开关、切换时数字跟着换算。
	 */
	targetMode = $state<TargetBasis>('profit');

	// ---------------------------------------------------------------- 参数预设

	/** 左侧预设面板保存的整组参数快照；本地持久化由 +page.svelte 的 $effect 负责 */
	presets = $state<RoiPreset[]>([]);
	/** 面板里的「名称」输入框；保存成功后清空 */
	presetName = $state('');
	#presetSeq = 0;

	/** 当前口径下解析好的数值输入；敏感性表与反推都要拿它 */
	readonly activeParsed = $derived(this.mode === 'batch' ? parseInputs(this.inputs) : parseUnitInputs(this.unitInputs));

	/** 是不是单件口径：结果卡与敏感性表都要按它换说法 */
	get isUnit(): boolean {
		return this.mode === 'unit';
	}

	/** 金额的读法：单件口径是「每件」，整盘口径是「本期」 */
	get period(): string {
		return this.isUnit ? '每件' : '本期';
	}

	/**
	 * 解析好的数值输入；解析失败时为 null。
	 * 面板里凡是要拿某一项去显示 / 代入公式的，走这一个而不是各自解 `activeParsed`。
	 */
	get parsed(): RoiInputs | null {
		return this.activeParsed.ok ? this.activeParsed.inputs : null;
	}

	/** 空态判定：三条主字段都空才走空态，避免满屏「请填写」 */
	readonly isEmpty = $derived(this.mode === 'batch' ? isEmptyInputs(this.inputs) : isEmptyUnitInputs(this.unitInputs));

	/**
	 * 当前是不是**原封不动**的示例数据。
	 * 首屏就填着示例，不标出来会被误当成自己的结果；改动过任何一项就不再提示。
	 */
	readonly isExample = $derived(
		this.mode === 'batch' ? isExampleInputs(this.inputs) : isExampleUnitInputs(this.unitInputs)
	);

	/** 最该盯的一项：改善它净利涨得最多 */
	readonly sensitive = $derived<SensitiveItem | null>(
		this.activeParsed.ok ? mostSensitive(this.activeParsed.inputs) : null
	);

	readonly error = $derived(this.activeParsed.ok ? '' : this.activeParsed.error);

	/**
	 * 出错的**那一格**：`ui/NumberField.svelte` 据此把红字挂到字段上（而不是只在结果卡报一句）。
	 * 校验一次只报第一条，所以最多一个字段；没有错误时为 null。
	 */
	readonly errorField = $derived(this.activeParsed.ok ? null : this.activeParsed.field);

	/** 指标：两种口径都走同一个 computeMetrics */
	readonly metrics = $derived(this.activeParsed.ok ? computeMetrics(this.activeParsed.inputs) : null);

	/**
	 * 目标框里的数值：净利口径是元、投产比口径就是一个投产比。空串按 0，解析不出数字给 NaN。
	 * **投产比口径留空时取保本线** —— 那跟「按净利填 0」是同一个点（净利归零的那条线），
	 * 不然留空会解析成 0 倍投产比、直接报「投产比要大于 0」，等于逼着用户先随便填个数。
	 * 单独拿出来是因为它有几个去处：算那条线、切换填法时换算、以及复制摘要里回显原字符串。
	 */
	readonly targetValue = $derived.by(() => {
		const value = parseTargetNumber(this.targetProfit);
		if (this.targetMode !== 'roas' || this.targetProfit.trim() !== '') return value;
		const breakEven = this.metrics?.breakEvenRoas ?? Number.NaN;
		return Number.isFinite(breakEven) && breakEven > 0 ? breakEven : value;
	});

	/**
	 * 试算那条线：投产比 + 净利天花板。三个读数（投产比 / 要投入的广告费 / 能赚的净利）
	 * 由**一个**自由度决定，所以这里只给投产比与天花板，另两个由调用方除出来 —— 两种填法共用。
	 */
	readonly targetRoas = $derived<TargetRoasResult | null>(
		this.activeParsed.ok ? roasForTarget(this.activeParsed.inputs, this.targetMode, this.targetValue) : null
	);

	/** 退货率档位 → 保本 ROAS（卖服装最该看的一张） */
	readonly returnRateTable = $derived(this.activeParsed.ok ? breakEvenByReturnRate(this.activeParsed.inputs) : []);

	/** ROAS 档位 → 净利。单件口径的档位围着保本线现算（见 `roasStepsFor`），整盘口径用固定档位 */
	readonly roasTable = $derived.by(() => {
		const parsed = this.activeParsed;
		const m = this.metrics;
		if (!parsed.ok || m === null) return [];
		return this.mode === 'unit'
			? profitByRoas(parsed.inputs, roasStepsFor(m.breakEvenRoas))
			: profitByRoas(parsed.inputs);
	});

	/**
	 * 试算 ROAS 的默认值：保本线**向上取整**。
	 * 向下取整会掉到保本线以下（那个 ROAS 下卖多少钱都亏，反推全无解），
	 * 原样用保本线又会让「保本售价」正好等于现价（恒等式，等于什么都没说）。
	 * 保本线不存在（贡献利润 ≤ 0）时没有默认值可取，返回 null。
	 */
	readonly defaultTrialRoas = $derived.by(() => {
		const m = this.metrics;
		if (m === null || !Number.isFinite(m.breakEvenRoas) || m.breakEvenRoas <= 0) return null;
		return Math.ceil(m.breakEvenRoas);
	});

	/** 实际拿去反推的试算 ROAS：填了就用填的，留空用默认；两个都拿不到时给 NaN，由反推自己报原因 */
	readonly trialRoasValue = $derived.by(() => {
		const value = toNumber(this.trialRoas);
		if (Number.isFinite(value) && value > 0) return value;
		return this.defaultTrialRoas ?? Number.NaN;
	});

	/**
	 * 试算 ROAS 填了却解析不出一个 > 0 的数（如「abc」「0」「-3」）。
	 * 非法值一律回落到默认值，不报出来的话，用户会以为自己填的那个 ROAS 生效了。
	 * 空串不算非法 —— 那就是「用默认值」。
	 */
	readonly trialRoasInvalid = $derived(isInvalidPositiveNumber(this.trialRoas, this.mode));

	/**
	 * 单件口径才有的反推：保本售价、目标净利率下的最低售价、最高可接受单件成本。
	 *
	 * 投产比前提直接用 `trialRoasValue`（② 段前提条那一格）—— 合并之后两个口径的
	 * ② 段各只有一个投产比，不再有「本段覆盖」。
	 */
	readonly reverse = $derived<ReverseResult | null>(
		this.mode === 'unit' && this.activeParsed.ok
			? reverseFromMargin(this.activeParsed.inputs, parsePercentNumber(this.targetMargin), this.trialRoasValue)
			: null
	);

	/**
	 * 单件口径才有的「卖多少赚多少」：把一件的账按试算售价与销量放大成一盘账。
	 * 声明位置必须排在 `activeParsed` 与 `trialRoasValue` **之后** —— `$derived(...)` 的表达式
	 * 在类初始化时就会求值一次（不是懒的），放在前面会撞上字段初始化的 TDZ。
	 */
	readonly scale = $derived<ScaleResult | null>(
		this.mode === 'unit' && this.activeParsed.ok
			? scaleToBatch(this.activeParsed.inputs, this.scalePriceValue, this.scaleQtyValue, this.trialRoasValue)
			: null
	);

	/**
	 * 保本销量（② 段的「规模试算」块）：这份固定成本要卖多少件、多少成交额才摊平。
	 *
	 * 分子是 ① 段那个**每件利润**（贡献利润，推广费之前）—— 所以这一块跟同段那几个试算格
	 * （假设投产比 / 试算售价 / 试算销量）**没有关系**，也不受它们影响：口径就是「不投广告」。
	 * 想按某个投产比算，那是同段「卖多少赚多少」那个子块的事。
	 *
	 * **纯试算**：`trialFixedCost` 不进输入面板、不进预设 / 会话快照 / CSV，
	 * 也不影响 ① 段的保本 ROAS —— 那一格仍是不含固定成本的口径。声明位置排在 `metrics` 之后：
	 * `$derived` 在类初始化时就会求值一次。
	 */
	readonly breakEvenVolume = $derived<VolumeResult | null>(
		this.mode === 'unit' && this.activeParsed.ok && this.metrics !== null
			? volumeFromFixedCost(this.trialFixedCostValue, this.metrics.contributionProfit, this.parsed?.gmv ?? 0)
			: null
	);

	/**
	 * 目标净利率填了却解析不出一个 ≥0 的数（如「abc」「-5」）。
	 * 反推里非法值一律按 0 处理，不报出来就会让人以为「目标填了 20% 怎么算出来是保本价」。
	 * 空串不算非法 —— 那就是「不设目标」，等价于 0。
	 */
	readonly targetMarginInvalid = $derived.by(() => {
		if (this.mode !== 'unit') return false;
		if (this.targetMargin.trim() === '') return false;
		const value = toNumber(this.targetMargin);
		return !Number.isFinite(value) || value < 0;
	});

	/** 结论句：一句话说清「现在什么水平、离保本线还有多远」 */
	get verdict(): string {
		const m = this.metrics;
		if (m === null) return '';
		// 单件口径没有广告费（`adRoas` 恒为 Infinity），套不了下面那两句「赚了 / 亏了」——
		// 它要回答的是**每件赚多少**，以及那个利润本身就是广告费上限（= 保本 ROAS 的由来）。
		if (this.mode === 'unit') {
			if (m.contributionProfit <= 0) {
				return `这个价每件亏 ${formatMoney(Math.abs(m.contributionProfit))} 元：扣完货、佣金、物流与退货损耗已经没有利润了`;
			}
			return `每件赚 ${formatMoney(m.contributionProfit)} 元（占售价 ${formatPercent(m.contributionMargin)}）—— 全投出去要跑赢 ${formatTimes(m.breakEvenRoas)} 才不亏`;
		}
		// 不赚钱这条**先判**：它跟有没有广告费无关，套下面那两句「ROAS 还能往下掉多少」反而错。
		if (m.contributionProfit <= 0) {
			return '这盘生意本身就不赚钱：扣完货、佣金、物流与退货损耗已经没有广告费的空间了';
		}
		// 没投广告（adCost = 0，纯自然流量）：ROAS 无从谈起，但钱算得出来 ——
		// 净利润就是贡献利润，结论给「这盘本身赚不赚」，不套那两句要有「现在的 ROAS」才写得出的余量话术。
		if (m.adRoas === Number.POSITIVE_INFINITY) {
			return '本期没有广告投入 —— 这是一盘自然流量的账，扣完全部成本是赚的';
		}
		if (m.netProfit >= 0) {
			// 顶部那两个盒子已经把「现在 ROAS 多少 / 保本要多少 / 赚了多少钱」说完了，
			// 结论句再报一遍就是同一件事说两次 —— 这里只补它们没说的一句：
			// 离保本线还有多少余量。按比例说，比再来一个 ROAS 数字有用。
			// **分母是当前的 ROAS，不是保本线**：措辞是「还能往下掉 X%」，说的是从当前值
			// 掉到那条线要跌几个百分点（6.00 → 3.93 是 34.6%；拿保本线当分母会算出 52.8%，
			// 而 6.00 真跌 53% 是 2.82，早在线下了）。
			return `这段投放是赚的 —— ROAS 还能往下掉 ${formatPercent((m.adRoas - m.breakEvenRoas) / m.adRoas)} 才到亏本`;
		}
		// 同理：「得再涨 X%」也是相对**现在这个数**说的（2.00 涨到 3.93 是 96%，
		// 拿保本线当分母只有 49% —— 而 2.00 真涨 49% 是 2.98，还没到线）
		return `这段投放是亏的 —— ROAS 得再涨 ${formatPercent((m.breakEvenRoas - m.adRoas) / m.adRoas)} 才回到保本线`;
	}

	// ---------------------------------------------------------------- 操作

	setMode(mode: RoiMode): void {
		this.mode = mode;
	}

	/**
	 * 切换商品成本的填法（按比例 / 按金额）。
	 * 数字跟着换算（`convertCostText`），不静默改变含义；客单价拿不到时数字原样保留，
	 * 由 `parseCost` 的校验消息告诉用户要先填成交额与订单数。
	 */
	setCostMode(next: CostMode): void {
		if (this.inputs.costMode === next) return;
		this.inputs = { ...this.inputs, costRate: convertCostText(this.inputs, next), costMode: next };
	}

	/**
	 * 切换广告那格的填法（广告花费 / 广告 ROAS）。
	 * 跟成本同理：数字跟着换算（`convertAdText`），不静默改变含义；
	 * 成交额拿不到时数字原样保留，由 `parseAd` 的校验消息告诉用户要先填成交额。
	 */
	setAdMode(next: AdMode): void {
		if (this.inputs.adMode === next) return;
		this.inputs = { ...this.inputs, adCost: convertAdText(this.inputs), adMode: next };
	}

	/**
	 * 切换订单数那格的填法（按订单数 / 按客单价）。
	 * 跟广告那格同理：两个方向都是「成交额 ÷ 当前值」（`convertOrdersText`），
	 * 成交额拿不到时数字原样保留，由 `parseOrders` 与提示行说明为什么算不出来。
	 */
	setOrdersMode(next: OrdersMode): void {
		if (this.inputs.ordersMode === next) return;
		this.inputs = { ...this.inputs, orders: convertOrdersText(this.inputs), ordersMode: next };
	}

	/**
	 * 切换目标的填法（按净利 / 按投产比）。跟前面几处同理：数字跟着换算，不静默改变含义 ——
	 * 只换单位的话，「500」会从 500 元静悄悄变成 500 倍投产比。
	 *
	 * 换算要用成交额与净利天花板（两者是同一条线的两端）；拿不到、或当前值换不出一个有限数时
	 * 原样保留，由 `roasForTarget` 的校验消息说明为什么算不出来。
	 */
	setTargetMode(next: TargetBasis): void {
		if (this.targetMode === next) return;
		const raw = this.targetProfit.trim().replace(/,/g, '');
		const value = Number(raw);
		const ceiling = this.metrics?.contributionProfit ?? Number.NaN;
		const gmv = this.parsed?.gmv ?? 0;

		let converted = this.targetProfit;
		if (raw !== '' && Number.isFinite(value)) {
			const target =
				next === 'roas' ? roasForTargetProfit(gmv, ceiling, value) : profitForTargetRoas(gmv, ceiling, value);
			if (Number.isFinite(target)) converted = String(Number(target.toFixed(2)));
		}
		this.targetProfit = converted;
		this.targetMode = next;
	}

	/**
	 * 切换固定成本的周期（日 / 月）。跟成本、广告、订单数那几处同理：**换算数字**而不是只换读法 ——
	 * 只换读法的话，「500」会从「每天 500」静悄悄变成「每月 500」，同一串字符含义全变。
	 *
	 * 月按 30 天折：这是个换算约定，不是业务口径（`500/天 = 15000/月`）。
	 * 空串与非法值原样保留，不猜 —— 那是「还没填」或「填错了」，都不该被换算成一个数。
	 */
	setFixedCostPeriod(next: FixedCostPeriod): void {
		if (this.trialFixedCostPeriod === next) return;
		const raw = this.trialFixedCost.trim().replace(/,/g, '');
		const value = Number(raw);
		if (raw !== '' && Number.isFinite(value)) {
			const converted = next === 'month' ? value * 30 : value / 30;
			// 留两位：跟 `convertCostText` 同一个取舍，换过去再换回来会有零点几的漂移
			this.trialFixedCost = String(Number(converted.toFixed(2)));
		}
		this.trialFixedCostPeriod = next;
	}

	/**
	 * 切换退款三格的填法（退款率 / 退款金额）。整组一个开关，三格一起换算 ——
	 * 跟成本、广告那两处同理：数字跟着换算（`convertRefundTexts`），不静默改变含义。
	 * 成交额（单件口径是售价）拿不到时数字原样保留，
	 * 由 `parseRefund` 的校验消息告诉用户要先把它填好。
	 */
	setRefundMode(next: RefundMode): void {
		const current = this.mode === 'batch' ? this.inputs : this.unitInputs;
		if (current.refundMode === next) return;
		if (this.mode === 'batch') {
			this.inputs = {
				...this.inputs,
				...convertRefundTexts(this.inputs, next, toNumber(this.inputs.gmv)),
				refundMode: next
			};
			return;
		}
		this.unitInputs = {
			...this.unitInputs,
			...convertRefundTexts(this.unitInputs, next, toNumber(this.unitInputs.price)),
			refundMode: next
		};
	}

	/**
	 * 把**另一套**输入里的退款参数搬进当前这套（两套口径不同，所以叫「带入」）。
	 *
	 * 三格走「源 → 率 → 目标」两跳（见 `carryRefundTexts`）；其余几项两边同义，原样搬：
	 * 收回比例是比例、单均/单件退货成本在「一单一件」下同一个数、佣金退还开关是平台规则。
	 */
	copyRefundFromOtherMode(): void {
		const sourceIsBatch = this.mode !== 'batch';
		const from = sourceIsBatch ? this.inputs : this.unitInputs;
		const to = sourceIsBatch ? this.unitInputs : this.inputs;
		// 源与目标各自的成交额：整盘认成交额、单件认售价
		const fromGmv = toNumber(sourceIsBatch ? this.inputs.gmv : this.unitInputs.price);
		const toGmv = toNumber(sourceIsBatch ? this.unitInputs.price : this.inputs.gmv);

		const carried = carryRefundTexts(from, fromGmv, to, toGmv);
		if (!carried.ok) {
			toast.show(carried.error, true);
			return;
		}

		const patch = {
			unshippedRefundRate: carried.unshippedRefundRate,
			shippedRefundRate: carried.shippedRefundRate,
			inTransitRefundRate: carried.inTransitRefundRate,
			recoverRate: from.recoverRate,
			returnShipCost: from.returnShipCost,
			commissionRefunded: from.commissionRefunded
		};
		if (sourceIsBatch) this.unitInputs = { ...this.unitInputs, ...patch };
		else this.inputs = { ...this.inputs, ...patch };
		toast.show(`已带入${sourceIsBatch ? '整盘' : '单件'}口径的退款参数`);
	}

	loadExample(): void {
		// 试算 ROAS 一起清掉：它跟着上一组参数算出来的保本线默认，留着会指着一个不存在的盘
		this.trialRoas = '';
		if (this.mode === 'batch') {
			this.inputs = { ...EXAMPLE_INPUTS };
			toast.show('已填入示例：成交额 6990 元、广告费 1165 元的一盘投放');
			return;
		}
		this.unitInputs = { ...UNIT_EXAMPLE_INPUTS };
		toast.show('已填入示例：一款卖 69.9 元、成本 35 元的单件账');
	}

	clearAll(): void {
		this.trialRoas = '';
		if (this.mode === 'batch') this.inputs = { ...EMPTY_INPUTS };
		else this.unitInputs = { ...UNIT_EMPTY_INPUTS };
	}

	/** 复制一段纯文本摘要，直接贴进聊天或周报 */
	async copySummary(): Promise<void> {
		const m = this.metrics;
		if (m === null) {
			toast.show('先把参数填好再复制', true);
			return;
		}
		// 空态下 metrics 不是 null（空串按 0 解析），照样能算出「全 0」的一串数 ——
		// 复制出去是一份没有意义的摘要，所以跟报错一样拦掉
		if (this.isEmpty) {
			toast.show('参数还是空的，没有可复制的内容', true);
			return;
		}
		const inputs = this.activeParsed.ok ? this.activeParsed.inputs : null;
		const gmv = inputs?.gmv ?? 0;
		// 前提要一起带走：只贴结果的话，收到的人不知道这盘数是怎么来的，也没法自己复算。
		// 分组与用字照输入面板（成交与广告 / 成本项 / 退货），回显**原始字符串**不换算（见 summaryInputs）
		const inputLines =
			this.mode === 'unit'
				? summaryUnitInputs(this.unitInputs, this.targetMargin, this.trialRoas)
				: summaryInputs(this.inputs, this.targetProfit, this.targetMode);
		// 退款这笔账拆成三句说，混成一句会让「未发货那类退了钱却没损失」看着像漏算：
		// ① 退款多少、三类各占多少（规模）；② 真损失多少（代价）；
		// ③ 未发货白花的推广费 —— 它不是利润表里的项，但恰恰是那一类退款真正的代价。
		const refundLine = `退款 ${formatMoney(m.returnedAmount)} = 未发货 ${formatMoney(m.unshippedAmount)} + 在途 ${formatMoney(m.inTransitAmount)} + 签收后 ${formatMoney(m.signedAmount)}`;
		const lossLine = `退货真损失 ${formatMoney(m.returnLoss)}（残损 ${formatMoney(m.damagedGoodsCost)} + 逆向物流 ${formatMoney(m.reverseShipping)}${this.commissionRefunded ? '' : ' + 不退的佣金'}）`;
		const wastedLine =
			m.unshippedAmount > 0
				? `未发货退款白花的推广费约 ${formatMoney(m.wastedAdCost)}（货与运费都没损失，这一类的代价只有推广费）`
				: '';
		// 单件口径的摘要里没有「广告 ROAS / 净利润」：那边的广告费恒为 0，报出来是 Infinity
		// 加一个不对应任何投放的净利。它该报的是「每件利润 + 保本线 + 卖多少单赚多少」。
		// 规模试算那行把售价与销量一起带上：它是这一版新加的主结果，贴出去得能照着复算。
		const scale = this.scale;
		const scaleLine =
			scale !== null && scale.metrics !== null
				? `按 ${formatMoney(scale.price)} 元卖 ${formatCount(scale.quantity)} 单：成交额 ${formatMoney(scale.gmv)} · 广告费 ${formatMoney(scale.adCost)} · 净利 ${formatMoney(scale.metrics.netProfit)} 元`
				: '';
		const lines =
			this.mode === 'unit'
				? [
						'【单件口径】',
						`保本 ROAS ${formatTimes(m.breakEvenRoas)} · 每件利润 ${formatMoney(m.maxAdCost)} 元（占售价 ${formatPercent(m.contributionMargin)}）`,
						`售价 ${formatMoney(gmv)} · 净收入（扣退货）${formatMoney(m.netRevenue)}`,
						`试算 ROAS ${formatTimes(this.trialRoasValue)} 下每件净利 ${formatMoney(m.contributionProfit - gmv / this.trialRoasValue)} 元`,
						...(scaleLine === '' ? [] : [scaleLine]),
						'',
						refundLine,
						lossLine,
						...(wastedLine === '' ? [] : [wastedLine]),
						'',
						'我填的参数：',
						...inputLines
					]
				: [
						'【整盘口径】',
						`广告 ROAS ${formatTimes(m.adRoas)} · 扣退货 ${formatTimes(m.netRoas)} · 保本 ${formatTimes(m.breakEvenRoas)}`,
						`成交额 ${formatMoney(gmv)} · 净收入 ${formatMoney(m.netRevenue)}`,
						`净利润 ${formatMoney(m.netProfit)} · 净利率（对成交额）${formatPercent(m.netMarginOnGmv)}`,
						`广告费上限 ${formatMoney(m.maxAdCost)}`,
						'',
						refundLine,
						lossLine,
						...(wastedLine === '' ? [] : [wastedLine]),
						'',
						'我填的参数：',
						...inputLines
					];
		await copyToClipboard(lines.join('\n'), { ok: '已复制结果摘要', fail: '复制失败，请手动选中复制' });
	}

	// ---------------------------------------------------------------- 参数预设

	/** 把当前整组参数存成一条预设；名称为空、或参数还全空时不存 */
	savePreset(): void {
		const name = this.presetName.trim();
		if (name === '') {
			toast.show('请先填写预设名称', true);
			return;
		}
		if (this.isEmpty) {
			toast.show('参数还是空的，没有可保存的内容', true);
			return;
		}
		this.presets = [
			...this.presets,
			{
				id: ++this.#presetSeq,
				name,
				mode: this.mode,
				inputs: { ...this.inputs },
				unitInputs: { ...this.unitInputs },
				targetMargin: this.targetMargin
			}
		];
		this.presetName = '';
		toast.show(`已保存参数预设「${name}」`);
	}

	deletePreset(id: number): void {
		this.presets = this.presets.filter((preset) => preset.id !== id);
		toast.show('已删除预设');
	}

	/**
	 * 拖动排序：把 `fromId` 那条移到 `toId` 那条**所在的位置**（目标整条让一格）。
	 * 往下拖 = 落在目标后面、往上拖 = 落在目标前面，两个方向同一套下标算法算出来就是这两种落点。
	 * **不弹 toast**：拖动是连续动作，每跨一条弹一次会糊成一片；顺序变了列表里看得到。
	 */
	movePreset(fromId: number, toId: number): void {
		if (fromId === toId) return;
		const from = this.presets.findIndex((preset) => preset.id === fromId);
		const to = this.presets.findIndex((preset) => preset.id === toId);
		if (from === -1 || to === -1) return;
		const next = [...this.presets];
		const [moved] = next.splice(from, 1);
		// 插回**原下标**：from < to 时目标已被挤上去一格，插在 to 正好是它原来的位置
		next.splice(to, 0, moved);
		this.presets = next;
	}

	/**
	 * 按 ↑ / ↓ 移动一条：与相邻那条交换。
	 * 相邻两条的「交换」与「移动到它的位置」是同一个结果，所以跟拖动共用一套落点语义。
	 */
	movePresetBy(id: number, delta: number): void {
		const from = this.presets.findIndex((preset) => preset.id === id);
		const to = from + delta;
		if (from === -1 || to < 0 || to >= this.presets.length) return;
		const next = [...this.presets];
		const moved = next[from];
		next[from] = next[to];
		next[to] = moved;
		this.presets = next;
	}

	/** 整组回填：口径、两套输入、目标净利率一起恢复 */
	applyPreset(id: number): void {
		const preset = this.presets.find((item) => item.id === id);
		if (!preset) return;
		this.mode = preset.mode;
		this.inputs = { ...preset.inputs };
		this.unitInputs = { ...preset.unitInputs };
		this.targetMargin = preset.targetMargin;
		toast.show(`已应用预设「${preset.name}」`);
	}

	/** 预设导出文本（JSON），供下载 */
	get presetsText(): string {
		return serializePresets(this.presets);
	}

	/** 导入预设文本：校验通过则追加进列表，失败用 toast 告知原因 */
	importPresetsText(text: string): void {
		const parsed = parsePresets(text);
		if (!parsed.ok) {
			toast.show(`导入失败：${parsed.error}`, true);
			return;
		}
		this.presets = [...this.presets, ...parsed.presets.map((preset) => ({ ...preset, id: ++this.#presetSeq }))];
		toast.show(`已导入 ${parsed.presets.length} 条预设`);
	}

	// ---------------------------------------------------------------- 预设 CSV
	//
	// 与上面的 JSON 存档是两件事：**JSON 是备份（原样存回）**，
	// CSV 是**拿去对比**的 —— 一行一条预设、列里带算出来的结果与利润明细，
	// 在 Excel 里能直接排序 / 拉图表。所以它一次只处理一种口径
	// （整盘与单件的参数集合不同，混一张表会有半数列是空的），口径由用户在下拉里选。

	/**
	 * 导出该口径的预设为 CSV。
	 * 一条都没有时不导 —— 空表（只有表头）比一句提示更难解释。
	 */
	exportPresetCsv(mode: RoiMode): void {
		const label = mode === 'batch' ? '整盘' : '单件';
		const list = this.presets.filter((preset) => preset.mode === mode);
		if (list.length === 0) {
			toast.show(`还没有${label}口径的预设 —— 先填个名称存一条`, true);
			return;
		}
		downloadText(`ecommerce-roi-presets-${mode}.csv`, buildPresetCsv(mode, list), 'text/csv;charset=utf-8');
		toast.show(`已导出 ${list.length} 条${label}预设（含参数与结果）`);
	}

	/**
	 * 导入 CSV：按选定口径读**参数列**，逐条追加为预设。
	 * 结果列忽略（那是算出来的）；另一套口径沿用当前这组（跟「保存预设」存两套同一个理由）。
	 */
	importPresetCsvText(mode: RoiMode, text: string): void {
		const parsed = parsePresetCsv(mode, text, { inputs: this.inputs, unitInputs: this.unitInputs });
		if (!parsed.ok) {
			toast.show(`导入失败：${parsed.error}`, true);
			return;
		}
		this.presets = [...this.presets, ...parsed.presets.map((preset) => ({ ...preset, id: ++this.#presetSeq }))];
		toast.show(`已导入 ${parsed.presets.length} 条${mode === 'batch' ? '整盘' : '单件'}预设`);
	}

	/** 从 localStorage 恢复预设（+page.svelte 在挂载时调用）；id 重新分配 */
	restorePresets(presets: RoiPresetFile[]): void {
		this.presets = presets.map((preset) => ({ ...preset, id: ++this.#presetSeq }));
	}

	// ---------------------------------------------------------------- 会话快照

	/**
	 * 当前输入的会话快照（localStorage 用），与预设的 `presetsText` 同一个路数：
	 * 页面只管把它写进存储，序列化与字段校验都在 `presets.ts` 的纯函数里。
	 */
	get sessionText(): string {
		return serializeSession({
			mode: this.mode,
			inputs: { ...this.inputs },
			unitInputs: { ...this.unitInputs },
			targetMargin: this.targetMargin
		});
	}

	/** 恢复上次填的那组参数（+page.svelte 在挂载时调用） */
	restoreSession(session: RoiSession): void {
		this.mode = session.mode;
		this.inputs = { ...session.inputs };
		this.unitInputs = { ...session.unitInputs };
		this.targetMargin = session.targetMargin;
	}

	get commissionRefunded(): boolean {
		return this.mode === 'batch' ? this.inputs.commissionRefunded : this.unitInputs.commissionRefunded;
	}
}

/**
 * 试算格（假设投产比 / 试算售价 / 试算销量）填了却不是一个正数。
 * 空串不算非法 —— 那是「用默认值」，跟填错是两回事。
 * 只在单件口径下有意义：整盘口径没有这三格。
 */
function isInvalidPositiveNumber(text: string, mode: RoiMode): boolean {
	if (mode !== 'unit') return false;
	if (text.trim() === '') return false;
	const value = toNumber(text);
	return !Number.isFinite(value) || value <= 0;
}

/** 目标净利率是用户填的字符串，解析失败按 0 处理（反推里会自己报上限） */
function parsePercentNumber(text: string): number {
	const value = toNumber(text);
	return Number.isFinite(value) && value > 0 ? value / 100 : 0;
}

/** 目标那一格：空串按 0（= 只要保本），解析不出数字给 NaN，由 `roasForTarget` 报出来 */
function parseTargetNumber(text: string): number {
	if (text.trim() === '') return 0;
	return toNumber(text);
}

export const roiStore = new EcommerceRoiStore();
