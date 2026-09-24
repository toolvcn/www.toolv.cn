<script lang="ts">
	// 区块内的空态提示。样式与文案间距只在这里定义，各工具的空态长得一样。
	//
	// 与 Button 同构：继承 HTMLAttributes + rest 透传（id、data-*、aria-live 等落到 <p> 上）。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLParagraphElement>, 'class' | 'children'> & {
		/** 附加类（如 mt-2、m-4） */
		class?: string;
		children: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLParagraphElement | null;
	};

	let { class: className = '', children, ref = $bindable(null), ...rest }: Props = $props();

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		['rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-600', className].join(' ')
	);
</script>

<p bind:this={ref} {...rest} class={cls}>
	{@render children()}
</p>
