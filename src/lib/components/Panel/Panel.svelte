<script lang="ts">
	// 面板外壳：卡片 + h-12 头部（标题 + 右侧操作区）+ 正文 + 可选底栏。
	// 各工具的面板共用，样式改一处即可全站生效。
	// 内边距与分隔线的规矩：正文的内边距由正文自己给（一般是 p-4 / 行给 px-4），
	// 于是行与区块的横向分隔线是通栏的（贴到卡片边框），跟头部那条 border-b 一个口径；
	// 工具条 / 状态条这类通栏底栏走 footer，渲染在正文容器之外，不吃正文的内边距。
	//
	// 与 Button 同构：继承 HTMLAttributes + rest 透传（data-*、aria-*、hidden 等落到外壳上）。
	// id / headingId 现在可省略 —— 省略时用 $props.id() 生成，省掉每处手写 id 的重复。
	//
	// 头部只有一行字时用 `heading`；头部整条换成别的（工作区的 Tabs 横线）用 `header` ——
	// 此时 `heading` 降级成视觉隐藏的 h2，landmark 仍然有名字。
	// `relative` 在基类里，不能省：sr-only 的 h2 / label 是 absolute，没有定位上下文时
	// 包含块退化成初始包含块，会逃出 `overflow-hidden` 把文档撑高（UI-STYLE §18）。
	//
	// 传 `fullscreen` 就在标题行右侧多一枚「全屏」按钮（原生全屏，见 `$lib/components/FullscreenButton`）：
	// 全屏的是**整张卡片**（标题行 + 正文 + 底栏一起进），高度策略在全屏时**整体换成** `h-dvh w-full` 而不是叠加覆盖。
	// 想全屏的卡片都从这里走 —— `EditorPane` 也是把 `fullscreen` 转交给它，别在工具里自己接那一套。
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import FullscreenButton from '$lib/components/FullscreenButton/FullscreenButton.svelte';

	type Props = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children' | 'id'> & {
		/** 外壳 id，省略则用 $props.id() 生成 */
		id?: string;
		/** 标题 id（aria-labelledby 用），省略则为 `${id}-heading` */
		headingId?: string;
		heading: string;
		tag?: 'section' | 'aside';
		/** 标题右侧的补充信息（比如当前连接的地址） */
		headingExtra?: Snippet;
		/** 头部右侧的操作按钮 */
		actions?: Snippet;
		/**
		 * 自定义头部：给了就**整条替换**默认的 h-12 标题行（工作区放 `<Tabs variant="line">` 用）。
		 * `heading` 仍必填 —— 降级成 sr-only 的 h2 供 aria-labelledby。
		 */
		header?: Snippet;
		/**
		 * 是否裁掉溢出（默认 true，配合 rounded-xl）。**里面有浮层时要关**：
		 * `overflow-hidden` 会把菜单 / 下拉（`absolute` 挂在卡片内）一起裁掉，
		 * 那种卡片由自己裁圆角（Tabs 上加 `overflow-hidden rounded-t-xl`）。见 UI-STYLE §8。
		 */
		clip?: boolean;
		/** 附加在外壳上的类（各面板的滚动 / 高度策略不同） */
		class?: string;
		/** 通栏底栏（计数 / 状态条）：在正文容器之外渲染，分隔线贴卡片边框 */
		footer?: Snippet;
		/** 是否在标题行右侧挂「全屏」按钮（默认关闭）。开了之后整张卡片走原生全屏 */
		fullscreen?: boolean;
		/** 全屏按钮的无障碍名，缺省用 `heading`（拼成「全屏查看输出结果」） */
		fullscreenName?: string;
		children: Snippet;
		/** 要拿到外壳 DOM 时 bind:ref={el}（动态标签，类型是 HTMLElement） */
		ref?: HTMLElement | null;
	};

	let {
		id,
		headingId,
		heading,
		tag = 'section',
		headingExtra,
		actions,
		header,
		clip = true,
		class: className = '',
		footer,
		fullscreen = false,
		fullscreenName,
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const uid = $props.id();
	const panelId = $derived(id ?? uid);
	const headingElId = $derived(headingId ?? `${panelId}-heading`);

	/** 当前是否全屏；真实状态由 `FullscreenButton` 按 `fullscreenchange` 写回（Esc 退出也算） */
	let isFullscreen = $state(false);
	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	// 全屏时**整体换掉**调用方的高度策略：不能给 `h-full` —— 全屏元素的父级高度是 `auto`，百分比高度不成立
	// （也不能用 `max-h-none` 之类去覆盖，同变体下谁生效取决于 Tailwind 产物顺序；见 docs/MEMORY.md）
	//
	// 末尾那条是小屏专用：编辑框自带 `h-[45vh]`（双栏堆叠时别把页面撑太长），全屏后该跟着卡片填满；
	// 用后代选择器（权重高于它自己的类）而不是再加一个 `h-full` —— 同权重的两条谁生效看产物顺序，不可靠
	const cls = $derived(
		[
			'relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm',
			clip ? 'overflow-hidden' : '',
			isFullscreen ? 'h-dvh w-full max-md:[&_textarea]:h-full' : className
		].join(' ')
	);
	// 没有调用方的 actions 又没开全屏时，别塞一个空的头部操作区进去
	const hasActions = $derived(actions !== undefined || fullscreen);
</script>

<!-- 调用方的操作在前、全屏按钮在后（最右） -->
{#snippet mergedActions()}
	{@render actions?.()}
	{#if fullscreen}
		<FullscreenButton bind:fullscreen={isFullscreen} name={fullscreenName ?? heading} target={() => ref} />
	{/if}
{/snippet}

<svelte:element this={tag} bind:this={ref} id={panelId} aria-labelledby={headingElId} {...rest} class={cls}>
	{#if header}
		<!-- 头部整条交给调用方：标题降级成视觉隐藏，aria-labelledby 仍指向它 -->
		<h2 id={headingElId} class="sr-only">{heading}</h2>
		{@render header()}
	{:else}
		<!-- flex-wrap：窄屏放不下时按钮换行而不是溢出 -->
		<div class="flex h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4">
			<div class="flex min-w-0 items-center gap-2">
				<h2 id={headingElId} class="shrink-0 text-sm font-semibold text-gray-900">{heading}</h2>
				{#if headingExtra}{@render headingExtra()}{/if}
			</div>
			{#if hasActions}
				<div class="flex shrink-0 items-center gap-1.5">{@render mergedActions()}</div>
			{/if}
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</div>

	{#if footer}
		{@render footer()}
	{/if}
</svelte:element>
