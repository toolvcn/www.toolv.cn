<script lang="ts">
	// AES 工作区：顶部工具条（方向 / 模式 + 执行）→ 密钥与 IV 参数卡 → 明文 / 密文双栏。
	// 密钥与 IV 的「格式」各自放在自己那一栏的标题行上（quiet 档分段），工具条就不再挤五行控件。
	import { Copy, Eraser, Lightbulb, Lock, Shuffle } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import {
		EDITOR_INPUT,
		FOOTER_BAR,
		OUTPUT_PRE,
		PANEL_HINT,
		TOOLBAR,
		TOOLBAR_ACTIONS,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL
	} from '$lib/ui/styles';
	import { AES_MODE_OPTIONS, DATA_FORMAT_OPTIONS, KEY_BYTE_OPTIONS } from '../config.ts';
	import { IV_HINT, IV_LENGTH } from '../core/aes.ts';
	import { cryptoStore } from '../core/store.svelte.ts';
	import type { AesMode, ByteFormat, OutFormat } from '../core/types.ts';

	const aes = cryptoStore.aes;

	const DIRECTION_OPTIONS = [
		{ value: 'encrypt', label: '加密' },
		{ value: 'decrypt', label: '解密' }
	] as const;

	// Quiet 档分段：跟 12px 的小标签同排，矮一档才不喧宾夺主（UI-STYLE §9）
	const KEY_FORMAT_OPTIONS = [
		{ value: 'text', label: '文本' },
		{ value: 'hex', label: 'Hex' },
		{ value: 'base64', label: 'Base64' }
	] as const;

	const runLabel = $derived(aes.direction === 'encrypt' ? '加密' : '解密');
	const FORMAT_LABEL: Record<OutFormat, string> = { hex: 'Hex', base64: 'Base64' };
	const formatName = $derived(FORMAT_LABEL[aes.dataFormat]);
	const inputHeading = $derived(aes.direction === 'encrypt' ? '明文' : `密文（${formatName}）`);
	const inputPlaceholder = $derived(
		aes.direction === 'encrypt' ? '在此输入要加密的明文…' : `在此粘贴要解密的密文（${formatName}）…`
	);
	const ivBytes = $derived(IV_LENGTH[aes.mode]);
	const emptyText = $derived(aes.error !== '' ? '出错了，原因见下面的状态条' : '结果会显示在这里');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：方向与模式是两个必须先定的旋钮，执行按钮靠右 -->
	<div id="aes-toolbar" role="group" aria-label="AES 参数" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="aes-direction-label">方向</span>
			<SegmentedControl
				aria-labelledby="aes-direction-label"
				options={DIRECTION_OPTIONS}
				value={aes.direction}
				onchange={(v) => aes.setDirection(v)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>模式</span>
			<Dropdown
				label="加密模式"
				size="sm"
				options={AES_MODE_OPTIONS}
				value={aes.mode}
				onSelect={(v) => aes.setMode(v as AesMode)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例" title="示例" onclick={() => aes.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入" title="清空" onclick={() => aes.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label={`${runLabel}（AES）`} disabled={aes.busy} onclick={() => void aes.run()}>
				<Lock class="size-4 shrink-0" aria-hidden="true" />{runLabel}
			</Button>
		</div>
	</div>

	<!-- 密钥与 IV：两栏，md 起并排；每栏标题行右边是自己的格式开关 -->
	<Panel heading="密钥与 IV" headingId="aes-key-heading" class="shrink-0">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>
				{aes.keyBytes === null ? '密钥待填' : `密钥 ${aes.keyBytes} 字节`} · {aes.mode} 需要 {ivBytes} 字节 IV
			</span>
		{/snippet}
		{#snippet actions()}
			<Dropdown
				label="随机生成密钥"
				triggerLabel="随机密钥"
				size="xs"
				options={KEY_BYTE_OPTIONS}
				value=""
				onSelect={(v) => aes.randomKey(Number(v))}
			/>
			<Button size="xs" label="随机生成 IV" title="随机 IV" onclick={() => aes.randomIv()}>
				<Shuffle class="size-3.5 shrink-0" aria-hidden="true" />随机 IV
			</Button>
		{/snippet}

		<div class="grid gap-4 p-4 md:grid-cols-2">
			<!-- relative：Input 的 label 是 sr-only（absolute），父级没有定位上下文会逃出裁剪 -->
			<div class="relative flex flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<span class={TOOLBAR_LABEL}>密钥</span>
					<SegmentedControl
						tone="quiet"
						aria-label="密钥格式"
						options={KEY_FORMAT_OPTIONS}
						value={aes.keyFormat}
						onchange={(v) => aes.setKeyFormat(v as ByteFormat)}
					/>
				</div>
				<Input label="AES 密钥" mono bind:value={aes.keyText} placeholder="16 / 24 / 32 字节 → AES-128 / 192 / 256" />
				<span class={PANEL_HINT}>长度决定档位：16 字节 = AES-128，24 = AES-192，32 = AES-256。</span>
			</div>

			<div class="relative flex flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<span class={TOOLBAR_LABEL}>IV / 计数器</span>
					<SegmentedControl
						tone="quiet"
						aria-label="IV 格式"
						options={DATA_FORMAT_OPTIONS}
						value={aes.ivFormat}
						onchange={(v) => aes.setIvFormat(v)}
					/>
				</div>
				<Input
					label="AES 的 IV"
					mono
					bind:value={aes.ivText}
					placeholder={`${ivBytes} 字节，共 ${ivBytes * 2} 个十六进制字符`}
				/>
				<span class={PANEL_HINT}>{IV_HINT[aes.mode]}。</span>
			</div>
		</div>
	</Panel>

	<!-- 明文 / 密文双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="aes-input-panel"
			headingId="aes-input-heading"
			heading={inputHeading}
			headingExtra={`${aes.inputBytes} 字节`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="aes-input"
				mono={aes.direction === 'decrypt'}
				label={inputHeading}
				bind:value={aes.input}
				placeholder={inputPlaceholder}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">
						参数改动后重新点一次「{runLabel}」；密钥与 IV 全程只在浏览器内存里。
					</p>
				</div>
			{/snippet}
		</EditorPane>

		<EditorPane
			fullscreen
			id="aes-output-panel"
			headingId="aes-output-heading"
			heading="结果"
			headingExtra={aes.outcome === null ? '' : `AES-${aes.outcome.bits} · ${aes.mode}`}
			empty={emptyText}
			ready={aes.output !== ''}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#snippet actions()}
				<Button
					size="xs"
					label="复制结果"
					title="复制"
					disabled={aes.output === ''}
					onclick={() => void aes.copyOutput()}
				>
					<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre class={OUTPUT_PRE} tabindex="0" role="region" aria-label="AES 结果">{aes.output}</pre>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={aes.statusTone} truncate>{aes.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
