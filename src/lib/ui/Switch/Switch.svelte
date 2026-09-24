<script lang="ts">
	// 滑动开关（跨工具公共组件）。role="switch" + aria-checked，键盘可聚焦、空格 / 回车切换。
	//
	// 之前 http（蓝 h-6 w-11）与 websocket（绿 h-7 w-10）各写一份，轨道尺寸与开态颜色都不一样。
	// 收在这里之后按 UI-STYLE 定死一版：外框 h-7（§3 开关档，同时满足触控目标）、
	// 轨道 h-5 w-9、圆钮 size-4；开态 emerald-500、关态 gray-300（§1：开关 on 走「成功」语义色）。
	//
	// 与 Button 同构：继承 HTMLButtonAttributes + rest 透传 + ref 暴露 DOM。
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { DISABLED, FOCUS_RING } from '../styles.ts';

	type Props = Omit<HTMLButtonAttributes, 'class' | 'children' | 'size' | 'type' | 'value' | 'onclick'> & {
		/** 无障碍名称，同时作为 title 的兜底 */
		label: string;
		/** 悬浮提示：说明开了会怎样 */
		title?: string;
		/** 开关状态，双向绑定：bind:checked */
		checked?: boolean;
		/** 点击回调：在 checked 翻转之后触发 */
		onclick?: HTMLButtonAttributes['onclick'];
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLButtonElement | null;
	};

	let {
		label,
		title,
		checked = $bindable(false),
		type = 'button',
		class: className = '',
		ref = $bindable(null),
		onclick,
		...rest
	}: Props = $props();

	function toggle(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }): void {
		checked = !checked;
		onclick?.(event);
	}

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[
			'relative inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-full',
			FOCUS_RING,
			DISABLED,
			className
		].join(' ')
	);
	const trackCls = $derived(
		['relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-emerald-500' : 'bg-gray-300'].join(' ')
	);
	const knobCls = $derived(
		[
			'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
			checked ? 'translate-x-4' : 'translate-x-0'
		].join(' ')
	);
</script>

<button
	bind:this={ref}
	{type}
	role="switch"
	aria-checked={checked}
	aria-label={label}
	title={title ?? label}
	{...rest}
	onclick={toggle}
	class={cls}
>
	<span aria-hidden="true" class={trackCls}>
		<span class={knobCls}></span>
	</span>
</button>
