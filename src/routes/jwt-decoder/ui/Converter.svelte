<script lang="ts">
	// JWT 工具的主界面：整宽版式 —— 顶部一张通栏输入卡（示例 / 复制 / 清空并入标题行、
	// 状态走卡片脚注），下方 Header / Payload 与右列（注册声明 + 签名）铺满整宽。
	// 所有状态从 store 读写，这里只做渲染与事件分发。
	import { Copy, Eraser, Lightbulb, ArrowUp } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { EDITOR_FRAME_PAD, FOOTER_BAR, JSON_TOKEN_CLASS, OUTPUT_EMPTY, PANEL_HINT } from '$lib/ui/styles';
	import { CLAIM_LIST, CLAIM_ROW, JSON_BOX, JSON_PRE, TOKEN_TEXTAREA } from './styles.ts';
	import { jwtStore } from '../core/store.svelte.ts';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import VerifyCard from './VerifyCard.svelte';

	// 派生视图先在脚本里算好：class 属性里不写裸三元（prettier 拆行后条件会静默失效）
	const isEmpty = $derived(jwtStore.isEmpty);
	const hasError = $derived(!isEmpty && jwtStore.error !== '');
	const hasResult = $derived(jwtStore.result.header !== null && jwtStore.result.payload !== null);
	const headerTokens = $derived(jwtStore.result.header?.tokens ?? []);
	const payloadTokens = $derived(jwtStore.result.payload?.tokens ?? []);
	const signatureText = $derived(jwtStore.result.signature);
	const algorithm = $derived(jwtStore.algorithm);

	// 状态条文案：空态、错误、正常三选一（AGENTS：空态与错误不能都写「暂无数据」）
	const statusText = $derived(
		isEmpty
			? '在上方粘贴 JWT，三段内容会实时解出显示在下方'
			: hasError
				? jwtStore.error
				: '解码成功 · 签名是否可信看下方「验签」卡（需自备密钥）'
	);
	const statusTone = $derived(isEmpty ? 'neutral' : hasError ? 'error' : 'ok');
	// 两个 JSON 面板的空态文案共用一套判断，只差段落名
	const headerEmptyText = $derived(isEmpty ? 'Header 会解出显示在这里' : '解码出错，Header 暂无内容');
	const payloadEmptyText = $derived(isEmpty ? 'Payload 会解出显示在这里' : '解码出错，Payload 暂无内容');
	const claimsEmptyText = $derived(isEmpty ? '注册声明会解出显示在这里' : '解码出错，暂无注册声明');
	const signatureEmptyText = $derived(
		isEmpty ? '签名段会原样显示在这里' : hasError ? '解码出错，签名暂无内容' : '未提供签名（alg 为 none 的不安全 JWT）'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 输入 + 验签：lg 起并排（左粘 token、右填密钥）、两块等高；小屏仍上下堆叠。
	     并排是这段的定高段（shrink-0），把纵向高度让给下面的结果区 -->
	<div class="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- 输入卡：操作收进标题行（省掉一条通栏工具条），状态条走卡片脚注 -->
		<PanelCard id="jwt-input" headingId="jwt-input-heading" heading="JWT 原文" class="min-h-0 min-w-0">
			{#snippet headingExtra()}
				<span class={PANEL_HINT}>{jwtStore.tokenCount} 字符</span>
			{/snippet}
			{#snippet actions()}
				<Button label="填入示例 JWT" title="示例" size="xs" onclick={() => jwtStore.loadExample()}>
					<Lightbulb class="size-3.5" aria-hidden="true" />示例
				</Button>
				<Button
					label="复制 JWT 原文"
					title="复制原文"
					size="xs"
					disabled={isEmpty}
					onclick={() => jwtStore.copyToken()}
				>
					<Copy class="size-3.5" aria-hidden="true" />复制
				</Button>
				<Button label="清空输入" title="清空" size="xs" onclick={() => jwtStore.clearInput()}>
					<Eraser class="size-3.5" aria-hidden="true" />清空
				</Button>
			{/snippet}
			<div class={EDITOR_FRAME_PAD}>
				<EditorBox>
					<Textarea
						id="jwt-token"
						mono
						label="JWT 原文"
						bind:value={jwtStore.token}
						autocomplete="off"
						placeholder="粘贴 header.payload.signature 三段式 JWT"
						class={TOKEN_TEXTAREA}
					/>
				</EditorBox>
			</div>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone} truncate>{statusText}</StatusPill>
				</div>
			{/snippet}
		</PanelCard>

		<!-- 验签卡：解码只是「读内容」，可信与否要另给密钥才算，所以单独一块、与输入并排 -->
		<VerifyCard />
	</div>

	<!-- 解码结果：吃掉剩余高度（宽屏不留白），lg 起两列、xl 起四列（Header 1 / Payload 2 / 右列 1）铺满整宽 -->
	<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
		<PanelCard id="jwt-header" headingId="jwt-header-heading" heading="Header" class="min-h-0 min-w-0">
			{#snippet headingExtra()}
				{#if algorithm !== ''}
					<Badge tone="info" mono>{algorithm}</Badge>
				{/if}
			{/snippet}
			{#snippet actions()}
				<Button
					label="复制 Header 的 JSON 文本"
					title="复制 Header JSON"
					size="xs"
					disabled={!hasResult}
					onclick={() => jwtStore.copyJson('header')}
				>
					<Copy class="size-3.5" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
			     svelte 的静态规则不认识 role="region"，这里放行 -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class={JSON_BOX} tabindex="0" role="region" aria-label="Header JSON">
				{#if hasResult}
					<CodeView tokens={headerTokens} classMap={JSON_TOKEN_CLASS} class={JSON_PRE} />
				{:else}
					<p class={OUTPUT_EMPTY}>{headerEmptyText}</p>
				{/if}
			</div>
		</PanelCard>

		<PanelCard id="jwt-payload" headingId="jwt-payload-heading" heading="Payload" class="min-h-0 min-w-0 xl:col-span-2">
			{#snippet actions()}
				<Button
					label="复制 Payload 的 JSON 文本"
					title="复制 Payload JSON"
					size="xs"
					disabled={!hasResult}
					onclick={() => jwtStore.copyJson('payload')}
				>
					<Copy class="size-3.5" aria-hidden="true" />复制
				</Button>
			{/snippet}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class={JSON_BOX} tabindex="0" role="region" aria-label="Payload JSON">
				{#if hasResult}
					<CodeView tokens={payloadTokens} classMap={JSON_TOKEN_CLASS} class={JSON_PRE} />
				{:else}
					<p class={OUTPUT_EMPTY}>{payloadEmptyText}</p>
				{/if}
			</div>
		</PanelCard>

		<!-- 右列：lg 与 Payload 并排时两块横向铺开，xl 收成窄列后上下堆叠 -->
		<div class="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-2 lg:flex-row xl:col-span-1 xl:flex-col">
			<PanelCard id="jwt-claims" headingId="jwt-claims-heading" heading="注册声明" class="min-h-0 min-w-0 flex-1">
				{#snippet headingExtra()}
					<span class={PANEL_HINT}>RFC 7519</span>
				{/snippet}
				<!-- 声明表依赖 now（客户端才有）：SSR 阶段 claims 为空且 now=0，两个分支都不渲染，
				     hydration 后才有表或空态，避免把「没有注册声明」烘进 HTML -->
				{#if jwtStore.claims.length > 0}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class={CLAIM_LIST} tabindex="0" role="region" aria-label="注册声明表">
						<dl class="divide-y divide-gray-100">
							{#each jwtStore.claims as row (row.key)}
								<div class={CLAIM_ROW}>
									<dt class="shrink-0 text-xs text-gray-600">{row.label}</dt>
									<dd class="flex min-w-0 items-center gap-2 text-right text-xs">
										<span class="min-w-0 font-mono break-all text-gray-900">{row.value}</span>
										{#if row.expired === true}
											<Badge tone="error" size="sm">已过期</Badge>
										{:else if row.expired === false}
											<Badge tone="ok" size="sm">有效中</Badge>
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{:else if jwtStore.now !== 0}
					<p class="flex flex-1 items-center justify-center px-4 py-6 text-center text-xs leading-5 text-gray-600">
						{isEmpty || hasError ? claimsEmptyText : 'Payload 里没有注册声明，自定义声明看 Payload 面板'}
					</p>
				{/if}
			</PanelCard>

			<PanelCard
				id="jwt-signature"
				headingId="jwt-signature-heading"
				heading="Signature"
				class="min-h-0 min-w-0 flex-1"
			>
				{#snippet headingExtra()}
					<Badge tone="info" class="gap-1"><ArrowUp class="size-3" aria-hidden="true" />见上方验签卡</Badge>
				{/snippet}
				<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
					{#if signatureText !== ''}
						<p class="font-mono text-xs break-all text-gray-900 sm:text-sm">{signatureText}</p>
						<p class="mt-2 text-xs text-gray-600">
							签名原文如上；是否可信取决于上方验签结果 —— 填入密钥后才下结论，密钥不会离开本机。
						</p>
					{:else}
						<p class="flex flex-1 items-center justify-center text-center text-xs text-gray-600">
							{signatureEmptyText}
						</p>
					{/if}
				</div>
			</PanelCard>
		</div>
	</div>
</div>

<Toast />
