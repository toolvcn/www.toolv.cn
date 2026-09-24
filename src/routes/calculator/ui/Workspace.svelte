<script lang="ts">
	// 科学计算器主界面：一条表达式输入（回车或点「计算」入历史）+ 一排插入按钮 + 下面「结果 / 历史」两块。
	//
	// 输入与结果同屏、跟着敲跟着算：本页没有「等号才算」的概念，结果面板始终是**当前**表达式的结果，
	// 「计算」这个按钮唯一的作用是把它记进历史。
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { TOOLBAR, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { SNIPPETS } from '../core/calc.ts';
	import { calcStore } from '../core/store.svelte.ts';
	import HistoryPanel from './HistoryPanel.svelte';
	import ResultPanel from './ResultPanel.svelte';

	const ANGLE_OPTIONS: ReadonlyArray<{ value: 'deg' | 'rad'; label: string }> = [
		{ value: 'deg', label: '角度' },
		{ value: 'rad', label: '弧度' }
	];

	const currentAngle = $derived(calcStore.deg ? 'deg' : 'rad');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- form 只为让回车提交（Svelte 的 Button 渲染成 type="button"，点它不会带出提交），
	     所以「计算」按钮自己挂 onclick —— 两条路径都走到 store.submit() -->
	<form
		id="calc-toolbar"
		class={TOOLBAR}
		onsubmit={(event) => {
			event.preventDefault();
			calcStore.submit();
		}}
	>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<label class={TOOLBAR_LABEL} for="calc-expr">表达式</label>
			<Input
				id="calc-expr"
				mono
				size="sm"
				bind:value={calcStore.expr}
				invalid={calcStore.error !== ''}
				autocomplete="off"
				spellcheck="false"
				placeholder="(12 + 8) * 3 / 2^2"
			/>
		</div>

		<div class="flex shrink-0 flex-wrap items-end gap-2 md:ml-auto">
			<div class="flex flex-col gap-1">
				<span class={TOOLBAR_LABEL} id="calc-angle-label">三角函数按</span>
				<SegmentedControl
					aria-labelledby="calc-angle-label"
					options={ANGLE_OPTIONS}
					value={currentAngle}
					onchange={(value) => calcStore.setDeg(value === 'deg')}
				/>
			</div>
			<!-- 可见文字「计算」就是无障碍名称（label 会盖掉文案，读屏听到的就跟看到的不一致了）；
			     那句「记进历史」放在 title 里当补充说明 -->
			<Button label="计算" title="把这条算式与结果记进历史" onclick={() => calcStore.submit()}>计算</Button>
			<Button label="清空表达式" title="清空" onclick={() => calcStore.clear()}>清空</Button>
		</div>
	</form>

	<div class="flex flex-wrap gap-2" role="group" aria-label="插入函数、常量与括号">
		{#each SNIPPETS as snippet (snippet.text)}
			<Button size="sm" label={`插入 ${snippet.label}`} onclick={() => calcStore.insert(snippet.text)}>
				{snippet.label}
			</Button>
		{/each}
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
		<ResultPanel />
		<HistoryPanel />
	</div>
</div>

<Toast />
