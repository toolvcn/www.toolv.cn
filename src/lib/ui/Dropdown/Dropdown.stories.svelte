<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import Dropdown, { type DropdownOption } from './Dropdown.svelte';

	type Args = Omit<ComponentProps<typeof Dropdown>, 'children'>;

	const options: DropdownOption[] = [
		{ value: 'json', label: 'JSON', description: '带缩进的 JSON 文本' },
		{ value: 'csv', label: 'CSV', description: '首行为表头的 CSV 文本' },
		{ value: 'yaml', label: 'YAML', description: '两空格缩进的 YAML 文本' }
	];

	const { Story } = defineMeta({
		title: 'UI/Dropdown',
		component: Dropdown,
		args: { label: '输出格式', options, value: 'json', onSelect: () => {} }
	});
</script>

{#snippet template(args: Args)}
	<Dropdown {...args} />
{/snippet}

<!-- sm 档 h-8，与 Button sm 同高，放在密集的工具条里 -->
{#snippet small()}
	<div class="flex items-center gap-1.5">
		<Dropdown label="输出格式" size="sm" {options} value="csv" onSelect={() => {}} />
	</div>
{/snippet}

<!-- xs 档 h-7 + triggerLabel：面板标题行那一档。动作型菜单（点一下就执行）把 value 留空，
     按钮上显示 triggerLabel 那句短的字，读屏听到的仍是 label -->
{#snippet extraSmall()}
	<div class="flex h-12 items-center gap-1.5 border-b border-gray-200 px-4">
		<Dropdown
			label="CSV 导出与导入：一行一条预设，含参数与算出来的结果"
			triggerLabel="CSV"
			size="xs"
			{options}
			value=""
			onSelect={() => {}}
		/>
	</div>
{/snippet}

<Story name="Default" {template} />
<Story name="Selected" {template} args={{ value: 'csv' }} />
<Story name="SizeSm" template={small} />
<Story name="SizeXs" template={extraSmall} />
<Story name="Disabled" {template} args={{ disabled: true, disabledTitle: '先选择输入内容' }} />
<!-- rest 透传：id / data-* 直接落到触发按钮上 -->
<Story name="RestProps" {template} args={{ id: 'format-select', 'data-testid': 'format-select' }} />
