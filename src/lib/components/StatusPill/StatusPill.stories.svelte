<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { FOOTER_BAR, type StatusTone } from '$lib/ui/styles';
	import StatusPill from './StatusPill.svelte';

	const { Story } = defineMeta({ title: 'UI/StatusPill', component: StatusPill });

	const TONES: StatusTone[] = ['neutral', 'info', 'ok', 'warn', 'error'];
</script>

<!-- 五档语义配色各一条，放进 FOOTER_BAR 看真实版式 -->
{#snippet tones()}
	<div class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white shadow-sm">
		{#each TONES as tone (tone)}
			<div class={FOOTER_BAR}>
				<StatusPill {tone}>{tone}：等待输入 / 计算中 / 校验通过 / 有降级 / 语法有误</StatusPill>
			</div>
		{/each}
	</div>
{/snippet}

<!-- 单条成功态：最常见用法 -->
{#snippet success()}
	<div class={FOOTER_BAR}>
		<StatusPill tone="ok">JSON 合法</StatusPill>
	</div>
{/snippet}

<!-- 长文案不截断时换行，卡片高度会被撑开 -->
{#snippet longText()}
	<div class={FOOTER_BAR}>
		<StatusPill tone="error">第 3 行第 5 列附近：Unexpected token } in JSON at position 27</StatusPill>
	</div>
{/snippet}

<!-- 加 truncate 后固定一行，超出省略（脚注是 h-9，长文案必须截断） -->
{#snippet truncated()}
	<div class={FOOTER_BAR}>
		<StatusPill tone="error" truncate>第 3 行第 5 列附近：Unexpected token } in JSON at position 27</StatusPill>
	</div>
{/snippet}

<!-- 覆盖 aria-live：紧急错误立刻打断读屏 -->
{#snippet assertive()}
	<div class={FOOTER_BAR}>
		<StatusPill tone="error" aria-live="assertive">连接已断开</StatusPill>
	</div>
{/snippet}

<Story name="Tones" template={tones} />
<Story name="Success" template={success} />
<Story name="LongText" template={longText} />
<Story name="Truncated" template={truncated} />
<Story name="Assertive" template={assertive} />
