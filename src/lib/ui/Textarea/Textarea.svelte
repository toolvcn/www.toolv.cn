<script lang="ts">
	// 多行输入框（跨工具公共组件）。继承 HTMLTextareaAttributes，其余原生属性（rows、
	// placeholder、readonly、oninput……）通过 rest 原样透传。
	//
	// 收在这里是为了让几件事只在一处定义，不靠逐处 review：
	//   1. label 关联 —— 渲染 sr-only 的 <label for>，不留无标注的 textarea（UI-STYLE §18）
	//   2. 透明无边框 —— 外观（边框 / 底色 / 聚焦转蓝）一律由外层 `EditorBox` 给（UI-STYLE §11.1），
	//      错误态同理走 `EditorBox` 的 `invalid`，组件自身不再画边框与焦点环
	//   3. 占位符 —— placeholder:text-gray-500；等宽字体时占位符回退成 sans（§15）
	//   4. 拖动 —— 面板里编辑区高度归容器管，默认 resize-none
	//   5. spellcheck="false" —— 代码 / JSON / token 一律关掉拼写检查，别再逐处写
	//
	// 高度、定位、断行这些**布局**不归组件管，由调用方用 class 传（见 `$lib/ui/styles.ts` 的
	// EDITOR_INPUT / EDITOR_OUTPUT）。内边距固定 8px，与框内其它编辑层同档。
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { DISABLED } from '../styles.ts';

	type Size = 'sm' | 'md';

	type Props = Omit<HTMLTextareaAttributes, 'class' | 'children' | 'value' | 'size'> & {
		/** 输入框名字，渲染成视觉隐藏的 label；调用方已在外部标注好时可不传，改给 aria-label */
		label?: string;
		/** 双向绑定：bind:value */
		value?: string;
		/** 等宽字体：代码 / JSON / Base64 一律开 */
		mono?: boolean;
		/** sm = text-xs（只读输出区，桌面再放大一档）/ md = text-sm（默认，编辑区） */
		size?: Size;
		/** 是否允许拖动改高度；面板里高度归容器管，默认关掉 */
		resize?: 'none' | 'y' | 'both';
		/** 字号（含行高）。传了就以它为准，`size` 档位不再生效 */
		textSize?: string;
		class?: string;
		/** 要拿到 DOM 节点时 bind:ref={el}（自动聚焦、选区操作） */
		ref?: HTMLTextAreaElement | null;
	};

	let {
		label,
		value = $bindable(''),
		mono = false,
		size = 'md',
		resize = 'none',
		textSize,
		class: className = '',
		id,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 没传 id 就用 $props.id() 生成一个（SSR 与客户端一致），保证 label 一定能关联上
	// $props.id() 只能出现在顶层的变量声明里，所以先取出来再用
	const uid = $props.id();
	const fieldId = $derived(id ?? uid);

	const RESIZE = { none: 'resize-none', y: 'resize-y', both: 'resize' } as const;

	// 两档的字号与行高绑在一起：分开给必然出现「字号变了行高没变」
	const SIZE: Record<Size, string> = {
		md: 'text-sm leading-6',
		sm: 'text-xs leading-5 sm:text-sm sm:leading-6'
	};

	const cls = $derived(
		[
			// 透明、无边框、8px 内边距：看到的框与聚焦转蓝都来自外层 `EditorBox`
			'w-full border-0 bg-transparent p-2 text-gray-900 placeholder:text-gray-500 focus:outline-none',
			textSize ?? SIZE[size],
			mono ? 'font-mono placeholder:font-sans' : '',
			RESIZE[resize],
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
<textarea bind:this={ref} id={fieldId} bind:value spellcheck="false" {...rest} class={cls}></textarea>
