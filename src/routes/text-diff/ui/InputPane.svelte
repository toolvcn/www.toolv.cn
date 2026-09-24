<script lang="ts">
	// 一侧的输入卡片：标题 + 编辑区 + 脚注提示。左右两栏各用一次，差别只在文案。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { EDITOR_FRAME_PAD, FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { splitLines } from '../core/diff.ts';

	let { side, value = $bindable('') }: { side: 'left' | 'right'; value?: string } = $props();

	const heading = $derived(side === 'left' ? '原文（左）' : '对照（右）');
	const label = $derived(side === 'left' ? '原文文本' : '对照文本');
	const placeholder = $derived(
		side === 'left' ? '粘贴原始文本，例如改动前的配置或代码' : '粘贴对照文本，例如改动后的版本'
	);
	const hint = $derived(side === 'left' ? '左栏是基准，删除的行以它为准' : '右栏是对照，新增的行以它为准');
	const count = $derived(`${splitLines(value).length} 行 / ${value.length} 字符`);

	// 移动端一栏 192px：比标准档的 h-56 矮一档 —— 两栏叠起来还要给下面的结果区留位置，
	// 按标准档走两块就把首屏占满了；md 起高度归容器，填满卡片
	const EDITOR = 'h-48 md:h-auto md:min-h-0 md:flex-1';
</script>

<Panel {heading} class="min-h-0">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>{count}</span>
	{/snippet}

	<div class={EDITOR_FRAME_PAD}>
		<EditorBox>
			<Textarea mono {label} {placeholder} bind:value class={EDITOR} />
		</EditorBox>
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">{hint}</p>
		</div>
	{/snippet}
</Panel>
