<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { tokenizeSource } from '$lib/utils/json';
	import { JSON_TOKEN_CLASS } from '$lib/ui/styles';
	import CodeView from './CodeView.svelte';

	const { Story } = defineMeta({ title: 'UI/CodeView', component: CodeView });

	const SAMPLE = `{
  "name": "微工具",
  "tools": [
    { "id": 1, "online": true },
    { "id": 2, "alias": null }
  ],
  "stars": 4.5
}`;

	const tokens = tokenizeSource(SAMPLE);

	// 换一套色板的用法（json-to-ts 的 TypeScript）。story 里手写一份 token 与色板，
	// 不去 import 那个工具的 core —— `$lib` 不反向依赖 `src/routes/`（STRUCTURE §2 C）。
	type TsKind = 'keyword' | 'type' | 'property' | 'primitive' | 'punct' | 'plain';

	const TS_TOKEN_CLASS: Record<TsKind, string> = {
		keyword: 'text-violet-700',
		type: 'text-amber-700',
		property: 'text-blue-700',
		primitive: 'text-emerald-700',
		punct: 'text-gray-500',
		plain: 'text-gray-900'
	};

	const tsTokens: { text: string; kind: TsKind }[] = [
		{ text: 'export ', kind: 'keyword' },
		{ text: 'interface ', kind: 'keyword' },
		{ text: 'Tool', kind: 'type' },
		{ text: ' {\n  ', kind: 'plain' },
		{ text: 'id', kind: 'property' },
		{ text: ': ', kind: 'punct' },
		{ text: 'number', kind: 'primitive' },
		{ text: ';\n  ', kind: 'plain' },
		{ text: 'online', kind: 'property' },
		{ text: ': ', kind: 'punct' },
		{ text: 'boolean', kind: 'primitive' },
		{ text: ';\n}', kind: 'plain' }
	];

	// 超长单行：容器横向滚动，不把卡片撑宽
	const longTokens = tokenizeSource(`{ "long": "${'x'.repeat(160)}" }`);
</script>

<!-- OUTPUT_PRE 那种绝对定位铺满容器的用法（json-formatter / http 的编辑区） -->
{#snippet outputPre()}
	<div class="relative h-56 rounded-lg border border-gray-200">
		<CodeView
			{tokens}
			classMap={JSON_TOKEN_CLASS}
			class="absolute inset-0 overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900 sm:text-sm sm:leading-6"
		/>
	</div>
{/snippet}

<!-- 固定高度、随内容滚动的用法（jwt-decoder 的 Header / Payload 块） -->
{#snippet plainBlock()}
	<CodeView
		{tokens}
		classMap={JSON_TOKEN_CLASS}
		class="overflow-auto rounded-lg border border-gray-200 p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900"
	/>
{/snippet}

<!-- 带 role/aria-label/tabindex 的可聚焦滚动区（axe scrollable-region-focusable 要求） -->
{#snippet focusable()}
	<CodeView
		{tokens}
		classMap={JSON_TOKEN_CLASS}
		tabindex={0}
		role="region"
		aria-label="输出内容"
		class="overflow-auto rounded-lg border border-gray-200 p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900"
	/>
{/snippet}

<!-- 空 token 列表：什么都不渲染，由调用方自己在外面出空态 -->
{#snippet emptyTokens()}
	<CodeView tokens={[]} classMap={JSON_TOKEN_CLASS} class="rounded-lg border border-gray-200 p-4" />
{/snippet}

<!-- 换一套色板（json-to-ts 的 TypeScript）：classMap 是唯一的差异点 -->
{#snippet tsPalette()}
	<CodeView
		tokens={tsTokens}
		classMap={TS_TOKEN_CLASS}
		class="overflow-auto rounded-lg border border-gray-200 p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900"
	/>
{/snippet}

<!-- 超长单行：容器横向滚动。**横向能滚就得能聚焦**（axe scrollable-region-focusable）——
     这里与上面的 Focusable 一样给全 tabindex / role / aria-label：组件把这三件事留给调用方
     （见 CodeView 的注释），story 少给一个，演示的就是错用法。 -->
{#snippet longLine()}
	<CodeView
		tokens={longTokens}
		classMap={JSON_TOKEN_CLASS}
		tabindex={0}
		role="region"
		aria-label="超长单行输出"
		class="overflow-auto rounded-lg border border-gray-200 p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900"
	/>
{/snippet}

<Story name="OutputPre" template={outputPre} />
<Story name="PlainBlock" template={plainBlock} />
<Story name="Focusable" template={focusable} />
<Story name="EmptyTokens" template={emptyTokens} />
<Story name="TsPalette" template={tsPalette} />
<Story name="LongLine" template={longLine} />
