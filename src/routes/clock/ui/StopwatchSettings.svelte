<script lang="ts">
	// 秒表模式的专属设置：显示精度与前置文案。
	// 计时逻辑不在这里 —— 开始 / 暂停 / 继续 / 重置那排按钮是倒计时共用的，放在 Workspace 里。
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { PREFIX_MAX_LENGTH } from '../config.ts';
	import { clockStore } from '../core/store.svelte.ts';

	const PRECISION_OPTIONS = [
		{ value: 'second', label: '秒' },
		{ value: 'tenth', label: '十分之一秒' },
		{ value: 'millisecond', label: '毫秒' }
	] as const;

	const options = $derived(clockStore.stopwatchOptions);
</script>

<Panel id="clock-stopwatch" heading="秒表" class="shrink-0">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">显示精度</span>
			<SegmentedControl
				aria-label="秒表显示精度"
				options={PRECISION_OPTIONS}
				value={options.precision}
				onchange={(value) => (clockStore.stopwatchOptions.precision = value)}
			/>
			{#if options.precision !== 'second'}
				<p class="text-[11px] leading-4 text-gray-600">精度越高数字跳动越快，大字号下会有点晃眼，看场合选。</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="stopwatch-prefix" class="text-xs font-medium text-gray-600">前置文案</label>
			<Input
				id="stopwatch-prefix"
				maxlength={PREFIX_MAX_LENGTH}
				autocomplete="off"
				placeholder="如：本轮用时"
				label="秒表前置文案"
				bind:value={clockStore.stopwatchOptions.prefix}
			/>
		</div>

		<p class="text-[11px] leading-4 text-gray-600">
			打开页面就从 0 开始跑，不用先点「开始」；刷新页面即重新计时（计时进度不保存）。
		</p>
	</div>
</Panel>
