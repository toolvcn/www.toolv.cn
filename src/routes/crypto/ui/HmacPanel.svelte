<script lang="ts">
	// HMAC 工作区：工具条（密钥 + 格式 / 算法 / 输出格式 + 操作）→ 消息与结果双栏。
	//
	// 这一页是**实时重算**的：只有密钥与算法两个旋钮，没有方向与模式要先定，边打边出比按按钮顺手
	// （与哈希工具同一个口径）。$effect 放在面板里而不是 +page.svelte —— 切到别的标签就卸载，
	// 不会在别人工作区里空转（哈希那页只有一块面板，所以它写在页面上）。
	import { Copy, Dices, Eraser, Lightbulb } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { EDITOR_INPUT, FOOTER_BAR, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { HMAC_ALGORITHM_OPTIONS, DATA_FORMAT_OPTIONS } from '../config.ts';
	import { cryptoStore } from '../core/store.svelte.ts';
	import type { ByteFormat, HmacAlgorithm, OutFormat } from '../core/types.ts';
	import { RESULT_TEXT } from './styles.ts';

	const hmac = cryptoStore.hmac;

	const KEY_FORMAT_OPTIONS = [
		{ value: 'text', label: '文本' },
		{ value: 'hex', label: 'Hex' },
		{ value: 'base64', label: 'Base64' }
	] as const;

	// 密钥、消息、算法、格式任一变化就重算；refresh 内部有竞态序号，晚回来的旧结果会作废
	$effect(() => {
		void hmac.refresh();
	});
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="hmac-toolbar" role="group" aria-label="HMAC 参数" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>密钥</span>
			<!-- Input 自带 w-full，宽度得由外层约束；relative 给 sr-only 的 label 当定位上下文 -->
			<div class="flex items-center gap-2">
				<span class="relative block w-40 sm:w-56">
					<Input size="sm" mono label="HMAC 密钥" bind:value={hmac.keyText} placeholder="密钥文本 / Hex / Base64" />
				</span>
				<SegmentedControl
					aria-label="密钥格式"
					options={KEY_FORMAT_OPTIONS}
					value={hmac.keyFormat}
					onchange={(v) => hmac.setKeyFormat(v as ByteFormat)}
				/>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>算法</span>
			<Dropdown
				label="摘要算法"
				size="sm"
				options={HMAC_ALGORITHM_OPTIONS}
				value={hmac.algorithm}
				onSelect={(v) => hmac.setAlgorithm(v as HmacAlgorithm)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="hmac-format-label">输出格式</span>
			<SegmentedControl
				aria-labelledby="hmac-format-label"
				options={DATA_FORMAT_OPTIONS}
				value={hmac.outputFormat}
				onchange={(v) => hmac.setOutputFormat(v as OutFormat)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="随机生成密钥" title="随机密钥" onclick={() => hmac.randomKey()}>
				<Dices class="size-4 shrink-0" aria-hidden="true" />随机
			</Button>
			<Button label="填入示例" title="示例" onclick={() => hmac.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空消息" title="清空" onclick={() => hmac.clearMessage()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="hmac-message-panel"
			headingId="hmac-message-heading"
			heading="消息"
			headingExtra={`${hmac.message.length} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="hmac-message"
				label="消息内容"
				bind:value={hmac.message}
				placeholder="在此输入要计算认证码的消息…"
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">消息、密钥或算法一变就重算，WebCrypto 本地完成，不联网。</p>
				</div>
			{/snippet}
		</EditorPane>

		<EditorPane
			fullscreen
			id="hmac-output-panel"
			headingId="hmac-output-heading"
			heading="HMAC"
			headingExtra={`HMAC-${hmac.algorithm}`}
			empty={hmac.error !== '' ? '出错了，原因见下面的状态条' : '填好密钥与消息后这里出认证码'}
			ready={hmac.output !== ''}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#snippet actions()}
				<Button
					size="xs"
					label="复制 HMAC 结果"
					title="复制"
					disabled={hmac.output === ''}
					onclick={() => void hmac.copyOutput()}
				>
					<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				<p class={RESULT_TEXT}>{hmac.output}</p>
			</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={hmac.statusTone} truncate>{hmac.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
