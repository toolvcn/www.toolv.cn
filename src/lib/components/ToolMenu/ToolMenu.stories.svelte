<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ArrowUpRight, BookOpen } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import { favorites } from '$lib/ui/favorites.svelte';
	import ToolMenu from './ToolMenu.svelte';

	// 「我的收藏」一组要有数据才渲染，而收藏是模块级单例、story 之间共享 ——
	// 所以在这里灌两条固定数据，下面凡展开态的 story 都能看到收藏组与点亮的星标。
	// 代价是这里没有「空收藏」的 story（单例全局共享，做不干净），那条留给浏览器里手验。
	favorites.paths = ['/regex', '/clock'];

	// defineMeta 的 args 只认组件自己的 props，想多开一种渲染形态就再写一个 template snippet
	type Args = ComponentProps<typeof ToolMenu>;

	const { Story } = defineMeta({
		title: 'UI/ToolMenu',
		component: ToolMenu,
		args: { current: '/json-formatter', open: false }
	});
</script>

{#snippet template(args: Args)}
	<!-- 抽屉是 absolute 挂在导航条上的，story 里补一个 sticky 的导航条当定位上下文 -->
	<nav class="sticky top-0 z-50 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-4">
		<ToolMenu current={args.current} open={args.open} />
		<span class="text-sm font-semibold text-gray-900">JSON 格式化</span>
	</nav>
{/snippet}

<!-- 底部那块内容由调用方给（真实用法是 ToolShell 塞文档 + 源码），这里给一行示例链接 -->
{#snippet templateWithFooter(args: Args)}
	<nav class="sticky top-0 z-50 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-4">
		<ToolMenu current={args.current} open={args.open}>
			{#snippet footer()}
				<a
					href="https://www.runoob.com/regexp/regexp-tutorial.html"
					target="_blank"
					rel="external noopener noreferrer"
					class="flex h-9 items-center gap-2 rounded px-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
				>
					<BookOpen class="size-3.5 shrink-0" aria-hidden="true" />
					<span class="min-w-0 flex-1 truncate">正则教程</span>
					<ArrowUpRight class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
				</a>
			{/snippet}
		</ToolMenu>
		<span class="text-sm font-semibold text-gray-900">JSON 格式化</span>
	</nav>
{/snippet}

<!-- story 的 name 会被当导出名解析：纯中文 + ASCII 词可以，全角括号（）不行（addon-svelte-csf 会报 exportName 非法） -->
<Story name="收起" {template} />
<Story name="展开并高亮 JSON 格式化" {template} args={{ open: true }} />
<Story name="展开并高亮电商 ROI" {template} args={{ current: '/ecommerce-roi', open: true }} />
<Story name="展开带底部链接" template={templateWithFooter} args={{ open: true }} />
