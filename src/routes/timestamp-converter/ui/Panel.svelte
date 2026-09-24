<script lang="ts">
	// 时间戳工具主界面：顶部通栏工具条（单位 / 现在 / 示例），下方双向换算两张卡，末尾世界时钟。
	// 版式与 json-formatter 一致：控件集中在工具条，卡片只放输入与结果，状态走脚注。
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Lightbulb, RefreshCw } from '@lucide/svelte';
	import { formatDiff, formatInZone } from '../core/format.ts';
	import { tsStore } from '../core/store.svelte.ts';
	import { WORLD_ZONES, type TsUnit } from '../core/types.ts';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	/** 只读结果字段：灰底等宽，跟可编辑输入框视觉上区分开 */
	const OUT_FIELD =
		'block w-full min-w-0 truncate rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-sm text-gray-900';

	const UNIT_OPTIONS: { value: TsUnit; label: string }[] = [
		{ value: 'auto', label: '自动' },
		{ value: 's', label: '秒' },
		{ value: 'ms', label: '毫秒' }
	];

	const isTsValid = $derived(tsStore.tsParsed.kind === 'ok');
	const isLocalValid = $derived(tsStore.localParsed.kind === 'ok');
	const cmpDiff = $derived(tsStore.cmpDiff);
	const cmpInvalid = $derived(tsStore.cmpAError !== '' || tsStore.cmpBError !== '');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：单位在左，现在 / 示例 md:ml-auto 靠右 -->
	<div id="ts-toolbar" role="group" aria-label="时间戳转换操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="ts-unit-group-label">时间戳单位</span>
			<SegmentedControl
				aria-labelledby="ts-unit-group-label"
				options={UNIT_OPTIONS}
				value={tsStore.tsUnit}
				onchange={(v) => tsStore.setTsUnit(v)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入当前时间" title="现在" onclick={() => tsStore.fillNow()}>
				<RefreshCw class="size-4 shrink-0" aria-hidden="true" />现在
			</Button>
			<Button label="填入示例时间戳" title="示例" onclick={() => tsStore.fillSample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- 时间戳 → 时间 -->
		<PanelCard id="ts-to-time" headingId="ts-to-time-heading" heading="时间戳 → 时间">
			{#snippet headingExtra()}
				<span class={PANEL_HINT}>支持 1970 年之前（负数）</span>
			{/snippet}

			<!-- relative 是给 Input 的 sr-only label 用的：它是 absolute，没有定位上下文会撑高文档 -->
			<div class="relative flex flex-col gap-3 p-4">
				<Input
					id="ts-number"
					mono
					inputmode="decimal"
					bind:value={tsStore.tsText}
					invalid={tsStore.tsError !== ''}
					label="时间戳数值"
					placeholder="例如 1704067200"
				/>

				<!-- 只读结果行：跟 generator / case-converter 等共用一个行骨架（ResultRow 自带悬浮与聚焦反馈） -->
				<ul class="space-y-1">
					<ResultRow density="sm">
						<span class="w-16 shrink-0 text-xs text-gray-600">本地时间</span>
						<p class="min-w-0 flex-1">
							<span class={OUT_FIELD}>{isTsValid ? tsStore.tsLocalText : '—'}</span>
						</p>
						<CopyButton
							icon
							label="复制本地时间"
							disabled={!isTsValid}
							text={tsStore.tsLocalText}
							ok="已复制本地时间"
						/>
					</ResultRow>
					<ResultRow density="sm">
						<span class="w-16 shrink-0 text-xs text-gray-600">UTC</span>
						<p class="min-w-0 flex-1">
							<span class={OUT_FIELD}>{isTsValid ? tsStore.tsUtcText : '—'}</span>
						</p>
						<CopyButton icon label="复制 UTC 时间" disabled={!isTsValid} text={tsStore.tsUtcText} ok="已复制UTC 时间" />
					</ResultRow>
				</ul>
			</div>

			<!-- 脚注：换算状态与错误都放这里，卡片高度不跳变 -->
			<div class={FOOTER_BAR}>
				<StatusPill tone={tsStore.tsError ? 'error' : 'neutral'} truncate
					>{tsStore.tsError || (isTsValid ? '已按当前单位解析，结果实时同步' : '输入时间戳后实时换算')}</StatusPill
				>
			</div>
		</PanelCard>

		<!-- 时间 → 时间戳 -->
		<PanelCard id="time-to-ts" headingId="time-to-ts-heading" heading="时间 → 时间戳">
			{#snippet headingExtra()}
				<span class={PANEL_HINT}>按本机时区解析</span>
			{/snippet}

			<!-- relative 是给 Input 的 sr-only label 用的：它是 absolute，没有定位上下文会撑高文档 -->
			<div class="relative flex flex-col gap-3 p-4">
				<Input id="ts-datetime" type="datetime-local" label="本地日期时间" bind:value={tsStore.localText} />

				<ul class="space-y-1">
					<ResultRow density="sm">
						<span class="w-16 shrink-0 text-xs text-gray-600">毫秒</span>
						<p class="min-w-0 flex-1">
							<span class={OUT_FIELD}>{isLocalValid ? String(tsStore.localEpochMs) : '—'}</span>
						</p>
						<CopyButton
							icon
							label="复制毫秒时间戳"
							disabled={!isLocalValid}
							text={String(tsStore.localEpochMs)}
							ok="已复制毫秒时间戳"
						/>
					</ResultRow>
					<ResultRow density="sm">
						<span class="w-16 shrink-0 text-xs text-gray-600">秒</span>
						<p class="min-w-0 flex-1">
							<span class={OUT_FIELD}>{isLocalValid ? String(tsStore.localEpochS) : '—'}</span>
						</p>
						<CopyButton
							icon
							label="复制秒时间戳"
							disabled={!isLocalValid}
							text={String(tsStore.localEpochS)}
							ok="已复制秒时间戳"
						/>
					</ResultRow>
				</ul>
			</div>

			<div class={FOOTER_BAR}>
				<StatusPill tone={tsStore.localError ? 'error' : 'neutral'} truncate
					>{tsStore.localError || (isLocalValid ? '已按本机时区换算' : '选一个日期时间后实时换算')}</StatusPill
				>
			</div>
		</PanelCard>
	</div>

	<!-- 双时间戳对比：A / B 各自换算，差值按 B − A -->
	<PanelCard id="ts-compare" headingId="ts-compare-heading" heading="双时间戳对比">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>差值按 B − A 计算</span>
		{/snippet}

		<!-- relative 是给 Input 的 sr-only label 用的：它是 absolute，没有定位上下文会撑高文档 -->
		<div class="relative flex flex-col gap-3 p-4">
			<div class={TOOLBAR_GROUP}>
				<span class={TOOLBAR_LABEL} id="ts-cmp-unit-label">对比单位</span>
				<SegmentedControl
					aria-labelledby="ts-cmp-unit-label"
					options={UNIT_OPTIONS}
					value={tsStore.cmpUnit}
					onchange={(v) => tsStore.setCmpUnit(v)}
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="flex min-w-0 flex-col gap-2">
					<Input
						id="ts-cmp-a"
						mono
						inputmode="decimal"
						bind:value={tsStore.cmpAText}
						invalid={tsStore.cmpAError !== ''}
						label="时间戳 A"
						placeholder="例如 1704067200"
					/>
					<dl class="space-y-0.5 text-xs">
						<div class="flex gap-2">
							<dt class="w-12 shrink-0 text-gray-600">本地</dt>
							<dd class="min-w-0 truncate font-mono text-gray-900">{tsStore.cmpALocalText}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-12 shrink-0 text-gray-600">UTC</dt>
							<dd class="min-w-0 truncate font-mono text-gray-900">{tsStore.cmpAUtcText}</dd>
						</div>
					</dl>
				</div>

				<div class="flex min-w-0 flex-col gap-2">
					<Input
						id="ts-cmp-b"
						mono
						inputmode="decimal"
						bind:value={tsStore.cmpBText}
						invalid={tsStore.cmpBError !== ''}
						label="时间戳 B"
						placeholder="例如 1706745600"
					/>
					<dl class="space-y-0.5 text-xs">
						<div class="flex gap-2">
							<dt class="w-12 shrink-0 text-gray-600">本地</dt>
							<dd class="min-w-0 truncate font-mono text-gray-900">{tsStore.cmpBLocalText}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-12 shrink-0 text-gray-600">UTC</dt>
							<dd class="min-w-0 truncate font-mono text-gray-900">{tsStore.cmpBUtcText}</dd>
						</div>
					</dl>
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
				<p class="text-xs text-gray-600">差值（B − A）</p>
				<p class="mt-0.5 font-mono text-sm break-words text-gray-900 tabular-nums">
					{cmpDiff ? formatDiff(cmpDiff) : '—'}
				</p>
				<p class="mt-0.5 text-xs text-gray-600 tabular-nums">
					毫秒余数 {cmpDiff ? `${cmpDiff.milliseconds} 毫秒` : '—'}
				</p>
			</div>
		</div>

		<div class={FOOTER_BAR}>
			<StatusPill tone={cmpInvalid ? 'error' : 'neutral'} truncate>{tsStore.cmpHint}</StatusPill>
		</div>
	</PanelCard>

	<!-- 世界时钟：参考时刻跟随上方两个输入 -->
	<PanelCard id="world-clock" headingId="world-clock-heading" heading="世界时钟">
		<ul class="grid grid-cols-2 gap-px bg-gray-200 p-px sm:grid-cols-3 lg:grid-cols-7">
			{#each WORLD_ZONES as zone (zone.zone)}
				<li class="flex min-w-0 flex-col items-center gap-1 bg-white px-2 py-3">
					<span class="text-xs text-gray-600">{zone.label}</span>
					<time class="truncate font-mono text-sm text-gray-900">{formatInZone(tsStore.clockMs, zone.zone)}</time>
				</li>
			{/each}
		</ul>
		<!-- 参考来源是运行态文字，挂 role=status 播报 -->
		<div class={FOOTER_BAR}>
			<p role="status" aria-live="polite" class="truncate text-xs text-gray-600">{tsStore.clockSource}</p>
		</div>
	</PanelCard>
</div>

<Toast />
