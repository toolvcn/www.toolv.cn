<script lang="ts">
	// HTML 实体工具的主界面：顶部通栏工具条（方向 / 编码选项 / 操作），下方输入、输出双栏。
	// 操作集中在工具条，两侧编辑区不用再让出宽度；所有状态从 store 读写，这里只做渲染与事件分发。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { ArrowDownUp, Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import {
		FOOTER_BAR,
		EDITOR_INPUT,
		EDITOR_OUTPUT,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import { entityStore } from '../core/store.svelte.ts';
	import type { EncodeScope, EncodeStyle } from '../core/types.ts';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	/** 编码范围选项。description 写进菜单行与 title，光看 label 看不出差异 */
	const SCOPES: Array<{ value: EncodeScope; label: string; description: string }> = [
		{
			value: 'required',
			label: '仅必需字符',
			description: '只转义 & < > " \' 这五个会破坏 HTML 结构的字符'
		},
		{
			value: 'symbols',
			label: '含常用符号',
			description: '必需字符之外，©、™、箭头、希腊字母等也转成实体'
		},
		{
			value: 'nonAscii',
			label: '所有非 ASCII',
			description: '中文、emoji 等所有非 ASCII 字符都转成实体'
		}
	];
	/** 实体形式选项 */
	const STYLES: Array<{ value: EncodeStyle; label: string; description: string }> = [
		{
			value: 'named',
			label: '命名实体',
			description: '有名字的用 &copy; 这类命名实体，没有的退回数字实体'
		},
		{
			value: 'numeric',
			label: '数字实体',
			description: '一律用 &#169; 这类十进制数字实体'
		}
	];

	const DIRECTIONS = [
		{ value: 'encode', label: '文本 → 实体' },
		{ value: 'decode', label: '实体 → 文本' }
	] as const;

	// ---- 派生类：条件类名一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） ----
	const isDecode = $derived(entityStore.direction === 'decode');
	const inputLabel = $derived(isDecode ? 'HTML 实体' : '原文');
	const outputLabel = $derived(isDecode ? '原文' : 'HTML 实体');
	// 输出区空态：输入为空时才出现，方向不同文案不同
	const outputEmptyText = $derived(
		isDecode ? '在左侧粘贴 HTML 实体，解码结果会实时显示在这里' : '在左侧输入文本，实体结果会实时显示在这里'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：小屏纵向堆叠，md 起并排，右侧操作 ml-auto 靠右 -->
	<div id="entity-toolbar" role="group" aria-label="HTML 实体编解码操作" class={TOOLBAR}>
		<!-- 方向切换 -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>方向</span>
			<SegmentedControl
				options={DIRECTIONS}
				value={entityStore.direction}
				onchange={(v) => (entityStore.direction = v)}
			/>
		</div>

		<!-- 编码选项：解码方向下禁用但常驻渲染，高度不跳变 -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>转义范围</span>
			<Dropdown
				label="转义范围"
				size="sm"
				options={SCOPES}
				value={entityStore.scope}
				disabled={isDecode}
				disabledTitle="切到「文本 → 实体」后可用"
				onSelect={(value) => entityStore.applyScope(value as EncodeScope)}
			/>
		</div>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>实体形式</span>
			<Dropdown
				label="实体形式"
				size="sm"
				options={STYLES}
				value={entityStore.style}
				disabled={isDecode}
				disabledTitle="切到「文本 → 实体」后可用"
				onSelect={(value) => entityStore.applyStyle(value as EncodeStyle)}
			/>
		</div>

		<!-- 右侧操作：md 起靠右 -->
		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例文本" title="示例" onclick={() => entityStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button
				label="把输出搬到输入框并切换方向"
				title="把当前输出搬到输入框并切换方向，来回验证不用手动复制"
				onclick={() => entityStore.swapDirection()}
			>
				<ArrowDownUp class="size-4 shrink-0" aria-hidden="true" />互换
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => entityStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制转换结果" title="复制输出" onclick={() => void entityStore.copyOutput()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="entity-input"
			headingId="entity-input-heading"
			heading={inputLabel}
			headingExtra={`${entityStore.inputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="entity-input-area"
				mono
				label="{inputLabel}输入"
				bind:value={entityStore.input}
				placeholder="粘贴要转换的文本或 HTML 实体"
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">方向 / 转义范围 / 实体形式 / 示例在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态与结果二选一由 EditorPane 管，容器高度不跳变 -->
		<EditorPane
			fullscreen
			id="entity-output"
			headingId="entity-output-heading"
			heading={outputLabel}
			headingExtra={`${entityStore.outputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			empty={outputEmptyText}
			ready={entityStore.output !== ''}
		>
			<Textarea
				id="entity-output-area"
				mono
				label="{outputLabel}结果"
				size="sm"
				readonly
				value={entityStore.output}
				class={EDITOR_OUTPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">结果随输入实时更新 · 复制输出在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
