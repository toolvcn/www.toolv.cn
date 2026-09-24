<script lang="ts">
	// 输入卡 + 预览块：任意格式粘贴解析，非法给红字提示；
	// 预览块按白色打底显示，块上并排「白字 / 黑字」两枚样张，可读性一眼见分晓。
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { colorStore } from '../core/store.svelte.ts';
	import { SWATCH } from './styles.ts';

	const previewTextClass = $derived(colorStore.previewTextDark ? 'text-gray-900' : 'text-white');
	// 空输入不算错，别在没输入时就打红边（同时避免给空控件落 aria-invalid）
	const inputInvalid = $derived(colorStore.input.trim() !== '' && colorStore.color === null);
	// 提示行三态：空输入引导 / 非法报错 / 合法时说明支持的写法
	const hintText = $derived(
		colorStore.input.trim() === ''
			? '输入颜色后这里实时解析。'
			: colorStore.color === null
				? '认不出这个颜色，试试 #ff5733、rgb(255, 87, 51) 或 hsl(9, 100%, 64%)。'
				: '支持 #f53 短写法、8 位 HEX、rgba() / hsla() 透明度、百分比分量与 deg。'
	);
	const hintClass = $derived(inputInvalid ? 'text-xs text-red-700' : 'text-xs text-gray-600');
</script>

<Panel id="color-input" headingId="color-input-heading" heading="颜色" class="shrink-0">
	{#snippet actions()}
		<Button label="填入示例颜色 #2563eb" title="填入示例" size="xs" onclick={() => colorStore.loadExample()}>
			示例
		</Button>
		<Button label="清空输入框" title="清空输入框" size="xs" onclick={() => colorStore.clearInput()}>清空</Button>
	{/snippet}
	<div class="flex flex-col gap-3 p-4">
		<div class="flex items-center gap-2">
			<div class="relative min-w-0 flex-1">
				<Input
					id="color-input-text"
					mono
					bind:value={colorStore.input}
					invalid={inputInvalid}
					autocapitalize="off"
					autocomplete="off"
					label="颜色值（HEX / RGB / HSL 均可）"
					placeholder="#ff5733 / rgb(255, 87, 51) / hsl(9, 100%, 64%)"
				/>
			</div>
			<!-- 原生色板：value 必须是 #rrggbb，由 store 保证 -->
			<input
				id="color-swatch"
				type="color"
				aria-label="从色板选色"
				title="从色板选色"
				value={colorStore.previewCss}
				oninput={(event) => colorStore.pickFromSwatch(event.currentTarget.value)}
				class={SWATCH}
			/>
		</div>
		<p class={hintClass}>{hintText}</p>

		<!-- 预览块：白色打底，文字色随底色亮度自动切换 -->
		<div
			class="flex h-44 flex-col justify-between rounded-lg border border-gray-200 p-4 sm:h-48"
			style:background-color={colorStore.previewCss}
			role="img"
			aria-label="颜色预览：{colorStore.input}"
		>
			<span class="font-mono text-sm font-semibold {previewTextClass}">
				{colorStore.color === null ? '—' : colorStore.rows[0]?.value}
			</span>
			<div class="flex items-end justify-between gap-3">
				<span class="text-4xl font-bold tracking-tight {previewTextClass}">白字 Aa</span>
				<span class="text-4xl font-bold tracking-tight text-black/85">黑字 Aa</span>
			</div>
		</div>
		<!-- 备注固定在白色卡片上，不跟随预览块文字色 -->
		<p class="text-xs text-gray-600">{colorStore.alphaNote || '块上并排白字与黑字样张，哪种可读一目了然。'}</p>
	</div>
</Panel>
