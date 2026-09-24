<script lang="ts" generics="Lang extends string">
	// 代码生成通用件：目标语言 chips（h-7，aria-pressed）+ 深底代码块 + 复制按钮。
	//
	// 原先 http 与 regex 各写一份 `ui/CodegenTab.svelte`（结构逐字相同，仅 store 名与三处文案不同），
	// 任何一处改动都要同步两份 —— 收成这一件，差异全部走 props。
	// 语言列表与生成函数仍留在各工具的 `core/codegen.ts`（业务，不进共享层）。
	import { Copy } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { CHIP_OFF, CHIP_ON, CODE_BLOCK, TAB_TOOLBAR } from '$lib/ui/styles';

	interface Props {
		/** 语言选项，顺序即展示顺序 */
		langs: readonly { id: Lang; label: string }[];
		/** 当前语言 */
		value: Lang;
		onchange: (value: Lang) => void;
		/** 生成的代码原文（已在各工具的 store 里派生好） */
		code: string;
		oncopy: () => void;
		/** 复制按钮的无障碍名称，如「复制当前语言的请求代码」 */
		copyLabel: string;
		/** 代码块 id（工具页内唯一） */
		blockId: string;
		/** 代码块的无障碍名称，如「生成的请求代码」 */
		blockLabel: string;
	}

	let { langs, value, onchange, code, oncopy, copyLabel, blockId, blockLabel }: Props = $props();

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	function langClass(id: Lang): string {
		return value === id ? CHIP_ON : CHIP_OFF;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- `max-md:justify-start`：窄屏时 chips 参与本行的换行流（见下），若仍 `justify-between`
	     会把每一行都拉到两端，一行两个 chip 也会被撑开成一大片空白 -->
	<div class="{TAB_TOOLBAR} max-md:justify-start">
		<!-- 窄屏 `contents`：语言 chips 直接成为工具条的 flex 子项，与复制按钮**共用同一个换行流** ——
		     否则这层包裹会按内容吃满整行，复制按钮被挤到自己一行，选择区下面凭空多出一块
		     「只有一个小图标」的空白（360-400px 上尤为明显）。
		     宽屏恢复 `flex`：chips 一屏放得下，该层回到「一组 + 复制贴右端」的原样 -->
		<div role="group" aria-label="目标语言" class="flex min-w-0 flex-wrap items-center gap-1.5 max-md:contents">
			{#each langs as lang (lang.id)}
				<button
					type="button"
					class={langClass(lang.id)}
					aria-pressed={value === lang.id}
					onclick={() => onchange(lang.id)}
				>
					{lang.label}
				</button>
			{/each}
		</div>
		<!-- `max-md:ml-1`：窄屏时它与最后一行 chips 同排，隔开一点免得看着像又一个语言选项 -->
		<Button icon class="max-md:ml-1" label={copyLabel} title="复制代码" onclick={oncopy}>
			<Copy class="size-3.5" />
		</Button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col p-4">
		<!-- 可滚动代码区需可聚焦才能用键盘滚动（axe scrollable-region-focusable 硬性要求）；
		     svelte 的静态规则不认识 role="region"，这里放行 -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre id={blockId} tabindex="0" role="region" aria-label={blockLabel} class="{CODE_BLOCK} max-lg:max-h-[60vh]"><code
				>{code}</code
			></pre>
	</div>
</div>
