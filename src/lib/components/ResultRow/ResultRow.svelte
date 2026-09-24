<script lang="ts">
	// 结果列表的一行：左侧标签 / 名称，中间结果文本，右侧行内操作（通常是复制按钮）。
	//
	// generator（3 个面板）/ case-converter / unit-converter / color-converter / radix-converter
	// 各自写着 `flex items-center gap-3 px-4 py-2`，生成器那几份还多了 hover 与 focus-within
	// 底色、其余四份没有 —— 同一个「结果行」在 7 处长成两个样子。收成组件后行距、
	// 间距、悬浮反馈只有一处定义。
	//
	// 行内的三段（名称 / 值 / 操作）各工具宽度差别很大（名称列 w-10 到 sm:w-52、值有
	// 右对齐与截断两种），所以这里只管行骨架，内容一律由 children 给。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLLIElement>, 'children'> & {
		/** sm：紧凑档（px-2 py-1.5，卡片里行多的用）；md：常规档（px-4 py-2） */
		density?: 'sm' | 'md';
		class?: string;
		children?: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLLIElement | null;
	};

	let { density = 'md', class: className = '', children, ref = $bindable(null), ...rest }: Props = $props();

	const cls = $derived(
		[
			'flex min-w-0 items-center gap-3',
			density === 'sm' ? 'px-2 py-1.5' : 'px-4 py-2',
			// 行尾有复制按钮时，鼠标悬浮或键盘聚焦到按钮都要给整行反馈
			'hover:bg-gray-50 focus-within:bg-gray-50',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<li bind:this={ref} {...rest} class={cls}>
	{#if children}{@render children()}{/if}
</li>
