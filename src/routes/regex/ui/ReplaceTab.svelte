<script lang="ts">
	// 文本替换标签页：输入替换串（支持 $1 / $<name> / $& / $` / $'），输出整段替换结果。
	// 结果区是只读 textarea，超长文本同样可滚，复制交给右上角按钮。
	import { Copy } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { TAB_TOOLBAR } from '$lib/ui/styles';

	const hasError = $derived(regexStore.replaceResult.error !== null);
	const statusText = $derived(
		hasError
			? '正则非法，修正后这里显示替换结果。'
			: regexStore.pattern === ''
				? '输入正则后这里实时替换。'
				: `已替换 ${regexStore.replaceResult.count} 处`
	);
	const showError = $derived(regexStore.replaceResult.error);
	const canCopy = $derived(!hasError && regexStore.pattern !== '');
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class={TAB_TOOLBAR}>
		<span class="text-xs text-gray-600" role="status" aria-live="polite">{statusText}</span>
		{#if canCopy}
			<Button icon label="复制替换结果" title="复制结果" onclick={() => void regexStore.copyReplaced()}>
				<Copy class="size-3.5" />
			</Button>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-3 p-4">
		<div class="flex flex-col gap-1">
			<label for="regex-replace-input" class="text-xs font-medium text-gray-600">替换为</label>
			<Input
				id="regex-replace-input"
				mono
				bind:value={regexStore.replacement}
				autocomplete="off"
				placeholder="$1  $&  $<name>  $`  $'"
			/>
			<p class="text-[11px] leading-4 text-gray-600">
				$1 引用第 1 组，$&lt;name&gt; 引用命名组，$&amp; 引用整段匹配，$` 与 $' 引用匹配前后；留空表示删除匹配部分。
			</p>
		</div>

		{#if showError}
			<p class="text-xs text-red-700">{showError}</p>
		{/if}

		<div class="flex min-h-0 flex-1 flex-col gap-1">
			<span class="text-xs font-medium text-gray-600">替换结果</span>
			<EditorBox invalid={hasError} class="h-56 lg:h-auto lg:min-h-0 lg:flex-1">
				<!-- 焦点环与错误红边都由 EditorBox 表达，控件不画自己的边框 / 焦点环 -->
				<Textarea
					id="regex-replace-output"
					mono
					label="替换结果"
					readonly
					value={regexStore.replaceResult.output}
					placeholder="替换结果会实时出现在这里"
					class="h-full [scrollbar-gutter:stable] break-words break-all whitespace-pre-wrap"
				/>
			</EditorBox>
		</div>
	</div>
</div>
