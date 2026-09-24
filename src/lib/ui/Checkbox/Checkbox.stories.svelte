<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import Checkbox from './Checkbox.svelte';

	type Args = Omit<ComponentProps<typeof Checkbox>, 'children'>;

	const { Story } = defineMeta({
		title: 'UI/Checkbox',
		component: Checkbox,
		args: { checked: true, title: '是否保留缩进' }
	});
</script>

{#snippet template(args: Args)}
	<Checkbox {...args}>格式化输出</Checkbox>
{/snippet}

<!-- 不给 children 时用 label 当文字，单行调用更省事 -->
{#snippet labelOnly(args: Args)}
	<Checkbox {...args} />
{/snippet}

<Story name="Checked" {template} />
<Story name="Unchecked" {template} args={{ checked: false }} />
<Story name="Disabled" {template} args={{ disabled: true }} />
<Story name="LabelOnly" template={labelOnly} args={{ label: '自动滚动' }} />
<!-- rest 透传：name / id 等原生属性直接落到 input 上，不用在组件里加 prop -->
<Story
	name="RestProps"
	template={labelOnly}
	args={{ label: '只看当前连接', name: 'only-current', id: 'only-current' }}
/>
