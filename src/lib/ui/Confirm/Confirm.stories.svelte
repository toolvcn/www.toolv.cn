<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Confirm from './Confirm.svelte';

	const { Story } = defineMeta({
		title: 'UI/Confirm',
		component: Confirm
	});
</script>

<script lang="ts">
	import { ConfirmState } from '$lib/ui/confirm.svelte';

	/**
	 * 造一个已经打开的状态：`Confirm` 的 `$effect` 会在挂载后自己 `showModal()`。
	 * 不调 `ask()` 是因为那要 await —— story 里拿不到返回值，还多一个悬着的 promise。
	 */
	function asking(message: string, confirmLabel = '确定'): ConfirmState {
		const state = new ConfirmState();
		state.message = message;
		state.confirmLabel = confirmLabel;
		state.open = true;
		return state;
	}

	const removePreset = asking('确定删除「订单号 + 商品成本」吗？删除后无法恢复。');
	const clearAll = asking('确定要清空全部参数吗？这一步不能撤销。', '清空');
	const longMessage = asking('「含测试文本的条目」里存了测试文本，会覆盖你当前编辑的文本。是否覆盖？', '覆盖');
</script>

{#snippet removeCase()}
	<Confirm confirm={removePreset} />
{/snippet}

{#snippet destructiveCase()}
	<Confirm confirm={clearAll} />
{/snippet}

{#snippet longCase()}
	<Confirm confirm={longMessage} />
{/snippet}

<Story name="删除确认" template={removeCase} />
<Story name="自定义确认文案" template={destructiveCase} />
<Story name="长文案" template={longCase} />
