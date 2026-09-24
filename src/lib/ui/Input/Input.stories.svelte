<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import Input from './Input.svelte';

	type Args = Omit<ComponentProps<typeof Input>, 'children'>;

	const SIZES = ['sm', 'md', 'lg'] as const;

	const { Story } = defineMeta({
		title: 'UI/Input',
		component: Input,
		args: { label: '搜索关键字', placeholder: '输入关键字筛选', size: 'md' }
	});
</script>

{#snippet template(args: Args)}
	<Input {...args} />
{/snippet}

<!-- 三档尺寸并排：高、内边距、字号一起放大 -->
{#snippet allSizes()}
	<div class="flex w-full max-w-md flex-col gap-3">
		{#each SIZES as size (size)}
			<Input label={`size ${size}`} {size} placeholder={`size ${size}`} />
		{/each}
	</div>
{/snippet}

<!-- 等宽的正则输入条：mono 打开后占位符自动回退成 sans -->
{#snippet monoPattern()}
	<Input label="正则表达式" mono value="\d{3}-\d{4}" placeholder="输入正则" />
{/snippet}

<Story name="Default" {template} />
<Story name="Sizes" template={allSizes} />
<Story name="Mono" template={monoPattern} />
<Story name="Invalid" {template} args={{ invalid: true, value: '12abc', label: '金额' }} />
<Story name="Disabled" {template} args={{ disabled: true }} />
<Story name="Password" {template} args={{ type: 'password', label: '密码', placeholder: '输入密码' }} />
<!-- 表单里按回车提交：组件默认 type=text，需要其它类型直接传 -->
<Story name="Number" {template} args={{ type: 'number', label: '数量', placeholder: '0' }} />
<!-- rest 透传：maxlength / pattern / name 等原生属性直接落到 input 上 -->
<Story name="RestProps" {template} args={{ label: '连接地址', name: 'url', maxlength: 64, placeholder: 'wss://' }} />
