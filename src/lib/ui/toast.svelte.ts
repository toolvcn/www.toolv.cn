// 全站提示（toast）的状态机 + 唯一实例。
//
// 提到这里的理由：20 个工具的 `core/store.svelte.ts` 各自抄了一份
// 「toastMessage / toastVisible / toastError + #toastTimer + showToast」，
// 连「重复触发时重置计时而不是排队」这条都一样（websocket 那份只少了失败态）。
// 逻辑一字不差、只有文案不同，所以状态机收在这里，工具侧只留文案。
//
// 为什么是单例而不是每个 store 一个：一页只跑一个工具，不需要按工具隔离；
// 这样 store 里连 toast 字段都不用留，直接 `toast.show('已复制结果')`。
// 组件在 `$lib/ui/Toast/Toast.svelte`，每个工具页挂一次。

/** 停留时长（毫秒）：够读完一眼，又不至于挡着下一步 */
export const TOAST_DURATION = 2000;

/** 底色：默认深灰兜底，失败用红 */
export type ToastTone = 'neutral' | 'error';

export class ToastState {
	visible = $state(false);
	message = $state('');
	tone = $state<ToastTone>('neutral');

	#timer: ReturnType<typeof setTimeout> | null = null;

	/** 弹一条提示；重复触发重置计时，不排队 */
	show(message: string, error = false): void {
		this.message = message;
		this.tone = error ? 'error' : 'neutral';
		this.visible = true;
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => (this.visible = false), TOAST_DURATION);
	}
}

/** 全站唯一实例；测试里直接改它的字段来复位 */
export const toast = new ToastState();
