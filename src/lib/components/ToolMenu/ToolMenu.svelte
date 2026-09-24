<script lang="ts">
	// 工具页左上角的全站导航：一个图标按钮 + 一条**从左侧弹出**的抽屉（不是从下方下拉的浮层）。
	//
	// 抽屉铺满视口高度，手机端宽 85vw、桌面端 18rem 封顶；内容按 $lib/tools 的 TOOL_CATEGORIES
	// 分组列出全部工具，当前所在工具用 aria-current="page" 标出（默认 active 就是当前页）。
	//
	// 收藏也在这里：有收藏时「我的收藏」一组排在各分类之前，每行行尾一个星标切换收藏。
	// 星标是 <a> 的**兄弟节点而不是子节点** —— 交互元素不能嵌套，<a> 里放 <button> 既不合规
	// 也会让「点星标」连带触发跳转。空收藏整组不渲染（不留引导空态）。
	//
	// 分组可展开 / 收起：每组标题就是一枚按钮（aria-expanded + aria-controls），收起只把 <ul>
	// 置 hidden 而不从 DOM 摘掉 —— aria-controls 指向的 id 必须存在，摘掉会踩 axe 的
	// aria-valid-attr-value。默认全部展开（跟没有这个功能时逐字一致），收起状态只活在组件里、
	// 不落存储：抽屉每次翻页都会重挂，跨页记住收起态要单开一份 store，本轮不做。
	//
	// 定位用 absolute 而不是 fixed：导航条带 backdrop-blur（backdrop-filter），
	// 会给 fixed 子元素当包含块，写 fixed 抽屉会被压进 56px 高的导航条里。
	// 导航条是 sticky top-0，它的 top 恒等于视口顶部，所以 absolute top-0 + h-dvh 就是整屏。
	import { resolve } from '$app/paths';
	import { Check, ChevronDown, LayoutGrid, Menu, Star, X } from '@lucide/svelte';
	import type { LucideIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import { TOOL_CATEGORIES, TOOL_COUNT, toolHref, type Tool } from '$lib/tools';
	import { favorites } from '$lib/ui/favorites.svelte';
	import { motionDuration } from '$lib/ui/motion.svelte';
	import { FOCUS_RING } from '$lib/ui/styles';

	let {
		/** 当前工具页的站内路径（ToolShell 的 path），用来标 active */
		current,
		/** 抽屉内容区顶部追加的内容（首页把移动端搜索框放这儿） */
		header,
		/** 抽屉底部钉住的内容：移动端导航条放不下的那些链接（文档 / 源码），由 ToolShell 整段塞进来 */
		footer,
		/** 展开状态；外部需要控制时 bind:open */
		open = $bindable(false)
	}: { current: string; header?: Snippet; footer?: Snippet; open?: boolean } = $props();

	// 当前页那条同样是链接（点它也能跳回自己），所以选中态也要给 hover 反馈 ——
	// 其余未选中的都写着 `hover:bg-gray-100`，独独漏这条会让「当前工具」看着像不可点。
	const linkClass = (active: boolean) =>
		active
			? `flex h-8 items-center gap-2 rounded bg-blue-50 px-2 text-xs font-medium text-blue-700 hover:bg-blue-100 ${FOCUS_RING}`
			: `flex h-8 items-center gap-2 rounded px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 ${FOCUS_RING}`;

	/** 在首页时（current === '/'）「首页 · 全部工具」那条就是 active，跟工具页标当前工具同一个口径 */
	const homeActive = $derived(current === '/');

	// 条件类名一律在脚本里拼好：写进 class 属性的三元会被 prettier 拆行后静默失效（AGENTS §6）
	const toolLinkClass = (active: boolean) => `min-w-0 flex-1 ${linkClass(active)}`;
	/**
	 * 行尾星标：24px 是触控下限，未收藏灰、已收藏琥珀（两档都过非文本对比度 3:1）。
	 * 未收藏的默认透明，**行 hover / 行内有焦点时才现形**（行元素带 `group`）—— 三十行各挂
	 * 一枚灰星星太吵；触摸设备没有 hover，`pointer-coarse` 下常显。透明 ≠ 禁用，点它照样能收藏。
	 */
	const starClass = (starred: boolean) =>
		`inline-flex size-6 shrink-0 items-center justify-center rounded transition-opacity ${FOCUS_RING} ${
			starred
				? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700'
				: 'text-gray-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-gray-100 hover:text-gray-700 pointer-coarse:opacity-100'
		}`;

	/**
	 * 收起的分组 id（分类 id，收藏组用 'favorites'）；缺省即展开。
	 * 只存在组件里，不落存储 —— 见文件头关于「跨页不记」那段。
	 */
	let collapsed = $state<Record<string, boolean>>({});

	const isCollapsed = (id: string) => collapsed[id] === true;

	function toggleGroup(id: string): void {
		collapsed[id] = !collapsed[id];
	}

	/** 分组标题那一整行是按钮：收起后长列表不用一路滚到底 */
	const headerButtonClass = `flex w-full items-center gap-2 rounded px-2 pt-1 pb-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 ${FOCUS_RING}`;
	/** 收藏组的图标底是琥珀、分类是蓝 */
	const headerIconClass = (favorite: boolean) =>
		`flex size-5 shrink-0 items-center justify-center rounded ${favorite ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`;
	/** 收起时箭头转成朝右 */
	const chevronClass = (hidden: boolean) =>
		`size-3.5 shrink-0 text-gray-500 transition-transform ${hidden ? '-rotate-90' : ''}`;

	/** 全部工具摊平一份，给收藏按路径回查用 */
	const ALL_TOOLS: Tool[] = TOOL_CATEGORIES.flatMap((category) => category.tools);

	/**
	 * 「我的收藏」那一组：按收藏顺序取工具，路径回查不到的直接跳过。
	 * 回查必须在渲染方做 —— store 只存路径，不知道现在有哪些工具；
	 * 工具下线或改名后残留在存储里的旧路径，不该再渲染成一行。
	 */
	const favoriteTools = $derived(
		favorites.paths
			.map((path) => ALL_TOOLS.find((tool) => tool.path === path))
			.filter((tool): tool is Tool => tool !== undefined)
	);

	/** 抽屉内容滚动区，打开时用它把当前工具滚进视野 */
	let scrollEl = $state<HTMLDivElement | null>(null);
	/** 触发按钮：抽屉关掉后焦点要还给它，否则键盘用户 Tab 会从页首重来一遍 */
	let triggerEl = $state<HTMLButtonElement | null>(null);
	/** 抽屉本体与里面的关闭按钮：焦点陷阱按抽屉为边界算 */
	let drawerEl = $state<HTMLElement | null>(null);
	let closeEl = $state<HTMLButtonElement | null>(null);

	/**
	 * 打开 / 关闭的焦点交接。
	 *
	 * 抽屉是一层浮起来的面板，不接管焦点的话：排在全站最后的那些工具链接继续留在 Tab 序列里，
	 * 键盘用户 Tab 一路走到看不见的背景上去，而打开抽屉的那一手没有任何反馈（焦点还在原按钮、
	 * 但屏幕上多了一整块内容）。所以打开进抽屉、关闭回触发器，中间 ^. Tab 只在抽屉内循环。
	 */
	$effect(() => {
		if (!open) return;
		// 抽屉刚挂上，先交给它自己往下传播的初始焦点（关闭按钮在标题行，位置最稳）
		closeEl?.focus();
		return () => {
			// 关抽屉的三路（点外面 / Esc / 点链接）都走这里，焦点回到那枚菜单按钮。
			// 点了工具链接的情况：导航马上就发生，这一下 focus 不会留下可见影响。
			triggerEl?.focus();
		};
	});

	/**
	 * Tab 在抽屉里兜圈：走到最后一枚再往后就绕回第一枚，反向同理。
	 *
	 * 挂在 window 上而不是 `<aside>` 上：`aside` 是 complementary landmark，
	 * 给它挂键盘监听会踩 svelte 的 a11y_no_noninteractive_element_interactions ——
	 * 而焦点陷阱本来也不是「抽屉自己的交互」，是「抽屉打开期间键盘全局归抽屉管」，
	 * 放在 window 这一层反而更贴合它做的事（遮罩那一路 pointerdown 也是这个思路）。
	 */
	function trapTab(event: KeyboardEvent): void {
		if (event.key !== 'Tab' || !drawerEl) return;
		const items = [
			...drawerEl.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]')
		].filter((el) => el.offsetParent !== null && el.tabIndex !== -1);
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		// 收起的分组是 hidden 的 <ul>，里面的链接 offsetParent 为 null，早已被上面滤掉
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	// 打开抽屉时把当前工具定位到视野中间：列表比一屏长，默认停在顶部分组就看不到自己在哪。
	// 已经在视野内则不动 —— 首页的 active 是顶部那条，无谓的跳动反而晃眼。
	// 用 rect 差值改 scrollTop 而不是 scrollIntoView：后者会连带滚动整页。
	$effect(() => {
		if (!open || !scrollEl) return;

		const active = scrollEl.querySelector<HTMLElement>('[aria-current="page"]');
		if (!active) return;
		// 当前工具所在分组被收起了：它在 DOM 里但 hidden，rect 全 0，拿它算会把列表滚到顶
		if (active.offsetParent === null) return;

		const container = scrollEl.getBoundingClientRect();
		const item = active.getBoundingClientRect();
		// 动画期间抽屉只做横向位移，纵向 rect 不受影响，这里可以直接量
		if (item.top >= container.top && item.bottom <= container.bottom) return;

		scrollEl.scrollTop += item.top - container.top - container.height / 2 + item.height / 2;
	});

	/** 点到抽屉外面就收起（按钮与抽屉都打了 data-tool-menu，点它们不算外部） */
	function onWindowPointerDown(event: Event): void {
		if (!open) return;
		if ((event.target as HTMLElement | null)?.closest('[data-tool-menu]')) return;
		open = false;
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (!open) return;
		if (event.key === 'Escape') open = false;
		else trapTab(event);
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<!--
	分组标题行：图标 + 组名 + 条数 + 箭头，整行一枚按钮，点它展开 / 收起本组。
	favorite 只影响图标底配色（收藏组琥珀、分类蓝），结构两处共用。
-->
{#snippet groupHeader(id: string, name: string, count: number, icon: LucideIcon, favorite = false)}
	{@const Icon = icon}
	{@const hidden = isCollapsed(id)}
	<h3 class="border-b border-gray-100">
		<button
			type="button"
			aria-expanded={!hidden}
			aria-controls={`tool-group-${id}`}
			title={hidden ? `展开${name}` : `收起${name}`}
			onclick={() => toggleGroup(id)}
			class={headerButtonClass}
		>
			<span class={headerIconClass(favorite)}>
				<Icon class="size-3" fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
			</span>
			<span class="min-w-0 truncate">{name}</span>
			<span class="ml-auto shrink-0 text-[11px] font-normal text-gray-500">{count}</span>
			<ChevronDown class={chevronClass(hidden)} aria-hidden="true" />
		</button>
	</h3>
{/snippet}

<!--
	一行工具：链接 + 行尾星标。两个列表（「我的收藏」与各分类）共用它，
	所以收藏组里的星标也是同一个按钮 —— 状态由 favorites 决定，在收藏组里点它就是取消收藏。
-->
{#snippet toolRow(tool: Tool)}
	{@const ToolIcon = tool.icon}
	{@const active = current === tool.path}
	{@const starred = favorites.has(tool.path)}
	<li class="group flex items-center gap-0.5">
		<a
			href={toolHref(tool.path)}
			aria-current={active ? 'page' : undefined}
			onclick={() => (open = false)}
			class={toolLinkClass(active)}
		>
			<ToolIcon class="size-3.5 shrink-0" aria-hidden="true" />
			<span class="min-w-0 flex-1 truncate">{tool.name}</span>
			{#if active}
				<Check class="size-3.5 shrink-0 text-blue-600" aria-hidden="true" />
			{/if}
		</a>
		<button
			type="button"
			aria-label={starred ? `取消收藏${tool.name}` : `收藏${tool.name}`}
			aria-pressed={starred}
			title={starred ? '取消收藏' : '收藏'}
			onclick={() => favorites.toggle(tool.path)}
			class={starClass(starred)}
		>
			<Star class="size-3.5" fill={starred ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
	</li>
{/snippet}

<button
	bind:this={triggerEl}
	type="button"
	data-tool-menu
	aria-label="全部工具导航"
	aria-expanded={open}
	title="全部工具导航"
	onclick={() => (open = !open)}
	class="-ml-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 {FOCUS_RING}"
>
	<Menu class="size-5" aria-hidden="true" />
</button>

{#if open}
	<!-- 遮罩与抽屉都是导航条里的定位元素：z-0 / z-10 让它们盖住导航条里的品牌文字，
		 且抽屉在遮罩之上（导航条本身 z-50，整条都盖在主区上面）。
		 遮罩只压暗、不接点击 —— 收起由 window 的 pointerdown 统一处理，省掉一处 a11y 交互 -->
	<div class="absolute top-0 left-0 z-0 h-dvh w-full bg-gray-900/20" aria-hidden="true"></div>

	<aside
		bind:this={drawerEl}
		id="tool-menu"
		data-tool-menu
		aria-label="全部工具导航"
		transition:fly={{ x: -320, duration: motionDuration(200) }}
		class="absolute top-0 left-0 z-10 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white shadow-xl"
	>
		<!-- px-4 + 关闭按钮 -mr-2：标题落在 16px 内容线上，X 图标（36px 方块里居中，自带 8px 内空）
			 的视觉右边距也正好是 16px，跟下面工具行的 16px 对齐 -->
		<div class="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-4">
			<span class="text-sm font-semibold tracking-tight text-gray-900">全部工具</span>
			<span class="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-gray-600">
				{TOOL_COUNT}
			</span>
			<button
				bind:this={closeEl}
				type="button"
				aria-label="关闭工具导航"
				title="关闭"
				onclick={() => (open = false)}
				class="-mr-2 ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 {FOCUS_RING}"
			>
				<X class="size-5" aria-hidden="true" />
			</button>
		</div>

		<div bind:this={scrollEl} class="min-h-0 flex-1 overflow-y-auto p-2">
			<!-- 调用方塞进来的内容（首页的移动端搜索框）：响应式由调用方自己写 -->
			{@render header?.()}

			<a
				href={resolve('/')}
				aria-current={homeActive ? 'page' : undefined}
				onclick={() => (open = false)}
				class={linkClass(homeActive)}
			>
				<LayoutGrid class="size-3.5 shrink-0 text-blue-600" aria-hidden="true" />
				<span class="min-w-0 flex-1 truncate">首页 · 全部工具</span>
				{#if homeActive}
					<Check class="size-3.5 shrink-0 text-blue-600" aria-hidden="true" />
				{/if}
			</a>

			<!-- 收藏优先于分类；一条都没有时整组不渲染，不留空态引导 -->
			{#if favoriteTools.length > 0}
				<section class="mt-2">
					{@render groupHeader('favorites', '我的收藏', favoriteTools.length, Star, true)}
					<ul id="tool-group-favorites" hidden={isCollapsed('favorites')} class="mt-1 space-y-0.5 pl-1">
						{#each favoriteTools as tool (tool.path)}
							{@render toolRow(tool)}
						{/each}
					</ul>
				</section>
			{/if}

			<div class="mt-2 space-y-3">
				{#each TOOL_CATEGORIES as category (category.id)}
					<section>
						{@render groupHeader(category.id, category.name, category.tools.length, category.icon)}
						<ul id={`tool-group-${category.id}`} hidden={isCollapsed(category.id)} class="mt-1 space-y-0.5 pl-1">
							{#each category.tools as tool (tool.path)}
								{@render toolRow(tool)}
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>

		<!-- 底部固定区：整块内容由调用方给（ToolShell 塞文档 + 源码两行），组件只管钉住与分隔线。
			 桌面端这些链接都留在导航条右侧，所以整块 lg:hidden -->
		{#if footer}
			<div class="shrink-0 border-t border-gray-200 p-2 lg:hidden">
				{@render footer()}
			</div>
		{/if}
	</aside>
{/if}
