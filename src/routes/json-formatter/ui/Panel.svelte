<script lang="ts">
	// JSON 工具的主界面：顶部通栏工具条（模式 / 缩进 / 操作），下方输入、输出双栏。
	// 操作集中在工具条，两侧编辑区不用再让出中间一栏；所有状态从 store 读写。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy, Eraser, FileBraces } from '@lucide/svelte';
	import { jsonStore } from '../core/store.svelte.ts';
	import type { IndentKind } from '../core/types.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import {
		FOOTER_BAR,
		EDITOR_INPUT,
		JSON_TOKEN_CLASS,
		OUTPUT_PRE,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	const MODE_OPTIONS = [
		{ value: 'format', label: '格式化' },
		{ value: 'minify', label: '压缩' }
	] as const;

	const INDENT_OPTIONS: { value: IndentKind; label: string }[] = [
		{ value: '2', label: '2 空格' },
		{ value: '4', label: '4 空格' },
		{ value: 'tab', label: 'Tab' }
	];

	// ---- 派生类：条件类名一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） ----
	const modeLabel = $derived(jsonStore.mode === 'format' ? '格式化' : '压缩');
	const indentLabel = $derived(jsonStore.indent === '2' ? '2 空格' : jsonStore.indent === '4' ? '4 空格' : 'Tab');
	// 压缩模式不消费缩进，整组半透明提示用户它暂时不生效
	const indentGroupClass = $derived(jsonStore.mode === 'minify' ? 'opacity-60' : '');
	const statusTone = $derived(jsonStore.isEmpty ? 'neutral' : jsonStore.error === null ? 'ok' : 'error');
	// 输出区空态占位：跟「非法」区分开（AGENTS：不能都写「暂无数据」）
	const outputEmptyText = $derived(
		jsonStore.isEmpty
			? '在左侧粘贴 JSON，格式化 / 压缩结果会实时显示在这里'
			: '语法有误，修正后高亮结果会实时出现在这里'
	);

	// placeholder 里有花括号，写在模板里会被当成表达式起始，放到脚本里用 {expr} 传
	const inputPlaceholder = '粘贴 JSON，例如 {"a": 1}';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：小屏纵向堆叠，md 起并排，右侧操作 ml-auto 靠右 -->
	<div id="json-toolbar" role="group" aria-label="JSON 处理操作" class={TOOLBAR}>
		<!-- 模式切换 -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>模式</span>
			<SegmentedControl options={MODE_OPTIONS} value={jsonStore.mode} onchange={(v) => jsonStore.setMode(v)} />
		</div>

		<!-- 缩进：只影响格式化；压缩模式下点了会切回格式化（见 store.setIndent）。
		     aria-disabled 跟 opacity-60 同源：半透明组里的文字对比度会掉到 3:1 以下，
		     标上 aria-disabled 后 axe 才按「当前不生效」而不是「对比度不合格」判定。 -->
		<div
			class={indentGroupClass ? `${TOOLBAR_GROUP} ${indentGroupClass}` : TOOLBAR_GROUP}
			aria-disabled={jsonStore.mode === 'minify'}
		>
			<span class={TOOLBAR_LABEL}>缩进</span>
			<SegmentedControl options={INDENT_OPTIONS} value={jsonStore.indent} onchange={(v) => jsonStore.setIndent(v)} />
		</div>

		<!-- 右侧操作：md 起靠右 -->
		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例 JSON" title="示例" onclick={() => jsonStore.loadSample()}>
				<FileBraces class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => jsonStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制输出结果" title="复制输出" onclick={() => void jsonStore.copyOutput()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="json-input-panel"
			headingId="json-input-heading"
			heading="JSON 输入"
			headingExtra={`${jsonStore.inputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="json-input"
				mono
				label="JSON 输入"
				bind:value={jsonStore.input}
				placeholder={inputPlaceholder}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<!-- 固定高度脚注：超长提示也在这里，不会把卡片撑高 -->
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">示例 / 清空在顶部工具条 · 校验状态见右侧输出卡片</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态与高亮二选一由 EditorPane 管（错误详情走脚注的 StatusPill） -->
		<EditorPane
			fullscreen
			id="json-output-panel"
			headingId="json-output-heading"
			heading="输出结果"
			headingExtra={`${modeLabel}${jsonStore.mode === 'format' ? ` · ${indentLabel}缩进` : ''} · ${jsonStore.outputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			empty={outputEmptyText}
			ready={!jsonStore.isEmpty && jsonStore.error === null}
		>
			<CodeView
				id="json-output"
				tokens={jsonStore.visibleTokens}
				classMap={JSON_TOKEN_CLASS}
				tabindex={0}
				role="region"
				aria-label="输出内容"
				class={OUTPUT_PRE}
			/>
			{#snippet footer()}
				<!-- 底部状态条：校验状态是运行态文字，挂 role=status 给读屏 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone}>{jsonStore.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
