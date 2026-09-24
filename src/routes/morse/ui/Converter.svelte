<script lang="ts">
	// 摩斯编解码的主界面：顶部通栏工具条（方向 / 符号 / 分隔符 / 操作），下方输入、输出双栏。
	// 操作集中在工具条，两侧编辑区不用再让出宽度；所有状态从 store 读写，这里只做渲染与事件分发。
	import { ArrowDownUp, Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import {
		EDITOR_INPUT,
		EDITOR_OUTPUT,
		FOOTER_BAR,
		TOOLBAR,
		TOOLBAR_ACTIONS,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL
	} from '$lib/ui/styles';
	import { morseStore } from '../core/store.svelte.ts';

	/**
	 * 方向标签用「编码 / 解码」而不是「文本 → 摩斯 / 摩斯 → 文本」：
	 * 完整写法两个按钮要多占 130 多像素，工具条现在挤在左侧窄栏里（速查占了右栏），
	 * 一排装不下就被迫换行。方向含义由两侧编辑区的标题（文本 / 摩斯密码）承担，
	 * 悬浮时再用 title 补全，所以短标签不会丢掉信息。
	 */
	const DIRECTIONS = [
		{ value: 'encode', label: '编码', title: '文本 → 摩斯' },
		{ value: 'decode', label: '解码', title: '摩斯 → 文本' }
	] as const;

	/**
	 * 分隔符给常用档而非自由输入：字母分隔默认是**一个空格**，
	 * 自由输入框里看不出里面有没有空格，换个写法更清楚（也顺带挡住「字母分隔 = 划」这类冲突写法）。
	 */
	const LETTER_SEPS: Array<{ value: string; label: string; description: string }> = [
		{ value: ' ', label: '空格', description: '标准写法：字母之间空一格' },
		{ value: '/', label: '斜杠', description: '字母之间用 / 分隔，写起来更紧凑' },
		{ value: '|', label: '竖线', description: '字母之间用 | 分隔，便于逐段对齐' },
		{ value: ',', label: '逗号', description: '字母之间用逗号分隔' },
		{ value: '', label: '不分隔', description: '整个词连写，解码时按字母表自动分词' }
	];
	const WORD_SEPS: Array<{ value: string; label: string; description: string }> = [
		{ value: ' / ', label: '空格 + 斜杠', description: '标准写法：词之间用 / 分隔' },
		{ value: '//', label: '双斜杠', description: '词之间用 // 分隔' },
		{ value: '|', label: '竖线', description: '词之间用 | 分隔（此时字母分隔别也用竖线）' },
		{ value: '\n', label: '换行', description: '一个词一行' },
		{ value: '', label: '不分隔', description: '整段连写，解码时按字母表自动分词' }
	];

	// ---- 派生类：条件类名与文案一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） ----
	const isDecode = $derived(morseStore.direction === 'decode');
	const inputLabel = $derived(isDecode ? '摩斯密码' : '文本');
	const outputLabel = $derived(isDecode ? '文本' : '摩斯密码');
	const outputEmptyText = $derived(
		isDecode ? '在左侧粘贴摩斯密码，解码结果会实时显示在这里' : '在左侧输入文本，摩斯密码会实时显示在这里'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：小屏纵向堆叠，md 起并排，右侧操作 ml-auto 靠右 -->
	<div id="morse-toolbar" role="group" aria-label="摩斯编解码操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>方向</span>
			<SegmentedControl
				options={DIRECTIONS}
				value={morseStore.direction}
				onchange={(value) => (morseStore.direction = value)}
			/>
		</div>

		<!-- 点与划：可以换成 · 与 —（解码时两者都认，编码时按这里的字符输出） -->
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>符号</span>
			<div class="flex h-8 items-center gap-2">
				<span class="flex items-center gap-1.5">
					<label class="shrink-0 text-xs text-gray-600" for="morse-dot">点</label>
					<span class="block w-12"
						><Input id="morse-dot" size="sm" mono maxlength={1} bind:value={morseStore.dot} /></span
					>
				</span>
				<span class="flex items-center gap-1.5">
					<label class="shrink-0 text-xs text-gray-600" for="morse-dash">划</label>
					<span class="block w-12"
						><Input id="morse-dash" size="sm" mono maxlength={1} bind:value={morseStore.dash} /></span
					>
				</span>
			</div>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>分隔符</span>
			<div class="flex h-8 items-center gap-2">
				<span class="flex items-center gap-1.5">
					<span class="shrink-0 text-xs text-gray-600" aria-hidden="true">字母</span>
					<Dropdown
						label="字母分隔符"
						size="sm"
						options={LETTER_SEPS}
						value={morseStore.letterSep}
						onSelect={(value) => (morseStore.letterSep = value)}
					/>
				</span>
				<span class="flex items-center gap-1.5">
					<span class="shrink-0 text-xs text-gray-600" aria-hidden="true">词</span>
					<Dropdown
						label="词分隔符"
						size="sm"
						options={WORD_SEPS}
						value={morseStore.wordSep}
						onSelect={(value) => (morseStore.wordSep = value)}
					/>
				</span>
			</div>
		</div>

		<!-- 右侧操作：md 起靠右 -->
		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例文本" title="示例" onclick={() => morseStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button
				label="把输出搬到输入框并切换方向"
				title="把当前输出搬到输入框并切换方向，来回验证不用手动复制"
				onclick={() => morseStore.swapDirection()}
			>
				<ArrowDownUp class="size-4 shrink-0" aria-hidden="true" />互换
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => morseStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制转换结果" title="复制输出" onclick={() => void morseStore.copyOutput()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			fullscreen
			id="morse-input"
			headingId="morse-input-heading"
			heading={inputLabel}
			headingExtra={`${morseStore.inputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea
				id="morse-input-area"
				mono
				label="{inputLabel}输入"
				bind:value={morseStore.input}
				placeholder="粘贴要转换的文本或摩斯密码"
				class={EDITOR_INPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">方向 / 符号 / 分隔符 / 示例在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 空态 / 错误态 / 结果三选一由 EditorPane 管，容器高度不跳变 -->
		<EditorPane
			fullscreen
			id="morse-output"
			headingId="morse-output-heading"
			heading={outputLabel}
			headingExtra={`${morseStore.outputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			error={morseStore.symbolError}
			empty={outputEmptyText}
			ready={morseStore.output !== ''}
		>
			<Textarea
				id="morse-output-area"
				mono
				label="{outputLabel}结果"
				size="sm"
				readonly
				value={morseStore.output}
				class={EDITOR_OUTPUT}
			/>
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={morseStore.statusTone} truncate>{morseStore.statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>
