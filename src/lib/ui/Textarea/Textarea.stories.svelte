<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from './Textarea.svelte';

	type Args = ComponentProps<typeof Textarea>;

	const { Story } = defineMeta({
		title: 'UI/Textarea',
		component: Textarea,
		args: { label: '输入内容', placeholder: '粘贴或输入', rows: 4 }
	});
</script>

<!-- 组件本身透明无边框：只该放进 EditorBox 里用，框负责边框 / 底色 / 聚焦（UI-STYLE §11.1） -->
{#snippet template(args: Args)}
	<div class="w-96">
		<EditorBox class="h-40">
			<Textarea {...args} />
		</EditorBox>
	</div>
{/snippet}

<Story name="Default" {template} />
<Story name="Mono" {template} args={{ mono: true, label: '输入 JSON' }} />
<Story name="Disabled" {template} args={{ disabled: true }} />
<Story name="Readonly" {template} args={{ readonly: true, value: '只读内容' }} />
