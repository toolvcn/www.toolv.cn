<script lang="ts">
	// Base64 工具的主界面：顶部通栏工具条（模式 / URL-safe / 操作），下方输入、输出双栏。
	// 所有状态从 store 读写，这里只做渲染与事件分发。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { ArrowLeftRight, Copy, Eraser, Square, SquareCheckBig, Upload } from '@lucide/svelte';
	import { formatFileSize } from '../core/base64.ts';
	import { base64 } from '../core/store.svelte.ts';
	import { MODE_LABEL } from '../core/types.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import {
		ACTION_BTN,
		FOOTER_BAR,
		EDITOR_INPUT,
		EDITOR_OUTPUT,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import { THUMB_BOX, TOGGLE_OFF, TOGGLE_ON } from './styles.ts';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	/** 文件输入框与「上传图片」按钮靠这个 id 配对 */
	const FILE_INPUT_ID = 'base64-file-input';

	const DIRECTION_OPTIONS = [
		{ value: 'encode', label: '编码' },
		{ value: 'decode', label: '解码' }
	] as const;

	// ---- 派生类：条件类名一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） ----
	const inputLabel = $derived(base64.mode === 'encode' ? '原文' : 'Base64');
	const outputLabel = $derived(base64.mode === 'encode' ? 'Base64' : '原文');
	const inputPlaceholder = $derived(
		base64.mode === 'encode' ? '在此输入要编码的文本…' : '在此粘贴要解码的 Base64 字符串…'
	);
	const urlSafeClass = $derived(base64.urlSafe ? TOGGLE_ON : TOGGLE_OFF);
	const outputEmptyText = $derived(
		base64.mode === 'encode'
			? '在左侧输入文本，编码结果会实时显示在这里'
			: '在左侧粘贴 Base64 字符串，解码结果会实时显示在这里'
	);

	function onFileChange(event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
		const input = event.currentTarget;
		void base64.processFile(input.files?.[0] ?? null);
		// 清空 value，否则连着选同一个文件不会再触发 change
		input.value = '';
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：小屏纵向堆叠，md 起并排，右侧操作 ml-auto 靠右 -->
	<div id="base64-toolbar" role="group" aria-label="Base64 编解码操作" class={TOOLBAR}>
		<!-- 方向切换 -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>方向</span>
			<SegmentedControl options={DIRECTION_OPTIONS} value={base64.mode} onchange={(v) => base64.setMode(v)} />
		</div>

		<!-- URL-safe 开关 -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>选项</span>
			<label
				class="relative inline-flex cursor-pointer items-center has-focus-visible:ring-2 has-focus-visible:ring-blue-500 {urlSafeClass}"
			>
				<input type="checkbox" class="sr-only" checked={base64.urlSafe} onchange={() => base64.toggleUrlSafe()} />
				{#if base64.urlSafe}
					<SquareCheckBig class="size-4 shrink-0" aria-hidden="true" />
				{:else}
					<Square class="size-4 shrink-0 text-gray-600" aria-hidden="true" />
				{/if}
				<span>URL-safe</span>
			</label>
		</div>

		<!-- 右侧操作：md 起靠右 -->
		<div class={TOOLBAR_ACTIONS}>
			<div class="relative">
				<input id={FILE_INPUT_ID} type="file" accept="image/*" class="peer sr-only" onchange={onFileChange} />
				<label
					for={FILE_INPUT_ID}
					class="{ACTION_BTN} peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:outline-none"
				>
					<Upload class="size-4 shrink-0" aria-hidden="true" />上传图片
				</label>
			</div>
			<Button label="互换输入与输出方向" title="互换" onclick={() => base64.swapMode()}>
				<ArrowLeftRight class="size-4 shrink-0" aria-hidden="true" />互换
			</Button>
			<Button label="清空输入与输出" title="清空" onclick={() => base64.clearAll()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制输出结果" title="复制输出" onclick={() => void base64.copyOutput()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="base64-input-panel"
			headingId="base64-input-heading"
			heading={inputLabel}
			headingExtra={`${MODE_LABEL[base64.mode]} · ${base64.inputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="base64-input"
				mono
				label={inputLabel}
				bind:value={base64.input}
				placeholder={inputPlaceholder}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">
						{#if base64.filePreview}
							{base64.filePreview.name} · {formatFileSize(base64.filePreview.size)}
						{:else}
							方向 / URL-safe / 上传图片在顶部工具条
						{/if}
					</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态 / 错误态 / 内容三选一由 EditorPane 管，切换不跳高 -->
		<EditorPane
			fullscreen
			id="base64-output-panel"
			headingId="base64-output-heading"
			heading={outputLabel}
			headingExtra={`${base64.outputCount} 字符 · Base64 长度 ${base64.base64Length}`}
			class="relative min-w-0 flex-1 md:min-h-0"
			error={base64.error || undefined}
			empty={outputEmptyText}
			ready={base64.processedOutput !== ''}
		>
			<Textarea
				id="base64-output"
				mono
				label={outputLabel}
				size="sm"
				value={base64.processedOutput}
				readonly
				class={EDITOR_OUTPUT}
			/>
			{#snippet footer()}
				<!-- 底部状态条：错误走 error 档，其余走中性档 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={base64.error ? 'error' : 'neutral'} truncate>
						{base64.error || '输出随输入实时更新'}
					</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>

	<!-- 缩略图：有图时显示在双栏下方，常驻高度不跳变 -->
	{#if base64.filePreview}
		<div class={THUMB_BOX}>
			<figure class="flex w-full items-center gap-2">
				<img
					src={base64.filePreviewUrl}
					alt=""
					class="size-14 shrink-0 rounded-md border border-gray-200 bg-white object-cover"
				/>
				<figcaption class="min-w-0 text-xs text-gray-600">
					<span class="block truncate font-medium text-gray-900">{base64.filePreview.name}</span>
					<span class="block">{formatFileSize(base64.filePreview.size)}</span>
				</figcaption>
			</figure>
		</div>
	{/if}
</div>

<Toast />
