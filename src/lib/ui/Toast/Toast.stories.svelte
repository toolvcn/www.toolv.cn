<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Toast from './Toast.svelte';

	const { Story } = defineMeta({
		title: 'UI/Toast',
		component: Toast
	});
</script>

<script lang="ts">
	import { ToastState } from '$lib/ui/toast.svelte';

	/**
	 * 直接写字段而不是调 show()：show() 会起 2 秒定时器，
	 * story 里来不及看清楚就消失了，那样看不出版式。
	 */
	function shown(message: string, tone: 'neutral' | 'error' = 'neutral'): ToastState {
		const state = new ToastState();
		state.message = message;
		state.tone = tone;
		state.visible = true;
		return state;
	}

	const neutral = shown('已复制输出结果');
	const failed = shown('复制失败，请手动选中复制', 'error');
	const long = shown('已为 #3 新增一条定时发送任务，间隔 5000 毫秒');
</script>

{#snippet bottom()}
	<Toast toast={neutral} />
{/snippet}

{#snippet errorTone()}
	<Toast toast={failed} />
{/snippet}

<!-- 顶部定位：底部有输入区的页面（websocket）用，避开输入框 -->
{#snippet topPosition()}
	<Toast toast={neutral} position="top" />
{/snippet}

{#snippet longMessage()}
	<Toast toast={long} />
{/snippet}

<Story name="默认底部居中" template={bottom} />
<Story name="错误态" template={errorTone} />
<Story name="顶部定位" template={topPosition} />
<Story name="长文案" template={longMessage} />
