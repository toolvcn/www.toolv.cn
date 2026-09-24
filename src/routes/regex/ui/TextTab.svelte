<script lang="ts">
	// 测试文本标签页：透明 textarea 叠在镜像高亮层上，边打字边着色。
	// 两层共用 styles.ts 里的 EDITOR_TYPE（字体 / 行高 / 内边距 / 断行 / 滚动条占位），
	// 任一项不一致高亮就会整片飘走；滚动只由 textarea 负责，镜像层跟着挪 scrollTop。
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { EDITOR_INPUT, EDITOR_MIRROR, HIGHLIGHT_EVEN, HIGHLIGHT_ODD } from './styles.ts';
	import { TAB_TOOLBAR } from '$lib/ui/styles';

	let mirror = $state<HTMLDivElement | null>(null);

	// 镜像层末尾补一个换行：文本以换行结尾时 textarea 会多出一行，不补高亮会错位
	const TRAILING_NEWLINE = '\n';

	const hasError = $derived(regexStore.result.error !== null);
	const countText = $derived(
		hasError
			? '正则非法，修正后这里显示匹配。'
			: regexStore.input === ''
				? '输入测试文本，这里实时标出匹配。'
				: regexStore.matchCount === 0
					? '没有匹配。'
					: `${regexStore.matchCount} 个匹配${regexStore.result.truncated ? `（已达上限，后面的没再数）` : ''}`
	);

	function syncScroll(event: Event & { currentTarget: HTMLTextAreaElement }): void {
		if (mirror) mirror.scrollTop = event.currentTarget.scrollTop;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class={TAB_TOOLBAR}>
		<span class="text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
		<Button label="清空测试文本" title="清空测试文本" size="xs" onclick={() => regexStore.clearInput()}>清空</Button>
	</div>

	<!-- relative 给 sr-only 的 label 用；编辑区高度移动端固定，桌面交回栅格行。
	     lg 下也留 `min-h-32` 而不是 min-h-0：栅格行有 16rem 下限，但那点高度还要分给标签条与
	     工具条，全交给 flex-1 在矮视口里仍有被压扁的余地 —— 这里是最后一道地板。 -->
	<div class="relative flex min-h-0 flex-1 flex-col p-4">
		<label for="regex-text-input" class="sr-only">测试文本</label>
		<EditorBox class="h-56 lg:h-auto lg:min-h-32 lg:flex-1">
			<div bind:this={mirror} class={EDITOR_MIRROR} aria-hidden="true">
				{#each regexStore.result.tokens as token, i (i)}
					{#if token.matchIndex === null}{token.text}{:else}<span
							class={token.matchIndex % 2 === 0 ? HIGHLIGHT_EVEN : HIGHLIGHT_ODD}>{token.text}</span
						>{/if}
				{/each}
				{TRAILING_NEWLINE}
			</div>
			<!-- 这个 textarea **刻意不用 <Textarea>**：它的文字是透明的（看到的字来自上面的镜像层），
			     必须与 EDITOR_MIRROR 逐字共用 EDITOR_TYPE 才能保证两层不断行位置一致。
			     组件那套底色 / 字色 / 焦点环在这里全不适用。 -->
			<textarea
				id="regex-text-input"
				bind:value={regexStore.input}
				spellcheck="false"
				autocomplete="off"
				placeholder="把要扫描的文本粘到这里"
				onscroll={syncScroll}
				class={EDITOR_INPUT}></textarea>
		</EditorBox>
	</div>
</div>
