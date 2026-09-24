<script lang="ts">
	// 一张分组卡：字段名 + 值 + 行内复制。
	// 值与占位符都走 deviceStore.valueOf：预渲染时全是占位符，采集完原地换成真值，
	// 行名与行数不变，不会出现高度跳变。
	//
	// 少数分组（指纹 / 传感器 / 设备名称）拿结果会弹权限框或属于指纹信息，
	// 这类不给自动读，改在标题行右侧放一个按钮 —— 按钮由 store 按分组给（actionsFor）。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { deviceStore } from '../core/store.svelte.ts';
	import { PLACEHOLDER, type GroupDef } from '../core/types.ts';

	let { group, class: className = '' }: { group: GroupDef; class?: string } = $props();

	// 提到组件级：写成模板里的 {@const} 会每次渲染重算一遍。
	// 名字避开 `actions` —— 下面那个同名 snippet 是传给 Panel 的，重名会撞上。
	const groupActions = $derived(deviceStore.actionsFor(group.id));
	const groupHint = $derived(deviceStore.hintFor(group.id));
</script>

<Panel id="device-{group.id}" heading={group.heading} class={className}>
	{#snippet headingExtra()}
		{#if groupHint}
			<!-- role=status：这行字随读取结果变化，读屏要能播报 -->
			<span class="shrink-0 text-[11px] leading-4 text-gray-600" role="status" aria-live="polite">{groupHint}</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		<!--
			每张卡最多一个动作按钮，列表是静态的 —— key 用下标而不是 action.label：
			label 会随状态变（「读取指纹」→「重新读取指纹」），拿它当 key 会让按钮每次变状态就重建。
		-->
		{#each groupActions as action, index (index)}
			<Button size="xs" label={action.hint} disabled={action.disabled} onclick={action.onclick}>
				{action.label}
			</Button>
		{/each}
	{/snippet}

	<ul class="divide-y divide-gray-200">
		{#each group.fields as field (field.key)}
			{@const value = deviceStore.valueOf(field.key)}
			<ResultRow density="sm">
				<span class="w-28 shrink-0 truncate text-xs text-gray-600" title={field.hint ?? field.label}>
					{field.label}{field.experimental ? '〔实验〕' : ''}
				</span>
				<span class="min-w-0 flex-1 text-right font-mono text-xs break-all text-gray-900">{value}</span>
				<CopyButton
					icon
					text={value}
					disabled={value === PLACEHOLDER}
					isEmpty={(text) => text === PLACEHOLDER}
					ok={`已复制「${field.label}」`}
					label={`复制${field.label}`}
					empty="这一项没有采集到"
				/>
			</ResultRow>
		{/each}
	</ul>
</Panel>
