<script lang="ts">
	// 全站默认错误页：地址没命中任何路由（404）与页面加载失败（5xx）都落在这里。
	// 放在根层就是「所有未命中路由 + 所有没被下级 +error.svelte 接住的错误」的兜底，
	// 因此不需要给任何子路由建副本。之前没有这个文件时，用户看到的是 SvelteKit 自带的英文裸页。
	//
	// 复用 ToolShell 而不是自绘外壳：顶部导航（含左上角「全部工具」抽屉）与 SEO head 都在那边，
	// 而这些正是 404 最该给的 —— 从这里能去哪儿。自绘一份约 40 行的外壳等于把导航栏分叉成两份。
	//
	// path 传 "/"：canonical / og:url 指向首页。**不能把出错的那个地址标成规范地址**，
	// 那是条死链。页面另挂 noindex，双保险。
	//
	// 版式：**一份失败报告，不套面板**。
	//   ① 不套卡片：白底 + 边框 + 阴影是「一页里好几张中的一张」的长相，
	//      这里整页只有这一件事，套上去像把一句话装进盒子。直接落在 bg-gray-50 的页面底上，
	//      靠留白与字号分层就行，也顺带让「不套盒子」本身成为这一页的长相。
	//   ② 层次分明：状态码退成小号等宽「眉标」，标题才是主角（两个都大的话，第一眼看到的是
	//      404 这个编号，而不是「页面不存在」这句人话）。
	//   ③ 单列：内容列 max-w-lg，里面不再套第二层 max-w-*，否则每块各有一个居中宽度，看着是散的。
	//   ④ 没有卡片托底了，需要的「抬起来」的两块自己立起来：等宽地址块与工具入口格子都是
	//      白底 + 描边（页面底是 gray-50，白底才是抬起的那一层）。
	//   ⑤ 只有两类内容不居中：等宽的请求地址（路径左对齐才像日志 / 终端输出）与工具入口格子
	//      （它是列表，行内左对齐），其余保持居中轴。
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowLeft, ArrowUpRight, CircleDot, SearchX, ServerCrash } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { FOCUS_RING } from '$lib/ui/styles';
	import { TOOL_CATEGORIES, toolHref } from '$lib/tools';
	import type { Tool } from '$lib/tools';

	const REPO = 'https://github.com/toolvcn/www.toolv.cn';

	// 精选工具（tools.ts 里带 featured 标记的，首页卡片用的也是这一份，不另维护列表）。
	// 404 页把它当「从哪儿开始」的入口 —— 死路至少留几个出口。取前 4 个：tools.ts 按分类顺序排，
	// 正好覆盖网络（HTTP / WebSocket）与格式（正则 / JSON）两条主线，2×2 一屏放得下。
	// **不做随机**：随机值在 SSR 与 hydration 之间对不上，会直接报 hydration mismatch。
	const FEATURED: Tool[] = TOOL_CATEGORIES.flatMap((category) => category.tools)
		.filter((tool) => tool.featured)
		.slice(0, 4);

	// 只分两档：地址问题（404）与站点问题（其余，实际是 5xx）。文案、图标、报错详情都随之走。
	const notFound = $derived(page.status === 404);

	// 导航标题 / 页内标题 / sr-only 的 h1 共用这一句，三处不各写一遍
	const heading = $derived(notFound ? '页面不存在' : '页面出错了');
	const desc = $derived(
		notFound
			? '可能是链接拼错了、工具改了名字，或者它还没上线。点左上角的「全部工具」可以直接找到想要的那个。'
			: '页面在加载时出了点问题，刷新一下通常就好了。如果一直打不开，欢迎把下面的信息反馈给我们。'
	);
	// 404 给出错的地址（多半是拼错），5xx 给错误信息。都是纯文本插值，Svelte 会转义，不要用 {@html}
	const detail = $derived(notFound ? page.url.pathname : (page.error?.message ?? ''));

	// 图标按状态切；条件类名一律在脚本里拼好（写进 class 属性的三元会被 prettier 拆断而静默失效）
	const Icon = $derived(notFound ? SearchX : ServerCrash);

	/**
	 * 返回上一页。直接打开 / 新标签页进来的没得可回（历史长度只有 1），这时兜到首页 ——
	 * 否则按钮点下去毫无反应，看着像坏了。用 history.back() 而不是 goto：goto 只收 URL，
	 * 而它本身就认 popstate，回退后 SvelteKit 会正常接管。
	 */
	function goBack(): void {
		if (history.length > 1) history.back();
		else goto(resolve('/'));
	}

	// 一行三枚 = Button 的 lg 档（h-11 / px-5 / text-base / gap-2），UI-STYLE §9 里 lg 正是「页级主 CTA」那一档。
	// 三条样式串都照 SIZE_TEXT.lg + VARIANT_TEXT 抄，逐字对齐，且只此一处用 —— 不往 ui/styles.ts 加常量
	// （门槛见 STRUCTURE §0 硬约束 2）。三处都从 `<a>` / `<button>` 手写而不是用 Button 组件：
	//   · 前两条的目的地是 URL，必须是 <a>（可新标签打开、爬虫也顺着回首页）；
	//   · 「返回上一页」是 JS 动作、必须是 <button>，但 Button 的 secondary 变体把 `hover:bg-gray-50`
	//     写死在里面（那是给白底卡片用的），落在 gray-50 页面底上 hover 完全看不出来 ——
	//     这里统一用 `hover:bg-gray-100` 那一档，三枚的悬浮手感才一致。
	const PRIMARY_LINK = `inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-base font-medium whitespace-nowrap text-white hover:bg-blue-700 ${FOCUS_RING}`;
	const SECONDARY_LINK = `inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-base font-medium whitespace-nowrap text-gray-700 hover:bg-gray-100 ${FOCUS_RING}`;

	// 工具入口格子：不是按钮而是「去哪儿」的一行，所以行内左对齐、图标蓝、hover 才上蓝底。
	// hover 三个类都在 layout.css 的重绑定表里，深色下跟着走。
	const TOOL_CELL =
		'flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700';
</script>

<svelte:head>
	<!-- 错误页不该进索引 -->
	<meta name="robots" content="noindex" />
</svelte:head>

<ToolShell
	icon={Icon}
	name={heading}
	tagline={notFound ? '404 · 地址没有对应的工具' : `${page.status} · 页面暂时打不开`}
	heading={`${heading}（${page.status}）`}
	title={`${heading}（${page.status}） - www.toolv.cn`}
	description={desc}
	keywords="404,页面不存在,微工具,在线工具"
	path="/"
	width="narrow"
>
	<div class="flex flex-1 items-center justify-center py-6">
		<div class="w-full max-w-lg text-center">
			<!-- 眉标：状态码只当编号，不跟标题抢位置（h1 里已念过一遍，读屏不必重复听） -->
			<p aria-hidden="true" class="font-mono text-sm font-medium text-gray-500 tabular-nums">{page.status}</p>
			<h2 class="mt-2 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">{heading}</h2>
			<p class="mt-4 text-base leading-7 text-gray-600">{desc}</p>
			{#if detail}
				<!-- 出错的地址 / 错误信息：页面底是 gray-50，所以白底 + 描边才立得起来。
				     等宽、左对齐（路径本来就该从左边读起）、可断行（长路径不撑破列宽）。 -->
				<p
					class="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left font-mono text-sm leading-6 break-all text-gray-600"
				>
					{detail}
				</p>
			{/if}
			<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
				<a href={resolve('/')} title="回到微工具首页" class={PRIMARY_LINK}>回到首页</a>
				<button type="button" title="回到上一个页面" onclick={goBack} class={SECONDARY_LINK}>
					<ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
					返回上一页
				</button>
				<a
					href={REPO + '/issues'}
					target="_blank"
					rel="external noopener noreferrer"
					title="在新标签页提交问题反馈"
					class={SECONDARY_LINK}
				>
					<CircleDot class="size-4 shrink-0" aria-hidden="true" />
					问题反馈
					<!-- 站外链接一律带角标，与首页页脚「问题反馈」同一条口径 -->
					<ArrowUpRight class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
				</a>
			</div>

			<!-- 死路变入口：做成 2×2 的格子而不是一排 chip —— chip 是「一排小开关」的长相，
			     跟上面的按钮行撞形，而且 4 个中文名在这里会折出一个孤零零的第二行。
			     数据走 tools.ts 的精选标记，不给 404 单开一份清单。 -->
			{#if FEATURED.length > 0}
				<div class="mt-10 border-t border-gray-200 pt-6 text-left">
					<p class="text-xs font-medium text-gray-600">或者，从这里开始</p>
					<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{#each FEATURED as tool (tool.path)}
							{@const ToolIcon = tool.icon}
							<a href={toolHref(tool.path)} title={`打开${tool.name}`} class={TOOL_CELL}>
								<ToolIcon class="size-4 shrink-0 text-blue-600" aria-hidden="true" />
								<span class="min-w-0 flex-1 truncate">{tool.name}</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</ToolShell>
