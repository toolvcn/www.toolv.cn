<script lang="ts">
	// 命名风格转换主界面：顶部通栏工具条（标识符 / 示例 / 清空），下方七种风格逐行列出。
	// 版式与 json-formatter 一致：输入与操作集中在工具条，结果卡片只放数据。
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { caseStore } from '../core/store.svelte.ts';
	import type { CaseRow } from '../core/types.ts';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_LABEL } from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	function onCopy(row: CaseRow): void {
		void caseStore.copyRow(row);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：标识符占满左侧，示例 / 清空 md:ml-auto 靠右 -->
	<div id="case-toolbar" role="group" aria-label="命名风格转换操作" class={TOOLBAR}>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<label class={TOOLBAR_LABEL} for="case-input-area">标识符</label>
			<Input
				id="case-input-area"
				mono
				size="sm"
				bind:value={caseStore.input}
				autocapitalize="off"
				autocomplete="off"
				placeholder="myVariableName / my-variable-name / my_variable_name / my variable name"
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例文本" title="示例" onclick={() => caseStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => caseStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
		</div>
	</div>

	<!-- 七种风格一次列出，逐行复制 -->
	<Panel id="case-output" headingId="case-output-heading" heading="全部风格" class="min-h-0 flex-1">
		{#snippet headingExtra()}
			<span class={PANEL_HINT}>{caseStore.inputCount} 字符</span>
		{/snippet}
		<ul class="min-h-0 flex-1 divide-y divide-gray-200 overflow-y-auto">
			{#each caseStore.rows as row (row.style)}
				<ResultRow>
					<!-- 风格名下带一行常用场景说明，选哪种一眼就有数 -->
					<div class="w-32 min-w-0 shrink-0 sm:w-52">
						<div class="truncate text-xs font-medium text-gray-900">{row.label}</div>
						<div class="truncate text-xs text-gray-600" title="常用场景：{row.scenario}">
							{row.scenario}
						</div>
					</div>
					<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900" title={row.output}>
						{row.output === '' ? '—' : row.output}
					</span>
					<Button icon label="复制 {row.label} 的转换结果" onclick={() => onCopy(row)}>
						<Copy class="size-3.5" aria-hidden="true" />
					</Button>
				</ResultRow>
			{/each}
		</ul>
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">输入任意风格，自动分词后按七种风格输出</p>
		</div>
	</Panel>
</div>

<Toast />
