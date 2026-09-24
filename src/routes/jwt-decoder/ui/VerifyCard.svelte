<script lang="ts">
	// 验签卡：填入密钥（HS 共享密钥 / RS 公钥）后点「验签」，结论以徽章 + 状态条给出。
	// 密钥只在内存里参与计算，不写 localStorage、不上传 —— 卡片里明说，免得用户以为上传了。
	//
	// HS 与 RS 共用同一个输入框：换控件会在改 token 时把已填的密钥和焦点一起丢掉，
	// 两档的差异只在提示行与那个 Base64 开关。
	import { Eraser, ShieldCheck } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { FOOTER_BAR } from '$lib/ui/styles';
	import { VERIFY_HINT, VERIFY_KEY_TEXTAREA, VERIFY_RESULT, VERIFY_ROW } from './styles.ts';
	import { jwtStore } from '../core/store.svelte.ts';

	const alg = $derived(jwtStore.algorithm);
	const family = $derived(jwtStore.verifyFamily);
	const snapshot = $derived(jwtStore.verifySnapshot);

	// 条件文案与配色一律在脚本里算好：class 属性里的三元会被 prettier 拆断而静默失效
	const keyLabel = $derived(family === 'rsa' ? 'RSA 公钥' : '共享密钥');
	const keyPlaceholder = $derived(
		family === 'rsa' ? '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----' : '签发方手里那把共享密钥'
	);
	const signatureTone = $derived(
		snapshot?.status === 'valid' ? 'ok' : snapshot?.status === 'invalid' ? 'error' : 'neutral'
	);
	const signatureLabel = $derived(
		snapshot === null
			? '未验签'
			: snapshot.status === 'valid'
				? '有效'
				: snapshot.status === 'invalid'
					? '无效'
					: snapshot.status === 'error'
						? '出错'
						: '算法不支持'
	);
	const expireTone = $derived(snapshot?.expired === true ? 'warn' : snapshot?.expired === false ? 'ok' : 'neutral');
	const expireLabel = $derived(
		snapshot === null || snapshot.expired === null ? 'payload 未给 exp' : snapshot.expired ? '已过期' : '有效期内'
	);
	const canClear = $derived(jwtStore.key !== '' || snapshot !== null);
</script>

<PanelCard id="jwt-verify" headingId="jwt-verify-heading" heading="验签" class="min-h-0 min-w-0">
	{#snippet headingExtra()}
		<Badge tone="info" mono>{alg === '' ? '缺少 alg' : alg}</Badge>
	{/snippet}
	{#snippet actions()}
		<Button
			label="用当前密钥验签"
			title="验签"
			size="xs"
			variant="primary"
			disabled={!jwtStore.canVerify}
			onclick={() => jwtStore.verify()}
		>
			<ShieldCheck class="size-3.5" aria-hidden="true" />验签
		</Button>
		<Button
			label="清除密钥与验签结果"
			title="清除"
			size="xs"
			disabled={!canClear}
			onclick={() => jwtStore.clearVerify()}
		>
			<Eraser class="size-3.5" aria-hidden="true" />清除
		</Button>
	{/snippet}

	<div class="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
		<div class="flex min-w-0 flex-col gap-2">
			<EditorBox>
				<Textarea
					id="jwt-verify-key"
					mono
					size="sm"
					label={keyLabel}
					bind:value={jwtStore.key}
					rows={3}
					autocomplete="off"
					spellcheck="false"
					placeholder={keyPlaceholder}
					class={VERIFY_KEY_TEXTAREA}
				/>
			</EditorBox>
			{#if family === 'hmac'}
				<Checkbox
					bind:checked={jwtStore.base64Secret}
					label="密钥是 Base64 编码"
					title="勾上后先把密钥按 Base64 解成字节再做 HMAC；明文密钥不要勾"
				/>
			{:else if family === 'rsa'}
				<p class={VERIFY_HINT}>
					支持 BEGIN PUBLIC KEY（SPKI）与 BEGIN RSA PUBLIC KEY（PKCS#1，现场包成 SPKI）；JWK 与证书链暂不支持。
				</p>
			{:else}
				<p class={VERIFY_HINT}>
					{jwtStore.isEmpty
						? '先在上方粘贴 JWT，验签需要它自带的 alg'
						: `暂不支持 ${alg === '' ? '未知算法' : alg}，目前只验 HS256/384/512 与 RS256/384/512`}
				</p>
			{/if}
			<p class={VERIFY_HINT}>密钥只在本页内存里参与计算，不写入本地存储，也不会随 token 上传。</p>
		</div>

		<div class={VERIFY_RESULT}>
			<div class={VERIFY_ROW}>
				<span class="text-xs text-gray-600">算法</span>
				<Badge tone="neutral" mono>{alg === '' ? '—' : alg}</Badge>
			</div>
			<div class={VERIFY_ROW}>
				<span class="text-xs text-gray-600">签名</span>
				<Badge tone={signatureTone} size="sm">{signatureLabel}</Badge>
			</div>
			<div class={VERIFY_ROW}>
				<span class="text-xs text-gray-600">过期结论</span>
				<Badge tone={expireTone} size="sm">{expireLabel}</Badge>
			</div>
			{#if snapshot !== null}
				<p class={VERIFY_HINT}>{snapshot.message}</p>
			{:else}
				<p class={VERIFY_HINT}>验签需要密钥，本页不代你保管，也没有任何默认密钥。</p>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={jwtStore.verifyTone} truncate>{jwtStore.verifyText}</StatusPill>
		</div>
	{/snippet}
</PanelCard>
