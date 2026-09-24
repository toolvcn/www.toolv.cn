<script lang="ts">
	// 全站提示条：浮在视口底部居中（`position="top"` 给底部有输入区的页面用）。
	//
	// 容器**常驻**：aria-live 区域必须是「已存在、内容变了」才会播报，
	// 跟着 visible 一起插入/移除时读屏往往一声不响。
	// 外层负责居中定位，内层只做动画 —— 让 fly 的 transform 覆盖不了居中。
	import { fly } from 'svelte/transition';
	import { toast as globalToast, type ToastState } from '$lib/ui/toast.svelte';
	import { motionDuration } from '$lib/ui/motion.svelte';
	import { TOAST_BOX, TOAST_ERROR, TOAST_NEUTRAL } from '$lib/ui/styles';

	let {
		toast = globalToast,
		position = 'bottom'
	}: {
		/** 默认用全站唯一实例；单独测组件时才传自己的 */
		toast?: ToastState;
		/** bottom 贴视口底部 / top 落在 h-14 导航栏下方（底部有输入区时用） */
		position?: 'bottom' | 'top';
	} = $props();

	const wrapClass = $derived(
		`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${position === 'top' ? 'top-16' : 'bottom-6'}`
	);
	const boxClass = $derived(`${TOAST_BOX} ${toast.tone === 'error' ? TOAST_ERROR : TOAST_NEUTRAL}`);
</script>

<div role="status" aria-live="polite" class={wrapClass}>
	{#if toast.visible}
		<div transition:fly={{ y: 8, duration: motionDuration(180) }} class={boxClass}>{toast.message}</div>
	{/if}
</div>
