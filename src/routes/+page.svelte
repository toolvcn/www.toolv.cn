<script lang="ts">
	// 首页：外壳直接复用工具页的 ToolShell（导航条高度、左上角工具菜单、SEO head 三处统一），
	// 只通过 mainClass 换掉主区栅格、用三个可选槽补自己的东西：
	//   navExtra   —— 导航条右侧追加：桌面端搜索框 + 官网链接
	//   menuHeader —— 工具菜单抽屉顶部追加：移动端搜索框（小屏导航条放不下）
	//   footer     —— 首页页脚（工具页没有）
	import { ArrowUpRight, CircleDot, Heart, Layers, Search, ShieldCheck, Star, Wrench } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import { TOOL_CATEGORIES, TOOL_COUNT, toolHref } from '$lib/tools';
	import type { Tool } from '$lib/tools';

	// 侧栏高亮跟随滚动：只在客户端跑，SSR 阶段不碰 DOM
	let activeId = $state('');
	// 搜索：纯前端按关键词过滤卡片，不发请求、不引依赖
	let query = $state('');

	const keyword = $derived(query.trim().toLowerCase());

	/** 命中口径：工具名 / 简介 / 标签 / 路径；分组名命中则整组保留 */
	function hit(tool: Tool): boolean {
		const haystack = [tool.name, tool.desc, tool.path, ...tool.tags.map((tag) => tag.label)].join(' ').toLowerCase();
		return haystack.includes(keyword);
	}

	const matched = $derived(
		TOOL_CATEGORIES.map((category) => ({
			...category,
			tools: category.name.toLowerCase().includes(keyword) ? category.tools : category.tools.filter((tool) => hit(tool))
		})).filter((category) => category.tools.length > 0)
	);
	const matchedCount = $derived(matched.reduce((n, category) => n + category.tools.length, 0));

	$effect(() => {
		// 依赖 matched：搜索过滤会重建 section 节点，观察器得重新挂一遍，否则高亮停在旧的分组上
		const visible = matched.length;
		const sections = document.querySelectorAll<HTMLElement>('[data-category]');
		if (visible === 0 || sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const top = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (top) activeId = top.target.id.replace('cat-', '');
			},
			{ rootMargin: '-72px 0px -70% 0px' }
		);
		sections.forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	});

	// 精选卡片用琥珀描边区分，其余中性灰；hover 统一上浮 + 蓝边
	const cardClass = (featured: boolean | undefined) =>
		featured
			? 'group flex flex-col rounded-xl border border-amber-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md'
			: 'group flex flex-col rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md';

	// 页脚开源区：仓库地址与 GitHub mark（lucide 无品牌图标，路径只能内联，与 ToolShell 同源）
	const REPO = 'https://github.com/toolvcn/www.toolv.cn';
	const GITHUB_MARK =
		'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';
	const linkClass = (id: string) =>
		activeId === id
			? // 选中态也给 hover：这一列里未被选中的十来条都有 `hover:bg-gray-100`，
				// 唯独当前这条悬上去毫无反应，会让人以为「选中的那条不再能点」。
				// `hover:bg-blue-100` 与 `hover:bg-gray-100` 同档，深浅主题的重绑定表里也已有这一个。
				'inline-flex h-9 w-full shrink-0 items-center gap-2 rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100'
			: 'inline-flex h-9 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100';
</script>

<ToolShell
	icon={Wrench}
	name="微工具"
	tagline="小而美的在线开发工具"
	heading="微工具 · 小而美的在线开发工具"
	title="微工具 · 小而美的在线开发工具 - www.toolv.cn"
	description="微工具（Micro Tools）：提供 WebSocket 在线测试、Base64 编解码、JSON 格式化等小而美的开发者工具，多连接调试、定时发送、图片转 Data URL、语法高亮，数据全部本地处理。"
	ogDescription="提供 WebSocket 在线测试、Base64 编解码等小而美的开发者工具，即开即用。"
	keywords="在线工具,开发者工具,微工具,WebSocket 在线测试,Base64 编解码,JSON 格式化,数据本地处理"
	path="/"
	mainClass="relative flex-1 w-full px-4 pt-4 pb-10 md:px-6"
>
	{#snippet navExtra()}
		<!-- 桌面端搜索：移动端的那份在工具菜单抽屉里（见 menuHeader），同一个 query 状态 -->
		<div class="relative hidden w-64 shrink-0 lg:block xl:w-80">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500"
				aria-hidden="true"
			/>
			<Input
				type="search"
				label="搜索工具"
				placeholder="搜索工具、分组…"
				autocomplete="off"
				bind:value={query}
				class="pl-9"
			/>
		</div>
		<a
			href="https://www.toolv.cn/"
			target="_blank"
			rel="noreferrer external"
			title="在新标签页打开官网 www.toolv.cn"
			class="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
		>
			官网 <ArrowUpRight class="size-3.5" />
		</a>
	{/snippet}

	{#snippet menuHeader()}
		<!-- 移动端搜索：小屏导航条放不下，收进工具菜单抽屉顶部 -->
		<div class="relative mb-2 lg:hidden">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500"
				aria-hidden="true"
			/>
			<Input
				type="search"
				label="搜索工具"
				placeholder="搜索工具、分组…"
				autocomplete="off"
				bind:value={query}
				class="pl-9"
			/>
		</div>
	{/snippet}

	<div class="grid grid-cols-1 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-6">
		<!-- 左侧分类：仅桌面端（手机端不再有分组入口，改走工具菜单里的工具直达） -->
		<aside aria-labelledby="categories-heading" class="hidden lg:sticky lg:top-20 lg:block lg:self-start">
			<h2 id="categories-heading" class="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
				<Layers class="h-4 w-4 text-blue-600" />
				全部工具
				<span class="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-gray-600">
					{keyword ? matchedCount : TOOL_COUNT}
				</span>
			</h2>
			<ul class="flex flex-col gap-1">
				{#each matched as category (category.id)}
					{@const CategoryIcon = category.icon}
					<li>
						<a
							href={'#cat-' + category.id}
							aria-current={activeId === category.id ? 'true' : undefined}
							class={linkClass(category.id)}
						>
							<CategoryIcon class="h-4 w-4 shrink-0" />
							<span class="min-w-0 flex-1 truncate">{category.name}</span>
							<span class="text-xs text-gray-500">{category.tools.length}</span>
						</a>
					</li>
				{/each}
			</ul>
		</aside>

		<!-- 分类分组的工具卡片 -->
		<div class="min-w-0 space-y-8">
			{#if keyword}
				<p class="text-xs text-gray-600">
					搜索「{query.trim()}」：命中 {matchedCount} / {TOOL_COUNT} 个工具
				</p>
			{/if}

			{#each matched as category (category.id)}
				{@const CategoryIcon = category.icon}
				<section
					id={'cat-' + category.id}
					data-category
					aria-labelledby={'cat-' + category.id + '-heading'}
					class="scroll-mt-20"
				>
					<div class="mb-4 flex items-center gap-2">
						<CategoryIcon class="h-4 w-4 text-blue-600" />
						<h2 id={'cat-' + category.id + '-heading'} class="text-base font-semibold text-gray-900">
							{category.name}
						</h2>
						<span class="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-gray-600">
							{category.tools.length}
						</span>
					</div>

					<div
						class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
					>
						{#each category.tools as tool (tool.path)}
							{@const ToolIcon = tool.icon}
							<a href={toolHref(tool.path)} class={cardClass(tool.featured)}>
								<!-- 图标 + 标题 + 精选标记 -->
								<div class="flex items-center gap-2.5">
									<span
										class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600"
									>
										<ToolIcon class="size-4.5" aria-hidden="true" />
									</span>
									<h3 class="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
										{tool.name}
									</h3>
									{#if tool.featured}
										<span
											class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700"
										>
											<Star class="size-3 fill-amber-400 text-amber-500" aria-hidden="true" />精选
										</span>
									{/if}
								</div>
								<p class="mt-2.5 line-clamp-2 flex-1 text-xs leading-relaxed text-gray-600">
									{tool.desc}
								</p>
								<!-- 标签区与正文用浅分隔线断开，chip 去边框、更安静 -->
								<div class="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-2.5">
									{#each tool.tags as tag (tag.label)}
										{@const TagIcon = tag.icon}
										<span
											class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
										>
											<TagIcon class="size-3 shrink-0" aria-hidden="true" />
											{tag.label}
										</span>
									{/each}
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/each}

			{#if keyword && matchedCount === 0}
				<div class="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
					<p class="text-sm font-medium text-gray-900">没有匹配「{query.trim()}」的工具</p>
					<p class="mt-1 text-xs text-gray-600">换个关键词试试，或用分组浏览全部工具</p>
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<!-- 页脚：白底跟随主题（浅色白 / 深色 gray-900），单列定宽居中收敛 -->
		<footer class="mt-10 border-t border-gray-200 bg-white">
			<div class="mx-auto max-w-5xl px-6 py-8 md:px-8">
				<div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
					<!-- 左：品牌 -->
					<div class="max-w-sm min-w-0">
						<div class="flex items-center gap-2.5">
							<span class="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
								<Wrench class="size-4" aria-hidden="true" />
							</span>
							<span class="text-base font-semibold text-gray-900">微工具 · Micro Tools</span>
						</div>
						<p class="mt-3 text-sm leading-relaxed text-gray-600">
							小而美的在线开发工具集合，一个页面搞定调试、测试与监控，即开即用。
						</p>
						<ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
							<li class="inline-flex items-center gap-1.5">
								<ShieldCheck class="size-3.5 text-emerald-600" aria-hidden="true" />
								数据本地处理 · 无需注册
							</li>
							<li class="inline-flex items-center gap-1.5">
								<Heart class="size-3.5 text-red-500" aria-hidden="true" />
								开源共建 · MIT 协议
							</li>
						</ul>
					</div>

					<!-- 右：开源 -->
					<div class="flex shrink-0 flex-col items-start gap-3">
						<a
							href={REPO}
							target="_blank"
							rel="external noopener noreferrer"
							title="在新标签页打开 GitHub 仓库"
							class="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
						>
							<svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d={GITHUB_MARK} />
							</svg>
							<span>在 GitHub 上开源收藏 · Star</span>
							<ArrowUpRight class="size-3.5 shrink-0 text-blue-100" aria-hidden="true" />
						</a>
						<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
							<a
								href={REPO + '/issues'}
								target="_blank"
								rel="external noopener noreferrer"
								title="在新标签页提交问题反馈"
								class="inline-flex h-8 items-center gap-1.5 transition-colors hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
							>
								<CircleDot class="size-3.5 shrink-0" aria-hidden="true" />
								问题反馈
								<ArrowUpRight class="size-3 shrink-0" aria-hidden="true" />
							</a>
							<a
								href={REPO + '/blob/master/LICENSE'}
								target="_blank"
								rel="external noopener noreferrer"
								title="在新标签页查看 MIT 许可证"
								class="inline-flex h-8 items-center gap-1.5 transition-colors hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
							>
								<ShieldCheck class="size-3.5 shrink-0" aria-hidden="true" />
								MIT License
								<ArrowUpRight class="size-3 shrink-0" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>

				<!-- 版权 -->
				<div
					class="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-200 pt-5 text-xs text-gray-500"
				>
					<p>
						© 2026
						<a href="https://www.toolv.cn/" class="transition-colors hover:text-blue-700">www.toolv.cn</a>
						· 作者：无情
					</p>
					<p>纯前端实现 · 数据全部留在你的浏览器里</p>
				</div>
			</div>
		</footer>
	{/snippet}
</ToolShell>
