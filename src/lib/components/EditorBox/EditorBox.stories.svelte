<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import EditorBox from './EditorBox.svelte';
	import { EDITOR_INPUT } from '$lib/ui/styles';

	const { Story } = defineMeta({ title: 'UI/EditorBox', component: EditorBox });

	const SAMPLE = '{\n  "name": "微工具",\n  "url": "https://www.toolv.cn"\n}';
	// 演示用固定高度容器：真实用法里高度来自卡片（双栏编辑区那两处）
	const DEMO = 'flex h-72 min-h-0 flex-col';
</script>

<!-- 可编辑：框内放可编辑的 <Textarea> -->
{#snippet editable()}
	<div class={DEMO}>
		<EditorBox>
			<Textarea mono label="JSON 输入" value={SAMPLE} class={EDITOR_INPUT} />
		</EditorBox>
	</div>
{/snippet}

<!-- 只读结果：同一副面貌，靠只读光标与标题区分 -->
{#snippet readOnly()}
	<div class={DEMO}>
		<EditorBox>
			<Textarea mono readonly size="sm" label="格式化结果" value={SAMPLE} class={EDITOR_INPUT} />
		</EditorBox>
	</div>
{/snippet}

<!-- 裸 <textarea> 也能套（regex / sql 的镜像高亮编辑器那种用法） -->
{#snippet rawTextarea()}
	<div class={DEMO}>
		<EditorBox>
			<textarea
				class="h-full w-full resize-none bg-transparent p-2 font-mono text-sm"
				aria-label="示例代码"
				spellcheck="false">{SAMPLE}</textarea
			>
		</EditorBox>
	</div>
{/snippet}

<!-- 错误态：边框与焦点环转红（如正则替换结果非法） -->
{#snippet invalidBox()}
	<div class={DEMO}>
		<EditorBox invalid>
			<Textarea mono label="替换结果" value="(" class={EDITOR_INPUT} />
		</EditorBox>
	</div>
{/snippet}

<Story name="Editable" template={editable} />
<Story name="ReadOnly" template={readOnly} />
<Story name="RawTextarea" template={rawTextarea} />
<Story name="Invalid" template={invalidBox} />
