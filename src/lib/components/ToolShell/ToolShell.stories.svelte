<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Braces } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import ToolShell from './ToolShell.svelte';

	type Args = Omit<ComponentProps<typeof ToolShell>, 'children'>;

	const { Story } = defineMeta({
		title: 'UI/ToolShell',
		component: ToolShell,
		args: {
			icon: Braces,
			name: 'JSON 格式化',
			tagline: '格式化 · 压缩 · 校验 · 语法高亮',
			description: '在线 JSON 格式化与压缩工具：语法高亮、实时校验、错误行列定位，纯本地运行。',
			keywords: 'JSON,格式化,压缩,校验,语法高亮,错误定位,在线工具',
			path: '/json-formatter',
			fill: 'flow'
		}
	});
</script>

{#snippet template(args: Args)}
	<ToolShell {...args}>
		<section class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
			工具面板渲染在这里
		</section>
	</ToolShell>
{/snippet}

<Story name="Flow 自然流" {template} />
<Story name="Fill 满屏" {template} args={{ fill: 'fill' }} />
<Story
	name="带教程链接"
	{template}
	args={{
		docUrl: 'https://www.runoob.com/regexp/regexp-tutorial.html',
		docLabel: '正则教程'
	}}
/>
<Story
	name="Narrow 窄栏"
	{template}
	args={{ width: 'narrow', name: '进制转换', tagline: '2 / 8 / 10 / 16 / 36 进制互转', path: '/radix-converter' }}
/>
