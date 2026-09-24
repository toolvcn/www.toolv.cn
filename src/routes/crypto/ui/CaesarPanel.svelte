<script lang="ts">
	// 凯撒密码工作区：工具条（方向 + 位移）→ 位移对照表条 → 明文 / 密文双栏。
	// 纯函数派生、没有密钥，所以不给「执行」按钮：改一个字结果就跟着变（与摩斯工具同一个口径）。
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { EDITOR_INPUT, FOOTER_BAR, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { cryptoStore } from '../core/store.svelte.ts';
	import { STRIP, STRIP_ITEM, STRIP_LABEL } from './styles.ts';

	const caesar = cryptoStore.caesar;

	const DIRECTION_OPTIONS = [
		{ value: 'encrypt', label: '加密' },
		{ value: 'decrypt', label: '解密' }
	] as const;

	const verb = $derived(caesar.direction === 'encrypt' ? '加密' : '解密');
	const inputHeading = $derived(caesar.direction === 'encrypt' ? '明文' : '密文');
	const outputHeading = $derived(caesar.direction === 'encrypt' ? '密文' : '明文');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="caesar-toolbar" role="group" aria-label="凯撒密码参数" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="caesar-direction-label">方向</span>
			<SegmentedControl
				aria-labelledby="caesar-direction-label"
				options={DIRECTION_OPTIONS}
				value={caesar.direction}
				onchange={(v) => caesar.setDirection(v)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>位移（0-25）</span>
			<div class="flex items-center gap-2">
				<!-- Input 自带 w-full，宽度得由外层约束；relative 给 sr-only 的 label 当定位上下文 -->
				<span class="relative block w-20">
					<Input
						size="sm"
						type="number"
						min="0"
						max="25"
						label="位移量"
						value={String(caesar.shift)}
						oninput={(event) => caesar.setShift(Number(event.currentTarget.value))}
					/>
				</span>
				<Button label="设为 ROT13（位移 13）" title="ROT13" onclick={() => caesar.setShift(13)}>ROT13</Button>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例" title="示例" onclick={() => caesar.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入" title="清空" onclick={() => caesar.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
		</div>
	</div>

	<!-- 位移对照表：一行横排、横向滚动，不换行（换行会让面板高度跟着内容变） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class={STRIP} tabindex="0" role="region" aria-label={`${verb}位移对照表`}>
		<span class={STRIP_LABEL}>{verb}映射</span>
		{#each caesar.table as row (row.from)}
			<span class={STRIP_ITEM}>{row.from}→{row.to}</span>
		{/each}
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="caesar-input-panel"
			headingId="caesar-input-heading"
			heading={inputHeading}
			headingExtra={`${caesar.input.length} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="caesar-input"
				label={inputHeading}
				bind:value={caesar.input}
				placeholder={`在此输入要${verb}的文本…`}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">只动拉丁字母，数字、标点与中文原样保留；大小写跟着原字母。</p>
				</div>
			{/snippet}
		</EditorPane>

		<EditorPane
			fullscreen
			id="caesar-output-panel"
			headingId="caesar-output-heading"
			heading={outputHeading}
			headingExtra={`${caesar.output.length} 字符`}
			empty={`输入文本后这里出${outputHeading}`}
			ready={caesar.output !== ''}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#snippet actions()}
				<Button
					size="xs"
					label="复制结果"
					title="复制"
					disabled={caesar.output === ''}
					onclick={() => void caesar.copyOutput()}
				>
					<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				<p class="min-w-0 text-sm leading-6 break-all whitespace-pre-wrap text-gray-900">{caesar.output}</p>
			</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={caesar.statusTone} truncate>{caesar.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
