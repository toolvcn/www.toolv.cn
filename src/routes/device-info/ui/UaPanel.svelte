<script lang="ts">
	// UA 卡：上半是当前浏览器的 UA 原文与解析结果，下半是「解析任意 UA」。
	//
	// 下半才是这页真正会被反复用的地方 —— 自己浏览器的信息看一眼就够，
	// 拿到别人日志里的一段 UA 能立刻解出浏览器 / 引擎 / 系统 / 设备，才省事。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import { deviceStore } from '../core/store.svelte.ts';
	import { PLACEHOLDER } from '../core/types.ts';
	import { uaRows } from '../core/ua.ts';

	let { class: className = '' }: { class?: string } = $props();

	// 派生值在组件里算一次：这两份行数据各被 5 行共用，别让每行自己重算
	const currentRows = $derived(uaRows(deviceStore.ua));
	const customRows = $derived(uaRows(deviceStore.customUaResult));
	const hasCustom = $derived(deviceStore.customUa.trim() !== '');
</script>

<Panel id="device-ua" heading="User-Agent 解析" class={className}>
	<div class="flex flex-col gap-3 p-4">
		<div class="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
			<p class="min-w-0 flex-1 font-mono text-xs leading-5 break-all text-gray-900">
				{deviceStore.ua?.raw ?? PLACEHOLDER}
			</p>
			<CopyButton
				icon
				text={deviceStore.ua?.raw ?? ''}
				ok="已复制当前 UA"
				label="复制当前 UA 原文"
				empty="还没有读到 UA"
			/>
		</div>

		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
			{#each currentRows as row (row.label)}
				<div class="min-w-0">
					<dt class="text-xs text-gray-600">{row.label}</dt>
					<dd class="truncate font-mono text-sm text-gray-900" title={row.value}>{row.value}</dd>
				</div>
			{/each}
		</dl>

		<div class="flex flex-col gap-2 border-t border-gray-100 pt-3">
			<label class="text-xs font-medium text-gray-600" for="device-custom-ua">解析任意 UA</label>
			<div class="flex flex-wrap items-center gap-2">
				<div class="min-w-0 flex-1">
					<Input
						id="device-custom-ua"
						mono
						size="sm"
						autocomplete="off"
						placeholder="粘贴一段 User-Agent 字符串"
						bind:value={deviceStore.customUa}
					/>
				</div>
				<Button size="sm" label="把当前浏览器的 UA 填进输入框" onclick={() => deviceStore.useCurrentUa()}>
					填入当前
				</Button>
				<Button size="sm" label="清空 UA 输入框" onclick={() => deviceStore.clearCustomUa()}>清空</Button>
			</div>
		</div>

		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
			{#each customRows as row (row.label)}
				<div class="min-w-0">
					<dt class="text-xs text-gray-600">{row.label}</dt>
					<dd class="truncate font-mono text-sm text-gray-900">{hasCustom ? row.value : PLACEHOLDER}</dd>
				</div>
			{/each}
		</dl>

		{#if !hasCustom}
			<p class="text-[11px] leading-4 text-gray-600">
				粘贴一段 UA 就能解出浏览器、引擎、系统与设备类型，看别人的日志不用猜。
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<div class="border-t border-gray-200 px-4 py-2">
			<p class="text-[11px] leading-4 text-gray-600">
				UA 可以随便改，也可能被浏览器冻结（UA reduction）；这里的结果是按常见约定推断的，别拿它当唯一依据。
			</p>
		</div>
	{/snippet}
</Panel>
