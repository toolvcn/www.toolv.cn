<script lang="ts">
	// 编辑区外框：边框 + 浅底 + 聚焦转蓝 + 淡蓝柔环。错误态走 `invalid`（边框转红）。
	// **可编辑的输入区与只读的结果区共用同一副面貌**（UI-STYLE §11.1）—— 不靠底色区分能不能输入，
	// 区分靠卡片标题与只读光标。
	//
	// 只负责外观，不碰里面的控件：children 放 `<Textarea>`，或裸 `<textarea>`
	// （regex / sql 的镜像高亮编辑器必须两层逐字对齐，用不了 `<Textarea>`；框照样能套）。
	// 框内编辑层的内边距由控件自己带（`Textarea` 固定 8px / 镜像编辑器的 `EDITOR_TYPE` 同档）。
	// `relative` 在基类里不能省：镜像层是 `absolute inset-0`，没有定位上下文会逃到卡片外。
	//
	// 与卡片边的间距**不在这里**：有的场景外面已有内边距（表单域），有的要自己留一圈再放（双栏编辑区），
	// 所以框只给外观，间距由调用方补（双栏那两处套 `EDITOR_FRAME_PAD`）。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
		/** 错误态：边框转红 + 红焦点环（如正则替换结果非法） */
		invalid?: boolean;
		/** 附加在框上的类（高度 / 伸缩等版式） */
		class?: string;
		children: Snippet;
		/** 要拿到框 DOM 时 bind:ref={el} */
		ref?: HTMLDivElement | null;
	};

	let { invalid = false, class: className = '', children, ref = $bindable(null), ...rest }: Props = $props();

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[
			'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-gray-50',
			invalid
				? 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
				: 'border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
			className
		].join(' ')
	);
</script>

<div bind:this={ref} {...rest} class={cls}>
	{@render children()}
</div>
