<script lang="ts">
	// WCAG 对比度卡：前景固定为当前颜色，背景三选（白 / 黑 / 自定义），
	// 给出比值与四档判定，并按真实颜色渲染一段正文 / 大字示例。
	import { CircleCheckBig, CircleX } from '@lucide/svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { formatRgb, rgbToHex } from '../core/color.ts';
	import { colorStore } from '../core/store.svelte.ts';
	// 达标线与自定义背景的初始值从 config 读：改了 config，这里的提示句跟着变
	import { DEFAULT_CUSTOM_BG, WCAG_THRESHOLDS } from '../config.ts';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { BADGE, SWATCH } from './styles.ts';

	// 条件类名一律在脚本里算好：class 属性里的三元会被 prettier 拆行而静默失效
	const BG_OPTIONS = [
		{ value: 'white', label: '白' },
		{ value: 'black', label: '黑' },
		{ value: 'custom', label: '自定义' }
	] as const;

	const hasResult = $derived(colorStore.ratio !== null && colorStore.wcag !== null);
	const customInvalid = $derived(colorStore.contrastBg === 'custom' && colorStore.customBg === null);
	const exampleFg = $derived(colorStore.color === null ? '#000000' : formatRgb(colorStore.color));
	const exampleBg = $derived(colorStore.bgColor === null ? '#ffffff' : formatRgb(colorStore.bgColor));
	/** 色板的 value 必须是不带 alpha 的 6 位 HEX */
	const customSwatchValue = $derived(
		colorStore.customBg === null ? DEFAULT_CUSTOM_BG : rgbToHex({ ...colorStore.customBg, a: 1 })
	);

	// 四档徽章：达标 emerald、不达标灰。hint 的阈值从 config 拼，跟判定同源
	const LEVELS = [
		{ key: 'aaNormal', name: 'AA 正文', hint: `≥ ${WCAG_THRESHOLDS.aaNormal}` },
		{ key: 'aaLarge', name: 'AA 大字', hint: `≥ ${WCAG_THRESHOLDS.aaLarge}` },
		{ key: 'aaaNormal', name: 'AAA 正文', hint: `≥ ${WCAG_THRESHOLDS.aaaNormal}` },
		{ key: 'aaaLarge', name: 'AAA 大字', hint: `≥ ${WCAG_THRESHOLDS.aaaLarge}` }
	] as const;

	function badgeClass(pass: boolean): string {
		return pass ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-600';
	}
</script>

<Panel id="color-contrast" headingId="color-contrast-heading" heading="WCAG 对比度" class="shrink-0">
	{#snippet actions()}
		<span class="text-xs text-gray-600">前景 = 当前颜色</span>
	{/snippet}
	<div class="flex flex-col gap-4 p-4">
		<!-- 背景选择 -->
		<div class="flex flex-wrap items-center gap-2">
			<SegmentedControl
				edge="dark"
				aria-label="对比背景"
				options={BG_OPTIONS}
				value={colorStore.contrastBg}
				onchange={(v) => (colorStore.contrastBg = v)}
			/>
			{#if colorStore.contrastBg === 'custom'}
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<input
						id="color-contrast-bg-swatch"
						type="color"
						aria-label="自定义背景色板"
						title="自定义背景色板"
						value={customSwatchValue}
						oninput={(event) => (colorStore.customBgText = event.currentTarget.value)}
						class={SWATCH}
					/>
					<div class="relative min-w-0 flex-1">
						<Input
							id="color-contrast-bg-text"
							mono
							bind:value={colorStore.customBgText}
							invalid={customInvalid}
							autocapitalize="off"
							autocomplete="off"
							label="自定义背景 HEX"
							placeholder={DEFAULT_CUSTOM_BG}
						/>
					</div>
				</div>
			{/if}
		</div>

		<!-- 结果：比值 + 四档徽章；空态 / 非法分别给文案 -->
		<div role="status" aria-live="polite">
			{#if customInvalid}
				<p class="text-sm text-red-700">
					自定义背景认不出，填 {DEFAULT_CUSTOM_BG} 这样的 HEX、rgb() 或 hsl()。
				</p>
			{:else if !hasResult}
				<p class="text-sm text-gray-600">输入合法颜色后，这里给出与所选背景的对比度与达标档位。</p>
			{:else}
				<p class="text-3xl font-semibold text-gray-900 tabular-nums">{colorStore.ratioText}</p>
				<div class="mt-3 grid grid-cols-2 gap-2">
					{#each LEVELS as level (level.key)}
						{@const pass = colorStore.wcag![level.key]}
						<div class="{BADGE} {badgeClass(pass)}">
							{#if pass}
								<CircleCheckBig class="size-3.5 shrink-0" aria-hidden="true" />
							{:else}
								<CircleX class="size-3.5 shrink-0" aria-hidden="true" />
							{/if}
							<span class="truncate">{level.name}</span>
							<span class="ml-auto shrink-0 font-normal tabular-nums">{level.hint}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 真实渲染示例：前景色文字画在背景色上 -->
		{#if hasResult}
			<div class="rounded-lg border border-gray-200 p-4" style:background-color={exampleBg} style:color={exampleFg}>
				<p class="text-sm">正文示例：14px 的普通文字要过 AA，对比度需 ≥ {WCAG_THRESHOLDS.aaNormal}。</p>
				<p class="mt-1 text-2xl font-semibold">大字示例：24px 粗体 ≥ {WCAG_THRESHOLDS.aaLarge} 即可。</p>
			</div>
			<p class="text-xs text-gray-600">
				大字 = ≥ 18pt（约 24px）或 ≥ 14pt 粗体；半透明前景已按 alpha 混进背景后再计算。
			</p>
		{/if}
	</div>
</Panel>
