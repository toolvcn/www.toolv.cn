<script lang="ts">
	// 能力探测：只回答支持 / 不支持，用徽章呈现，比一张全是「true / false」的表好扫。
	// 绿色 = 支持，灰色 = 这个浏览器没有；WebGL 那一项在开关打开时还带渲染器名（写在 title 里）。
	import Badge from '$lib/components/Badge/Badge.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { deviceStore } from '../core/store.svelte.ts';

	let { class: className = '' }: { class?: string } = $props();
</script>

<Panel id="device-capability" heading="能力探测" class={className}>
	{#if deviceStore.capabilities.length === 0}
		<p class="px-4 py-3 text-xs leading-5 text-gray-600">打开页面后自动读取这些能力，数据不会离开浏览器。</p>
	{:else}
		<ul class="flex flex-wrap gap-2 p-4">
			{#each deviceStore.capabilities as cap (cap.key)}
				<li>
					<Badge
						size="sm"
						tone={cap.ok ? 'ok' : 'neutral'}
						title={`${cap.label}：${cap.ok ? '支持' : '不支持'}${cap.detail === '' ? '' : ` · ${cap.detail}`}`}
					>
						{cap.label}
					</Badge>
				</li>
			{/each}
		</ul>
	{/if}

	{#snippet footer()}
		<div class="border-t border-gray-200 px-4 py-2">
			<p class="text-[11px] leading-4 text-gray-600">绿色为支持，灰色为当前浏览器不支持。</p>
		</div>
	{/snippet}
</Panel>
