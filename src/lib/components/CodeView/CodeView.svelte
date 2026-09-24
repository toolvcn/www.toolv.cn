<script lang="ts" generics="K extends string">
	// 代码高亮的渲染块（跨工具共用）：把 token 铺成一串上色 <span>。
	//
	// 这段循环原先有三份：`$lib/components/JsonView`（json-formatter / jwt-decoder / http 用）
	// 与 json-to-ts 自己的 TsView，逐字相同、只有配色不同。SQL 页是第三个需要代码高亮的工具，
	// 按 UI-STYLE §14 的预告收成这里一份 —— 渲染结构不变，**配色由调用方用 classMap 传进来**
	// （JSON 仍走 `$lib/ui/styles` 的 JSON_TOKEN_CLASS，TS / SQL 各自带自己的色板）。
	// websocket 的日志面板仍未并进来：它的高亮长在日志行里、配色要配底色（见 LogPanel）。
	//
	// 文本一律走 Svelte 文本节点，不经过 {@html}，用户输入天然安全（AGENTS §12 A 层第 3 条）。
	// <pre><code>{#each} 刻意写成一行：<pre> 里的换行与缩进会原样渲染出来。
	// 版式（font-mono / p-4 / 高度 / 焦点环）由调用方用 class 给，各工具不一样。
	//
	// 调用方给的 tabindex / role / aria-label 走 rest 展开（可滚动代码区要能键盘滚动，
	// 见 axe 的 scrollable-region-focusable）；svelte 的 a11y 静态检查看不到展开的属性，
	// 所以这个组件内部不需要 svelte-ignore，调用方也不再需要。
	import type { HTMLAttributes } from 'svelte/elements';

	/** token 的最小形状：各工具自己的 token 类型（JsonToken / TsToken / SqlToken）都满足它 */
	interface Token {
		text: string;
		kind: K;
	}

	type Props = HTMLAttributes<HTMLPreElement> & {
		tokens: readonly Token[];
		/** kind → 颜色类。色板留在各自工具，不在这里堆条件 */
		classMap: Record<K, string>;
		ref?: HTMLPreElement | null;
	};

	let { tokens, classMap, ref = $bindable(null), ...rest }: Props = $props();
</script>

<pre bind:this={ref} {...rest}><code
		>{#each tokens as token, index (index)}<span class={classMap[token.kind]}>{token.text}</span>{/each}</code
	></pre>
