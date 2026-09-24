<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Copy, Eraser } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import EditorPane from './EditorPane.svelte';
	import { EDITOR_INPUT, EDITOR_OUTPUT, FOOTER_BAR } from '$lib/ui/styles';

	const { Story } = defineMeta({ title: 'UI/EditorPane', component: EditorPane });

	const SIDE = 'relative min-w-0 flex-1 md:min-h-0';
	const SAMPLE = '{\n  "name": "微工具",\n  "url": "https://www.toolv.cn"\n}';
</script>

<!-- 输入侧：不传 error / empty，children 套进 EditorBox 编辑框后进正文 -->
{#snippet input()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane id="demo-input" heading="JSON 输入" headingExtra="48 字符 · 3 行" class={SIDE}>
			{#snippet actions()}
				<Button label="清空输入框" size="xs" title="清空输入框"><Eraser class="size-3.5" />清空</Button>
			{/snippet}
			<Textarea mono label="JSON 输入" value={SAMPLE} class={EDITOR_INPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">操作在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<!-- 非编辑器正文：传 bare，不套编辑框（hash 结果列表那种用法） -->
{#snippet bareBody()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane id="demo-bare" heading="计算结果" headingExtra="5 种算法" class={SIDE} bare>
			<div class="min-h-0 flex-1 overflow-y-auto p-4 text-xs text-gray-600">这里是任意非编辑器正文</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone="neutral">无编辑框</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<!-- 输出侧有内容：ready 为真 -->
{#snippet outputReady()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane id="demo-out" heading="格式化结果" headingExtra="52 字符" class={SIDE} empty="还没有输出" ready={true}>
			{#snippet actions()}
				<Button label="复制输出结果" size="xs" variant="primary" title="复制输出"><Copy class="size-3.5" />复制</Button>
			{/snippet}
			<Textarea mono size="sm" readonly label="格式化结果" value={SAMPLE} class={EDITOR_OUTPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone="ok">JSON 合法</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<!-- 输出侧空态：ready 为假，空态盖住编辑区（容器高度不变，切换不跳高） -->
{#snippet outputEmpty()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			id="demo-empty"
			heading="格式化结果"
			class={SIDE}
			empty="在左侧粘贴 JSON，格式化结果会实时显示在这里"
			ready={false}
		>
			<Textarea mono size="sm" readonly label="格式化结果" class={EDITOR_OUTPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone="neutral">等待输入</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<!-- 输出侧错误态：error 优先于空态与内容 -->
{#snippet outputError()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			id="demo-error"
			heading="格式化结果"
			class={SIDE}
			error="第 3 行第 7 列：缺少逗号"
			empty="在左侧粘贴 JSON"
			ready={true}
		>
			<Textarea mono size="sm" readonly label="格式化结果" class={EDITOR_OUTPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone="error" truncate>第 3 行第 7 列：缺少逗号</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<!-- 开了 fullscreen：标题行右侧多一枚全屏按钮（调用方的 actions 仍在其左侧） -->
{#snippet withFullscreen()}
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			id="demo-fs"
			fullscreen
			heading="输出结果"
			headingExtra="52 字符"
			class={SIDE}
			empty="还没有输出"
			ready={true}
		>
			{#snippet actions()}
				<Button label="复制输出结果" size="xs" variant="primary" title="复制输出">
					<Copy class="size-3.5" />复制
				</Button>
			{/snippet}
			<Textarea mono size="sm" readonly label="输出结果" value={SAMPLE} class={EDITOR_OUTPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone="ok">JSON 合法</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
{/snippet}

<Story name="Input" template={input} />
<Story name="WithFullscreen" template={withFullscreen} />
<Story name="Bare" template={bareBody} />
<Story name="OutputReady" template={outputReady} />
<Story name="OutputEmpty" template={outputEmpty} />
<Story name="OutputError" template={outputError} />
