<script lang="ts" generics="T extends string">
	// 多工作区标签条：互斥切换，选中项用 aria-pressed 标记。
	//
	// 原先两套并存、各自在工具里手写：
	//   ① 卡片式（h-9，`TAB_BAR`）：generator / csv-json / date-calculator / text-tools / unit-converter
	//   ② 横线式（h-12，`WS_TAB`）：regex 与 http，两份常量逐字相同
	// 结构其实完全一样：`role="group"` 容器 + N 个「图标 + 文字」按钮 + aria-pressed + onclick，
	// 差别只有外壳（独立卡片 vs 贴顶横线）与高度，收成一个 variant 两档。
	//
	// **刻意不用 role="tablist"**：真 tablist 要求方向键在标签间移动焦点、且要管 tabpanel 关联，
	// 这里只是「按钮组切内容」，上了 tablist 反而要补一堆键盘逻辑（各工具原本也是这么定的）。
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { TAB_BAR, TAB_BTN, TAB_OFF, TAB_ON } from '$lib/ui/styles';

	/** 横线式（h-12）的外壳与按钮：贴在工作区顶部，跟下方内容是一体的 */
	const TAB_LINE = 'flex shrink-0 border-b border-gray-200';
	const LINE_BTN =
		'flex h-12 min-w-0 flex-1 items-center justify-center gap-1 px-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset focus-visible:outline-none';
	const LINE_ON = 'bg-blue-600 text-white hover:bg-blue-700';
	const LINE_OFF = 'text-gray-600 hover:bg-gray-50';

	interface TabOption<V extends string> {
		value: V;
		label: string;
		/** 图标组件（@lucide/svelte）。窄屏由组件自己隐藏，放不下就藏 */
		icon?: Component<{ class?: string }>;
	}

	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'onchange'> & {
		/** 标签列表；顺序即渲染顺序 */
		options: readonly TabOption<T>[];
		value: T;
		onchange: (value: T) => void;
		/**
		 * card：独立卡片式，h-9，带边框圆角、分隔线与阴影（工具页顶部单独一行）
		 * flat：同 card 但**不带阴影** —— 标签条下方紧跟卡片时用，避免两层阴影叠着显脏
		 * line：贴顶横线式，h-12，只有下边框（工作区内部，跟下方内容一体）
		 *
		 * card / flat 两档在**标签多到一行放不下时整条横向滚动**（`TAB_BAR` 的 `overflow-x-auto`
		 * 配 `TAB_BTN` 的 `min-w-fit`）：单位换算 15 个分类、速查表 10 张表都靠它。
		 * `line` 档刻意不动 —— 它在卡片内部、最多四五个标签，容器不该出现滚动条。
		 */
		variant?: 'card' | 'flat' | 'line';
		class?: string;
		ref?: HTMLDivElement | null;
	};

	let {
		options,
		value,
		onchange,
		variant = 'card',
		class: className = '',
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const isLine = $derived(variant === 'line');
	const shellClass = $derived(isLine ? TAB_LINE : `${TAB_BAR}${variant === 'card' ? ' shadow-sm' : ''}`);
	const cls = $derived([shellClass, className].filter(Boolean).join(' '));
	const btnClass = (option: TabOption<T>): string =>
		isLine
			? `${LINE_BTN} ${value === option.value ? LINE_ON : LINE_OFF}`
			: `${TAB_BTN} ${value === option.value ? TAB_ON : TAB_OFF}`;
</script>

<div bind:this={ref} role="group" {...rest} class={cls}>
	{#each options as option (option.value)}
		{@const Icon = option.icon}
		<button
			type="button"
			class={btnClass(option)}
			aria-pressed={value === option.value}
			onclick={() => onchange(option.value)}
		>
			{#if Icon}<Icon class="hidden size-3.5 shrink-0 sm:block" />{/if}
			{option.label}
		</button>
	{/each}
</div>
