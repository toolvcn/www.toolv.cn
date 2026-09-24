<script lang="ts" generics="T extends string">
	// 标签切换外壳：标签条一行 + 下方内容区。
	//
	// 原先 generator / unit-converter / text-tools / date-calculator / cheatsheet 五个工具
	// 各自写一份 `ui/Panel.svelte`，除 TABS 元数据与分支内容外逐字相同 ——
	// 而且那个文件名跟共享的 `Panel` 撞名，调用方只能 `import PanelCard` 绕开，读代码容易误判。
	//
	// 与 `Tabs` 的分工：Tabs 只画标签条，这里补上「标签条 + 内容区」的页面骨架
	// （外层纵向容器、gap、内容区的高度策略）。
	// **Toast 不收进来**：全局提示层跟标签切换无关，仍由工具页自己放一个（UI-STYLE §11.3）。
	//
	// 属性分流：`id` / `class` 落外层容器，其余（含 `aria-label`）透传给 `Tabs` ——
	// 标签条才是需要无障碍名字的那个元素（跟 Button 同构：rest 透传到真正需要它的那一层）。
	import type { Component } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import Tabs from '$lib/components/Tabs/Tabs.svelte';

	interface TabOption<V extends string> {
		value: V;
		label: string;
		/** 图标组件（@lucide/svelte）。窄屏由 Tabs 自己隐藏 */
		icon?: Component<{ class?: string }>;
	}

	// Omit 'onchange'：它跟原生的 onchange（Event）撞名，不去掉会合并成联合类型，
	// 调用方写的 (v) => store.setTab(v) 里 v 就变成 `Tab | Event`（跟 Tabs / SegmentedControl 同一处坑）
	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'id' | 'onchange'> & {
		/** 标签列表；顺序即渲染顺序 */
		options: readonly TabOption<T>[];
		value: T;
		onchange: (value: T) => void;
		/** 转发给 Tabs：card 独立卡片 / flat 不带阴影 / line 贴顶横线 */
		variant?: 'card' | 'flat' | 'line';
		/** 外层容器的附加类（各工具的高度策略不同，如 text-tools 的 h-full） */
		class?: string;
		id?: string;
		/** 当前标签对应的工作区；切哪个分支由调用方写 `{#if}` */
		children: Snippet;
		/** 要拿到外层容器 DOM 时 bind:ref={el} */
		ref?: HTMLDivElement | null;
	};

	let {
		options,
		value,
		onchange,
		variant = 'card',
		class: className = '',
		id,
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const cls = $derived(['flex min-h-0 flex-1 flex-col gap-4', className].filter(Boolean).join(' '));
</script>

<div bind:this={ref} {id} class={cls}>
	<Tabs {...rest} {options} {value} {onchange} {variant} />
	{@render children()}
</div>
