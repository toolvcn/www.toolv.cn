<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Binary, FileCode, Ruler } from '@lucide/svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import TabShell from './TabShell.svelte';

	const { Story } = defineMeta({ title: 'UI/TabShell', component: TabShell });

	const OPTIONS = [
		{ value: 'mime', label: 'MIME 类型', icon: FileCode },
		{ value: 'ascii', label: 'ASCII 码表', icon: Binary },
		{ value: 'unit', label: '单位换算', icon: Ruler }
	] as const;

	/** 内容区用一张 Panel 代替：真实用法里这里是各标签自己的面板 */
	const BODY = 'flex min-h-56 flex-1 items-center justify-center text-xs text-gray-600 p-4 text-center';
</script>

<!-- 卡片式（默认）：标签条是独立一张卡，下方工作区另起（generator / date-calculator / unit-converter） -->
{#snippet card()}
	<TabShell aria-label="速查表类型" options={OPTIONS} value="mime" onchange={() => {}}>
		<Panel heading="MIME 类型" class="min-w-0 flex-1">
			<p class={BODY}>标签条与内容区之间的 gap-4 由外壳给，分支内容由调用方写 &#123;#if&#125;</p>
		</Panel>
	</TabShell>
{/snippet}

<!-- 扁平式：标签条下方紧跟卡片时用，避免两层阴影叠着（cheatsheet） -->
{#snippet flat()}
	<TabShell variant="flat" aria-label="速查表类型" options={OPTIONS} value="ascii" onchange={() => {}}>
		<Panel heading="ASCII 码表" class="min-w-0 flex-1">
			<p class={BODY}>variant 直接转发给 Tabs，外壳不另做判断</p>
		</Panel>
	</TabShell>
{/snippet}

<!-- 无图标标签：选项不给 icon 时只渲染文字 -->
{#snippet noIcon()}
	<TabShell
		aria-label="工具模式"
		options={[
			{ value: 'stats', label: '文本统计' },
			{ value: 'clean', label: '文本清理' }
		]}
		value="stats"
		onchange={() => {}}
	>
		<Panel heading="文本统计" class="min-w-0 flex-1">
			<p class={BODY}>两个标签时也要能撑满上半行，标签条自己会收缩</p>
		</Panel>
	</TabShell>
{/snippet}

<!-- 高度策略由调用方给：class 落在外层容器上（text-tools 的 h-full） -->
{#snippet fillHeight()}
	<TabShell class="h-full" aria-label="工具模式" options={OPTIONS} value="unit" onchange={() => {}}>
		<Panel heading="单位换算" class="min-w-0 flex-1">
			<p class={BODY}>class 追加在「flex min-h-0 flex-1 flex-col gap-4」之后</p>
		</Panel>
	</TabShell>
{/snippet}

<Story name="Card" template={card} />
<Story name="Flat" template={flat} />
<Story name="NoIcon" template={noIcon} />
<Story name="FillHeight" template={fillHeight} />
