<script lang="ts">
	// 人民币大写主界面：金额输入、大写结果、填写要点三张卡。
	// 单列居中，但外壳宽度走 full —— 内容靠内层 max-w 收窄，跟其它工具的外壳口径一致。
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { rmbStore } from '../core/store.svelte.ts';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	// 三种输出状态先在脚本里算好，避免 class 属性里写裸三元（prettier 拆行会静默失效）
	const isEmpty = $derived(rmbStore.input.trim() === '');
	const hasError = $derived(!isEmpty && rmbStore.error !== '');

	/** 填写要点：把票据规范的常见坑写成短句，用户不用猜输出为什么长这样 */
	const RULES = [
		'「10」写作壹拾，拾位前不省略「壹」',
		'数字中间的连续零只写一个「零」',
		'角分都为 0 结尾加「整」；角为 0 分不为 0 写「零X分」',
		'第三位小数自动四舍五入到分，支持千分位逗号与负数'
	];
</script>

<!-- 内容单列居中：金额输入短、大写结果也只占一两行，双栏反而空旷 -->
<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
	<!-- 金额输入 -->
	<Panel id="rmb-input" headingId="rmb-input-heading" heading="金额" class="shrink-0">
		{#snippet actions()}
			<Button label="填入示例金额 1,234,567.89" title="填入示例金额" size="xs" onclick={() => rmbStore.loadExample()}>
				<Lightbulb class="size-3.5" />示例
			</Button>
			<Button label="清空金额输入框" title="清空输入框" size="xs" onclick={() => rmbStore.clearInput()}>
				<Eraser class="size-3.5" />清空
			</Button>
		{/snippet}
		<!-- relative 是给 Input 的 sr-only label 用的：它是 absolute，没有定位上下文会撑高文档 -->
		<div class="relative flex flex-col gap-2 p-4">
			<!-- inputmode=decimal 让手机直接弹数字键盘；输入实时派生大写结果，无需提交按钮 -->
			<Input
				id="rmb-amount"
				size="lg"
				mono
				inputmode="decimal"
				autocomplete="off"
				bind:value={rmbStore.input}
				placeholder="如 1,234.56"
				label="金额数字"
			/>
			<p class="text-xs text-gray-600">支持千分位逗号、最多两位小数，第三位小数自动四舍五入。</p>
		</div>
	</Panel>

	<!-- 大写结果：空态 / 错误 / 结果三态切换，容器常驻渲染保证读屏播报不断 -->
	<Panel id="rmb-output" headingId="rmb-output-heading" heading="大写结果" class="shrink-0">
		{#snippet actions()}
			<Button
				label="复制大写结果"
				title="复制大写结果"
				variant="primary"
				size="xs"
				disabled={rmbStore.output === ''}
				onclick={() => rmbStore.copyOutput()}
			>
				<Copy class="size-3.5" />复制
			</Button>
		{/snippet}
		<div class="flex min-h-28 items-center p-4">
			<!-- role=status 常驻：三态都从这播报；结果本身用大字号居中呈现 -->
			<div role="status" aria-live="polite" class="w-full">
				{#if isEmpty}
					<p class="text-sm text-gray-600">在上方输入金额，这里实时显示票据大写。</p>
				{:else if hasError}
					<p class="text-sm text-red-700">{rmbStore.error}</p>
				{:else}
					<p class="text-xl leading-relaxed font-semibold tracking-wider wrap-break-word text-gray-900 sm:text-2xl">
						{rmbStore.output}
					</p>
				{/if}
			</div>
		</div>
	</Panel>

	<!-- 填写要点：两列短句，说明输出为什么长这样 -->
	<Panel id="rmb-rules" headingId="rmb-rules-heading" heading="填写要点" class="shrink-0">
		<ul class="grid grid-cols-1 gap-x-6 gap-y-1.5 p-4 text-xs text-gray-600 sm:grid-cols-2">
			{#each RULES as rule (rule)}
				<li class="flex items-start gap-1.5">
					<span aria-hidden="true" class="mt-1.5 size-1 shrink-0 rounded-full bg-blue-600"></span>
					{rule}
				</li>
			{/each}
		</ul>
	</Panel>
</div>

<Toast />
