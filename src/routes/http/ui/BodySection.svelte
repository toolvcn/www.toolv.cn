<script lang="ts">
	// 请求体标签页：类型下拉（无 / JSON / 纯文本 / 表单）+ 对应的编辑区。
	//
	// 类型就是原来的 Content-Type —— 两者本是一件事，所以不再另设一个「类型」字段：
	// 选了 JSON 就自动带 application/json，选了表单就用键值表并拼成 `a=1&b=2`（见 store.effectiveBody）。
	// 于是 cURL 生成、代码生成、实际发送共用同一个正文，谁都不用知道是哪一种写法。
	import { Braces } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { isJson } from '$lib/utils/json';
	import { toast } from '$lib/ui/toast.svelte';
	import { httpStore } from '../core/store.svelte.ts';
	import type { ContentType } from '../core/types.ts';
	import KeyValueTable from './KeyValueTable.svelte';
	import { PANEL_EDITOR } from './styles.ts';

	const BODY_TYPE_OPTIONS = [
		{ value: 'none', label: '无', description: '不发送请求体' },
		{ value: 'application/json', label: 'JSON', description: 'application/json，可一键格式化' },
		{ value: 'application/x-www-form-urlencoded', label: '表单', description: '用键值表填写，发送时拼成 a=1&b=2' },
		{ value: 'text/plain', label: '纯文本', description: 'text/plain' }
	] as const;

	const bodyDisabled = $derived(!httpStore.isBodyAllowed);
	const isFormType = $derived(httpStore.contentType === 'application/x-www-form-urlencoded');
	const isJsonType = $derived(httpStore.contentType === 'application/json');
	// 只在「填了内容、又不是合法 JSON」时提醒；空的时候不喊
	const jsonInvalid = $derived(isJsonType && httpStore.body.trim() !== '' && !isJson(httpStore.body));
	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const editorClass = $derived(bodyDisabled ? `${PANEL_EDITOR} opacity-50` : PANEL_EDITOR);

	/** 说明行常驻（高度固定），文案随状态换 —— 免得贴 JSON 时页面上下跳 */
	const hintText = $derived.by(() => {
		if (bodyDisabled) return 'GET / HEAD 不发送请求体，切到 POST / PUT / PATCH / DELETE 才会带上。';
		if (jsonInvalid) return '当前内容不是合法 JSON，但会原样发送。';
		if (isFormType) return '每一行拼成一个表单字段，取消勾选的行不发送。';
		if (httpStore.contentType === 'none') return '当前类型是「无」，不会发送请求体。';
		return `Content-Type 会带 ${httpStore.contentType}`;
	});

	function formatJson(): void {
		try {
			httpStore.body = JSON.stringify(JSON.parse(httpStore.body), null, 2);
			toast.show('已格式化请求体');
		} catch {
			toast.show('请求体不是合法 JSON，没法格式化', true);
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2 p-4">
	<div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<span class="text-xs font-medium text-gray-600">类型</span>
			<Dropdown
				size="sm"
				label="请求体类型"
				options={BODY_TYPE_OPTIONS}
				value={httpStore.contentType}
				onSelect={(value) => (httpStore.contentType = value as ContentType)}
				disabled={bodyDisabled}
				disabledTitle="GET / HEAD 不发送请求体"
			/>
		</div>
		{#if isJsonType}
			<Button
				size="sm"
				label="格式化请求体 JSON"
				disabled={bodyDisabled || httpStore.body.trim() === ''}
				onclick={formatJson}
			>
				<Braces class="size-3.5" aria-hidden="true" />格式化
			</Button>
		{/if}
	</div>

	<p
		role="status"
		aria-live="polite"
		class="min-h-4 shrink-0 text-[11px] leading-4 {jsonInvalid ? 'text-amber-700' : 'text-gray-600'}"
	>
		{hintText}
	</p>

	{#if isFormType}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<KeyValueTable
				idPrefix="http-form"
				rows={httpStore.formRows}
				onchange={(id, patch) => httpStore.updateFormRow(id, patch)}
				onremove={(id) => httpStore.removeFormRow(id)}
				onadd={() => httpStore.addFormRow()}
				namePlaceholder="字段名"
				valuePlaceholder="值"
				emptyHint="还没有表单字段。点下面的「添加」加一条（文件上传用的 multipart 暂不支持）。"
				addLabel="添加表单字段"
			/>
		</div>
	{:else}
		<EditorBox>
			<Textarea
				id="http-body"
				label="请求体"
				mono
				textSize="text-xs leading-5"
				bind:value={httpStore.body}
				disabled={bodyDisabled}
				placeholder="请求体内容（JSON / 纯文本）"
				class={editorClass}
			/>
		</EditorBox>
	{/if}
</div>
