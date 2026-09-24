<script lang="ts">
	// 外观面板：三个模式共用这一份样式，所以它独立成一个面板、不跟着标签走。
	//
	// 「背景 + 不透明度」是本工具的核心项：拉到 0% 就是全透明，
	// 录屏 / 直播软件把本页当浏览器源叠加时，背景是真的透过去的。
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import {
		ANGLE_PRESETS,
		ANGLE_RANGE,
		DEFAULT_STYLE,
		FONT_SIZE_RANGE,
		PADDING_STEPS,
		STYLE_PRESETS,
		WEIGHT_STEPS
	} from '../config.ts';
	import { clockStore } from '../core/store.svelte.ts';

	/** 原生色板的外观：去掉默认边框内边距，只留一圈细边（与 color-converter 的色板同款） */
	const SWATCH =
		'h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

	const SIZE_OPTIONS = [
		{ value: 'auto', label: '自动填满' },
		{ value: 'manual', label: '手动' }
	] as const;

	const FONT_OPTIONS = [
		{ value: 'mono', label: '等宽' },
		{ value: 'sans', label: '无衬线' },
		{ value: 'serif', label: '衬线' }
	] as const;

	const WEIGHT_OPTIONS = WEIGHT_STEPS.map((weight) => ({ value: String(weight), label: String(weight) }));
	const PADDING_OPTIONS = PADDING_STEPS.map((step) => ({ value: String(step), label: String(step) }));

	const OUTLINE_OPTIONS = [
		{ value: 'none', label: '无' },
		{ value: 'soft', label: '柔和' },
		{ value: 'strong', label: '强' }
	] as const;

	/** 角度预设：0 度写成「0°（不转）」，比光秃秃一个 0 好认 */
	const ANGLE_OPTIONS = ANGLE_PRESETS.map((angle) => ({
		value: String(angle),
		label: angle === 0 ? '0°（不转）' : `${angle}°`
	}));

	const FLIP_OPTIONS = [
		{ value: 'normal', label: '不翻转' },
		{ value: 'mirror', label: '水平翻转' }
	] as const;

	const style = $derived(clockStore.style);

	/** 预设小方块：把预设那套颜色画出来，不用点进去看名字猜 */
	function presetChipStyle(bg: string, alpha: number, fg: string): string {
		return `background: ${alpha <= 0 ? 'transparent' : bg}; color: ${fg};`;
	}
</script>

<Panel id="clock-appearance" heading="外观" class="shrink-0">
	{#snippet actions()}
		<Button
			label="恢复默认外观"
			title="把颜色、字体、字号都恢复成初始值"
			size="xs"
			onclick={() => clockStore.patchStyle({ ...DEFAULT_STYLE })}
		>
			重置
		</Button>
	{/snippet}

	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">配色预设</span>
			<div class="flex flex-wrap gap-1.5">
				{#each STYLE_PRESETS as preset (preset.id)}
					<button
						type="button"
						title="套用「{preset.name}」配色（只改颜色，字号字体不动）"
						aria-label="套用配色预设：{preset.name}"
						onclick={() => clockStore.applyPreset(preset)}
						class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
					>
						<span
							class="size-3.5 shrink-0 rounded-full border border-gray-300"
							style={presetChipStyle(
								preset.style.bg ?? style.bg,
								preset.style.bgAlpha ?? style.bgAlpha,
								preset.style.fg ?? style.fg
							)}
						></span>
						{preset.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">背景色</span>
			<div class="flex items-center gap-2">
				<input
					id="clock-bg"
					type="color"
					aria-label="背景色"
					title="选择背景色"
					value={style.bg}
					oninput={(event) => clockStore.patchStyle({ bg: event.currentTarget.value })}
					class={SWATCH}
				/>
				<div class="min-w-0 flex-1">
					<!-- 40px 高的滑块：视觉上是细轨，触控目标是整块，满足 24px 下限。
						无障碍名走 aria-label 而不是 sr-only 的 label —— sr-only 是 absolute，
						这里没有 relative 的祖先，它会逃出裁剪把文档撑高（UI-STYLE §18）。 -->
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						aria-label="背景不透明度"
						title="背景不透明度；拉到 0 就是全透明，录屏叠加时用得上"
						value={style.bgAlpha}
						oninput={(event) => clockStore.patchStyle({ bgAlpha: Number(event.currentTarget.value) })}
						class="h-10 w-full cursor-pointer accent-blue-600"
					/>
				</div>
				<span class="w-10 shrink-0 text-right text-xs text-gray-600 tabular-nums">{style.bgAlpha}%</span>
			</div>
			<p class="text-[11px] leading-4 text-gray-600">
				不透明度 0% 是纯透明：在普通浏览器窗口里会露出浏览器的默认底色，但在 OBS / 录屏软件的浏览器源、或网页 iframe
				里叠加时是真透明的。
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">文字颜色</span>
			<div class="flex items-center gap-2">
				<input
					id="clock-fg"
					type="color"
					aria-label="文字颜色"
					title="选择文字与数字的颜色"
					value={style.fg}
					oninput={(event) => clockStore.patchStyle({ fg: event.currentTarget.value })}
					class={SWATCH}
				/>
				<span class="font-mono text-xs text-gray-600">{style.fg}</span>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">字号</span>
			<SegmentedControl
				aria-label="字号模式"
				options={SIZE_OPTIONS}
				value={style.sizeMode}
				onchange={(value) => clockStore.patchStyle({ sizeMode: value })}
			/>
			{#if style.sizeMode === 'manual'}
				<div class="flex items-center gap-2">
					<input
						type="range"
						aria-label="手动字号，单位像素"
						min={FONT_SIZE_RANGE.min}
						max={FONT_SIZE_RANGE.max}
						step={FONT_SIZE_RANGE.step}
						title="手动指定字号"
						value={style.fontSize}
						oninput={(event) => clockStore.patchStyle({ fontSize: Number(event.currentTarget.value) })}
						class="h-10 w-full cursor-pointer accent-blue-600"
					/>
					<span class="w-14 shrink-0 text-right text-xs text-gray-600 tabular-nums">{style.fontSize}px</span>
				</div>
			{:else}
				<p class="text-[11px] leading-4 text-gray-600">字号跟着容器走：拖动画中画窗口大小，数字会自动缩放填满。</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">字体</span>
			<SegmentedControl
				aria-label="字体族"
				options={FONT_OPTIONS}
				value={style.font}
				onchange={(value) => clockStore.patchStyle({ font: value })}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">字重</span>
			<SegmentedControl
				aria-label="字重"
				options={WEIGHT_OPTIONS}
				value={String(style.weight)}
				onchange={(value) => clockStore.patchStyle({ weight: Number(value) })}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">描边</span>
			<SegmentedControl
				aria-label="描边强度"
				options={OUTLINE_OPTIONS}
				value={style.outline}
				onchange={(value) => clockStore.patchStyle({ outline: value })}
			/>
			<p class="text-[11px] leading-4 text-gray-600">
				背景透明时给数字描一圈反色边。描边颜色自动取文字色的反色，不用单独设。
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">内边距</span>
			<SegmentedControl
				aria-label="内边距档位"
				options={PADDING_OPTIONS}
				value={String(style.padding)}
				onchange={(value) => clockStore.patchStyle({ padding: Number(value) })}
			/>
			<p class="text-[11px] leading-4 text-gray-600">
				数字离窗口边缘的距离，按窗口短边的百分比算，窗口大小变了也跟着变。
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">显示角度</span>
			<div class="flex flex-wrap items-center gap-2">
				<SegmentedControl
					aria-label="显示角度预设"
					options={ANGLE_OPTIONS}
					value={String(style.angle)}
					onchange={(value) => clockStore.patchStyle({ angle: Number(value) })}
				/>
				<Button
					size="xs"
					label="把显示角度恢复成 0 度"
					title="一键恢复默认 0°（不旋转）"
					onclick={() => clockStore.patchStyle({ angle: 0 })}
				>
					重置
				</Button>
			</div>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min={ANGLE_RANGE.min}
					max={ANGLE_RANGE.max}
					step={ANGLE_RANGE.step}
					aria-label="自定义显示角度，单位度"
					title="拖到任意角度；90° / 270° 会把画面横过来填满，其它角度整体缩一点保证不裁切"
					value={style.angle}
					oninput={(event) => clockStore.patchStyle({ angle: Number(event.currentTarget.value) })}
					class="h-10 w-full cursor-pointer accent-blue-600"
				/>
				<span class="w-12 shrink-0 text-right text-xs text-gray-600 tabular-nums">{style.angle}°</span>
			</div>
			<p class="text-[11px] leading-4 text-gray-600">
				整块画面绕中心旋转，预览、画中画与独立窗口都用这同一个角度，跟配色、字号互不干扰。 画中画会即时跟着变；<strong
					class="font-medium text-gray-700">独立窗口的地址是快照</strong
				>，改完角度要重新打开（或刷新那个窗口）。
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">翻转</span>
			<SegmentedControl
				aria-label="水平翻转"
				options={FLIP_OPTIONS}
				value={style.mirror ? 'mirror' : 'normal'}
				onchange={(value) => clockStore.patchStyle({ mirror: value === 'mirror' })}
			/>
			<p class="text-[11px] leading-4 text-gray-600">镜像整块画面，给需要左右翻转的录屏 / 直播场景用。</p>
		</div>
	</div>
</Panel>
