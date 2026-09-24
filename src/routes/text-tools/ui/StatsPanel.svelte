<script lang="ts">
	// 「文本统计」标签：左输入、右统计卡片，数字随输入实时刷新。
	// 各口径的说明来自 STAT_ITEMS，放在卡片 title 里悬浮可见。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import { textStore } from '../core/store.svelte.ts';
	import { STAT_ITEMS } from '../core/types.ts';
	import { FOOTER_BAR, EDITOR_INPUT } from '$lib/ui/styles';
	import { PANEL_BODY_SCROLL } from './styles.ts';

	// 千分位分组展示。显式 locale，node 与浏览器的输出一致，不担心 hydration 差异
	const nf = new Intl.NumberFormat('zh-CN');

	// 头部的一句话摘要：读屏与速览都先看这里，卡片明细是补充
	const summary = $derived(`共 ${nf.format(textStore.stats.chars)} 字符、${nf.format(textStore.stats.words)} 字`);
</script>

<!-- 输入 / 统计双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
	<!-- 输入区 -->
	<EditorPane
		fullscreen
		id="text-stats-input"
		headingId="text-stats-input-heading"
		heading="输入"
		class="relative min-w-0 flex-1 md:min-h-0"
	>
		{#snippet actions()}
			<Button
				label="填入一段覆盖中英文、数字、多段落的示例文本"
				title="填入示例"
				size="xs"
				onclick={() => textStore.loadStatsExample()}
			>
				<Lightbulb class="size-3.5" />示例
			</Button>
			<Button label="清空输入框" title="清空输入框" size="xs" onclick={() => textStore.clearStatsInput()}>
				<Eraser class="size-3.5" />清空
			</Button>
		{/snippet}
		<Textarea
			id="text-stats-input-area"
			mono
			label="要统计的文本"
			bind:value={textStore.statsInput}
			placeholder="粘贴要统计的文本，数字随输入实时刷新"
			class={EDITOR_INPUT}
		/>
		{#snippet footer()}
			<div class={FOOTER_BAR}>
				<p class="truncate text-xs text-gray-600">示例 / 清空在卡片右上角</p>
			</div>
		{/snippet}
	</EditorPane>

	<!-- 统计结果区 -->
	<PanelCard
		fullscreen
		id="text-stats-result"
		headingId="text-stats-result-heading"
		heading="统计结果"
		class="relative min-w-0 flex-1 md:min-h-0"
	>
		{#if textStore.statsEmpty}
			<!-- 空态给明确指引，不显示一排 0 -->
			<div class="flex flex-1 items-center justify-center p-6">
				<p class="max-w-64 text-center text-sm text-gray-600">
					输入文本后，这里会按字符、字数、行数等口径给出统计，各口径的算法见每张卡片的悬浮说明。
				</p>
			</div>
		{:else}
			{@const s = textStore.stats}
			<div class="{PANEL_BODY_SCROLL} grid grid-cols-2 content-start gap-2 p-3 lg:grid-cols-3">
				{#each STAT_ITEMS as item (item.key)}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-3" title={item.description}>
						<p class="text-xl font-semibold text-gray-900 tabular-nums">{nf.format(s[item.key])}</p>
						<p class="mt-0.5 text-xs text-gray-600">{item.label}</p>
					</div>
				{/each}
			</div>
		{/if}
		<!-- 摘要挂脚注：它是运行态文字，读屏与速览都从这里拿 -->
		<div class={FOOTER_BAR}>
			<StatusPill truncate>{textStore.statsEmpty ? '尚未输入文本' : summary}</StatusPill>
		</div>
	</PanelCard>
</div>
