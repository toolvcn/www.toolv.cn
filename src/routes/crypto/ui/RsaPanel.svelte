<script lang="ts">
	// RSA 工作区：工具条（操作 + 模数 + 执行）→ 密钥对卡（私钥 / 公钥两栏）→ 输入 / 结果双栏。
	//
	// 四种操作各有自己需要的那把钥匙，所以在密钥标签上挂一个「本次使用」徽章 ——
	// 不然用户得自己推「验签到底要公钥还是私钥」。
	import { Copy, Eraser, KeyRound, Lightbulb, WandSparkles } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import {
		EDITOR_INPUT,
		FOOTER_BAR,
		PANEL_HINT,
		TOOLBAR,
		TOOLBAR_ACTIONS,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL
	} from '$lib/ui/styles';
	import { RSA_MODULUS_OPTIONS, RSA_OPERATION_OPTIONS } from '../config.ts';
	import { cryptoStore } from '../core/store.svelte.ts';
	import type { RsaOperation } from '../core/types.ts';
	import { RESULT_TEXT } from './styles.ts';

	const rsa = cryptoStore.rsa;

	/** 每种操作需要的钥匙、输入框文案与一句口径说明 */
	const META: Record<
		RsaOperation,
		{ input: string; placeholder: string; run: string; footer: string; key: 'private' | 'public' }
	> = {
		encrypt: {
			input: '明文',
			placeholder: '在此输入要加密的明文…',
			run: '加密',
			footer: '公钥加密：RSA-OAEP + SHA-256，单次能封的明文上限 = 密钥字节数 − 66。',
			key: 'public'
		},
		decrypt: {
			input: '密文（Base64）',
			placeholder: '在此粘贴 Base64 密文…',
			run: '解密',
			footer: '私钥解密：密文长度必须正好等于密钥字节数。',
			key: 'private'
		},
		sign: {
			input: '待签名内容',
			placeholder: '在此输入要签名的原文…',
			run: '签名',
			footer: '私钥签名：RSASSA-PKCS1-v1_5 + SHA-256，输出 Base64 签名。',
			key: 'private'
		},
		verify: {
			input: '原文',
			placeholder: '在此输入原文（签名在下面一栏）…',
			run: '验签',
			footer: '公钥验签：原文与签名都要填，两者有一处对不上就是「签名无效」。',
			key: 'public'
		}
	};

	const meta = $derived(META[rsa.operation]);
	const emptyText = $derived(rsa.error !== '' ? '出错了，原因见下面的状态条' : '结果会显示在这里');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="rsa-toolbar" role="group" aria-label="RSA 参数" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="rsa-operation-label">操作</span>
			<SegmentedControl
				aria-labelledby="rsa-operation-label"
				options={RSA_OPERATION_OPTIONS}
				value={rsa.operation}
				onchange={(v) => rsa.setOperation(v)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>生成时的模数</span>
			<Dropdown
				label="密钥模数长度"
				size="sm"
				options={RSA_MODULUS_OPTIONS}
				value={String(rsa.modulusLength)}
				onSelect={(v) => rsa.setModulus(v)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例内容" title="示例" onclick={() => rsa.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入" title="清空" onclick={() => rsa.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button
				variant="primary"
				label={`${meta.run}（RSA）`}
				disabled={rsa.busy || rsa.generating}
				onclick={() => void rsa.run()}
			>
				<KeyRound class="size-4 shrink-0" aria-hidden="true" />{meta.run}
			</Button>
		</div>
	</div>

	<!-- 密钥对：私钥与公钥各一栏，能从 openssl 或其它工具直接粘进来 -->
	<Panel heading="密钥对" headingId="rsa-key-heading" class="shrink-0">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>PKCS#8 私钥 / SPKI 公钥，与 openssl 通用</span>
		{/snippet}
		{#snippet actions()}
			<Button
				size="xs"
				variant="primary"
				label={rsa.generating ? '正在生成密钥对' : `生成 ${rsa.modulusLength} 位密钥对`}
				disabled={rsa.generating}
				onclick={() => void rsa.generate()}
			>
				<WandSparkles class="size-3.5 shrink-0" aria-hidden="true" />{rsa.generating ? '生成中…' : '生成密钥对'}
			</Button>
			<Button size="xs" label="复制私钥" title="复制私钥" onclick={() => void rsa.copyKey('private')}>
				<Copy class="size-3.5 shrink-0" aria-hidden="true" />私钥
			</Button>
			<Button size="xs" label="复制公钥" title="复制公钥" onclick={() => void rsa.copyKey('public')}>
				<Copy class="size-3.5 shrink-0" aria-hidden="true" />公钥
			</Button>
		{/snippet}

		<div class="grid gap-4 p-4 md:grid-cols-2">
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<label class={TOOLBAR_LABEL} for="rsa-private-key">私钥（PKCS#8）</label>
					{#if meta.key === 'private'}<Badge size="sm" tone="info">本次使用</Badge>{/if}
				</div>
				<EditorBox>
					<Textarea
						id="rsa-private-key"
						mono
						size="sm"
						resize="none"
						class="h-28"
						placeholder="-----BEGIN PRIVATE KEY-----"
						bind:value={rsa.privateKey}
					/>
				</EditorBox>
			</div>

			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<label class={TOOLBAR_LABEL} for="rsa-public-key">公钥（SPKI）</label>
					{#if meta.key === 'public'}<Badge size="sm" tone="info">本次使用</Badge>{/if}
				</div>
				<EditorBox>
					<Textarea
						id="rsa-public-key"
						mono
						size="sm"
						resize="none"
						class="h-28"
						placeholder="-----BEGIN PUBLIC KEY-----"
						bind:value={rsa.publicKey}
					/>
				</EditorBox>
			</div>
		</div>
	</Panel>

	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="rsa-input-panel"
			headingId="rsa-input-heading"
			heading={meta.input}
			headingExtra={`${rsa.input.length} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#if rsa.operation === 'verify'}
				<!-- 验签要多一段签名：固定在正文上方，正文仍占剩余高度，切操作不会引起高度跳变 -->
				<!-- relative：Textarea 的 label 是 sr-only（absolute），父级没有定位上下文会逃出裁剪 -->
				<div class="relative shrink-0 border-b border-gray-200 p-3">
					<EditorBox>
						<Textarea
							id="rsa-signature"
							size="sm"
							mono
							resize="none"
							class="h-20"
							label="签名（Base64）"
							placeholder="在此粘贴 Base64 签名…"
							bind:value={rsa.signature}
						/>
					</EditorBox>
				</div>
			{/if}
			<Textarea
				id="rsa-input"
				mono={rsa.operation === 'decrypt'}
				label={meta.input}
				bind:value={rsa.input}
				placeholder={meta.placeholder}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">{meta.footer}</p>
				</div>
			{/snippet}
		</EditorPane>

		<EditorPane
			fullscreen
			id="rsa-output-panel"
			headingId="rsa-output-heading"
			heading="结果"
			headingExtra={rsa.outcome === null ? '' : `${meta.run}完成`}
			empty={emptyText}
			ready={rsa.output !== ''}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#snippet actions()}
				<Button
					size="xs"
					label="复制结果"
					title="复制"
					disabled={rsa.output === ''}
					onclick={() => void rsa.copyOutput()}
				>
					<Copy class="size-3.5 shrink-0" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				<p class={RESULT_TEXT}>{rsa.output}</p>
			</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={rsa.statusTone} truncate>{rsa.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
