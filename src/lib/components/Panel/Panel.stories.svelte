<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Copy } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import Panel from './Panel.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	type Args = Omit<ComponentProps<typeof Panel>, 'children' | 'headingExtra' | 'actions' | 'footer'>;

	const { Story } = defineMeta({
		title: 'UI/Panel',
		component: Panel,
		args: { heading: '日志', tag: 'section' }
	});
</script>

{#snippet template(args: Args)}
	<Panel {...args}>
		<p class="p-4 text-sm text-gray-600">面板内容</p>
	</Panel>
{/snippet}

{#snippet withFooter(args: Args)}
	<Panel {...args}>
		<p class="p-4 text-sm text-gray-600">面板内容</p>
		{#snippet footer()}
			<div class="flex h-9 shrink-0 items-center border-t border-gray-200 px-4 text-xs text-gray-600">共 3 条</div>
		{/snippet}
	</Panel>
{/snippet}

<!-- 头部右侧操作区 + 标题补充信息都靠 snippet 传进来 -->
{#snippet withHeaderSlots(args: Args)}
	<Panel {...args}>
		{#snippet headingExtra()}
			<span class="truncate text-xs text-gray-500">wss://echo.websocket.events</span>
		{/snippet}
		{#snippet actions()}
			<Button icon label="复制全部日志">
				<Copy class="size-3.5" />
			</Button>
		{/snippet}
		<p class="p-4 text-sm text-gray-600">面板内容</p>
	</Panel>
{/snippet}

<!-- 标题行右侧多一枚全屏按钮（原生全屏，Esc 退出）；整张卡片铺满视口 -->
{#snippet withFullscreen(args: Args)}
	<Panel {...args} fullscreen>
		<p class="p-4 text-sm text-gray-600">面板内容</p>
		{#snippet footer()}
			<div class="flex h-9 shrink-0 items-center border-t border-gray-200 px-4 text-xs text-gray-600">共 3 条</div>
		{/snippet}
	</Panel>
{/snippet}

<Story name="Section" {template} />
<Story name="全屏按钮" template={withFullscreen} args={{ heading: '输出结果' }} />
<Story name="Aside" {template} args={{ tag: 'aside' }} />
<!-- id / headingId 可省略：组件内部用 $props.id() 生成 -->
<Story name="省略 id" {template} />
<Story name="指定 id" {template} args={{ id: 'log-panel', headingId: 'log-heading' }} />
<Story name="带通栏底栏" template={withFooter} />
<Story name="头部操作区" template={withHeaderSlots} />
<!-- rest 透传：data-* / aria-* 落到外壳上 -->
<Story name="RestProps" {template} args={{ heading: '隐藏面板', hidden: true }} />
