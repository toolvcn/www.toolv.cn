<script lang="ts">
	// JSON → TypeScript 主界面：顶部通栏工具条（根类型名 / export / 示例 / 清空 / 复制），
	// 下方输入、输出双栏，类型定义随输入与选项实时刷新。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import { jsonToTsStore } from '../core/store.svelte.ts';
	import { MAX_ROOT_NAME } from '../config.ts';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import { tokenizeTypeScript, type TsTokenKind } from '../core/highlight.ts';
	import {
		FOOTER_BAR,
		EDITOR_INPUT,
		OUTPUT_PRE,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	// TS 高亮的色板：沿用 UI-STYLE §14 的六档色（白底 ≥4.5:1，深色主题由 layout.css 自动换档）。
	// 原先跟渲染块一起放在 ui/TsView.svelte，收成共享 CodeView 后色板归调用方（只此一处的短串，
	// 按 STRUCTURE §0 硬约束 2 不另建 ui/styles.ts）。
	const TS_TOKEN_CLASS: Record<TsTokenKind, string> = {
		keyword: 'text-violet-700',
		type: 'text-amber-700',
		property: 'text-blue-700',
		primitive: 'text-emerald-700',
		punct: 'text-gray-500',
		plain: 'text-gray-900'
	};

	// 派生视图先在脚本里算好：class 属性里不写裸三元（prettier 拆行后条件会静默失效）
	const isEmpty = $derived(jsonToTsStore.isEmpty);
	const hasError = $derived(jsonToTsStore.hasError);
	const output = $derived(jsonToTsStore.result.ok ? jsonToTsStore.result.code : '');
	const errorText = $derived(jsonToTsStore.result.ok ? '' : jsonToTsStore.result.error);
	// 输出走高亮 <pre>：分词随输出重算（结果就是几百字的声明代码，代价可忽略）
	const tsTokens = $derived(tokenizeTypeScript(output));
	const statusText = $derived(
		isEmpty
			? '粘贴一段 JSON，类型定义会实时出现在这里'
			: jsonToTsStore.result.ok
				? `${jsonToTsStore.result.declarations} 个声明 · ${jsonToTsStore.result.code.split('\n').length} 行`
				: errorText
	);
	const statusTone = $derived(hasError ? 'error' : isEmpty ? 'neutral' : 'ok');

	// 输出空态跟「解析失败」区分开写（AGENTS：不能都写「暂无数据」）
	const outputEmptyText = $derived(
		isEmpty ? '在左侧粘贴 JSON，生成的 interface 会实时出现在这里' : '语法有误，修正后类型定义会实时出现在这里'
	);

	// Svelte 模板里属性值的 {} 会被当表达式，含花括号的占位文案要用 JS 字符串传入
	const inputPlaceholder = '{ "userId": 1, "tags": ["dev"] }';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：根类型名 + 声明选项在左，操作 md:ml-auto 靠右 -->
	<div id="json-to-ts-toolbar" role="group" aria-label="JSON 转 TypeScript 操作" class={TOOLBAR}>
		<!-- 根类型名不参与 flex 拉伸（flex-1 会把框拉成整条工具栏那么宽，淡边框看着像失效）；
		     移动端不限宽撑满整行，md 起定宽——40 字符 mono 刚好放得下 -->
		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="json-to-ts-root-name">根类型名</label>
			<div class="md:w-72">
				<Input
					id="json-to-ts-root-name"
					mono
					size="sm"
					maxlength={MAX_ROOT_NAME}
					bind:value={jsonToTsStore.rootName}
					title="生成 interface 的名字；不合法字符会自动净化成合法标识符（最多 {MAX_ROOT_NAME} 个字符）"
					placeholder="RootObject"
				/>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>声明方式</span>
			<div class="flex h-8 items-center">
				<Checkbox bind:checked={jsonToTsStore.exportKeyword} title="声明前是否加 export">加 export</Checkbox>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例 JSON" title="示例" onclick={() => jsonToTsStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => jsonToTsStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button
				variant="primary"
				label="复制生成的类型定义"
				title="复制输出"
				disabled={isEmpty || hasError}
				onclick={() => void jsonToTsStore.copyOutput()}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="json-to-ts-input"
			headingId="json-to-ts-input-heading"
			heading="JSON 输入"
			headingExtra={`${jsonToTsStore.input.length} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="json-to-ts-input-area"
				mono
				label="JSON 样例"
				bind:value={jsonToTsStore.input}
				placeholder={inputPlaceholder}
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">粘贴即生成，命名与 export 选项在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态与高亮二选一由 EditorPane 管（错误详情走脚注的 StatusPill） -->
		<EditorPane
			fullscreen
			id="json-to-ts-output"
			headingId="json-to-ts-output-heading"
			heading="TypeScript 类型"
			headingExtra={jsonToTsStore.result.ok ? `${jsonToTsStore.result.declarations} 个声明` : '待生成'}
			class="relative min-w-0 flex-1 md:min-h-0"
			empty={outputEmptyText}
			ready={!isEmpty && !hasError}
		>
			<CodeView
				id="json-to-ts-output-area"
				tokens={tsTokens}
				classMap={TS_TOKEN_CLASS}
				tabindex={0}
				role="region"
				aria-label="生成的 TypeScript 类型"
				class={OUTPUT_PRE}
			/>
			{#snippet footer()}
				<!-- 固定高度脚注：错误与统计都在这里，不会把卡片撑高 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone}>{statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
