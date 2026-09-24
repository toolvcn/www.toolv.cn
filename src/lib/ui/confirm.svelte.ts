// 全站二次确认（破坏性操作前问一句）的状态机 + 唯一实例。
//
// 提上来的起因：11 处「删掉就找不回来」的操作各自调原生 `confirm()`。原生对话框有三个
// 躲不掉的毛病：① 按钮由浏览器给，中文站碰上英文界面的浏览器就是「OK / Cancel」；
// ② 不跟随主题，深色页面里弹出一块白底系统框；③ 同步阻塞主线程，弹着的时候 toast 都不动。
// 所以换成 `<dialog>` 版本的，文案与配色都归站点。
//
// 为什么是原生 `<dialog>` + `showModal()` 而不是自绘遮罩：焦点陷阱、Esc 关闭、背景 inert、
// `::backdrop`、顶层渲染（不必跟 z-index 纠缠）浏览器全给，自绘这五样每一样都能写错。
// 组件在 `$lib/ui/Confirm/Confirm.svelte`，由 `+layout.svelte` 挂一次（全站一个实例）。
//
// 用法：`if (!(await confirm.ask('确定删除「x」吗？删除后无法恢复。'))) return;`
// 调用方必须是 async 函数 —— 破坏性操作因此天然带上了「等用户答完再做」的顺序。

/** 确认框的两个按钮文案 */
export interface ConfirmOptions {
	/** 确认按钮文字，默认「确定」 */
	confirmLabel?: string;
	/** 取消按钮文字，默认「取消」 */
	cancelLabel?: string;
}

export class ConfirmState {
	open = $state(false);
	message = $state('');
	confirmLabel = $state('确定');
	cancelLabel = $state('取消');

	/** 当前这一问的兑现函数；没有待答的问题时为 null */
	#resolve: ((value: boolean) => void) | null = null;

	/** 问一句；点确认给 true，点取消 / 按 Esc / 点其他地方给 false */
	ask(message: string, options: ConfirmOptions = {}): Promise<boolean> {
		// 上一句还没答完又来一句（连点两下破坏性按钮）：把前一句当成取消，
		// 不叠两层对话框 —— 叠起来之后用户答的是哪一句都说不清
		this.#settle(false);
		this.message = message;
		this.confirmLabel = options.confirmLabel ?? '确定';
		this.cancelLabel = options.cancelLabel ?? '取消';
		this.open = true;
		return new Promise((resolve) => (this.#resolve = resolve));
	}

	/** 收口：兑现 promise 并关掉对话框。**重复调用无副作用** ——
	 *  点确认后 `close()` 还会再触发一次 close 事件（那时 resolve 已经是 null） */
	settle(value: boolean): void {
		this.#settle(value);
		this.open = false;
	}

	#settle(value: boolean): void {
		const resolve = this.#resolve;
		this.#resolve = null;
		resolve?.(value);
	}
}

/** 全站唯一实例；测试里直接 `new ConfirmState()` 造一个自己的 */
export const confirm = new ConfirmState();
