<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FullscreenButton from './FullscreenButton.svelte';

	const { Story } = defineMeta({ title: 'UI/FullscreenButton', component: FullscreenButton });
</script>

<!-- story 里只渲染、不真的点它：点击会请求全屏，在 storybook 的 iframe 里可能被权限策略拒掉 -->
{#snippet idle()}
	<div class="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-4">
		<FullscreenButton target={() => null} name="响应" fullscreen={false} />
	</div>
{/snippet}

{#snippet active()}
	<div class="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-4">
		<FullscreenButton target={() => null} name="响应" fullscreen={true} />
	</div>
{/snippet}

<Story name="默认" template={idle} />
<Story name="已全屏" template={active} />
