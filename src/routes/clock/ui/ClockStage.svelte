<script lang="ts">
	// 时钟舞台：页面预览区与小窗（画中画 / 独立窗口）共用同一个显示组件。
	//
	// ⚠️ 本组件刻意**一处 Tailwind class 都不用**，全部走 inline style，理由是：
	//   ① 画中画是把本节点整体搬进另一个 document 的，那边没有本站的样式表 —— 用 class 写会在窗口里
	//      整块失灵（颜色、字号、居中全丢），只剩浏览器默认样式；
	//   ② 时钟是一幅「独立画面」，不该跟着站点的深浅主题走 —— 它的颜色完全由用户设定决定；
	//   ③ 预览区与窗口因此所见即所得，不必再写一套「窗口专用样式」。
	//   改样式时请继续内联，**不要**为了省事换成 class。
	//
	// 字号自适应靠容器查询（cqw / cqh）：外层舞台是 container-type: size，
	// 所以拖动画中画窗口大小时数字会跟着缩放，纯 CSS 完成、不经过 JS。
	import { FONT_STACKS } from '../config.ts';
	import { outlineColor, rotateLayout, textWidthEm } from '../core/format.ts';
	import { clockStore } from '../core/store.svelte.ts';
	import type { FontKey } from '../core/types.ts';

	/** DOM 节点交给页面：画中画要把它搬走（见 ui/window.ts） */
	let { ref = $bindable(null) }: { ref?: HTMLElement | null } = $props();

	/**
	 * 舞台的像素尺寸，旋转摆放要用到长宽比（纯 CSS 拿不到这个比例，见 rotateLayout 的注释）。
	 * 画中画窗口被拖动缩放时，这里量到的值也会跟着变，画面自动重新摆放。
	 */
	let size = $state({ w: 0, h: 0 });

	// 只在客户端跑：SSR 阶段没有 ResizeObserver，首帧就保持 0×0（即「不缩」，0 度本来也不需要缩）
	$effect(() => {
		const el = ref;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				size = { w: entry.contentRect.width, h: entry.contentRect.height };
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	/** 各字体族下一个**半角**字符大致占几 em 宽；全角按 1em 单独算（见 textWidthEm） */
	const CHAR_RATIO: Record<FontKey, number> = { mono: 0.6, sans: 0.56, serif: 0.5 };

	/** 描边方向：八邻域各叠一层，斜向也补上，细笔画才不会缺角 */
	const OUTLINE_DIRS = [
		[0, 0],
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1]
	] as const;

	const style = $derived(clockStore.style);
	const fontStack = $derived(FONT_STACKS[style.font]);
	/** 按冒号切开，闪烁时只让冒号淡出 */
	const parts = $derived(clockStore.primaryText.split(':'));

	const isText = $derived(clockStore.mode === 'text');

	/** 到点转红：属于提醒语义，优先于用户设定的文字色 */
	const mainColor = $derived(clockStore.alarmed ? '#ef4444' : style.fg);

	/** 冒号透明度。先在脚本里算好 —— 属性里写三元会被 prettier 拆行拆坏（AGENTS §6） */
	const colonOpacity = $derived(clockStore.colonVisible ? 1 : 0.2);

	/** 整摞内容的横向对齐：文字模式选左对齐时，文本块本身也要靠左（光设 text-align 只会让每行居中） */
	const stackAlign = $derived(isText && clockStore.textOptions.align === 'left' ? 'flex-start' : 'center');

	function hexToRgba(hex: string, alpha: number): string {
		const normalized = hex.replace('#', '');
		if (normalized.length !== 6) return hex;
		const channels = [0, 2, 4].map((i) => Number.parseInt(normalized.slice(i, i + 2), 16));
		const [r, g, b] = channels as [number, number, number];
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	/** 背景色 + 不透明度；拉满时直接用原色，省掉一层 rgba */
	const background = $derived(style.bgAlpha >= 100 ? style.bg : hexToRgba(style.bg, style.bgAlpha / 100));

	/**
	 * 描边：八方向各叠一层 text-shadow。
	 * 不用 `-webkit-text-stroke` —— 它是**向内**描边，细笔画会被吃粗糊成一块；
	 * shadow 用 em 作单位，字号变了描边跟着变，不必再算一遍。
	 *
	 * 这里算出**整条属性值**（含 `none`），模板里直接 `text-shadow: {outlineShadow}` ——
	 * 不要在属性里写三元，prettier 拆行后条件会被当成纯文本、整段静默失效（AGENTS §6）。
	 */
	const outlineShadow = $derived.by(() => {
		if (style.outline === 'none') return 'none';
		const color = outlineColor(style.fg);
		const width = style.outline === 'soft' ? 0.03 : 0.055;
		return OUTLINE_DIRS.map(([x, y]) => `${x * width}em ${y * width}em 0 ${color}`).join(', ');
	});

	/**
	 * 自动档字号要在**宽、高两个方向**都不出界，所以两个方向各估一个「等于多少个字号单位」，
	 * 最后取小的那个（`min(100cqw / 宽, 100cqh / 高)`）。
	 *
	 * 估得略保守（除数偏大），宁可小一点也不要顶出边界。两处差别：
	 *   · 时钟/倒计时/秒表 —— 宽按主数字字符数，高按「主数字 + 上下两行说明」；
	 *   · 文字模式 —— 宽按**最长那一行**（中文按 1em、半角按字体族比例），高按行数。
	 */
	const metrics = $derived.by(() => {
		const half = CHAR_RATIO[style.font];
		if (isText) {
			const lines = clockStore.textOptions.content.split('\n');
			const widest = Math.max(1, ...lines.map((line) => textWidthEm(line, half)));
			return { widthUnits: widest + 0.4, heightUnits: lines.length * 1.3 + 0.2 };
		}
		const chars = Math.max(1, clockStore.primaryText.length);
		return {
			widthUnits: chars * half + 0.4,
			heightUnits: 1.2 + (clockStore.prefixText === '' ? 0 : 0.6) + (clockStore.captionText === '' ? 0 : 0.55)
		};
	});

	const rootFontSize = $derived(
		style.sizeMode === 'manual'
			? `${style.fontSize}px`
			: `min(calc(100cqw / ${metrics.widthUnits.toFixed(2)}), calc(100cqh / ${metrics.heightUnits.toFixed(2)}))`
	);

	/** 角度 / 翻转的摆放结果；整条 transform 与长宽是否对调都在里面算好 */
	const layout = $derived(rotateLayout(style.angle, style.mirror, size.w, size.h));
</script>

<!-- 外层舞台：容器查询的上下文，背景色铺在这一层；旋转层转出去的部分由它裁掉（overflow: hidden） -->
<div
	bind:this={ref}
	role="timer"
	style="container-type: size; position: relative; width: 100%; height: 100%; overflow: hidden;
		background: {background};"
>
	<!-- 旋转层：绝对定位 + 中心旋转。它自己也是容器查询的上下文 ——
	     里面那几行的 cqw / cqh / cqmin 因此按**旋转后**的这张画布算，字号的填满口径不变。
	     自身的宽高用外层容器的 cq 单位写；90 / 270 时长宽对调，正好把竖着的窗口填满 -->
	<div
		style="container-type: size; position: absolute; top: 50%; left: 50%;
			width: {layout.swap ? '100cqh' : '100cqw'}; height: {layout.swap ? '100cqw' : '100cqh'};
			transform: {layout.transform}; transform-origin: center;"
	>
		<div
			style="display: flex; width: 100%; height: 100%; flex-direction: column; align-items: {stackAlign};
				justify-content: center; box-sizing: border-box; padding: {style.padding}cqmin;
				font-family: {fontStack}; font-size: {rootFontSize}; line-height: 1.2;
				text-shadow: {outlineShadow};"
		>
			{#if isText}
				<!-- 文字模式：保留用户自己的换行，整体居中或靠左 -->
				<div
					style="max-width: 100%; white-space: pre-wrap; color: {mainColor}; font-weight: {style.weight};
						text-align: {clockStore.textOptions.align}; line-height: 1.3;"
				>
					{clockStore.textOptions.content}
				</div>
			{:else}
				{#if clockStore.prefixText}
					<div style="margin-bottom: 0.3em; font-size: 0.26em; font-weight: 600; color: {mainColor}; opacity: 0.85;">
						{clockStore.prefixText}
					</div>
				{/if}

				<div
					style="display: flex; align-items: baseline; color: {mainColor};
						font-weight: {style.weight}; font-variant-numeric: tabular-nums; letter-spacing: 0.01em;"
				>
					{#each parts as part, index (index)}
						{#if index > 0}
							<!-- 冒号闪烁：只调透明度，不删节点，免得整行宽度跳 -->
							<span style="opacity: {colonOpacity}; transition: opacity 120ms linear;">:</span>
						{/if}
						<span>{part}</span>
					{/each}
					{#if clockStore.meridiemText}
						<span style="margin-left: 0.18em; font-size: 0.3em; font-weight: 600; opacity: 0.8;">
							{clockStore.meridiemText}
						</span>
					{/if}
				</div>

				{#if clockStore.captionText}
					<div style="margin-top: 0.3em; font-size: 0.18em; font-weight: 500; color: {mainColor}; opacity: 0.75;">
						{clockStore.captionText}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
