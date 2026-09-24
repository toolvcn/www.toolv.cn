<script lang="ts">
	// 全站二次确认框（破坏性操作前的那一句）。状态机在 `$lib/ui/confirm.svelte.ts`，
	// 这里只负责把它渲染成一个 `<dialog>`。
	//
	// 为什么走原生 `<dialog>` + showModal()：焦点陷阱、Esc 关闭、背景 inert、`::backdrop`、
	// 顶层渲染（z-index 免谈）五件事浏览器全包了。自绘遮罩这五样都得自己写对，而其中任何一样
	// 写错都不会被工具查出来（`ToolMenu` 的抽屉就为此写了一整套焦点接管）。
	//
	// 焦点落点：`showModal()` 默认聚焦「第一个可聚焦元素」，这里**显式把焦点给「取消」**
	// —— 取消是不动数据的那一个，误按回车不该把东西删掉。
	// 不用 `autofocus` 属性：Svelte 的 a11y 检查会为此报警（a11y_autofocus），
	// 于是改成开框之后自己调 `focus()`，效果相同且报错更少。
	import Button from '$lib/ui/Button/Button.svelte';
	import { confirm as globalConfirm, type ConfirmState } from '$lib/ui/confirm.svelte';

	let { confirm = globalConfirm }: { confirm?: ConfirmState } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let cancelButton = $state<HTMLButtonElement | null>(null);

	// 打开 / 关闭只在这里发生（状态是唯一真相，DOM 跟着它走）：
	// 别处再手写一次 `showModal()` 就会出现「状态说关了、框还在」的分叉
	$effect(() => {
		const el = dialog;
		if (el === null) return;
		if (confirm.open && !el.open) {
			el.showModal();
			cancelButton?.focus();
		} else if (!confirm.open && el.open) {
			el.close();
		}
	});
</script>

<!-- Esc 与「点确认 / 点取消」两条路都要收到一个明确的「否」，否则调用方的 await 会永远悬着：
     Esc 由浏览器自己关框并派发 close 事件（不 preventDefault 就能拿到），
     它的语义就是取消 —— 所以 close 一律按 false 兑现，取消按钮那条路是幂等的。 -->
<dialog
	bind:this={dialog}
	onclose={() => confirm.settle(false)}
	aria-labelledby="toolv-confirm-message"
	class="toolv-confirm m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-lg"
>
	<p id="toolv-confirm-message" class="text-sm leading-6">{confirm.message}</p>
	<!-- 取消在左、确认在右（中文习惯），两枚都走 lg 档 —— 对话框按钮是这一屏的主操作，
	     移动端 h-11 正好是 44px 触控目标（UI-STYLE §9 / §18） -->
	<div class="mt-4 flex justify-end gap-2">
		<Button bind:ref={cancelButton} size="lg" label={confirm.cancelLabel} onclick={() => confirm.settle(false)}>
			{confirm.cancelLabel}
		</Button>
		<Button size="lg" variant="primary" label={confirm.confirmLabel} onclick={() => confirm.settle(true)}>
			{confirm.confirmLabel}
		</Button>
	</div>
</dialog>
