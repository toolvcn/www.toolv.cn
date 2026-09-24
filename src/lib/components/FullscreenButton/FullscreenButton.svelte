<script lang="ts">
	// 面板标题行的「全屏」图标按钮：双栏工具的编辑面板与 /http 的请求 / 响应面板共用。
	//
	// 走**原生全屏 API**，与 /clock 的「本页全屏」同一套：Esc 退出、焦点与键盘可达性都由浏览器负责。
	// 自绘 `fixed inset-0` 遮罩则要自己补焦点陷阱 / inert / 滚动锁定 —— 那才是这个功能全部的复杂度；
	// 所以这里只有三件事：目标元素、一个布尔、一次 toggle。
	//
	// 原先只在 /http/ui 里（同工具的两个面板共用）。因为双栏工具的编辑面板也要共用同一套行为
	// （提示文案、Esc 同步、被拒兜底只该有一份），按 STRUCTURE §2 C 的提升门槛收到 $lib/components。
	import { Maximize, Minimize } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	let {
		/** 要全屏的元素（面板根节点）。用 getter 传：元素是 `bind:ref` 拿到的，首帧还是 null */
		target,
		/** 面板名，拼进无障碍名（「全屏查看响应」） */
		name,
		/** 进全屏前要额外做的事：面板收起时先展开，否则全屏里只剩一条标题行 */
		onenter,
		/** 真实状态变化时写回，供调用方切布局类名（`h-dvh` 那一份） */
		fullscreen = $bindable(false)
	}: {
		target: () => HTMLElement | null;
		name: string;
		onenter?: () => void;
		fullscreen?: boolean;
	} = $props();

	async function toggle(): Promise<void> {
		if (document.fullscreenElement !== null) {
			await document.exitFullscreen();
			return;
		}
		const element = target();
		if (element === null) return;
		try {
			onenter?.();
			await element.requestFullscreen();
		} catch {
			// 与 /clock 同一句兜底：iframe 沙箱 / 权限策略下原生全屏可能被拒
			toast.show('全屏失败，可以试试按 F11', true);
		}
	}

	// 用户按 Esc（或点浏览器自带的退出）时要同步回来 —— 只靠自家按钮记账会与真实状态脱节。
	// **必须比对身份**：同一页有两个面板都能全屏，只看 `fullscreenElement !== null` 会把另一个也点亮
	$effect(() => {
		const onChange = (): void => {
			fullscreen = document.fullscreenElement === target();
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});
</script>

<Button
	icon
	label={fullscreen ? '退出全屏' : `全屏查看${name}`}
	title={fullscreen ? '退出全屏（也可以按 Esc）' : `全屏查看${name}`}
	aria-pressed={fullscreen}
	onclick={() => void toggle()}
>
	{#if fullscreen}
		<Minimize class="size-3.5" aria-hidden="true" />
	{:else}
		<Maximize class="size-3.5" aria-hidden="true" />
	{/if}
</Button>
