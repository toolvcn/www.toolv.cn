<script lang="ts">
	// 全站按钮的唯一入口：带文字的按钮与行内图标按钮都走这里。
	//
	// 尺寸档位与配色见 UI-STYLE §9：
	//   文字：lg = h-11 页级主 CTA / 移动端、md = h-9 主操作、sm = h-8 次级、xs = h-7 面板 header
	//   图标：md = size-6（24px，触控目标下限）、sm = size-5（需调用方自行扩热区）
	// 之前 IconButton 是独立组件，两个组件各维护一份尺寸表与焦点环，
	// 于是「图标尺寸改了文字没改」这类漂移只能靠逐处比对发现，收进来之后两档在一处定义。
	//
	// 继承 HTMLButtonAttributes + rest 透传：除下面显式声明的几个（label / title / variant /
	// size / type / class / children / icon / ref），其余原生属性（id、form、autofocus、
	// aria-expanded、data-*、onkeydown……）原样落到 <button> 上，不再需要为它们往这里加 prop。
	// 上一版只继承了类型却没有透传，传进来的属性被静默丢掉 —— 这是重写的起因。
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { DISABLED, FOCUS_RING, FOCUS_RING_DANGER } from '../styles.ts';

	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'neutral';
	type Size = 'xs' | 'sm' | 'md' | 'lg';

	type Props = Omit<HTMLButtonAttributes, 'class' | 'children' | 'size' | 'type'> & {
		/** 无障碍名称。按钮文字往往太短，读屏需要更完整的一句 */
		label: string;
		/** 悬浮提示，省略则与 label 相同 */
		title?: string;
		/** primary 蓝实底 / secondary 灰描边 / danger 红描边 / ghost 无边框蓝字 / neutral 灰（图标默认） */
		variant?: Variant;
		/** 文字：lg = h-11 / md = h-9 / sm = h-8 / xs = h-7；图标：md = size-6 / sm = size-5 */
		size?: Size;
		/** 表单里的提交按钮要传 submit，否则输入框里按回车不会提交 */
		type?: 'button' | 'submit' | 'reset';
		/** 切成圆形图标按钮：走另一张尺寸表与配色表，children 即图标本体 */
		icon?: boolean;
		class?: string;
		/** 按钮内容，省略则直接显示 label；icon 形态下即图标，通常不省的 */
		children?: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLButtonElement | null;
	};

	let {
		label,
		title,
		variant,
		size,
		type = 'button',
		icon = false,
		class: className = '',
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 两种形态的默认档不同，所以默认值不写在解构里，而是在这里按形态解析：
	// 文字默认 secondary / sm，图标默认 neutral / md。调用方显式传了的一律不覆盖。
	const resolvedVariant = $derived(variant ?? (icon ? 'neutral' : 'secondary'));
	const resolvedSize = $derived(size ?? (icon ? 'md' : 'sm'));

	const VARIANT_TEXT: Record<Variant, string> = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700',
		secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
		danger: 'border border-red-200 text-red-700 hover:bg-red-50',
		ghost: 'text-blue-600 hover:underline',
		success: 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50',
		warning: 'border border-amber-200 text-amber-700 hover:bg-amber-50',
		neutral: 'text-gray-700 hover:bg-gray-100'
	};

	// 图标按 WCAG 非文本对比度走 3:1，-600 这档刚好够（文字才需要 -700）
	const VARIANT_ICON: Record<Variant, string> = {
		neutral: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
		primary: 'text-blue-600 hover:bg-blue-50',
		success: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
		warning: 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
		danger: 'text-red-600 hover:bg-red-50 hover:text-red-700',
		secondary: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
		ghost: 'text-blue-600 hover:bg-blue-50'
	};

	// 高、内边距、字号一起跟着尺寸走：lg = text-base / md = text-sm / sm·xs = text-xs
	// 面板内的次级按钮统一 text-xs —— 同样高却两种字号会显得凌乱
	//
	// whitespace-nowrap 不能省：按钮高度固定，文字一旦换行就会溢出按钮框、压到相邻控件。
	// 窄到放不下时让整行溢出 / 由调用方给横向滚动，也比文字挤出框强（同 SEG_BTN 的约定）。
	//
	// sm 档跟 `$lib/ui/styles` 的 `ACTION_BTN` 逐字对齐（h-8 + px-2.5 + gap-1.5）：
	// 那条常量是工具条按钮的老写法，两者曾差 2px 内边距与 2px 字图间距，
	// 同一个「工具条按钮」因此长成两种样子。现在工具条一律走 `<Button size="sm">`。
	const SIZE_TEXT: Record<Size, string> = {
		lg: 'h-11 gap-2 px-5 text-base whitespace-nowrap',
		md: 'h-9 gap-1.5 px-4 text-sm whitespace-nowrap',
		sm: 'h-8 gap-1.5 px-2.5 text-xs whitespace-nowrap',
		xs: 'h-7 gap-1 px-2 text-xs whitespace-nowrap'
	};

	// 图标形态只有正方形两档，宽高一起变。卡片这么写是为了让 xs / lg 也能落在合法值上，
	// 组合出来的 class 里不会出现 undefined
	const SIZE_ICON: Record<Size, string> = {
		lg: 'size-6',
		md: 'size-6',
		sm: 'size-5',
		xs: 'size-5'
	};

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[
			icon
				? 'inline-flex shrink-0 items-center justify-center rounded-full'
				: 'inline-flex items-center rounded-lg font-medium',
			icon ? SIZE_ICON[resolvedSize] : SIZE_TEXT[resolvedSize],
			icon ? VARIANT_ICON[resolvedVariant] : VARIANT_TEXT[resolvedVariant],
			resolvedVariant === 'danger' ? FOCUS_RING_DANGER : FOCUS_RING,
			DISABLED,
			className
		].join(' ')
	);
</script>

<button bind:this={ref} {type} {...rest} aria-label={label} title={title ?? label} class={cls}>
	{#if children}{@render children()}{:else if !icon}{label}{/if}
</button>
