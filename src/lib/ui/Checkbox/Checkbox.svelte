<script lang="ts">
	// 复选框 + 文字（跨工具公共组件）。checked 用 $bindable，调用方直接 bind:checked 双向同步。
	//
	// 与 Button 同构：继承 HTMLInputAttributes + rest 透传。除显式声明的几个
	// （checked / disabled / title / label / class / children / ref），
	// 其余原生属性（id、name、value、required、onchange……）原样落到 <input> 上。
	// 上一版只有手写的四个 prop，传 id / name / onchange 进来会被静默丢掉。
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<
		HTMLInputAttributes,
		'class' | 'children' | 'size' | 'type' | 'value' | 'checked' | 'disabled' | 'title'
	> & {
		checked?: boolean;
		disabled?: boolean;
		/** 悬浮提示：说明这个开关影响什么 */
		title?: string;
		/** 不传 children 时用它当文字 */
		label?: string;
		/** 附加类（如 ml-auto） */
		class?: string;
		/** 文字内容，省略则显示 label */
		children?: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLInputElement | null;
	};

	let {
		checked = $bindable(false),
		disabled = false,
		title,
		label,
		class: className = '',
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 禁用态整块淡出并给出 not-allowed，否则看不出点不动。
	// 条件类名在脚本里算好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[
			'inline-flex h-6 items-center gap-1.5 text-xs',
			disabled ? 'cursor-not-allowed text-gray-600 opacity-40' : 'cursor-pointer text-gray-600',
			className
		].join(' ')
	);
</script>

<label class={cls} {title}>
	<input
		bind:this={ref}
		type="checkbox"
		bind:checked
		{disabled}
		{...rest}
		class="size-3.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
	/>
	{#if children}{@render children()}{:else}{label}{/if}
</label>
