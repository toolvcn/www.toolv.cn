<script lang="ts">
	// 敏感性表配的迷你折线：运营看图比看表快，但为一个 sparkline 引图表库不值（原生优先）。
	// 手写 SVG，只有一条折线 + 一条零线 + 几个点，没有任何依赖。
	//
	// 两个刻意的选择：
	// 1. **整块 aria-hidden** —— 上面的表格里已经有同样的数字，读屏不该再念一遍；
	//    它是纯装饰，信息一点没少。
	// 2. **点是 HTML 元素，不是 <circle>** —— 折线用 preserveAspectRatio="none" 拉满宽度，
	//    SVG 里的圆会被拉成椭圆；用绝对定位的 span 按百分比摆，形状才是对的。
	let {
		values,
		highlight = -1
	}: {
		/** 要画的数，顺序即从左到右；非有限值（Infinity / NaN）的那几个点跳过不画 */
		values: number[];
		/** 高亮第几个点（当前值落在哪一档，按 `values` 的下标）；-1 表示不高亮 */
		highlight?: number;
	} = $props();

	const W = 100;
	const H = 32;
	const PAD = 4;

	/**
	 * 只保留**画得出来**的那些点。
	 * Infinity / NaN 既污染 Math.min / Math.max，也算不出坐标；而它们是有真实来源的：
	 * 退货率涨到贡献利润转负时保本 ROAS 就是 Infinity（表里那一格显示「—」）。
	 * 旧写法要求「全都有限」才画，于是 10 档表里只要有一档不存在，整条折线就消失 ——
	 * 现在改成跳过那几个点，线停在能算出来的最后一档。全都画不出时才整块隐藏。
	 */
	const points = $derived(
		values.map((value, index) => ({ value, index })).filter((point) => Number.isFinite(point.value))
	);

	/** 画得出来才画 */
	const drawable = $derived(points.length > 1);

	/** 横轴按**原始档位数**均分（跳过的那几档照样占位），这样刻度与上面的表格一一对齐 */
	const toX = (index: number): number => (values.length > 1 ? index / (values.length - 1) : 0.5);

	// 纵轴范围把 0 包进来：净利可能为负，没有零线就看不出「哪一段是亏的」
	const range = $derived.by(() => {
		const nums = points.map((point) => point.value);
		const min = Math.min(0, ...nums);
		const max = Math.max(0, ...nums);
		return max - min < 1e-9 ? { min: -1, max: 1 } : { min, max };
	});

	const toY = $derived(
		(value: number): number => H - PAD - ((value - range.min) / (range.max - range.min)) * (H - PAD * 2)
	);

	/** 折线的 points：x 按档位均分，y 按上面的映射（viewBox 里 0 = 顶部） */
	const line = $derived(points.map((point) => `${toX(point.index) * W},${toY(point.value)}`).join(' '));

	/** 每个点的位置，换算成百分比交给绝对定位的 span；`index` 是它在原始档位里的下标，用来对高亮 */
	const dots = $derived(
		points.map((point) => ({ index: point.index, x: toX(point.index) * 100, y: (toY(point.value) / H) * 100 }))
	);

	const hasNegative = $derived(points.some((point) => point.value < 0));
</script>

{#if drawable}
	<div class="relative mt-1 h-8 w-full text-blue-500" aria-hidden="true">
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="h-full w-full">
			{#if hasNegative}
				<line
					x1="0"
					x2={W}
					y1={toY(0)}
					y2={toY(0)}
					stroke="currentColor"
					stroke-width="0.5"
					stroke-dasharray="2 2"
					opacity="0.5"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
			<polyline points={line} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
		</svg>
		{#each dots as dot (dot.index)}
			<span
				class="absolute rounded-full {dot.index === highlight
					? 'size-2.5 bg-blue-600 ring-2 ring-blue-200'
					: 'size-1.5 bg-blue-400'}"
				style="left: {dot.x}%; top: {dot.y}%; transform: translate(-50%, -50%)"
			></span>
		{/each}
	</div>
{/if}
