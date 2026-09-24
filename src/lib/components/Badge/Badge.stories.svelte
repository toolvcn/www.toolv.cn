<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { BadgeTone } from '$lib/ui/styles';
	import Badge from './Badge.svelte';

	const { Story } = defineMeta({ title: 'UI/Badge', component: Badge });

	const TONES: BadgeTone[] = ['neutral', 'info', 'ok', 'warn', 'error'];
</script>

<!-- 五档语义配色，md 档（h-7） -->
{#snippet tones()}
	<div class="flex flex-wrap items-center gap-2">
		{#each TONES as tone (tone)}
			<Badge {tone}>{tone}</Badge>
		{/each}
	</div>
{/snippet}

<!-- 面板标题行里的响应状态徽章：max-w-40 防长状态文本挤爆标题行 -->
{#snippet responseStatus()}
	<div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
		<span class="text-sm font-semibold text-gray-900">响应</span>
		<Badge tone="ok" class="max-w-40"><span class="truncate">200 OK</span></Badge>
		<Badge tone="info" class="max-w-40"><span class="truncate">301 Moved Permanently</span></Badge>
		<Badge tone="error" class="max-w-40"><span class="truncate">500 Internal Server Error</span></Badge>
		<Badge tone="neutral" class="max-w-40"><span class="truncate">102 Processing</span></Badge>
	</div>
{/snippet}

<!-- 状态码速查：等宽 + min-w-11，三位数不抖宽 -->
{#snippet codeBadges()}
	<div class="flex flex-wrap items-center gap-2">
		<Badge mono class="min-w-11" tone="neutral">100</Badge>
		<Badge mono class="min-w-11" tone="ok">200</Badge>
		<Badge mono class="min-w-11" tone="info">301</Badge>
		<Badge mono class="min-w-11" tone="warn">404</Badge>
		<Badge mono class="min-w-11" tone="error">500</Badge>
	</div>
{/snippet}

<!-- sm 档（h-6）：贴在结果行里，跟行内的小控件同高 -->
{#snippet inRow()}
	<ul class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
		<li class="flex min-w-0 items-center gap-3 px-4 py-2">
			<span class="w-28 shrink-0 truncate text-xs text-gray-600">米</span>
			<span class="min-w-0 flex-1 truncate text-right font-mono text-sm text-gray-900">1</span>
			<Badge size="sm" tone="info">输入</Badge>
		</li>
		<li class="flex min-w-0 items-center gap-3 px-4 py-2">
			<span class="w-28 shrink-0 truncate text-xs text-gray-600">英尺</span>
			<span class="min-w-0 flex-1 truncate text-right font-mono text-sm text-gray-900">3.28084</span>
			<span class="inline-flex size-6 shrink-0 items-center justify-center"> </span>
		</li>
	</ul>
{/snippet}

<Story name="Tones" template={tones} />
<Story name="ResponseStatus" template={responseStatus} />
<Story name="CodeBadges" template={codeBadges} />
<Story name="InRow" template={inRow} />
