<script lang="ts">
	// 中央工作区：一条 h-12 的标签条（测试文本 / 匹配详情 / 文本替换 / 代码生成 / 正则图解）
	// + 按当前标签渲染对应内容。标签条仿 generator 的分段式按钮（aria-pressed），
	// 默认 text 标签，SSR 首屏就能输出编辑区骨架。
	import { Code, GitFork, ListTree, ReplaceAll, Type } from '@lucide/svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import type { WorkspaceTab } from '../core/types.ts';
	import { CODE_LANGS } from '../core/codegen.ts';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import Tabs from '$lib/components/Tabs/Tabs.svelte';
	import CodegenTab from '$lib/components/CodegenTab/CodegenTab.svelte';
	import DiagramTab from './DiagramTab.svelte';
	import MatchesTab from './MatchesTab.svelte';
	import ReplaceTab from './ReplaceTab.svelte';
	import TextTab from './TextTab.svelte';

	const TABS: { value: WorkspaceTab; label: string; icon?: typeof Type }[] = [
		{ value: 'text', label: '测试文本', icon: Type },
		{ value: 'matches', label: '匹配详情', icon: ListTree },
		{ value: 'replace', label: '文本替换', icon: ReplaceAll },
		{ value: 'code', label: '代码生成', icon: Code },
		{ value: 'diagram', label: '正则图解', icon: GitFork }
	];

	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- 卡片外壳交给 Panel（原有那份 rounded-xl + border + shadow-sm 是手写的，跟 Panel 同款）；
     `class` 由 regex/ui/Panel.svelte 传进来定位栅格。头部换成 Tabs 横线，Panel 的 heading 降级成 sr-only -->
<Panel id="regex-workspace" heading="正则工作区" class="min-h-0 flex-1 {className}">
	{#snippet header()}
		<!-- 五个标签均分宽度；窄屏图标隐藏，保证一行放得下 -->
		<Tabs
			variant="line"
			aria-label="工作区标签"
			options={TABS}
			value={regexStore.tab}
			onchange={(v) => (regexStore.tab = v)}
		/>
	{/snippet}

	<div class="flex min-h-0 flex-1 flex-col">
		{#if regexStore.tab === 'text'}
			<TextTab />
		{:else if regexStore.tab === 'matches'}
			<MatchesTab />
		{:else if regexStore.tab === 'replace'}
			<ReplaceTab />
		{:else if regexStore.tab === 'code'}
			<CodegenTab
				langs={CODE_LANGS}
				value={regexStore.codeLang}
				onchange={(v) => (regexStore.codeLang = v)}
				code={regexStore.code}
				oncopy={() => void regexStore.copyCode()}
				copyLabel="复制当前语言的生成代码"
				blockId="regex-codegen-block"
				blockLabel="生成的代码"
			/>
		{:else}
			<DiagramTab />
		{/if}
	</div>
</Panel>
