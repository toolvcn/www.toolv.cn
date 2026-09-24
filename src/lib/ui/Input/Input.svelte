<script lang="ts">
	// 单行输入框（跨工具公共组件）。继承 HTMLInputAttributes，其余原生属性
	// （type、placeholder、maxlength、readonly、pattern、oninput、onkeydown……）
	// 通过 rest 原样透传，不用往组件里加 prop。value 用 bind:value 双向绑定。
	//
	// 与 Textarea（§11.1）同一套口径 —— label 关联、焦点环、错误态、等宽字体，
	// 差别只在两处：
	//   1. 高度走 size 档位（sm h-8 / md h-9 / lg h-11），不再单给 padding / textSize
	//   2. 没有 resize —— 单行输入框不存在拖动改高度
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { DISABLED, INPUT_FOCUS } from '../styles.ts';

	type Size = 'sm' | 'md' | 'lg';

	type Props = Omit<HTMLInputAttributes, 'class' | 'children' | 'value' | 'size'> & {
		/** 输入框名字，渲染成视觉隐藏的 label；调用方已在外部标注好时可不传，改给 aria-label */
		label?: string;
		/** 双向绑定：bind:value */
		value?: string;
		/** 错误态：红边 + 红焦点环（如金额非法、URL 解析失败） */
		invalid?: boolean;
		/** 等宽字体：正则、token、编码串一律开 */
		mono?: boolean;
		/** sm = h-8（密集工具条）/ md = h-9（默认，与 Button md 同高）/ lg = h-11（页面主输入） */
		size?: Size;
		class?: string;
		/** 要拿到 DOM 节点时 bind:ref={el}（自动聚焦、选区操作） */
		ref?: HTMLInputElement | null;
	};

	let {
		label,
		value = $bindable(''),
		invalid = false,
		mono = false,
		size = 'md',
		type = 'text',
		class: className = '',
		id,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 没传 id 就用 $props.id() 生成一个（SSR 与客户端一致），保证 label 一定能关联上
	// $props.id() 只能出现在顶层的变量声明里，所以先取出来再用
	const uid = $props.id();
	const fieldId = $derived(id ?? uid);

	// 高、内边距、字号一起跟着档位放大：只改高度不改字号会显得头重脚轻
	const SIZE: Record<Size, string> = {
		lg: 'h-11 px-4 text-base',
		md: 'h-9 px-3 text-sm',
		sm: 'h-8 px-2.5 text-xs'
	};

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[
			'w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-500',
			SIZE[size],
			invalid
				? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none'
				: `border-gray-300 ${INPUT_FOCUS}`,
			mono ? 'font-mono placeholder:font-sans' : '',
			DISABLED,
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if label}
	<!-- sr-only 是 absolute，父级必须带 relative，否则会逃出裁剪把文档撑高（§18） -->
	<label class="sr-only" for={fieldId}>{label}</label>
{/if}
<input bind:this={ref} id={fieldId} {type} bind:value aria-invalid={invalid} spellcheck="false" {...rest} class={cls} />
