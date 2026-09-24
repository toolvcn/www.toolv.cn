<script lang="ts">
	// 假文工作区：工具条放语言 / 粒度 / 数量 / 生成，下方整块输出。
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy } from '@lucide/svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { generatorStore } from '../core/store.svelte.ts';
	import { COUNT_MAX, QUICK_COUNTS } from '../config.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';

	const hasOutput = $derived(generatorStore.loremOutput !== '');
	const countInvalid = $derived(generatorStore.loremCountInvalid);

	const langOptions = [
		{ value: 'latin', label: '拉丁文', description: '经典 Lorem ipsum，占位文本的事实标准' },
		{ value: 'zh', label: '中文', description: '常用字随机组句，中文排版占位用' }
	];
	const modeOptions = [
		{ value: 'sentences', label: '按句子', description: 'N 句连成一段' },
		{ value: 'paragraphs', label: '按段落', description: 'N 段，每段 3-6 句' }
	];

	const outputLines = $derived(hasOutput ? generatorStore.loremOutput.split('\n').length : 0);

	/** 快捷数量按钮样式 */
	const quickBtn =
		'inline-flex h-7 shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：语言 / 粒度 / 数量在左，操作 md:ml-auto 靠右 -->
	<div id="lorem-toolbar" role="group" aria-label="假文生成操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="lorem-lang-label">语言</span>
			<Dropdown
				label="假文语言"
				size="sm"
				options={langOptions}
				value={generatorStore.loremLang}
				onSelect={(value) => (generatorStore.loremLang = value as typeof generatorStore.loremLang)}
			/>
		</div>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="lorem-mode-label">粒度</span>
			<Dropdown
				label="假文粒度"
				size="sm"
				options={modeOptions}
				value={generatorStore.loremMode}
				onSelect={(value) => (generatorStore.loremMode = value as typeof generatorStore.loremMode)}
			/>
		</div>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="lorem-count">数量</label>
			<div class="flex flex-wrap items-center gap-1.5">
				<div class="w-24">
					<Input
						id="lorem-count"
						mono
						size="sm"
						inputmode="numeric"
						bind:value={generatorStore.loremCountText}
						invalid={countInvalid}
					/>
				</div>
				{#each QUICK_COUNTS as n (n)}
					<button
						type="button"
						class={quickBtn}
						onclick={() => generatorStore.setLoremCount(n)}
						aria-label={`一键填入数量 ${n}`}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button
				label="复制假文全文"
				title="复制全文"
				size="sm"
				disabled={!hasOutput}
				onclick={() => void generatorStore.copyLorem()}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制全文
			</Button>
			<Button
				variant="primary"
				label="生成假文"
				title="生成"
				size="sm"
				disabled={countInvalid}
				onclick={() => void generatorStore.generateLorem()}
			>
				生成
			</Button>
		</div>
	</div>

	<Panel id="lorem-panel" headingId="lorem-panel-heading" heading="占位假文" class="relative min-h-0 flex-1">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>{hasOutput ? `${outputLines} 段/行` : '待生成'}</span>
		{/snippet}

		{#if hasOutput}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<p class="p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-900">{generatorStore.loremOutput}</p>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<EmptyState class="max-w-72">选语言和粒度点「生成」，输出整块占位文本。</EmptyState>
			</div>
		{/if}

		<div class={FOOTER_BAR}>
			<StatusPill tone={countInvalid ? 'error' : 'neutral'} truncate
				>{countInvalid ? `数量要是 1-${COUNT_MAX} 的整数。` : '拉丁假文以经典 Lorem ipsum 开头起手。'}</StatusPill
			>
		</div>
	</Panel>
</div>
