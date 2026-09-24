<script lang="ts">
	// 公式正文：先给符号表，再按编号列出全部中间量，形成一条能从头核到尾的推导链。
	// 结果卡里给的是「代入本次数字」，这里给的是「符号公式」—— 两个都要，
	// 只给代入式凑不齐推导链，只给符号公式又没法当场核对。
	//
	// 公式文本写成常量而不是铺在模板里：`whitespace-pre` 要保留换行与对齐空格，
	// 模板里的缩进会被 Svelte 折叠，写死在字符串里才能保证对得上。
	import { CircleQuestionMark } from '@lucide/svelte';
	import { FORMULA_BLOCK, SECTION_TITLE } from './styles.ts';
	import { HOVER_CARD } from '$lib/ui/styles';

	/**
	 * 符号表：用等宽串排，比表格省地方。
	 *
	 * 退款拆成三个率之后，符号也分了三层：`u` 未发货、`r` 已发货（= 在途 `t` + 签收后）、
	 * 在途 `t` 是 `r` 里面的一部分。**签收后退货率不另给符号**，一律写成 `r − t` ——
	 * 它是个派生量，给它一个字母反而会让人以为能从输入里直接读到。
	 */
	const SYMBOLS = `G 成交额 · N 订单数 · A 广告费 · c 商品成本率 · k 平台佣金率
L 单均发货成本 · R 单均退货成本 · O 其他固定成本
u 未发货退款率 · r 已发货退款率（= 在途 + 签收后）· t 在途退款率（选填，≤ r）
s 退货能收回的货款比例（只作用于签收后退货：自己再上架、或退回厂家拿回进价）
A 可以反过来填：整盘口径允许直接填「广告 ROAS」，此时 A = G ÷ 广告 ROAS
单件口径另用：P 售价 · C 单件成本 · m 目标净利率（对售价）
假设投产比统一写 ROAS —— 规模试算与定价反推共用（单件口径的输入里没有广告费）`;

	/**
	 * 从最基础的量一路推到保本线，编号与结果卡一一对应。
	 * 注意 ⑨ 里**没有** ⑤：货品成本按发出量算（③），退回的那部分靠 ④ 加回来，
	 * 剩下的 ⑤ 已经含在「③ − ④」里了，再减一遍等于把残损货值扣两次。
	 *
	 * 三处跟着「退款三分类」变了的写法（改的时候别只看结论）：
	 * - ③ 的成交额乘了 `(1 − u)`：未发货退款那批货没出库，不该计成本，
	 *   也就没有「先按全量算、回头再加回来」这一说 —— 那是旧模型对未发货那类的错误处理；
	 * - ④ 拆成「在途按 100% + 签收后按 s」两段：拒收件原封返回，不该按折损比例打折；
	 * - ⑦ 的订单数也乘了 `(1 − u)`：一单一个快递，没发出去的那批不产生运费。
	 *
	 * 拆成一行一条（`STEPS`）而不是一整块 `whitespace-pre`：这一块要给**每行挂一个 ?**，
	 * 悬浮显示「这一行用中文怎么说」。符号式（`G × (1 − u − r)`）写起来短、能跟结果卡的代入式
	 * 一一对应，但它要求读者先记住符号表；中文那句才是真正看懂的那一句，
	 * 所以符号留在行里、**解释收进 ?**，两边都不占版面。
	 * `tip` 里一律写中文名，不写 `G` / `r` / `c` —— 鼠标停上去还要回头查符号表，等于没解释。
	 */
	interface Step {
		/** 行文本：等宽 + 中文双宽对齐，改中文标签要跟着补尾随空格 */
		text: string;
		/** 这一行的中文算法；留空表示这是条空行分隔 */
		tip?: string;
	}

	const STEPS: Step[] = [
		{
			text: '① 净收入       = G × (1 − u − r)',
			tip: '净收入 = 成交额 ×（1 − 未发货退款率 − 已发货退款率）：退掉的那部分不算收入'
		},
		{ text: '② 退款金额     = G × (u + r)', tip: '退款金额 = 成交额 ×（未发货退款率 + 已发货退款率）' },
		{
			text: '③ 发出货品成本 = G × (1 − u) × c',
			tip: '发出货品成本 = 成交额 ×（1 − 未发货退款率）× 商品成本率 —— 未发货那批货压根没出库，不计成本，所以也没有「加回来」这一步'
		},
		{
			text: '④ 收回货值     = G × c × (t + (r − t)×s)',
			tip: '收回货值 = 成交额 × 商品成本率 ×（在途退款率 + 签收后退货率 × 能收回的货款比例）：在途件原封回来按 100% 算，只有签收后退货走那个比例'
		},
		{
			text: '⑤ 残损货值     = G × c × (r − t) × (1 − s)',
			tip: '残损货值 = 成交额 × 商品成本率 × 签收后退货率 ×（1 − 能收回的比例）：唯一真亏掉的货值，而且只发生在签收后退货那一类'
		},
		{
			text: '⑥ 平台佣金     = 佣金口径 × k',
			tip: '平台佣金 = 佣金口径 × 平台佣金率；口径看你勾选的「退款时退还佣金」——未发货退款那类平台必然退佣，所以它始终不进佣金口径'
		},
		{
			text: '⑦ 正向物流     = N × (1 − u) × L',
			tip: '正向物流 = 实际发出的订单数 × 单均发货成本：未发货退款的那批没发出去，不产生运费'
		},
		{
			text: '⑧ 逆向物流     = N × r × R',
			tip: '逆向物流 = 已发货退款单数 × 单均退货成本：只有发出去又退回来的那些才发生，未发货退款没有逆向物流'
		},
		{
			text: '⑨ 贡献利润     = ① − ③ + ④ − ⑥ − ⑦ − ⑧ − O',
			tip: '贡献利润 = 净收入 − 发出货品成本 + 收回货值 − 平台佣金 − 正向物流 − 逆向物流 − 其他固定成本：这是「投广告之前」剩下的钱'
		},
		{ text: '⑩ 净利润       = ⑨ − A', tip: '净利润 = 贡献利润 − 广告费' },
		{ text: '' },
		{
			text: '佣金口径     = 退款退还佣金时取 ①，不退还时取 G − G×u',
			tip: '平台退还佣金时按净收入抽（退掉那单不抽佣），不退还就按成交额抽、但要先把未发货退款那类刨掉 —— 一句话：未发货退款始终不进佣金口径'
		},
		{ text: '广告 ROAS    = G ÷ A', tip: '广告 ROAS = 成交额 ÷ 广告费：一块钱广告费带来多少成交额' },
		{
			text: '广告费       = G ÷ 广告 ROAS（整盘口径允许直接填 ROAS，由它换算成 A）',
			tip: '整盘口径允许直接填「广告 ROAS」，此时广告费 = 成交额 ÷ 广告 ROAS'
		},
		{ text: '扣退货 ROAS  = ① ÷ A', tip: '扣退货 ROAS = 净收入 ÷ 广告费：把退掉的那部分从成交额里剔掉后再算' },
		{ text: '广告 ROI     = ⑩ ÷ A', tip: '广告 ROI = 净利润 ÷ 广告费：投广告这一件事的回报率' },
		{
			text: '生意 ROI     = ⑩ ÷ (A + 净货品成本)',
			tip: '生意 ROI = 净利润 ÷（广告费 + 净货品成本）：分母把压在货上的钱也算进去，是整盘生意的回报率'
		},
		{ text: '净货品成本   = ③ − ④', tip: '净货品成本 = 发出货品成本 − 收回货值：只算真正卖掉那部分的货值' },
		{ text: '保本 ROAS    = G ÷ ⑨', tip: '保本 ROAS = 成交额 ÷ 贡献利润：广告费投到贡献利润那么多时，净利润刚好归零' },
		{ text: '广告费上限   = ⑨', tip: '广告费上限 = 贡献利润：本期最多能拿这么多钱去投广告，再多就亏' },
		{ text: '' },
		{
			text: '单件口径     = N 取 1、G 取售价、A 取 0（它只算到广告费之前 → ⑩ = ⑨）',
			tip: '单件口径就是订单数取 1、成交额取售价、广告费取 0：它只算到广告费之前，所以净利润等于贡献利润'
		}
	];

	/** 三个利润率与三层保本线：同一个数、三种算法，差多少一目了然 */
	const MARGINS = `三个利润率（都对着成交额 G）
毛利率         = 1 − c
退货修正毛利率 = (① − 净货品成本) ÷ G
净利率         = ⑩ ÷ G

保本 ROAS 的三层口径（从粗到细，数字一层比一层高）
只扣货款     = 1 ÷ (1 − c)
再扣退货     = G ÷ (① − 净货品成本)
完整口径     = G ÷ ⑨

单件口径     = ⑩ = ⑨，所以第一组第三格是「净赚比例」而不是净利率`;

	/**
	 * 定价反推：单件口径专用，把售价与成本解出来；佣金口径与指标同源。
	 *
	 * 把「每件真花掉的钱」提成 `Fc` 单独一行：拆成三段的式子直接塞进分式里，
	 * 三个反推公式会各写一遍、改一处就要改三处 —— 提出来之后只在 Fc 那一行维护。
	 */
	const REVERSE = `每元剩余 p = 1 − u − r − 佣金口径 − 1 ÷ ROAS
（退款退还佣金时 佣金口径 = (1 − u − r)k，不退还时 = (1 − u)k）
（ROAS 就是结果卡上那个「假设投产比」：单件口径的输入里没有广告费，
  而售价要定多少，本来就取决于你打算按多少的投产比投）

每件真成本 Fc = C × (1 − u − t − (r − t)s) + L × (1 − u) + r × R
（未发货那件没出库，既不计货值也不计运费；在途件原封回来按完好算）

保本售价  P₀ = Fc ÷ p
达标售价  Pm = Fc ÷ (p − m)
成本上限  Cm = [P × (p − m) − L × (1 − u) − r × R] ÷ (1 − u − t − (r − t)s)

单件口径换算：N = 1 · G = P · c = C ÷ P · A = P ÷ ROAS`;

	/** 悬浮解释气泡的宽度，跟下面那个 `w-72`（18rem）必须一致 —— 定位要拿它算右边界 */
	const TIP_WIDTH = 288;

	/**
	 * 当前展开的解释。**用固定定位，不用 absolute**：说明栏是滚动容器
	 * （`#roi-doc-body`，桌面滚动、手机封顶 60vh），absolute 的气泡探出容器就被裁掉，
	 * 最下面那几行必然看不到。固定定位只跟视口算，代价是要自己算坐标。
	 */
	let tip = $state<{ text: string; top: number; left: number; flip: boolean } | null>(null);

	function showTip(step: Step, el: HTMLElement): void {
		if (!step.tip) return;
		const r = el.getBoundingClientRect();
		// 贴近视口底部就翻到 ? 上方：翻的那一下用 -translate-y-full，不用先量气泡高度
		const flip = r.bottom > window.innerHeight - 160;
		tip = {
			text: step.tip,
			top: flip ? r.top - 6 : r.bottom + 6,
			left: Math.min(Math.max(8, r.left - 4), window.innerWidth - TIP_WIDTH - 8),
			flip
		};
	}

	/** 触屏没有悬浮：点一下展开、再点一下收起（键盘 Tab 走 focus/blur，走不到 onclick） */
	function toggleTip(step: Step, el: HTMLElement): void {
		if (tip?.text === step.tip) tip = null;
		else showTip(step, el);
	}
</script>

<section class="relative flex flex-col gap-3">
	<!-- 公式块等宽横滚（长公式在窄屏不换行更好读），可滚动区需可聚焦才能用键盘滚动
	     （axe scrollable-region-focusable）；svelte 的静态规则不认识 role="region"，这里放行 -->
	<!-- relative 不能省：sr-only 是 absolute，没有定位上下文时包含块是初始包含块，
	     会逃出 #roi-doc-body 这个滚动容器的裁剪、把文档撑到内容之外（UI-STYLE §18） -->
	<h2 class="sr-only">计算公式</h2>

	<div class="flex flex-col gap-1.5">
		<h3 class={SECTION_TITLE}>符号</h3>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class={FORMULA_BLOCK} tabindex="0" role="region" aria-label="符号表">{SYMBOLS}</div>
	</div>

	<div class="flex flex-col gap-1.5">
		<h3 class={SECTION_TITLE}>从基础量推到保本线</h3>
		<!-- 每行前面一个问号图标（lucide `CircleQuestionMark`，就是圆圈里一个 ?）。
		     图标库里 `CircleHelp` 是它的旧名，已被标 deprecated，eslint 会拦（`no-deprecated`）。
		     悬浮（或聚焦、触屏点一下）显示这一行的中文算法。
		     行文本仍是等宽对齐的符号式，中文那句收在气泡里 —— 两者是同一件事的两种写法，
		     都铺在版面上会把这一块撑成两倍高。 -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class={FORMULA_BLOCK} tabindex="0" role="region" aria-label="公式推导">
			{#each STEPS as step, i (i)}
				{#if step.text === ''}
					<div class="h-6"></div>
				{:else}
					<div class="flex items-center gap-1.5">
						<!-- 按钮本体 24px（axe target-size 的下限），里面的图标只有 16px ——
						     视觉上要小、手指与鼠标可点范围要够，两者不在一个元素上解决 -->
						<button
							type="button"
							class="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
							aria-label={step.tip}
							onmouseenter={(e) => showTip(step, e.currentTarget)}
							onmouseleave={() => (tip = null)}
							onfocus={(e) => showTip(step, e.currentTarget)}
							onblur={() => (tip = null)}
							onclick={(e) => toggleTip(step, e.currentTarget)}
						>
							<CircleQuestionMark class="size-4" aria-hidden="true" />
						</button>
						<span class="whitespace-pre">{step.text}</span>
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<div class="flex flex-col gap-1.5">
		<h3 class={SECTION_TITLE}>三个利润率与三层保本线</h3>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class={FORMULA_BLOCK} tabindex="0" role="region" aria-label="利润率与保本线公式">{MARGINS}</div>
	</div>

	<div class="flex flex-col gap-1.5">
		<h3 class={SECTION_TITLE}>定价反推（单件口径）</h3>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class={FORMULA_BLOCK} tabindex="0" role="region" aria-label="定价反推公式">{REVERSE}</div>
	</div>

	<p class="text-xs leading-5 text-gray-600">
		怎么读：<span class="font-mono">① − ③ + ④</span> 是「收入减成本」的完整链路 ——
		<span class="font-mono">③</span> 只按<span class="font-medium">真正发出去</span>的货算成本（未发货退款的那批没出库，
		所以既不计货值也不计运费），退回的那部分再把 <span class="font-mono">④</span> 加回来。
		<span class="font-mono">⑤</span> 是 ③ 里真损耗掉的那点货值， 已经留在「③ − ④」里，<span class="font-medium"
			>不再单独减一次</span
		>。这也是本工具跟「收入乘个毛利率就完事」 的算法最大的差别。<span class="font-mono">⑨</span> 是广告费的上限：投到 ⑨ 这么多，净利润刚好归零，
		对回去就是保本 ROAS。
	</p>
	<p class="text-xs leading-5 text-gray-600">
		退款拆成三类是这个工具最该被看懂的一层：未发货的货没出库、在途的货原封回来、只有签收后退货会折损。
		合成一个「退货率」会把三者按同一套成本处理，最常见的结果是<span class="font-medium">给没发出去的货也算了运费</span
		>。
	</p>
	<p class="text-xs leading-5 text-gray-600">
		三个利润率对着的是<span class="font-medium">同一个销售额</span>，差别只在扣到哪一层；反推里的
		<span class="font-mono">p</span> 是「每 1 元售价里真正能留下来付货款的钱」—— 反推售价与成本上限全靠它。
		广告那一项两种填法只是入口不同：按 ROAS 填时先按 <span class="font-mono">A = G ÷ ROAS</span> 换成广告费，
		后面的符号一个都不变。 单件口径不是另一套公式，就是把 <span class="font-mono">N</span> 取 1、
		<span class="font-mono">G</span> 取售价、<span class="font-mono">A</span> 取 0： 它算的是<span class="font-medium"
			>广告费之前</span
		>的账，所以那边不给净利，给的是「每件赚多少」与「保本 ROAS」—— 每件赚的那个数， 同时就是能投出去的广告费上限。
	</p>
	<!-- 气泡挂在 section 末尾：fixed 不受任何祖先的 overflow 影响，放在哪层都能全屏显示 -->
	{#if tip !== null}
		<div
			class="{HOVER_CARD} w-72 text-xs leading-5 text-gray-700"
			class:-translate-y-full={tip.flip}
			style="top: {tip.top}px; left: {tip.left}px"
			role="tooltip"
		>
			{tip.text}
		</div>
	{/if}
</section>
