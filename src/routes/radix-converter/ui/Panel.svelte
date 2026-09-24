<script lang="ts">
	// 进制转换主界面：顶部通栏工具条（数值 / 输入进制 / 大写 / 示例），下方五种进制的实时结果。
	// 版式与 json-formatter 一致：控件集中在工具条，结果卡片只放数据，状态走脚注。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Lightbulb } from '@lucide/svelte';
	import { radixStore } from '../core/store.svelte.ts';
	import { BASE_LABEL, OUTPUT_BASES, SOURCE_BASES } from '../core/types.ts';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	/** 输入进制下拉：description 写进菜单行，光看数字看不出各进制的字符范围 */
	const SOURCE_OPTIONS = SOURCE_BASES.map((base) => ({
		value: String(base),
		label: `${base} 进制`,
		description: `${BASE_LABEL[base]}：允许 ${base === 36 ? '0-9 与 a-z' : `0-${base === 16 ? '9 与 a-f' : base - 1}`} 与可选正负号`
	}));

	const isValid = $derived(radixStore.value !== null);
	// 脚注三态：非法报错 / 空输入引导 / 已解析
	const statusText = $derived(
		radixStore.error !== ''
			? radixStore.error
			: radixStore.text.trim() === ''
				? '输入一个数值，下面实时给出各进制写法'
				: `已按${BASE_LABEL[radixStore.sourceBase]}解析，切换输入进制即时重算`
	);
	const statusTone = $derived(radixStore.error !== '' ? 'error' : 'neutral');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：数值 + 输入进制 + 大写在左，示例 md:ml-auto 靠右 -->
	<div id="radix-toolbar" role="group" aria-label="进制转换操作" class={TOOLBAR}>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<label class={TOOLBAR_LABEL} for="radix-input">数值</label>
			<Input
				id="radix-input"
				mono
				size="sm"
				inputmode="text"
				bind:value={radixStore.text}
				invalid={radixStore.error !== ''}
				placeholder="例如 255 或 ff"
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="radix-source-label">输入进制</span>
			<Dropdown
				label="输入进制"
				size="sm"
				options={SOURCE_OPTIONS}
				value={String(radixStore.sourceBase)}
				onSelect={(value) => radixStore.setSourceBase(Number(value) as (typeof SOURCE_BASES)[number])}
			/>
		</div>

		<div class="flex shrink-0 flex-wrap items-center gap-3 md:ml-auto">
			<Checkbox
				checked={radixStore.upperHex}
				title="十六进制等含字母的进制输出大写"
				onchange={() => radixStore.toggleUpper()}
			>
				大写字母
			</Checkbox>
			<Button label="填入示例数值" title="示例" onclick={() => radixStore.loadSample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
		</div>
	</div>

	<!-- 结果：五种进制各一行，行尾复制 -->
	<PanelCard id="radix-panel" headingId="radix-panel-heading" heading="各进制结果" class="relative min-h-0 flex-1">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>BigInt 运算，任意大整数都精确</span>
		{/snippet}

		<ul class="min-h-0 flex-1 divide-y divide-gray-200">
			{#each OUTPUT_BASES as base (base)}
				{@const output = radixStore.outputOf(base)}
				<ResultRow>
					<span class="w-20 shrink-0 text-xs font-medium text-gray-600">{BASE_LABEL[base]}</span>
					<p class="min-w-0 flex-1 font-mono text-sm leading-6 break-all text-gray-900">{output}</p>
					<CopyButton
						icon
						text={output}
						ok={`已复制${BASE_LABEL[base]}结果`}
						empty="还没有可复制的结果"
						isEmpty={(t) => t === '' || t === '—'}
						label={`复制${BASE_LABEL[base]}结果`}
						disabled={!isValid}
					/>
				</ResultRow>
			{/each}
		</ul>

		<!-- 固定高度脚注：解析状态与错误都在这里，不会把卡片撑高 -->
		<div class={FOOTER_BAR}>
			<StatusPill tone={statusTone} truncate>{statusText}</StatusPill>
		</div>
	</PanelCard>
</div>

<Toast />
