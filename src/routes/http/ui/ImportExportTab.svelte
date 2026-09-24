<script lang="ts">
	// 导入 / 导出：与浏览器 DevTools、终端、其它工具之间搬运请求。
	//
	// 导入侧**自动识别格式**：DevTools 复制菜单里那五项形态各异，让用户先选格式是多此一举 ——
	// 从哪儿复制的、粘进来是什么，工具自己认（识别规则见 core/request-text.ts 的 detectFormat）。
	// 导出侧把当前请求（含参数表与认证注入后的请求头、请求体）生成成同一批格式。
	//
	// 与「代码生成」标签的分工：那边是**写进代码工程**的 8 种语言；这里是**在工具之间搬运**的
	// DevTools 复制格式。两边的 fetch 输出有意不同 —— 这边保留 DevTools 的样子
	// （mode / credentials / 双引号键），粘回 Console 或其它工具能直接用。
	import { WandSparkles } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import {
		FORMAT_OPTIONS,
		SUPPORTED_FORMATS_HINT,
		detectFormat,
		formatLabel,
		parseRequestText
	} from '../core/request-text.ts';
	import type { RequestTextFormat } from '../core/request-text.ts';
	import { httpStore } from '../core/store.svelte.ts';
	import { GENERATED_PRE, IMPORT_EDITOR } from './styles.ts';

	let parseError = $state('');

	/** 粘贴区内容的识别结果；没内容或认不出来时为 null */
	const detected = $derived(detectFormat(httpStore.importText));
	const detectedText = $derived.by(() => {
		if (httpStore.importText.trim() === '') return '粘贴后自动识别';
		return detected === null ? '认不出这是什么格式' : `识别为 ${formatLabel(detected)}`;
	});

	// placeholder 里有引号与换行，放模板里难写，挪到脚本里用 {expr} 传
	const importPlaceholder = `curl 'https://api.example.com/items' \\\n  -H 'accept: application/json'\n\n或 DevTools 里的 Copy as fetch / Copy as PowerShell，粘进来会自动识别`;

	function parse(): void {
		const result = parseRequestText(httpStore.importText);
		if (!result.ok) {
			parseError = result.error;
			return;
		}
		parseError = '';
		httpStore.applyParsedForm(result.form);
		toast.show(`已解析 ${formatLabel(result.format)} 并填入请求表单`);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- 导入。**移动端 `flex-none`**：这一层是 `flex-1 + min-h-0`，在定高的面板里与导出
	     对半分高度；可手机端没有定高（页面本身滚动），对半分出来的 297px 装不下
	     「提示 + 编辑器 + 按钮行」（约 344px），按钮行就被挤出区块、压在导出的下拉上。
	     移动端改成按内容排（`flex-none`），两段各自长够，页面滚动到底即可 -->
	<div class="flex min-h-0 flex-1 flex-col gap-2 p-4 max-lg:flex-none">
		<p class="text-[11px] leading-4 text-gray-600">
			粘贴 DevTools「Copy as …」或终端里复制出来的请求，识别出格式后填进请求表单。支持 {SUPPORTED_FORMATS_HINT}。
		</p>
		<EditorBox>
			<Textarea
				id="http-import-input"
				label="待解析的请求文本"
				mono
				textSize="text-xs leading-5"
				bind:value={httpStore.importText}
				placeholder={importPlaceholder}
				class={IMPORT_EDITOR}
			/>
		</EditorBox>
		{#if parseError !== ''}
			<p
				role="status"
				aria-live="polite"
				class="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
			>
				{parseError}
			</p>
		{/if}
		<div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
			<span class="text-xs text-gray-600">{detectedText}</span>
			<Button label="解析并填入请求表单" variant="primary" size="sm" onclick={parse}>
				<WandSparkles class="size-3.5" aria-hidden="true" />解析到表单
			</Button>
		</div>
	</div>

	<!-- 导出（同导入：移动端按内容排，不与导入抢那半屏高度） -->
	<div class="flex min-h-0 flex-1 flex-col gap-2 border-t border-gray-200 p-4 max-lg:flex-none">
		<div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
			<span class="text-xs font-medium text-gray-600">从当前请求生成</span>
			<div class="flex shrink-0 items-center gap-2">
				<Dropdown
					size="sm"
					label="导出格式"
					options={FORMAT_OPTIONS}
					value={httpStore.exportFormat}
					onSelect={(value) => (httpStore.exportFormat = value as RequestTextFormat)}
				/>
				<Button size="sm" label="复制生成的请求文本" onclick={() => void httpStore.copyExportText()}>复制</Button>
			</div>
		</div>
		<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
		     svelte 的静态规则不认识 role="region"，这里放行 -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre
			id="http-export-text"
			tabindex="0"
			role="region"
			aria-label="生成的请求文本"
			class="{GENERATED_PRE} max-lg:min-h-56">{httpStore.exportText}</pre>
	</div>
</div>
