<script lang="ts">
	// 哈希工具的主界面：顶部通栏工具条（结果大小写 / 示例 / 清空），下方输入、结果双栏。
	// 版式与 json-formatter 一致：操作集中在工具条，编辑区无边框，状态走卡片脚注。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import { hashStore } from '../core/store.svelte.ts';
	import { ALGORITHMS, HASH_BITS, isInsecure } from '../core/types.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import {
		FOOTER_BAR,
		EDITOR_INPUT,
		PANEL_HINT,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	const CASE_OPTIONS = [
		{ value: 'lower', label: 'a' },
		{ value: 'upper', label: 'A' }
	] as const;

	// 五个摘要一起算，逐条出现；播报只说算完几条，避免每条都打断读屏。
	// 环境缺 WebCrypto 时只剩 MD5 能算，这时不能再报「正在计算」——那是不会完成的进度
	const progressText = $derived(
		hashStore.input.trim() === ''
			? '输入内容后自动计算'
			: hashStore.unsupported
				? `仅算出 ${hashStore.computedCount}/${ALGORITHMS.length} 个（当前环境缺 WebCrypto）`
				: hashStore.computedCount === ALGORITHMS.length
					? `已同步 ${ALGORITHMS.length} 个算法`
					: `正在计算 ${hashStore.computedCount}/${ALGORITHMS.length}…`
	);
	const progressTone = $derived(
		hashStore.input.trim() === '' || hashStore.unsupported || hashStore.computedCount === ALGORITHMS.length
			? 'neutral'
			: 'info'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：大小写在左，操作 md:ml-auto 靠右 -->
	<div id="hash-toolbar" role="group" aria-label="哈希计算操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="hash-case-group-label">结果大小写</span>
			<SegmentedControl
				aria-labelledby="hash-case-group-label"
				options={CASE_OPTIONS}
				value={hashStore.hexCase}
				onchange={(v) => hashStore.setHexCase(v)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例文本" title="示例" onclick={() => hashStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => hashStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
		</div>
	</div>

	<!-- 输入 / 结果双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="hash-input-panel"
			headingId="hash-input-heading"
			heading="输入内容"
			headingExtra={`${hashStore.charCount} 字符 · ${hashStore.byteCount} 字节`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="hash-input"
				mono
				label="待哈希的文本"
				bind:value={hashStore.input}
				placeholder="在此输入要计算摘要的文本…"
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">摘要随输入实时重算，WebCrypto 本地完成，不联网。</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 结果区：逐算法一行，行尾复制。正文是列表不是编辑器，bare 关掉输入框外框 -->
		<EditorPane
			fullscreen
			id="hash-result-panel"
			headingId="hash-result-heading"
			heading="计算结果"
			headingExtra={`${ALGORITHMS.length} 种算法`}
			bare
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<div class="min-h-0 flex-1 overflow-y-auto">
				<ul class="divide-y divide-gray-200">
					{#each ALGORITHMS as algorithm (algorithm)}
						<li class="flex flex-col gap-2 px-4 py-3">
							<div class="flex items-center justify-between gap-2">
								<h3 class="flex items-center gap-2 text-xs font-semibold text-gray-900">
									<span>{algorithm}</span>
									<span class="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600"
										>{HASH_BITS[algorithm]} 位</span
									>
									{#if isInsecure(algorithm)}
										<span class="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">已不安全</span>
									{/if}
								</h3>
								<Button
									label="复制 {algorithm} 结果"
									title="复制"
									size="xs"
									disabled={hashStore.digests[algorithm] === ''}
									onclick={() => void hashStore.copyDigest(algorithm)}
								>
									<Copy class="size-3.5" aria-hidden="true" />复制
								</Button>
							</div>
							<p class="min-w-0 font-mono text-sm leading-6 break-all text-gray-900">
								{#if hashStore.digests[algorithm] === ''}
									<span class={PANEL_HINT}>—</span>
								{:else}
									{hashStore.digestText(algorithm)}
								{/if}
							</p>
						</li>
					{/each}
				</ul>

				{#if hashStore.unsupported}
					<p class="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
						当前环境不支持 WebCrypto（需要 HTTPS 或 localhost），SHA 系列算法无法计算；MD5 为本地自实现，不受影响。
					</p>
				{/if}
			</div>

			{#snippet footer()}
				<!-- 底部状态条：进度是运行态文字，挂 role=status 给读屏 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={progressTone}>{progressText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
