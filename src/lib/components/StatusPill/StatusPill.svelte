<script lang="ts">
	// 输出卡片底部的状态胶囊：一句运行态文字（校验结果 / 进度 / 错误）。
	//
	// 原先 14 个工具各写一份 `role="status" aria-live="polite"` +
	// `w-full rounded-lg px-3 py-1 text-xs font-medium {三态三元}`，
	// 三态的配色也是各推一遍（都是灰 / 绿 / 红三选一），改配色要改 14 处。
	// 现在语义收成 tone 五档，配色见 $lib/ui/styles.ts 的 STATUS_PILL_TONE。
	//
	// role / aria-live 是这里给的默认值 —— 它存在的意义就是给读屏播报，
	// 调用方不该再手写一遍；真要改（比如改成 aria-live="assertive"）用 rest 覆盖即可。
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { STATUS_PILL, STATUS_PILL_TONE, type StatusTone } from '$lib/ui/styles';

	type Props = Omit<HTMLAttributes<HTMLParagraphElement>, 'children' | 'role'> & {
		/** 五档语义配色；默认 neutral（等待输入） */
		tone?: StatusTone;
		/** 文案可能很长时截断，避免撑高脚注（FOOTER_BAR 是固定 h-9） */
		truncate?: boolean;
		class?: string;
		children?: Snippet;
		/** 要拿到 DOM 节点时 bind:ref={el} */
		ref?: HTMLParagraphElement | null;
	};

	let {
		tone = 'neutral',
		truncate = false,
		class: className = '',
		children,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const cls = $derived(
		[STATUS_PILL, STATUS_PILL_TONE[tone], truncate ? 'truncate' : '', className].filter(Boolean).join(' ')
	);
</script>

<p bind:this={ref} role="status" aria-live="polite" {...rest} class={cls}>
	{#if children}{@render children()}{/if}
</p>
