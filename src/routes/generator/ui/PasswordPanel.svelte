<script lang="ts">
	// 密码工作区：工具条放长度 / 数量 / 字符集 / 生成，下方逐行结果，强度按熵实时估算。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy } from '@lucide/svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { generatorStore } from '../core/store.svelte.ts';
	import { COUNT_MAX, PASS_LENGTH_MAX, PASS_LENGTH_MIN, QUICK_COUNTS } from '../config.ts';
	import { RESULT_TEXT } from './styles.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';

	const lines = $derived(generatorStore.passLines);
	const hasLines = $derived(lines.length > 0);
	const lengthInvalid = $derived(generatorStore.passLengthInvalid);
	const countInvalid = $derived(generatorStore.passCountInvalid);
	const customChars = $derived(generatorStore.passCustomCharset);
	const customInvalid = $derived(generatorStore.passCustomCharsetText.trim() !== '' && customChars === '');

	// class 属性里不写三元（prettier 拆行会静默失效），强度文字色放脚本算
	const strengthColor = $derived.by(() => {
		const label = generatorStore.passStrength.label;
		if (label === '极弱') return 'text-red-700';
		if (label === '弱') return 'text-amber-700';
		if (label === '中等') return 'text-gray-900';
		return 'text-emerald-700';
	});
	// 脚注文案：自定义无效 / 字符集空 / 长度非法 / 数量非法优先，其余给默认说明
	// 区间数字一律从 config 取（只此一处），改上限不会漏改提示句
	const hintText = $derived(
		customInvalid
			? '自定义字符集去重后为空，请输入有效字符。'
			: generatorStore.passClassCount === 0
				? '至少勾选一类字符或填写自定义字符集。'
				: lengthInvalid
					? `长度要是 ${PASS_LENGTH_MIN}-${PASS_LENGTH_MAX} 的整数。`
					: countInvalid
						? `数量要是 1-${COUNT_MAX} 的整数。`
						: '每类字符保底出现一次，打乱后输出。自定义字符集去重后追加。'
	);
	const hintError = $derived(customInvalid || generatorStore.passClassCount === 0 || lengthInvalid || countInvalid);

	/** 快捷数量按钮的样式：轻量 chip，h-7（比工具条按钮的 h-8 矮一档）但更紧凑。shrink-0 防窄屏被挤压 */
	const quickBtn =
		'inline-flex h-7 shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：长度 / 数量 / 字符集 / 自定义字符集在左，操作 md:ml-auto 靠右 -->
	<div id="password-toolbar" role="group" aria-label="密码生成操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="pass-length">长度（{PASS_LENGTH_MIN}-{PASS_LENGTH_MAX}）</label>
			<div class="w-24">
				<Input
					id="pass-length"
					mono
					size="sm"
					inputmode="numeric"
					bind:value={generatorStore.passLengthText}
					invalid={lengthInvalid}
				/>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="pass-count">数量</label>
			<div class="flex flex-wrap items-center gap-1.5">
				<div class="w-20 sm:w-24">
					<Input
						id="pass-count"
						mono
						size="sm"
						inputmode="numeric"
						bind:value={generatorStore.passCountText}
						invalid={countInvalid}
					/>
				</div>
				{#each QUICK_COUNTS as n (n)}
					<button
						type="button"
						class={quickBtn}
						onclick={() => generatorStore.setPassCount(n)}
						aria-label={`一键填入数量 ${n}`}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>字符集</span>
			<div class="flex min-h-8 flex-wrap items-center gap-3">
				<Checkbox bind:checked={generatorStore.passLower}>小写 a-z</Checkbox>
				<Checkbox bind:checked={generatorStore.passUpper}>大写 A-Z</Checkbox>
				<Checkbox bind:checked={generatorStore.passDigits}>数字 0-9</Checkbox>
				<Checkbox bind:checked={generatorStore.passSymbols}>符号</Checkbox>
				<Checkbox bind:checked={generatorStore.passAvoid} title="排除 0 O o 1 l I | 这些肉眼难分的字符">
					排除易混淆
				</Checkbox>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="pass-custom">自定义字符（追加）</label>
			<div class="w-full md:w-48">
				<Input
					id="pass-custom"
					mono
					size="sm"
					placeholder="如 !@#$"
					bind:value={generatorStore.passCustomCharsetText}
					invalid={customInvalid}
				/>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button
				label="复制全部密码"
				title="复制全部"
				size="sm"
				disabled={!hasLines}
				onclick={() => void generatorStore.copyAllLines(lines)}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制全部
			</Button>
			<Button
				variant="primary"
				label="生成密码"
				title="生成"
				size="sm"
				disabled={!generatorStore.passValid}
				onclick={() => void generatorStore.generatePasswords()}
			>
				生成
			</Button>
		</div>
	</div>

	<Panel id="password-panel" headingId="password-panel-heading" heading="密码" class="relative min-h-0 flex-1">
		{#snippet headingExtra()}
			<!-- 强度是运行态指标，跟条数并排放在标题右侧 -->
			<span class="text-xs font-medium {strengthColor}">
				强度：{generatorStore.passStrength.label}（约 {generatorStore.passStrength.bits} 位熵）
			</span>
			<span class={PANEL_HINT}>{hasLines ? `${lines.length} 条` : '待生成'}</span>
		{/snippet}

		{#if hasLines}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<ul class="divide-y divide-gray-200">
					{#each lines as line, index (index)}
						<ResultRow>
							<span class={RESULT_TEXT}>{line}</span>
							<CopyButton icon text={line} ok="已复制这条密码" label="复制第 {index + 1} 条密码" />
						</ResultRow>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<EmptyState class="max-w-72">配好字符集点「生成」，强度按字符池估算熵值。</EmptyState>
			</div>
		{/if}

		<div class={FOOTER_BAR}>
			<StatusPill tone={hintError ? 'error' : 'neutral'} truncate>{hintText}</StatusPill>
		</div>
	</Panel>
</div>
