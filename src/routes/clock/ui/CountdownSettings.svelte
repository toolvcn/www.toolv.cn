<script lang="ts">
	// 倒计时模式的专属设置：两个口径（倒一段时长 / 倒数到每天某个时刻）、设定值、超时开关、前缀。
	// 开始 / 暂停 / 继续 / 重置那排按钮不在这里 —— 它跟秒表共用，放在 Workspace 里。
	//
	// 输入框用单向 value + oninput 直接写 store，不另存一份本地文本：
	// 清空输入框会解析成 0（而不是拒绝），所以不会出现「删不掉」的僵住感。
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Switch from '$lib/ui/Switch/Switch.svelte';
	import { DAILY_RANGE, DURATION_RANGE, PREFIX_MAX_LENGTH, QUICK_MINUTES } from '../config.ts';
	import { durationFromParts, parseUnitText, splitDuration } from '../core/format.ts';
	import { clockStore } from '../core/store.svelte.ts';

	const KIND_OPTIONS = [
		{ value: 'duration', label: '倒一段时长' },
		{ value: 'daily', label: '倒数到每天某时' }
	] as const;

	const options = $derived(clockStore.countdownOptions);
	const parts = $derived(splitDuration(options.durationMs));

	function setDurationPart(key: 'hours' | 'minutes' | 'seconds', text: string): void {
		const limits = {
			hours: DURATION_RANGE.hours,
			minutes: DURATION_RANGE.minutes,
			seconds: DURATION_RANGE.seconds
		};
		const value = parseUnitText(text, limits[key]);
		if (value === null) return;
		const next = { ...splitDuration(options.durationMs), [key]: value };
		clockStore.setDuration(durationFromParts(next.hours, next.minutes, next.seconds));
	}

	function setDailyPart(key: 'dailyHour' | 'dailyMinute' | 'dailySecond', text: string): void {
		const limits = { dailyHour: DAILY_RANGE.hour, dailyMinute: DAILY_RANGE.minute, dailySecond: DAILY_RANGE.second };
		const value = parseUnitText(text, limits[key]);
		if (value === null) return;
		clockStore.countdownOptions[key] = value;
	}
</script>

<Panel id="clock-countdown" heading="倒计时" class="shrink-0">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">口径</span>
			<SegmentedControl
				aria-label="倒计时口径"
				options={KIND_OPTIONS}
				value={options.kind}
				onchange={(value) => (clockStore.countdownOptions.kind = value)}
			/>
		</div>

		{#if options.kind === 'duration'}
			<div class="flex flex-col gap-2">
				<span class="text-xs font-medium text-gray-600">时长</span>
				<div class="grid grid-cols-3 gap-2">
					<div class="flex flex-col gap-1">
						<label for="cd-hours" class="text-[11px] text-gray-600">时</label>
						<Input
							id="cd-hours"
							type="number"
							inputmode="numeric"
							min="0"
							max={DURATION_RANGE.hours}
							size="sm"
							class="text-center"
							value={String(parts.hours)}
							oninput={(event) => setDurationPart('hours', event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="cd-minutes" class="text-[11px] text-gray-600">分</label>
						<Input
							id="cd-minutes"
							type="number"
							inputmode="numeric"
							min="0"
							max={DURATION_RANGE.minutes}
							size="sm"
							class="text-center"
							value={String(parts.minutes)}
							oninput={(event) => setDurationPart('minutes', event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="cd-seconds" class="text-[11px] text-gray-600">秒</label>
						<Input
							id="cd-seconds"
							type="number"
							inputmode="numeric"
							min="0"
							max={DURATION_RANGE.seconds}
							size="sm"
							class="text-center"
							value={String(parts.seconds)}
							oninput={(event) => setDurationPart('seconds', event.currentTarget.value)}
						/>
					</div>
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each QUICK_MINUTES as minutes (minutes)}
						<Button
							size="xs"
							label="把时长设为 {minutes} 分钟"
							onclick={() => clockStore.setDuration(minutes * 60_000)}
						>
							{minutes} 分
						</Button>
					{/each}
				</div>
				<p class="text-[11px] leading-4 text-gray-600">
					打开页面就自动开始，不用先点「开始」；刷新页面即新的一轮（计时进度不保存）。
					走时记的是目标时刻而不是每秒减一，所以切到后台、页面卡顿都不会走偏。
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				<span class="text-xs font-medium text-gray-600">目标时刻（本地时间）</span>
				<div class="grid grid-cols-3 gap-2">
					<div class="flex flex-col gap-1">
						<label for="cd-daily-hour" class="text-[11px] text-gray-600">时</label>
						<Input
							id="cd-daily-hour"
							type="number"
							inputmode="numeric"
							min="0"
							max={DAILY_RANGE.hour}
							size="sm"
							class="text-center"
							value={String(options.dailyHour)}
							oninput={(event) => setDailyPart('dailyHour', event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="cd-daily-minute" class="text-[11px] text-gray-600">分</label>
						<Input
							id="cd-daily-minute"
							type="number"
							inputmode="numeric"
							min="0"
							max={DAILY_RANGE.minute}
							size="sm"
							class="text-center"
							value={String(options.dailyMinute)}
							oninput={(event) => setDailyPart('dailyMinute', event.currentTarget.value)}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="cd-daily-second" class="text-[11px] text-gray-600">秒</label>
						<Input
							id="cd-daily-second"
							type="number"
							inputmode="numeric"
							min="0"
							max={DAILY_RANGE.second}
							size="sm"
							class="text-center"
							value={String(options.dailySecond)}
							oninput={(event) => setDailyPart('dailySecond', event.currentTarget.value)}
						/>
					</div>
				</div>
				<p class="text-[11px] leading-4 text-gray-600">
					每天都往下一个整点滚：过了今天的点会自动开始倒数明天的，不需要手动重开。这个口径没有「开始 /
					暂停」，也不会有「时间到」。
				</p>
			</div>
		{/if}

		{#if options.kind === 'duration'}
			<div class="flex items-start justify-between gap-3 border-t border-gray-100 pt-3">
				<div class="min-w-0">
					<p class="text-xs text-gray-700">超时正计时</p>
					<p class="text-[11px] leading-4 text-gray-600">到点后不归零，继续往上涨并标注「超时」。</p>
				</div>
				<Switch
					label="超时正计时"
					title="到点后继续正计时，显示已经超时多久"
					bind:checked={clockStore.countdownOptions.overtime}
				/>
			</div>
		{/if}

		<div class="flex flex-col gap-1.5">
			<label for="countdown-prefix" class="text-xs font-medium text-gray-600">前置文案</label>
			<Input
				id="countdown-prefix"
				maxlength={PREFIX_MAX_LENGTH}
				autocomplete="off"
				placeholder="如：距开播"
				label="倒计时前置文案"
				bind:value={clockStore.countdownOptions.prefix}
			/>
		</div>
	</div>
</Panel>
