<script lang="ts">
	// 命令速查表的通用界面：**左右双栏版式** —— 左栏「变量条在上、参数预设面板在下」，
	// 右栏命令列表。三个工具（docker / git / linux）各传自己的数据与几句文案。
	//
	// 定位：它是**组装件**（$lib/components），只认 props 里的 store、文案与预设面板那个 snippet，
	// 不掺任何工具的业务 —— 每个工具的 `+page.svelte` 只负责 ToolShell + SEO head + 传参 + 预设持久化。
	// 状态由调用方在 `core/store.svelte.ts` 里 new 出来，模块顶层导出单例（STRUCTURE §0 硬约束 3）。
	//
	// 为什么版式收在这里：docker 先改双栏时是各页自己画栅格，git / linux 跟上就是第三份一模一样的
	// 栅格（连「左栏 22rem 是下限」这种数都要抄三遍）。预设面板仍由各工具用 `presets` snippet 传进来
	// —— 那是业务绑定（idPrefix / 摘要文案 / 空态），按 STRUCTURE §2 C 留在 `src/routes/<tool>/ui/`。
	import type { Snippet } from 'svelte';
	import CommandList from './CommandList.svelte';
	import VarBar from './VarBar.svelte';
	import type { CheatsheetStore } from './cheatsheet.svelte.ts';

	type Props = {
		store: CheatsheetStore;
		/** 无障碍名字的前缀（工具名），如「Docker」 */
		namePrefix: string;
		/** 列表面板标题 */
		heading: string;
		/** 搜索框占位符 */
		searchPlaceholder: string;
		/** 变量条右侧的提示 */
		varsHint: string;
		/** 列表底栏提示 */
		footerHint: string;
		/**
		 * 参数预设面板（各工具的 `ui/PresetPanel.svelte`），放在左栏变量条下面。
		 * **不传就不出这一块**，左栏只剩变量条。
		 */
		presets?: Snippet;
	};

	let { store, namePrefix, heading, searchPlaceholder, varsHint, footerHint, presets }: Props = $props();
</script>

<!-- 左右双栏：左栏「变量条在上、预设面板在下」，右栏命令列表。
     宽屏（lg 起）走 ToolShell 的 `fill` **满屏**：两栏各占视口高度、各自内部滚，
     所以命令列表能填满右栏（`CommandList fill`）、不会卡在 60vh 下面留一片白。
     页面侧记得开 `fill="fill" fillFrom="lg"`，否则「剩余高度」不存在。

     左栏给 22rem：再窄「更多变量」的网格就只剩一列（9~10 个变量拖成 9 行），
     再宽则没必要（命令列表才是主角）。嫌宽 / 嫌窄就调这一个数。

     `min-w-0` 不能省：栅格（以及行向 flex）子项的 `min-width: auto` 等于「最小内容宽度」，
     长命令会一路把布局视口撑开，手机上表现为整页被缩小。
     `max-lg:content-start` 同理不能省：栅格的 align-content 默认 stretch，
     会把内容没占满的那一行拉高。
     小屏退回自然流（`grid-cols-1`），单列顺序 = 变量条 → 预设 → 命令列表。 -->
<div class="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 max-lg:content-start lg:grid-cols-[22rem_minmax(0,1fr)]">
	<!-- 左栏自己滚（`lg:overflow-y-auto`）：变量条展开后整列可能超过视口高度，
	     这时让这一列滚，而不是把预设面板压扁或把内容顶出屏幕 -->
	<div class="flex min-h-0 min-w-0 flex-col gap-4 lg:overflow-y-auto">
		<VarBar {store} hint={varsHint} {namePrefix} />

		{#if presets}
			<!-- 预设面板撑满左栏剩下的高度（`grow` + 1fr 栅格）。没有这层它只按内容长
			     （空态就一条提示那么矮），左栏下半截会留一大片空白。

			     `grow` 而不是 `flex-1`：`flex-1` 的 basis 是 0，容器高度为 auto 时会把面板压到 0 高。
			     `shrink-0` 与 `grow` 搭配：**内容超出时不许缩**，让左栏去滚（否则变量条展开时
			     预设面板会被一路压扁）。共享的 `PresetPanel` 不加 class，所以由外面这层负责拉伸。 -->
			<div class="grid min-w-0 shrink-0 grow grid-rows-[minmax(0,1fr)]">
				{@render presets()}
			</div>
		{/if}
	</div>

	<!-- 命令列表：满屏那一档要把面板拉伸到整列高（1fr 栅格），列表本身再 `fill` 吃满 -->
	<div class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)]">
		<CommandList
			{store}
			{heading}
			{searchPlaceholder}
			{footerHint}
			listLabel="{namePrefix}命令列表"
			filterLabel="{namePrefix}命令分组"
			fill
		/>
	</div>
</div>
