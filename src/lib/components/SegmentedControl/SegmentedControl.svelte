<script lang="ts" generics="T extends string">
	// 分段选择：一组互斥的小按钮（模式 / 方向 / 单位 / 大小写……）。
	//
	// 原先 11 处各写一份：容器 `flex divide-x divide-gray-2/300 overflow-hidden rounded-lg border`，
	// 里面 N 个 `<button type="button" class={SEG_BTN + 选中态} aria-pressed onclick>`，
	// 选中态的三元在每个工具里各推一遍。组件化之后调用方只给 options / value / onchange。
	//
	// 语义是 `role="group"` + 每项的 `aria-pressed` —— 不是 tablist（不切换面板）、
	// 也不是 radio（没有表单提交语义），别改成那两种。
	import type { HTMLAttributes } from 'svelte/elements';
	import { DISABLED, SEG_BTN, SEG_BTN_QUIET, SEG_OFF, SEG_OFF_QUIET, SEG_ON, SEG_ON_QUIET } from '$lib/ui/styles';

	// 不导出：调用方写 `{ value, label }` 字面量即可（通常配 `as const`），
	// 不需要 import 这个类型。声明在实例 <script> 里，加 export 会被 TS 判为修饰符位置非法。
	interface SegmentedOption<V extends string> {
		value: V;
		label: string;
		/** 用不了就禁用（如压缩模式下的缩进）——禁用项仍常驻渲染，避免高度跳变 */
		disabled?: boolean;
		/** 补充说明，鼠标悬浮显示；label 太短时用它补一句 */
		title?: string;
	}

	// onchange 必须从 HTMLAttributes 里 Omit 掉：div 原生的 onchange 是 (Event) => void，
	// 不 Omit 会跟这里的 (value: T) => void 交叉成联合类型，调用方拿到的是 `T | Event`。
	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'onchange'> & {
		/** 选项列表；顺序即渲染顺序。readonly 是为了接 `as const` 数组 */
		options: readonly SegmentedOption<T>[];
		/** 当前选中的值 */
		value: T;
		/** 选中变化；只传新值，不派发事件对象 */
		onchange: (value: T) => void;
		/** 分隔线与边框深浅：工具条里用 light（gray-200），卡片正文里用 dark（gray-300） */
		edge?: 'light' | 'dark';
		/**
		 * 视觉档：
		 * - `default`：选中是**实心蓝底白字**、按钮 `px-3` —— 对比最强，一屏里只有一两处时最好扫。
		 * - `quiet`：选中是**浅蓝底 + 蓝字**、按钮收到 `h-7` + `px-2.5` —— 给**小节标题行**那种
		 *   一屏里可能同时出现好几处的地方：实心蓝块会互相抢镜头，控件比它自己那行 12px 的标题还响；
		 *   高度也矮一档，免得按钮框比标题高出一倍（用它的那行其余控件跟着 h-7）。
		 */
		tone?: 'default' | 'quiet';
		class?: string;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLDivElement | null;
	};

	let {
		options,
		value,
		onchange,
		edge = 'light',
		tone = 'default',
		class: className = '',
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const edgeClass = $derived(edge === 'dark' ? 'divide-gray-300 border-gray-300' : 'divide-gray-200 border-gray-200');
	/**
	 * `md:w-fit` 跟按钮那侧的 `md:flex-none` 是**一对**，不能只写一半。
	 *
	 * 按钮过了 md 改回自然宽度，但容器是 `div` + `flex`，宽度默认撑满父级 ——
	 * 于是按钮只占左边一段，右边空出来的那截仍被容器的边框兜住，
	 * 看着就像「最后一个选项的边框跑偏了」。放在**窄卡片**里（比如卡片列宽固定 256px、
	 * 而五个单字按钮只占 150px）尤其明显。
	 *
	 * `Tabs` 的 `TAB_BAR` 写的是 `sm:w-fit`（配它的 `sm:flex-none`），是同一个道理 —— 这里原先漏了。
	 * 小屏不加：那时按钮是 `flex-1`，本来就该均分整行。
	 */
	const cls = $derived(
		['flex divide-x overflow-hidden rounded-lg border md:w-fit', edgeClass, className].filter(Boolean).join(' ')
	);
	const btnClass = (option: SegmentedOption<T>): string => {
		const on = value === option.value;
		const base = tone === 'quiet' ? SEG_BTN_QUIET : SEG_BTN;
		const state = tone === 'quiet' ? (on ? SEG_ON_QUIET : SEG_OFF_QUIET) : on ? SEG_ON : SEG_OFF;
		return `${base} ${state} ${DISABLED}`;
	};
</script>

<div bind:this={ref} role="group" {...rest} class={cls}>
	{#each options as option (option.value)}
		<button
			type="button"
			class={btnClass(option)}
			aria-pressed={value === option.value}
			disabled={option.disabled ?? false}
			title={option.title}
			onclick={() => onchange(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
