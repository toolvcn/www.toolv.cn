<script lang="ts">
	// 小徽章：一行短标签（状态码、分类、「输入」标记……），按语义上色。
	//
	// 跟 StatusPill 的区别：StatusPill 是卡片脚注里那条**会变**的运行态文字（撑满宽度、
	// 带 role="status"），Badge 是贴在标题行 / 列表行里的**静态**标记（内容宽度、不播报）。
	//
	// 原先 http 写了两份（响应状态徽章 4 色 + 状态码速查徽章 5 分类），
	// unit-converter 又写了一份「输入」标记 —— 外壳都是
	// `inline-flex h-N shrink-0 items-center [justify-center] rounded-lg px-* text-xs font-*`，
	// 收成下面这一个组件，配色见 $lib/ui/styles.ts 的 BADGE_TONE。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { BADGE_TONE, type BadgeTone } from '$lib/ui/styles';

	type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
		/** 五档语义配色；默认 neutral */
		tone?: BadgeTone;
		/** sm：h-6（贴在列表行里，跟 h-6 的行内控件同高）；md：h-7（面板标题行） */
		size?: 'sm' | 'md';
		/** 内容多为数字 / 进制值时用等宽；配合 class 的 min-w-* 保证三位数不抖宽 */
		mono?: boolean;
		class?: string;
		children?: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLSpanElement | null;
	};

	let {
		tone = 'neutral',
		size = 'md',
		mono = false,
		class: className = '',
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const cls = $derived(
		[
			'inline-flex shrink-0 items-center justify-center',
			size === 'sm' ? 'h-6 rounded px-1.5 text-xs font-medium' : 'h-7 rounded-lg px-2.5 text-xs font-semibold',
			mono ? 'font-mono' : '',
			BADGE_TONE[tone],
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<span bind:this={ref} {...rest} class={cls}>
	{#if children}{@render children()}{/if}
</span>
