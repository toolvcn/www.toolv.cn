<script lang="ts">
	// 「文本清理」标签：左输入、中选项、右输出，结果随选项实时刷新。
	// 选项是纯开关（只影响渲染结果，不动输入），「写回输入」才真正替换输入框内容。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { ArrowDownToLine, Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import { textStore } from '../core/store.svelte.ts';
	import { CLEAN_ITEMS, type CleanOptions } from '../core/types.ts';
	import { FOOTER_BAR, EDITOR_INPUT, EDITOR_OUTPUT } from '$lib/ui/styles';
	import { PANEL_BODY_SCROLL } from './styles.ts';

	/** 行排序选项。description 写进菜单行与 title，光看 label 看不出排序口径 */
	const SORT_OPTIONS: ReadonlyArray<{
		value: CleanOptions['sort'];
		label: string;
		description: string;
	}> = [
		{ value: 'none', label: '不排序', description: '保持原有行序，只应用上面的清理项' },
		{ value: 'asc', label: '按码点升序', description: '按 Unicode 码点从小到大排，中英混排结果也稳定' },
		{ value: 'desc', label: '按码点降序', description: '按 Unicode 码点从大到小排' }
	];

	const outputLines = $derived(textStore.cleaned === '' ? 0 : textStore.cleaned.split('\n').length);
	// 脚注一句话说清当前状态：空输入 / 清空了内容 / 有变化 / 没变化，四种文案不重样
	const statusText = $derived(
		textStore.cleanEmpty
			? '输入文本后这里会显示清理结果'
			: textStore.cleaned === ''
				? '清理后没有剩余内容，可调整选项或清空重来'
				: textStore.cleanChanged
					? `已按当前选项清理，输出 ${outputLines} 行`
					: '当前选项下文本没有变化'
	);
	const statusTone = $derived(textStore.cleanEmpty ? 'neutral' : textStore.cleanChanged ? 'ok' : 'neutral');
	const copyDisabled = $derived(textStore.cleaned === '');
	const applyDisabled = $derived(!textStore.cleanChanged);
</script>

<!-- md 起三栏：输入 | 选项（定宽）| 输出；手机端上下堆叠，编辑区各自固定高度 -->
<div
	class="flex min-h-0 flex-1 flex-col gap-4 md:grid md:min-h-0 md:grid-cols-[minmax(0,1fr)_15rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]"
>
	<!-- 输入区 -->
	<EditorPane
		fullscreen
		id="text-clean-input"
		headingId="text-clean-input-heading"
		heading="输入"
		class="relative min-h-0 min-w-0"
	>
		{#snippet actions()}
			<Button
				label="填入一段带重复行、空行和首尾空白的示例文本"
				title="填入示例"
				size="xs"
				onclick={() => textStore.loadCleanExample()}
			>
				<Lightbulb class="size-3.5" />示例
			</Button>
			<Button label="清空输入框" title="清空输入框" size="xs" onclick={() => textStore.clearCleanInput()}>
				<Eraser class="size-3.5" />清空
			</Button>
		{/snippet}
		<Textarea
			id="text-clean-input-area"
			mono
			label="要清理的文本"
			bind:value={textStore.cleanInput}
			placeholder="粘贴要清理的文本，结果随右侧选项实时刷新"
			class={EDITOR_INPUT}
		/>
		{#snippet footer()}
			<div class={FOOTER_BAR}>
				<p class="truncate text-xs text-gray-600">选项只影响右侧输出，不动输入</p>
			</div>
		{/snippet}
	</EditorPane>

	<!-- 选项区：复选框 + 排序下拉。勾选只影响输出渲染，不写回输入 -->
	<PanelCard id="text-clean-options" headingId="text-clean-options-heading" heading="清理选项" class="min-h-0 min-w-0">
		<div class="{PANEL_BODY_SCROLL} space-y-1 p-3">
			{#each CLEAN_ITEMS as item (item.key)}
				<!-- 包裹式 label 隐式关联控件；说明放 title 悬浮可见 -->
				<label class="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-gray-50" title={item.description}>
					<input
						type="checkbox"
						class="mt-0.5 size-4 shrink-0 accent-blue-600"
						checked={textStore.options[item.key]}
						onchange={() => textStore.toggleOption(item.key)}
					/>
					<span class="min-w-0">
						<span class="block text-sm font-medium text-gray-900">{item.label}</span>
						<span class="mt-0.5 block text-xs text-gray-600">{item.description}</span>
					</span>
				</label>
			{/each}
			<div class="border-t border-gray-100 pt-2">
				<p class="mb-1.5 px-2 text-xs font-medium text-gray-600">行排序</p>
				<Dropdown
					label="行排序"
					options={SORT_OPTIONS}
					value={textStore.options.sort}
					onSelect={(value) => textStore.setSort(value as CleanOptions['sort'])}
				/>
			</div>
		</div>
	</PanelCard>

	<!-- 输出区：只读无边框，写回 / 复制走卡片右上角 -->
	<EditorPane
		fullscreen
		id="text-clean-output"
		headingId="text-clean-output-heading"
		heading="输出"
		class="relative min-h-0 min-w-0"
		empty="清理结果会实时出现在这里"
		ready={textStore.cleaned !== ''}
	>
		{#snippet actions()}
			<Button
				label="把清理结果写回输入框，便于继续叠加其它选项"
				title="把当前输出替换到输入框，继续叠加清理"
				size="xs"
				disabled={applyDisabled}
				onclick={() => textStore.applyToInput()}
			>
				<ArrowDownToLine class="size-3.5" />写回
			</Button>
			<Button
				label="复制清理结果"
				title="复制清理结果"
				size="xs"
				variant="primary"
				disabled={copyDisabled}
				onclick={() => void textStore.copyCleaned()}
			>
				<Copy class="size-3.5" />复制
			</Button>
		{/snippet}
		<Textarea
			id="text-clean-output-area"
			mono
			label="清理结果"
			size="sm"
			readonly
			value={textStore.cleaned}
			class={EDITOR_OUTPUT}
		/>
		{#snippet footer()}
			<!-- 固定高度脚注：状态播报在这里，不会把卡片撑高 -->
			<div class={FOOTER_BAR}>
				<StatusPill tone={statusTone}>{statusText}</StatusPill>
			</div>
		{/snippet}
	</EditorPane>
</div>
