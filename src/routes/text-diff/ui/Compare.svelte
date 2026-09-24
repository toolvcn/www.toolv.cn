<script lang="ts">
	// 文本对比主界面：顶部工具条（视图 / 忽略项 / 操作），中间左右两栏输入，下面结果面板。
	import { ArrowLeftRight, Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { diffStore, type DiffView } from '../core/store.svelte.ts';
	import InputPane from './InputPane.svelte';
	import ResultPanel from './ResultPanel.svelte';

	const VIEW_OPTIONS: { value: DiffView; label: string }[] = [
		{ value: 'split', label: '并排' },
		{ value: 'unified', label: '合并' }
	];
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="text-diff-toolbar" role="group" aria-label="文本对比操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="text-diff-view-label">视图</span>
			<SegmentedControl
				aria-labelledby="text-diff-view-label"
				options={VIEW_OPTIONS}
				value={diffStore.view}
				onchange={(view) => diffStore.setView(view)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>比较时忽略</span>
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
				<Checkbox bind:checked={diffStore.ignoreCase} label="大小写" title="勾选后 Foo 与 foo 视为同一行" />
				<Checkbox
					bind:checked={diffStore.ignoreWhitespace}
					label="行首尾空白"
					title="勾选后缩进或行尾空格不同仍视为同一行"
				/>
				<Checkbox bind:checked={diffStore.ignoreBlank} label="空行" title="勾选后空行不参与对比" />
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例文本" title="示例" onclick={() => diffStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="交换左右两栏内容" title="交换" onclick={() => diffStore.swap()}>
				<ArrowLeftRight class="size-4 shrink-0" aria-hidden="true" />交换
			</Button>
			<Button label="清空两栏输入" title="清空" onclick={() => diffStore.clear()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制对比结果" title="复制结果" onclick={() => void diffStore.copyResult()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制结果
			</Button>
		</div>
	</div>

	<!-- 两栏输入：小屏上下堆叠，md 起并排；高度按 2 : 3 分给输入区与结果区 -->
	<div class="grid grid-cols-1 gap-4 md:min-h-0 md:flex-[2] md:grid-cols-2">
		<InputPane side="left" bind:value={diffStore.left} />
		<InputPane side="right" bind:value={diffStore.right} />
	</div>

	<ResultPanel />
</div>

<Toast />
