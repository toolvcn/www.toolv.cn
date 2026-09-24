<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Check, Copy } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ResultRow from './ResultRow.svelte';

	const { Story } = defineMeta({ title: 'UI/ResultRow', component: ResultRow });

	const ROWS = [
		{ label: 'HEX', value: '#1f2937' },
		{ label: 'RGB', value: 'rgb(31, 41, 55)' },
		{ label: 'HSL', value: 'hsl(215, 28%, 17%)' }
	];
</script>

<!-- 常规档 md：px-4 py-2，宽名称列 + 等宽结果 + 行尾复制（generator / case / unit / radix 的形态） -->
{#snippet regular()}
	<ul class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
		{#each ROWS as row (row.label)}
			<ResultRow>
				<span class="w-20 shrink-0 text-xs font-medium text-gray-600">{row.label}</span>
				<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{row.value}</span>
				<Button icon label="复制 {row.label}"><Copy class="size-3.5" /></Button>
			</ResultRow>
		{/each}
	</ul>
{/snippet}

<!-- 紧凑档 sm：px-2 py-1.5，卡片里行多的时候用（color-converter 的形态） -->
{#snippet dense()}
	<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white p-2">
		{#each ROWS as row (row.label)}
			<ResultRow density="sm">
				<span class="w-10 shrink-0 text-xs font-semibold text-gray-600">{row.label}</span>
				<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{row.value}</span>
				<Button icon label="复制 {row.label}"><Copy class="size-3.5" /></Button>
			</ResultRow>
		{/each}
	</ul>
{/snippet}

<!-- 值右对齐 + 行首状态徽章（unit-converter 的形态） -->
{#snippet withBadge()}
	<ul class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
		{#each ROWS as row, index (row.label)}
			<ResultRow>
				<span class="w-28 shrink-0 truncate text-xs text-gray-600">{row.label}</span>
				<span class="min-w-0 flex-1 truncate text-right font-mono text-sm text-gray-900">{row.value}</span>
				{#if index === 0}
					<span
						class="inline-flex h-6 shrink-0 items-center rounded bg-blue-50 px-1.5 text-xs font-medium text-blue-700"
					>
						输入
					</span>
				{:else}
					<span class="inline-flex size-6 shrink-0 items-center justify-center"> </span>
				{/if}
				<Button icon label="复制 {row.label}"><Copy class="size-3.5" /></Button>
			</ResultRow>
		{/each}
	</ul>
{/snippet}

<!-- 长数值换行而不是截断（radix-converter 的大整数） -->
{#snippet wrappedValue()}
	<ul class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
		<ResultRow>
			<span class="w-20 shrink-0 text-xs font-medium text-gray-600">二进制</span>
			<p class="min-w-0 flex-1 font-mono text-sm leading-6 break-all text-gray-900">
				1111111111111111111111111111111111111111111111111111111111111111
			</p>
			<Button icon label="复制二进制结果"><Copy class="size-4" /></Button>
		</ResultRow>
	</ul>
{/snippet}

<!-- 行内不只放复制按钮时的形态 -->
{#snippet customTrailing()}
	<ul class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
		<ResultRow>
			<span class="w-24 shrink-0 text-xs font-medium text-gray-600">已生成</span>
			<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">550e8400-e29b-41d4-a716-446655440000</span>
			<span class="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700">
				<Check class="size-3.5" />已复制
			</span>
		</ResultRow>
	</ul>
{/snippet}

<Story name="Regular" template={regular} />
<Story name="Dense" template={dense} />
<Story name="WithBadge" template={withBadge} />
<Story name="WrappedValue" template={wrappedValue} />
<Story name="CustomTrailing" template={customTrailing} />
