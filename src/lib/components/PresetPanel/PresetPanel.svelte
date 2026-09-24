<script lang="ts" generics="T extends { id: number; name: string }">
	// 参数预设面板（工具页最左一栏）：导出 / 导入 JSON、填名称保存、点条目整组回填、逐条删除。
	//
	// 原先 http 与电商 ROI 各写一份（结构相同、仅 store 与三处文案不同），
	// 留两份的结果已经能看出来：id 前缀、导出文件名、徽章与摘要各自长各的。
	// 收成这一件后，各工具只做「业务绑定」——store 与摘要文案通过 props 传进来。
	// 持久化（localStorage）仍归各工具的 `+page.svelte`。
	//
	// **一条预设长什么样，不归这个文件管**：条目渲染在 `PresetItem.svelte`。
	// 分界是「面板的壳」与「条目的样子」——壳（头 / 名称输入 / 列表 / 导入导出）工具无关，
	// 而条目各工具想改的地方多得多（电商 ROI 已经改过两轮：摘要换内容、按钮挪位置）。
	// 要整个换掉版式就传 `item` snippet，不必再往面板里加 prop。
	import type { Snippet } from 'svelte';
	import { Download, Save, Upload } from '@lucide/svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import PresetItem from './PresetItem.svelte';
	import { downloadText } from '$lib/utils/browser';
	import { toast } from '$lib/ui/toast.svelte';
	import { PRESET_ACTION, HEADER_BTN } from '$lib/ui/styles';

	interface Props {
		/** 面板与内部控件的 id 前缀，如 `http` → `http-presets` / `http-preset-name` */
		idPrefix: string;
		/** 面板标题。默认「参数预设」；SQL 的片段列表传「我的片段」（形状同构、只是叫法不同） */
		heading?: string;
		/** 这类条目叫什么，默认「预设」：名称标签 / 占位符与导出导入的悬浮提示都按它拼 */
		noun?: string;
		/** 预设列表 */
		presets: readonly T[];
		/** 名称输入框的值：`bind:name` */
		name: string;
		/** 导出文件名，如 `http-presets.json` */
		exportFileName: string;
		/** 导出用的 JSON 文本 */
		exportText: string;
		onsave: () => void;
		onapply: (id: number) => void;
		ondelete: (id: number) => void;
		/**
		 * 拖动排序：**给了才在每条左侧出拖拽手柄**（http 没传，那边就不出）。
		 * 语义是「把 dragId 那条移到 targetId 那条所在的位置」，两者相同时不做事。
		 */
		onreorder?: (dragId: number, targetId: number) => void;
		/**
		 * 手柄聚焦后按 ↑ / ↓ 移动一条（`delta` 为 -1 / 1）。
		 * 拖动的键盘等价操作，跟 `onreorder` 成对给 —— 只给前者键盘就排不动。
		 */
		onmove?: (id: number, delta: number) => void;
		/** 文件读到的文本，交给各工具的 store 去解析合并 */
		onimport: (text: string) => void;
		/** 条目右上角的小徽章（http 放请求方法，电商 ROI 放口径） */
		badgeText: (preset: T) => string;
		/** 条目摘要，显示在名称下面一行（可折行，所以不必刻意压短） */
		summaryText: (preset: T) => string;
		/**
		 * 悬浮条目时摊开的参数卡：一组一块、块内一字段一行（左名右值）。
		 * 结构写在这里而不从别处 import —— 组件只声明「要什么形状」，具体类型留在各工具的 core 里
		 * （同 `SegmentedControl` 的 `options`）。省略、或所有组都没有字段时都不出这张卡。
		 */
		detailGroups?: (preset: T) => readonly {
			name: string;
			fields: readonly { label: string; value: string }[];
		}[];
		/** 自定义条目。省略则用内置的 `PresetItem`；给了就完全由调用方渲染（回调自备） */
		item?: Snippet<[T]>;
		/**
		 * 标题行右侧的**附加操作**（如电商 ROI 的 CSV 下拉）。
		 *
		 * **给了它，JSON 那两个按钮就收成图标、条数也让位** —— 这一栏只有 16rem（内容区 224px），
		 * 带宽文字的导出 / 导入（各 58px）已经把 122px 占满，第三组控件放不下。
		 * 收成图标后：标题 56 + 图标钮 30×2 + 附加控件 60 + 间隙 20 = 196px，留得住。
		 * 图标钮的 `title` / `aria-label` 仍在，只是不再把字写出来。
		 */
		extraActions?: Snippet;
		/**
		 * 面板是否裁掉溢出（转发给 `Panel` 的 `clip`，默认 true）。
		 *
		 * **`extraActions` 里挂了浮层（`Dropdown` 这类 `absolute` 菜单）时必须传 `false`** ——
		 * 面板根节点是 `overflow-hidden`，菜单展开后超出面板的那半截会被整块裁掉，
		 * 而面板在移动端只有 224px 高（`max-lg:max-h-56`），四项菜单 213px 一开就被切掉最后一项。
		 * 这种裁切 axe 查不出来（元素确实在 DOM 里、只是看不见），只能靠肉眼点开菜单。
		 * 见 UI-STYLE §8。
		 */
		clip?: boolean;
		/** 空态文案：各工具的「怎么用」不同，留在调用方 */
		emptyHint: string;
	}

	let {
		idPrefix,
		heading = '参数预设',
		noun = '预设',
		presets,
		name = $bindable(),
		exportFileName,
		exportText,
		onsave,
		onapply,
		ondelete,
		onreorder,
		onmove,
		onimport,
		badgeText,
		summaryText,
		detailGroups,
		item,
		extraActions,
		clip = true,
		emptyHint
	}: Props = $props();

	/** 有附加操作就走紧凑档（理由见 `extraActions` 那条注释） */
	const compact = $derived(extraActions !== undefined);

	const panelId = $derived(`${idPrefix}-presets`);
	const headingId = $derived(`${panelId}-heading`);
	const nameInputId = $derived(`${idPrefix}-preset-name`);

	let fileInput = $state<HTMLInputElement | null>(null);

	function exportPresets(): void {
		if (presets.length === 0) {
			toast.show('还没有可导出的预设', true);
			return;
		}
		downloadText(exportFileName, exportText, 'application/json;charset=utf-8');
		toast.show(`已导出 ${presets.length} 条预设`);
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// 清空 value，否则连着选同一个文件不会再触发 change
		input.value = '';
		if (!file) return;
		void file.text().then((text) => onimport(text));
	}
</script>

<!-- 内置条目版式。**必须定义在 `<Panel>` 之前**：写在组件标签里面会被当成它的 prop snippet
     （Svelte 5 里组件标签内的 snippet 就是「传进去的内容」这个意思），
     报「builtinItem 不存在于 Panel 的 props」。
     它存在的意义是跟调用方传进来的 `item` 走同一条渲染路径，两条路只留一处分支 -->
{#snippet builtinItem(preset: T)}
	<PresetItem {preset} {badgeText} {summaryText} {detailGroups} {onapply} {ondelete} {onreorder} {onmove} />
{/snippet}

<Panel id={panelId} {headingId} {heading} tag="aside" {clip} class="max-lg:shrink-0 lg:min-h-0">
	{#snippet headingExtra()}
		{#if !compact}<span class="hidden truncate text-xs text-gray-600 sm:inline">{presets.length} 条</span>{/if}
	{/snippet}

	{#snippet actions()}
		<button type="button" class={HEADER_BTN} title={`导出${noun}为 JSON 文件`} onclick={exportPresets}>
			<Download class="size-3.5 shrink-0" aria-hidden="true" />
			{#if !compact}<span class="hidden sm:inline">导出</span>{/if}
		</button>
		<button type="button" class={HEADER_BTN} title={`从 JSON 文件导入${noun}`} onclick={() => fileInput?.click()}>
			<Upload class="size-3.5 shrink-0" aria-hidden="true" />
			{#if !compact}<span class="hidden sm:inline">导入</span>{/if}
		</button>
		<input bind:this={fileInput} type="file" accept=".json,application/json" class="hidden" onchange={onFileChange} />
		{#if extraActions}{@render extraActions()}{/if}
	{/snippet}

	<!-- 名称 + 保存。relative 不能省：Input 的 sr-only label 是 absolute，
	     没有定位上下文会逃出裁剪把文档撑高（UI-STYLE §18） -->
	<div class="relative flex shrink-0 gap-2 border-b border-gray-100 p-3">
		<Input
			id={nameInputId}
			size="sm"
			mono
			class="min-w-0 flex-1"
			label={`${noun}名称`}
			bind:value={name}
			placeholder={`${noun}名称`}
			autocomplete="off"
		/>
		<button type="button" class={PRESET_ACTION} onclick={onsave}>
			<Save class="size-3.5 shrink-0" aria-hidden="true" />保存
		</button>
	</div>

	<!-- 预设列表：桌面占满剩余空间滚动，移动端封顶 -->
	<div class="min-h-0 flex-1 overflow-y-auto p-3 max-lg:max-h-56">
		{#if presets.length === 0}
			<p class="text-xs leading-5 text-gray-600">{emptyHint}</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each presets as preset (preset.id)}
					{#if item}
						{@render item(preset)}
					{:else}
						{@render builtinItem(preset)}
					{/if}
				{/each}
			</ul>
		{/if}
	</div>
</Panel>
