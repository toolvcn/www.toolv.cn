<script lang="ts">
	// 时钟模式的专属设置：小时制、秒、日期与星期、时区、冒号闪烁。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Switch from '$lib/ui/Switch/Switch.svelte';
	import { clockStore } from '../core/store.svelte.ts';

	const HOUR_OPTIONS = [
		{ value: '24', label: '24 小时制' },
		{ value: '12', label: '12 小时制' }
	] as const;

	const DATE_OPTIONS = [
		{ value: 'none', label: '不显示' },
		{ value: 'iso', label: '2026-09-20' },
		{ value: 'cn', label: '2026年9月20日' }
	] as const;

	const options = $derived(clockStore.clockOptions);
</script>

<Panel id="clock-mode" heading="时钟" class="shrink-0">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">小时制</span>
			<SegmentedControl
				aria-label="小时制"
				options={HOUR_OPTIONS}
				value={options.hourSystem}
				onchange={(value) => (clockStore.clockOptions.hourSystem = value)}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">日期</span>
			<SegmentedControl
				aria-label="日期格式"
				options={DATE_OPTIONS}
				value={options.dateFormat}
				onchange={(value) => (clockStore.clockOptions.dateFormat = value)}
			/>
		</div>

		<div class="flex flex-col gap-3 border-t border-gray-100 pt-3">
			<div class="flex items-center justify-between gap-3">
				<span class="text-xs text-gray-700">显示秒</span>
				<Switch label="显示秒" title="主数字带上秒位" bind:checked={clockStore.clockOptions.showSeconds} />
			</div>
			<div class="flex items-center justify-between gap-3">
				<span class="text-xs text-gray-700">显示星期</span>
				<Switch label="显示星期" title="在主数字下方带上星期几" bind:checked={clockStore.clockOptions.showWeekday} />
			</div>
			<div class="flex items-center justify-between gap-3">
				<span class="text-xs text-gray-700">显示时区</span>
				<Switch
					label="显示时区"
					title="在主数字下方带上本地时区，如 UTC+8"
					bind:checked={clockStore.clockOptions.showTimezone}
				/>
			</div>
			<div class="flex items-center justify-between gap-3">
				<span class="text-xs text-gray-700">冒号闪烁</span>
				<Switch
					label="冒号闪烁"
					title="眨眼式闪烁：冒号每秒淡出一次"
					bind:checked={clockStore.clockOptions.blinkColon}
				/>
			</div>
		</div>

		<p class="text-[11px] leading-4 text-gray-600">
			数字一律等宽对齐 —— 秒一跳整行宽度就会变，不锁等宽的话时钟会左右抖。
		</p>
	</div>
</Panel>
