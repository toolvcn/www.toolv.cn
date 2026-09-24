<script lang="ts">
	// 命令列表：搜索条 + 分组 chips + 按组分节的命令列表 + 底栏提示。三个命令速查工具共用。
	//
	// 命令文本按占位符分词上色（$lib/utils/command-cheatsheet 的 tokenizeCommand）——
	// 用 `<span>` 分段渲染而**不是 `{@html}`**：值来自用户输入，拼 HTML 有注入风险。
	//
	// 上色分两档：**用户自己填的值加淡底**（一眼看出「哪几个是我填的」），
	// 输入框留空、回落示例值的只有绿字。之前两档同款，等于没区分。
	//
	// 危险命令只标红、不做弹窗确认：这里复制的只是文本，真正执行在用户自己的终端里。
	import { Search } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import ResultRow from '$lib/components/ResultRow/ResultRow.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import {
		CHIP_OFF,
		CHIP_ON,
		FOOTER_BAR,
		LIST_HEADING,
		PANEL_HINT,
		SEARCH_ICON,
		SEARCH_INPUT,
		SEARCH_ROW
	} from '$lib/ui/styles';
	import type { BadgeTone } from '$lib/ui/styles';
	import { renderCommand, tokenizeCommand } from '$lib/utils/command-cheatsheet';
	import type { CheatsheetCommand, CheatsheetFilter, CommandSegment } from '$lib/utils/command-cheatsheet';
	import type { CheatsheetStore } from './cheatsheet.svelte.ts';

	/**
	 * 变量值的两档上色。底色走 `emerald-50` + 边框 `emerald-200`（§1 的成功语义色，
	 * 深色下会被变量表重绑）；**不要用 `emerald-100` / `emerald-800`** —— 那两档没进映射表，
	 * 深色主题下会变成亮斑（UI-STYLE §1 硬约束 1）。
	 */
	const VAR_TEXT = 'font-semibold text-emerald-700';
	const VAR_FILLED = `${VAR_TEXT} rounded border border-emerald-200 bg-emerald-50 px-0.5`;

	type Props = {
		store: CheatsheetStore;
		/** 面板标题，如「命令列表」 */
		heading: string;
		/** 搜索框占位符 */
		searchPlaceholder: string;
		/** 列表滚动区的无障碍名字，如「Docker 命令列表」 */
		listLabel: string;
		/** 分组 chips 的无障碍名字 */
		filterLabel: string;
		/** 底栏的一句提示 */
		footerHint: string;
		/**
		 * 列表高度是否交给父级拉伸（lg 起生效）。
		 *
		 * - **不传（默认）**：`max-h-[60vh]` 封顶，给**整页自然流**的工具（git / linux）——
		 *   列表不撑高页面，长表格在卡片内滚。
		 * - **`fill`**：lg 起换成 `lg:max-h-none lg:flex-1`，填满父级给的高度再在卡片内滚。
		 *   要求父级是**确定高度**（页面得开 ToolShell 的 `fill` 满屏、并把这条列钉住），
		 *   否则「剩余高度」不存在，flex-1 等于没给。docker 就是这一档。
		 *
		 * 小屏两档一样（都是 `60vh` 封顶）：小屏页面是自然流，没有可填的剩余高度。
		 */
		fill?: boolean;
	};

	let { store, heading, searchPlaceholder, listLabel, filterLabel, footerHint, fill = false }: Props = $props();

	// 页面上可能出现多个实例（Storybook / 将来的组合页），id 一律带上前缀，别用固定值
	const uid = $props.id();

	/** 用户填了值的变量。提到组件级算一次 —— 放进 `{#each}` 会每行重算一遍 */
	const filledVars = $derived(store.filledVars);

	/** 变量段的上色：自己填的加淡底，回落示例值的只有绿字 */
	function segmentClass(segment: CommandSegment): string {
		return segment.filled ? VAR_FILLED : VAR_TEXT;
	}

	/**
	 * 列表滚动区的高度策略（两档见 `fill` 的 prop 注释）。类名在脚本里拼好：
	 * class 属性里的三元会被 prettier 拆断而静默失效。
	 */
	const listClass = $derived(
		fill ? 'max-h-[60vh] min-h-0 overflow-y-auto lg:max-h-none lg:flex-1' : 'max-h-[60vh] min-h-0 overflow-y-auto'
	);

	// 「全部」在前（默认档，整张表都在 HTML 里），「常用」是它的筛选档
	const filters = $derived<{ value: CheatsheetFilter; label: string }[]>([
		{ value: 'all', label: '全部' },
		{ value: 'featured', label: '常用' },
		...store.groups.map((group) => ({ value: group.id, label: group.name }))
	]);

	const countText = $derived(`${store.total} 条`);
	// 空态分两种文案：搜索无结果 ≠ 分组下没内容（否则用户不知道该清搜索还是该换分组）
	const emptyText = $derived(store.query === '' ? '这个分组下暂时没有命令。' : '没有匹配的命令，换个关键词试试。');

	function filterChipClass(value: CheatsheetFilter): string {
		return store.filter === value ? CHIP_ON : CHIP_OFF;
	}

	/** 备选写法 chips：下标 0 是主模板，`i + 1` 对应 `variants[i]` */
	function variantChips(cmd: CheatsheetCommand): { label: string; index: number }[] {
		return [{ label: '默认', index: 0 }, ...(cmd.variants ?? []).map((v, i) => ({ label: v.label, index: i + 1 }))];
	}

	function variantChipClass(cmd: CheatsheetCommand, index: number): string {
		return store.variantIndexOf(cmd) === index ? CHIP_ON : CHIP_OFF;
	}

	function dangerTone(cmd: CheatsheetCommand): BadgeTone {
		return cmd.danger === 'destructive' ? 'error' : 'warn';
	}

	function dangerText(cmd: CheatsheetCommand): string {
		return cmd.danger === 'destructive' ? '危险' : '谨慎';
	}

	function dangerTitle(cmd: CheatsheetCommand): string {
		return cmd.danger === 'destructive'
			? '删除对象或数据丢失，执行前确认目标'
			: '会改动文件 / 服务 / 磁盘状态，执行前确认目标';
	}
</script>

<Panel id="{uid}-panel" headingId="{uid}-heading" {heading}>
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>点行首图标复制</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{countText}</span>
	{/snippet}

	<div class={SEARCH_ROW}>
		<div class="relative min-w-0 flex-1">
			<Search class={SEARCH_ICON} aria-hidden="true" />
			<label class="sr-only" for="{uid}-search">搜索命令</label>
			<input
				id="{uid}-search"
				type="search"
				value={store.query}
				oninput={(event) => store.setQuery(event.currentTarget.value)}
				placeholder={searchPlaceholder}
				class={SEARCH_INPUT}
			/>
		</div>
		<!-- 常驻渲染：按钮随搜索词显隐会让搜索条里的控件位置跳变 -->
		<Button label="清空搜索词" title="清空" disabled={store.query === ''} onclick={() => store.clearQuery()}>
			清空
		</Button>
	</div>

	<div
		class="flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-100 px-4 py-2"
		role="group"
		aria-label={filterLabel}
	>
		{#each filters as item (item.value)}
			<button
				type="button"
				class={filterChipClass(item.value)}
				aria-pressed={store.filter === item.value}
				onclick={() => store.setFilter(item.value)}
			>
				{item.label}
			</button>
		{/each}
	</div>

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     svelte 的静态规则不认识 role="region"，这里放行（与 MIME 速查同款） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class={listClass} tabindex="0" role="region" aria-label={listLabel}>
		{#if store.sections.length === 0}
			<div class="p-4">
				<EmptyState>{emptyText}</EmptyState>
			</div>
		{:else}
			{#each store.sections as section (section.id)}
				<section class="border-b border-gray-100 last:border-b-0" aria-labelledby="{uid}-group-{section.id}">
					<h3 id="{uid}-group-{section.id}" class={LIST_HEADING}>
						{section.name}（{section.items.length}）
					</h3>
					<ul class="divide-y divide-gray-100">
						{#each section.items as cmd (cmd.id)}
							{@const template = store.templateOf(cmd)}
							{@const segments = tokenizeCommand(template, store.effectiveVars, filledVars)}
							{@const commandText = renderCommand(template, store.effectiveVars)}
							<ResultRow class="items-start">
								<!-- 复制按钮放命令**左侧**：一列下来按钮落在同一条竖线上，
								     命令的起始位置也因此整齐（放行尾时每行长命令长短不一，按钮右边界看着散）。

								     `-mt-0.5`（上提 2px）是**视觉居中**用的：行是 `items-start`，
								     命令首行行高 `leading-5` = 20px，而图标钮 / 徽章都是 `size-6` = 24px，
								     顶对齐时它们的中心比首行中心低 2px，看着像没对齐。 -->
								<CopyButton
									icon
									class="-mt-0.5"
									text={commandText}
									ok="已复制命令"
									label="复制命令：{cmd.desc}"
									title="复制这条命令"
								/>

								<div class="min-w-0 flex-1">
									<p class="font-mono text-xs leading-5 break-all text-gray-900">
										{#each segments as segment, i (i)}{#if segment.varKey}<span class={segmentClass(segment)}
													>{segment.text}</span
												>{:else}{segment.text}{/if}{/each}
									</p>
									<p class="text-[11px] leading-4 text-gray-600">{cmd.desc}</p>
									{#if cmd.note}
										<p class="mt-0.5 text-[11px] leading-4 text-gray-600">{cmd.note}</p>
									{/if}
									{#if cmd.variants}
										<div class="mt-1.5 flex flex-wrap gap-1.5">
											{#each variantChips(cmd) as chip (chip.index)}
												<button
													type="button"
													class={variantChipClass(cmd, chip.index)}
													aria-pressed={store.variantIndexOf(cmd) === chip.index}
													onclick={() => store.setVariant(cmd.id, chip.index)}
												>
													{chip.label}
												</button>
											{/each}
										</div>
									{/if}
								</div>

								{#if cmd.danger}
									<!-- 与左侧的复制按钮同一条水平线：`h-6` 徽章在 `items-start` 下同样偏低 2px -->
									<div class="-mt-0.5 flex shrink-0 items-center gap-1.5">
										<Badge size="sm" tone={dangerTone(cmd)} title={dangerTitle(cmd)}>{dangerText(cmd)}</Badge>
									</div>
								{/if}
							</ResultRow>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">{footerHint}</p>
		</div>
	{/snippet}
</Panel>
