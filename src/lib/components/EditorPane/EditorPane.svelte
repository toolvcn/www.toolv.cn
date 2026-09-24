<script lang="ts">
	// 双栏工具的**一侧**面板：Panel 外壳 + 标题行（补充信息 / 操作）+ 内容区 + 通栏底栏。
	//
	// 收它的理由：base64 / json-formatter / json-to-ts / hash-calculator / csv-json / html-entity /
	// url-encoder 七处各写一份同样的卡片骨架，其中最易写错的是输出侧那个
	// `relative min-h-56 flex-1 md:min-h-0` 容器 —— `EDITOR_OUTPUT`（`absolute inset-0`）全靠它给定位
	// 上下文与高度，漏掉任何一项输出区就撑不满或塌成 0（UI-STYLE §8.2）。
	//
	// **错误 / 空态 / 内容三选一**只在给了 `error` 或 `empty` 时才启用：
	// 输入侧不传，children 套进 `EditorBox` 编辑框（边框 + 底色 + 聚焦转蓝）后渲染；
	// 输出侧传 `error` + `empty` + `ready`，三选一的内容同样套框，框内是一块可聚焦滚动的只读区。
	// 三选一而不是 `{#if}` 整组删掉，是为了状态切换不引起高度跳变（UI-STYLE §17）。
	// 错误与空态都不挂 `role="status"`：运行态播报归底栏的 `StatusPill`（§13.1）。
	// 正文不是编辑器的（如 hash 的结果列表）传 `bare`，直接渲染 children。
	//
	// 槽名跟 `Panel` 保持一致（`headingExtra` / `actions` / `footer`）—— 两者是同一个位置，
	// 两套名字会让调用方每次都要想「这里该叫哪个」。
	//
	// 传 `fullscreen` 就在标题行右侧多一枚「全屏」按钮 —— 整件在 `Panel` 里，这边只是转交过去
	// （双栏工具的两侧都该有，各自独立、互不影响；全屏的是整张卡片）。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import { EDITOR_FRAME_PAD, OUTPUT_EMPTY, PANEL_HINT } from '$lib/ui/styles';

	type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
		/** 外壳 id，省略则由 Panel 用 $props.id() 生成 */
		id?: string;
		headingId?: string;
		heading: string;
		/**
		 * 标题右侧的补充小字（字符数、口径）。
		 * **传字符串就按 `PANEL_HINT` 渲染**（绝大多数是这个），要放更复杂的东西才传 snippet。
		 */
		headingExtra?: string | Snippet;
		/** 头部右侧的操作按钮（示例 / 清空 / 复制…） */
		actions?: Snippet;
		/** 错误文案；非空时优先于空态与内容 */
		error?: string;
		/** 空态文案；与 `ready` 配对 */
		empty?: string;
		/** 是否有内容 —— 「什么算有结果」只有调用方知道，所以判据从外面传 */
		ready?: boolean;
		/**
		 * 正文不是编辑器时传 true。非三选一分支默认把正文套进 `EditorBox` 编辑框（给输入侧用）；
		 * 结果列表这类纯展示正文传 `bare`，直接渲染 children。
		 */
		bare?: boolean;
		/** 通栏底栏（输入卡放提示、输出卡放 StatusPill） */
		footer?: Snippet;
		/** 是否在标题行右侧挂「全屏」按钮（默认关闭）。转交给 `Panel`，整件都在那边 */
		fullscreen?: boolean;
		/** 全屏按钮的无障碍名，缺省用 `heading`（拼成「全屏查看输出结果」）。同样转交 `Panel` */
		fullscreenName?: string;
		/** 附加在外壳上的类（各侧的滚动与高度策略不同） */
		class?: string;
		children: Snippet;
		/** 要拿到外壳 DOM 时 bind:ref={el}（动态标签，类型是 HTMLElement） */
		ref?: HTMLElement | null;
	};

	let {
		id,
		headingId,
		heading,
		headingExtra,
		actions,
		error,
		empty,
		ready = false,
		bare = false,
		footer,
		fullscreen = false,
		fullscreenName,
		class: className = '',
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 给了空态 / 错误文案才走三选一；否则当成普通内容面板
	const triState = $derived(error !== undefined || empty !== undefined);
</script>

<!-- 字符串形态在这里转成 snippet：Panel 只认 snippet，而调用方绝大多数只要一句小字 -->
{#snippet headingSlot()}
	{#if typeof headingExtra === 'string'}
		<span class={PANEL_HINT}>{headingExtra}</span>
	{:else if headingExtra}
		{@render headingExtra()}
	{/if}
{/snippet}

<Panel
	bind:ref
	{id}
	{headingId}
	{heading}
	headingExtra={headingSlot}
	{actions}
	{fullscreen}
	{fullscreenName}
	class={className}
	{footer}
	{...rest}
>
	{#if triState}
		<div class={EDITOR_FRAME_PAD}>
			<EditorBox>
				<div class="relative min-h-56 flex-1 md:min-h-0">
					{#if error}
						<p class={OUTPUT_EMPTY}>{error}</p>
					{:else if !ready}
						<p class={OUTPUT_EMPTY}>{empty}</p>
					{:else}
						{@render children()}
					{/if}
				</div>
			</EditorBox>
		</div>
	{:else if bare}
		{@render children()}
	{:else}
		<div class={EDITOR_FRAME_PAD}>
			<EditorBox>
				{@render children()}
			</EditorBox>
		</div>
	{/if}
</Panel>
