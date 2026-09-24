<script lang="ts">
	// 维吉尼亚密码工作区：工具条（方向 + 密钥）→ 密钥预览条 → 明文 / 密文双栏。
	// 同样是纯函数派生：改密钥或改文本结果立刻跟着变。
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { EDITOR_INPUT, FOOTER_BAR, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { VIGENERE_KEY_MAX } from '../config.ts';
	import { cryptoStore } from '../core/store.svelte.ts';
	import { STRIP, STRIP_LABEL } from './styles.ts';

	const vigenere = cryptoStore.vigenere;

	const DIRECTION_OPTIONS = [
		{ value: 'encrypt', label: '加密' },
		{ value: 'decrypt', label: '解密' }
	] as const;

	const verb = $derived(vigenere.direction === 'encrypt' ? '加密' : '解密');
	const inputHeading = $derived(vigenere.direction === 'encrypt' ? '明文' : '密文');
	const outputHeading = $derived(vigenere.direction === 'encrypt' ? '密文' : '明文');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="vigenere-toolbar" role="group" aria-label="维吉尼亚密码参数" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="vigenere-direction-label">方向</span>
			<SegmentedControl
				aria-labelledby="vigenere-direction-label"
				options={DIRECTION_OPTIONS}
				value={vigenere.direction}
				onchange={(v) => vigenere.setDirection(v)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>密钥（只取字母）</span>
			<!-- Input 自带 w-full，宽度得由外层约束；relative 给 sr-only 的 label 当定位上下文 -->
			<span class="relative block w-40 sm:w-56">
				<Input
					size="sm"
					mono
					maxlength={VIGENERE_KEY_MAX}
					label="维吉尼亚密钥"
					bind:value={vigenere.key}
					placeholder="如 LEMON"
				/>
			</span>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例" title="示例" onclick={() => vigenere.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入" title="清空" onclick={() => vigenere.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
		</div>
	</div>

	<!-- 密钥预览：密钥按字母位置重复铺开、与原文逐位对齐（非字母位置保留原字符） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class={STRIP} tabindex="0" role="region" aria-label="密钥重复预览">
		<span class={STRIP_LABEL}>密钥重复</span>
		{#if vigenere.flow === ''}
			<span class={STRIP_LABEL}
				>{vigenere.error === '' ? '输入文本后这里显示密钥怎么重复' : '密钥里至少要有一个字母'}</span
			>
		{:else}
			<span class="shrink-0 font-mono text-xs whitespace-pre text-gray-900">{vigenere.flow}</span>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="vigenere-input-panel"
			headingId="vigenere-input-heading"
			heading={inputHeading}
			headingExtra={`${vigenere.input.length} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="vigenere-input"
				label={inputHeading}
				bind:value={vigenere.input}
				placeholder={`在此输入要${verb}的文本…`}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">
						只动拉丁字母，非字母原样保留且不消耗密钥位；密钥按字母位置循环复用。
					</p>
				</div>
			{/snippet}
		</EditorPane>

		<EditorPane
			fullscreen
			id="vigenere-output-panel"
			headingId="vigenere-output-heading"
			heading={outputHeading}
			headingExtra={`${vigenere.output.length} 字符`}
			empty={`输入文本后这里出${outputHeading}`}
			ready={vigenere.output !== ''}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#snippet actions()}
				<Button
					size="xs"
					label="复制结果"
					title="复制"
					disabled={vigenere.output === ''}
					onclick={() => void vigenere.copyOutput()}
				>
					<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				<p class="min-w-0 text-sm leading-6 break-all whitespace-pre-wrap text-gray-900">{vigenere.output}</p>
			</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={vigenere.statusTone} truncate>{vigenere.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
