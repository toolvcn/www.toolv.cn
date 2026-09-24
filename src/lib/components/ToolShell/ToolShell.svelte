<script lang="ts">
	// 工具页的外壳：SEO head + 顶部导航 + 主区，各工具页只留自己的面板。
	// 之前 18 个页面各写一份 ~40 行的外壳，宽度、满屏策略、title 格式逐处长歪
	// （max-w 三档混用、title 两种写法），收在这里之后只在一处定义。
	//
	// 布局只有三个旋钮：width 定宽、fill 满屏、mainClass 整段替换主区（自绘栅格的页面用）。
	import { resolve } from '$app/paths';
	import { ArrowUpRight, BookOpen, ShieldCheck } from '@lucide/svelte';
	import type { LucideIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import ToolMenu from '$lib/components/ToolMenu/ToolMenu.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle/ThemeToggle.svelte';
	import { FOCUS_RING } from '$lib/ui/styles';

	let {
		// 导航标题与 SEO
		icon,
		name,
		tagline,
		heading,
		description,
		keywords,
		path,
		ogDescription,
		docUrl,
		docLabel,
		title,
		navExtra,
		menuHeader,
		footer,
		// 主区布局
		width = 'wide',
		fill = 'flow',
		fillFrom = 'md',
		mainClass,
		children
	}: {
		/** 导航图标块里的图标 */
		icon: LucideIcon;
		/** 工具名，用于导航标题与 <title> */
		name: string;
		/** 导航标题下的副标题：一行卖点 */
		tagline: string;
		/** 页面唯一的 h1（视觉隐藏），省略则与 name 相同 */
		heading?: string;
		description: string;
		keywords: string;
		/** 站内绝对路径，同时用于 canonical 与 og:url */
		path: string;
		/** og:description，省略则与 description 相同 */
		ogDescription?: string;
		/** `<title>`：省略用默认的「{name} by 无情 | www.toolv.cn」；首页这种标题里自带卖点的才传 */
		title?: string;
		/** 导航条右侧一簇里追加的内容（首页放桌面端搜索框）：排在「数据本地处理」之后、文档 / 源码之前 */
		navExtra?: Snippet;
		/** 塞进工具菜单抽屉顶部的内容（首页把移动端搜索框放这儿，见 ToolMenu 的 header 槽） */
		menuHeader?: Snippet;
		/** 主区之后、外壳底部的内容（目前只有首页有页脚） */
		footer?: Snippet;
		/** 站外文档链接（如菜鸟教程的对应章节），给了才在导航右侧显示 */
		docUrl?: string;
		/** 文档链接的文案，省略为「文档」 */
		docLabel?: string;
		/** 主区最大宽度：narrow 单栏窄表单 / medium / wide 多栏与长列表 / full 不封顶（宽屏也要铺满） */
		width?: 'narrow' | 'medium' | 'wide' | 'full';
		/** fill 满屏（铺满视口，编辑器型）/ flow 页面自然流（面板型） */
		fill?: 'fill' | 'flow';
		/** fill 从哪个断点开始铺满视口：面板在 lg 才切多列时用 lg，否则默认 md */
		fillFrom?: 'md' | 'lg';
		/** 主区类名：给了就整段替换默认的「定宽 + 纵向 flex」，自绘栅格的页面（如 websocket）用它 */
		mainClass?: string;
		children: Snippet;
	} = $props();

	// canonical / og:url 与「源码直达」都从这两个地址拼
	const SITE = 'https://www.toolv.cn';
	const REPO = 'https://github.com/toolvcn/www.toolv.cn';

	// 外壳：满屏与否都带这一串，差别只在下面 FILL 那两档断点类
	const SHELL_BASE = 'flex min-h-dvh flex-col bg-gray-50 text-gray-900';
	// 满屏两档：外壳钉住视口并裁掉溢出，主区解除 flex 最小高度，里面的面板才能自己滚。
	// 必须写成完整字面量：把断点变量和类名拼在一起 Tailwind 扫不到这个类，
	// h-dvh 根本不生成、页面会被内容一路撑高。
	const FILL = {
		md: { shell: 'md:h-dvh md:overflow-hidden', main: 'md:min-h-0' },
		lg: { shell: 'lg:h-dvh lg:overflow-hidden', main: 'lg:min-h-0' }
	} as const;
	const WIDTH = { narrow: 'max-w-3xl', medium: 'max-w-5xl', wide: 'max-w-7xl', full: 'max-w-none' } as const;
	// 导航右侧两个外链共用一套样式：静止是灰字，hover 只变蓝、不加底色，保持导航栏安静
	const NAV_LINK =
		'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-600 transition-colors hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
	// lucide 已无品牌图标，GitHub mark 的路径只能内联；抽成常量，免得占掉半个模板
	const GITHUB_MARK =
		'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

	// 塞进工具菜单底部那两行（移动端）：图标 + 文字 + 外链角标，跟菜单里的工具链接同一档高度
	const MENU_LINK = `flex h-9 items-center gap-2 rounded px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 ${FOCUS_RING}`;
	// 导航条里的主题切换：36px 方块，跟左上角菜单按钮同档；小屏导航条放不下，那份在工具抽屉里
	const THEME_BTN =
		'inline-flex size-9 shrink-0 justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900';
	// 「跳到主要内容」：平时 sr-only 只给读屏念，聚焦时浮出 + 抬到所有内容之上（z-[60] 压过 z-50 的导航条）。
	// 位置写死在左上角：它是页面的第一个可聚焦元素，浮在该处最容易被看见，也不会盖住看重的内容。
	const SKIP_LINK =
		'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:border focus:border-gray-200 focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg';

	// 图标是 prop 传进来的组件，起个大写变量名才能当动态组件渲染
	const Icon = $derived(icon);
	// 首页那种标题里要带卖点的走 title prop，其余工具页统一用「<name> by 无情」
	const titleText = $derived(title ?? `${name} by 无情 | www.toolv.cn`);
	const url = $derived(`${SITE}${path}`);
	// 每个工具页直达它自己的源码目录，方便对照实现
	const sourceUrl = $derived(`${REPO}/tree/master/src/routes${path}`);

	const shellClass = $derived(fill === 'fill' ? `${SHELL_BASE} ${FILL[fillFrom].shell}` : SHELL_BASE);
	const defaultMainClass = $derived(
		`relative mx-auto flex w-full ${WIDTH[width]} flex-1 flex-col p-4 sm:p-4` +
			(fill === 'fill' ? ` ${FILL[fillFrom].main}` : '')
	);
	const mainCls = $derived(mainClass ?? defaultMainClass);
</script>

<svelte:head>
	<title>{titleText}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<link rel="canonical" href={url} />
	<meta property="og:title" content={`${name} by 无情`} />
	<meta property="og:description" content={ogDescription ?? description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={url} />
</svelte:head>

<div class={shellClass}>
	<!--
		跳到主要内容：导航栏整条排在主区之前（菜单按钮 + 品牌 + 右侧一簇链接），
		键盘用户每进一个工具页都要 Tab 过这一串才能摸到输入框。给一枚只在聚焦时现形的链接，
		一次跳进 <main>。`sr-only` 到 `not-sr-only` 的切换写在本组件的 CSS 类里，
		聚焦样式不用 focus-visible —— 鼠标点它同样该看得见它跳到了哪。
	-->
	<a href="#toolv-main" class="{SKIP_LINK} {FOCUS_RING}">跳到主要内容</a>
	<!-- gap-1：菜单按钮是 36px 方块、图标 20px 居中，自身已带 8px 内空，再叠 12px 会显空 -->
	<nav
		class="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-1 border-b border-gray-200 bg-white/90 px-4 backdrop-blur-sm sm:px-6"
	>
		<!-- 左上角：全站工具导航（按钮 + 抽屉两个节点，抽屉靠 absolute 挂在导航条里） -->
		<!-- 文档 / 源码两个站外链接由外壳整段塞进菜单底部（移动端），ToolMenu 只认 footer 这一个槽 -->
		<ToolMenu current={path}>
			{#snippet header()}
				{@render menuHeader?.()}
			{/snippet}
			{#snippet footer()}
				<!-- 小屏那份主题切换（导航条那份是 max-lg:hidden）：跟下面的文档 / 源码同一档高度 -->
				<ThemeToggle showLabel class="{MENU_LINK} lg:hidden" />
				{#if docUrl}
					<a
						href={docUrl}
						target="_blank"
						rel="external noopener noreferrer"
						title="在新标签打开教程文档"
						class={MENU_LINK}
					>
						<BookOpen class="size-3.5 shrink-0" aria-hidden="true" />
						<span class="min-w-0 flex-1 truncate">{docLabel ?? '文档'}</span>
						<ArrowUpRight class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
					</a>
				{/if}
				<a
					href={sourceUrl}
					target="_blank"
					rel="external noopener noreferrer"
					title="在新标签打开本工具的源码目录（GitHub）"
					class={MENU_LINK}
				>
					<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d={GITHUB_MARK} />
					</svg>
					<span class="min-w-0 flex-1 truncate">源码</span>
					<ArrowUpRight class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
				</a>
			{/snippet}
		</ToolMenu>
		<a href={resolve('/')} class="flex h-9 min-w-0 items-center gap-2.5 rounded-lg hover:opacity-80">
			<span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
				<Icon class="size-4" aria-hidden="true" />
			</span>
			<span class="min-w-0">
				<span class="block truncate text-sm font-semibold tracking-tight text-gray-900">{name}</span>
				<span class="block truncate text-xs text-gray-600">{tagline}</span>
			</span>
		</a>
		<!-- ml-auto：菜单按钮 + 品牌在左，右侧一簇靠边（不能再用 justify-between，会把品牌顶到中间） -->
		<div class="ml-auto flex shrink-0 items-center gap-1">
			<!-- 全站承诺：做成浅底胶囊，和右侧链接区分开；小屏收掉，宽度让给工具名 -->
			<span
				class="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 lg:inline-flex"
			>
				<ShieldCheck class="size-3.5" aria-hidden="true" />数据本地处理
			</span>
			<!-- 调用方追加的导航条内容（首页的桌面端搜索框）：响应式由调用方自己写 -->
			{@render navExtra?.()}
			<!-- rel 里的 external 是给 svelte/no-navigation-without-resolve 用的：站外链接不走 resolve() -->
			<!-- max-lg:hidden：小屏导航条放不下，文档链接挪进工具菜单底部（见 ToolMenu 的 docUrl） -->
			{#if docUrl}
				<a
					href={docUrl}
					target="_blank"
					rel="external noopener noreferrer"
					title="在新标签打开教程文档"
					class="{NAV_LINK} max-lg:hidden"
				>
					<BookOpen class="size-3.5" aria-hidden="true" />
					{docLabel ?? '文档'}
					<!-- 站外链接一律带这个角标，跟首页「官网」同一个口径 -->
					<ArrowUpRight class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
				</a>
			{/if}
			<!-- max-lg:hidden：小屏导航条只留菜单按钮与工具名，源码链接挪进工具菜单底部 -->
			<a
				href={sourceUrl}
				target="_blank"
				rel="external noopener noreferrer"
				aria-label="本工具源码（GitHub）"
				title="在新标签打开本工具的源码目录（GitHub）"
				class="{NAV_LINK} max-lg:hidden"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d={GITHUB_MARK} />
				</svg>
			</a>
			<!-- max-lg:hidden：小屏导航条只留菜单按钮与工具名，主题切换挪进工具抽屉顶部 -->
			<ThemeToggle class="{THEME_BTN} max-lg:hidden" />
		</div>
	</nav>

	<!-- relative 是给 sr-only 的 h1 用的：它是 absolute，没有定位上下文会逃出裁剪并撑高文档 -->
	<!-- tabindex="-1"：给上面那枚「跳到主要内容」一个能接住焦点的落点。
	     浏览器只滚动到 hash 目标、不转移焦点，没有它的话跳过链接跳完之后焦点仍停在链接自己身上，
	     下一次 Tab 还是从页首开始 —— 等于没跳。main 本不该进 Tab 序列，而 -1 正是「可编程聚焦、
	     不参与 Tab」，-1 这一档不触发 a11y_no_noninteractive_tabindex（那条规则只拦 0 与正数）。 -->
	<main id="toolv-main" tabindex="-1" class={mainCls}>
		<h1 class="sr-only">{heading ?? name}</h1>
		{@render children()}
	</main>

	{@render footer?.()}
</div>
