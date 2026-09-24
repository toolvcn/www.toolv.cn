<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import Switch from './Switch.svelte';

	type Args = Omit<ComponentProps<typeof Switch>, 'children'>;

	const { Story } = defineMeta({
		title: 'UI/Switch',
		component: Switch,
		args: {
			label: '服务器代发开关',
			title: '开启后请求经服务器转发，绕开 CORS 限制',
			checked: false
		}
	});
</script>

{#snippet template(args: Args)}
	<Switch {...args} />
{/snippet}

<!-- 常见形态：开关 + 右侧说明文字，整行 h-8 与其它控件同高 -->
{#snippet withText()}
	<div class="flex h-8 items-center gap-2">
		<Switch label="服务器代发开关" checked={true} />
		<span class="text-xs font-medium text-blue-700">服务器代发（含测速）</span>
	</div>
{/snippet}

<!-- 开关组：同一个开关在两个状态下的对照 -->
{#snippet pair()}
	<div class="flex items-center gap-4">
		<Switch label="关" checked={false} />
		<Switch label="开" checked={true} />
	</div>
{/snippet}

<Story name="Off" {template} />
<Story name="On" {template} args={{ checked: true }} />
<Story name="对照" template={pair} />
<Story name="带说明文字" template={withText} />
<Story name="Disabled" {template} args={{ disabled: true }} />
<Story name="DisabledOn" {template} args={{ disabled: true, checked: true }} />
<!-- rest 透传：data-* / name 等原生属性直接落到 button 上 -->
<Story name="RestProps" {template} args={{ name: 'server-mode', 'data-testid': 'server-switch' }} />
