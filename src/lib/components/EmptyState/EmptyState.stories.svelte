<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EmptyState from './EmptyState.svelte';

	const { Story } = defineMeta({
		title: 'UI/EmptyState',
		component: EmptyState
	});
</script>

<Story name="Default">还没有定时任务</Story>

{#snippet longText()}
	<EmptyState>还没有预设，点右上角「添加预设」新建；想留到下次用就点「保存到本地」</EmptyState>
{/snippet}

<!-- class 透传：外边距这类位置由调用方决定，组件只管自身外观 -->
{#snippet withClass()}
	<EmptyState class="m-4">自定义外边距</EmptyState>
{/snippet}

<!-- rest 透传：aria-live 让读屏在内容出现时播报 -->
{#snippet ariaLive()}
	<EmptyState aria-live="polite">结果会实时更新</EmptyState>
{/snippet}

<Story name="长文案" template={longText} />
<Story name="带附加类" template={withClass} />
<Story name="AriaLive" template={ariaLive} />
