<script lang="ts">
	// 中央工作区：**左栏（工作区导航 + 参数预设）+ 主区（当前工作区的内容）**。
	//
	// 三个工作区标签**竖着排在左栏、参数预设上方**：横排那条标签栏要在主区顶上占一整条 48px，
	// 而左栏只有 16rem、竖着排正好装下 —— 主区因此多出整条标签栏的高度给请求与响应。
	// 移动端左栏是整页宽，竖排反而白占纵向高度，所以那边退回一排横排（见 styles.ts 的 NAV_*）。
	//
	// 工作区标签是**路由级切换**，不是弹层；选中项用 `aria-pressed` 标记（与全站标签同一口径，
	// 刻意不用 tablist —— 真 tablist 要补一整套方向键与 tabpanel 关联）。
	import { ArrowLeftRight, CodeXml, Send } from '@lucide/svelte';
	import type { LucideIcon } from '@lucide/svelte';
	import { httpStore } from '../core/store.svelte.ts';
	import type { WorkspaceTab } from '../core/types.ts';
	import { CODE_LANGS } from '../core/codegen.ts';
	import CodegenTab from '$lib/components/CodegenTab/CodegenTab.svelte';
	import ImportExportTab from './ImportExportTab.svelte';
	import PresetPanel from './PresetPanel.svelte';
	import RequestTab from './RequestTab.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { NAV_BTN, NAV_CARD, NAV_LIST, NAV_OFF, NAV_ON } from './styles.ts';

	const TABS: { value: WorkspaceTab; label: string; icon: LucideIcon }[] = [
		{ value: 'request', label: '请求调试', icon: Send },
		{ value: 'text', label: '导入 / 导出', icon: ArrowLeftRight },
		{ value: 'codegen', label: '代码生成', icon: CodeXml }
	];

	/** 主区面板的读屏名字（标题行不渲染了，见下面的 header snippet） */
	const activeLabel = $derived(TABS.find((tab) => tab.value === httpStore.tab)?.label ?? '工作区');

	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	function tabClass(value: WorkspaceTab): string {
		return `${NAV_BTN} ${value === httpStore.tab ? NAV_ON : NAV_OFF}`;
	}
</script>

<!-- relative 给 sr-only 的 h2 提供定位上下文，避免它逃出裁剪撑高文档 -->
<section id="http-workspace" aria-labelledby="http-workspace-heading" class="relative flex min-h-0 flex-1 flex-col">
	<h2 id="http-workspace-heading" class="sr-only">HTTP 请求调试工作区</h2>

	<!-- 小屏单列、lg 两栏，**同一份 DOM 靠 lg 的显式栅格定位换位置**：
	     小屏顺序 = 工作区标签 → 主区 → 预设。手机上要先把「输入 URL + 发送」这条主路径给人看到，
	     而不是排在它前面的预设货架（原先左栏整体在前，预设就夹在标签与请求条之间）。
	     lg 上标签回左栏顶部、预设回左栏下方、主区占右栏整高 —— 于是 DOM 按小屏顺序写
	     （标签 / 主区 / 预设），lg 那层不是「左栏 + 主区」两个格子而是四个。
	     外层 ToolShell 已带 p-4，这里只留面板间距 gap-4，避免双层内距。

	     **小屏 `content-start` 不能省**：栅格的 `align-content` 默认是 `stretch`，会把「内容没占满的
	     那部分高度」分摊给 `auto` 行 —— 内容短的工作区（「代码生成」）里，标签卡那一行会被拉高
	     （实测 54px → 92px），看上去就是「三个工作区选择下面多出一块白」。
	     宽屏有显式行模板（`auto + 1fr`）本来就填满，用不上这条 -->
	<div
		class="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 max-lg:content-start lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]"
	>
		<!-- 工作区标签：小屏一整行；lg 回左栏顶部（高度由内容决定） -->
		<div class="{NAV_CARD} min-w-0 lg:col-start-1 lg:row-start-1">
			<div class={NAV_LIST} role="group" aria-label="工作区标签">
				{#each TABS as tab (tab.value)}
					{@const Icon = tab.icon}
					<button
						type="button"
						class={tabClass(tab.value)}
						aria-pressed={httpStore.tab === tab.value}
						onclick={() => (httpStore.tab = tab.value)}
					>
						<Icon class="size-3.5 shrink-0" aria-hidden="true" />
						<span class="truncate">{tab.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- 主区：lg 占右栏整高。外面这层 1fr 栅格是把里面的卡片拉伸到满高用的 ——
		     里面可能是共享组件（CodegenTab），不能给它们加 class 让它 flex-1，
		     而栅格会把 `minmax(0,1fr)` 那一行的子项拉伸到满高，正好不用改共享件。

		     **每个栅格子项都必须带 `min-w-0`**：grid（以及行向 flex）子项的 `min-width: auto`
		     等于「最小内容宽度」，于是宽内容会一路把轨道撑开 —— 代码生成那块 `whitespace-pre`
		     的代码（最长行约 495px）就是这么把布局视口从 393 撑到 577 的，手机上表现为
		     **整页被缩小**（卡片只有 380px，代码块 527px）。`min-w-0` 让它能收缩，
		     代码块自身带 `overflow-auto`，于是改成块内横向滚动。 -->
		<div class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
			<!-- **只有那两个「裸内容」的工作区才包一层 Panel**：
			     「请求调试」自己就是三张卡（请求条 / 请求构造 / 响应），再套一层外壳就成了白卡套白卡，
			     而且会把主区推得比左栏多出一层边距；它直接落进栅格即可。
			     「导入 / 导出」与「代码生成」的内容本身不是卡片（靠外层卡片成形），所以仍旧包一层。

			     Panel 的 `heading` 必填 —— 它会渲染成 sr-only 的 h2，区域的读屏名字（当前是哪个工作区）不丢。
			     clip 关掉：卡内有下拉菜单（导入 / 导出的格式、代码生成的语言），
			     默认的 overflow-hidden 会把展开的菜单裁掉 -->
			{#if httpStore.tab === 'request'}
				<RequestTab />
			{:else}
				<Panel heading={activeLabel} clip={false} class="min-h-0 min-w-0">
					{#snippet header()}
						<!-- 标题行整条不渲染：标签已在左栏，这里再挂一条 48px 的标题栏就是白占高度 -->
					{/snippet}

					<div class="flex min-h-0 flex-1 flex-col">
						{#if httpStore.tab === 'text'}
							<ImportExportTab />
						{:else}
							<CodegenTab
								langs={CODE_LANGS}
								value={httpStore.codeLang}
								onchange={(v) => (httpStore.codeLang = v)}
								code={httpStore.code}
								oncopy={() => void httpStore.copyCode()}
								copyLabel="复制当前语言的请求代码"
								blockId="http-codegen-block"
								blockLabel="生成的请求代码"
							/>
						{/if}
					</div>
				</Panel>
			{/if}
		</div>

		<!-- 参数预设：小屏排在最后（次要面板别挡在主路径前面）；lg 回左栏下方。
		     也走 1fr 栅格拉伸（那个面板在移动端自带 `max-lg:max-h-56` 封顶，不会把首屏占满） -->
		<div class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] lg:col-start-1 lg:row-start-2">
			<PresetPanel />
		</div>
	</div>

	<Toast />
</section>
