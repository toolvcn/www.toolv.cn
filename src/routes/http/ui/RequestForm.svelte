<script lang="ts">
	// 请求构造面板：四个**横向标签** —— 参数 / 授权 / 请求头 / 请求体，标签条挂在面板标题行右侧。
	//
	// 为什么是标签而不是折叠段：这四处就是 Hoppscotch 的同一处布局，用户的肌肉记忆在那儿；
	// 而且四块内容互斥、各自要写满整块高度，标签比折叠省地方、也不会一屏堆两三个编辑区。
	// 标签用 SegmentedControl 的 quiet 档 —— 工作区那一层已经是实心蓝的 Tabs（h-12），
	// 这一层再叠一版实心蓝会抢镜头（UI-STYLE §12.1）。
	//
	// 整个面板还能**收起**（标题行右侧那枚箭头）：收起后只剩标题行，高度全给响应。
	// 还能**全屏**（同一排的那枚方形图标，与响应面板共用 FullscreenButton）：填长请求体时把整屏让给它。
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { httpStore } from '../core/store.svelte.ts';
	import type { RequestPanelTab } from '../core/types.ts';
	import AuthSection from './AuthSection.svelte';
	import BodySection from './BodySection.svelte';
	import FullscreenButton from '$lib/components/FullscreenButton/FullscreenButton.svelte';
	import ParamsSection from './ParamsSection.svelte';
	import { PANEL_EDITOR } from './styles.ts';

	/** 高度策略由 RequestTab 按「收起 / 上下 / 左右」算好传进来（面板自己不知道页面的排法） */
	let { class: className = '' }: { class?: string } = $props();

	/** 全屏用：面板外壳（`bind:ref`）+ 是否全屏 —— 类名要随全屏切换，所以状态留在这里 */
	let panelEl = $state<HTMLElement | null>(null);
	let fullscreen = $state(false);
	/**
	 * 全屏时**丢掉**父级算好的那套高度策略，换成铺满视口的一份。
	 * 必须是 `h-dvh` 而不是 `h-full` —— 全屏元素的父级高度是 `auto`（`/clock` 的注释里已记过这条）。
	 */
	const panelClass = $derived(fullscreen ? 'h-dvh w-full' : `min-h-0 ${className}`);

	const TABS = [
		{ value: 'params', label: '参数' },
		{ value: 'auth', label: '授权' },
		{ value: 'headers', label: '请求头' },
		{ value: 'body', label: '请求体' }
	] as const;

	const collapsed = $derived(httpStore.requestCollapsed);
	const headerCount = $derived(httpStore.effectiveHeaders.length);
	const headerHint = $derived(
		headerCount === 0 ? '每行一条「名称: 值」，# 开头的行为注释' : `每行一条「名称: 值」，现有 ${headerCount} 条生效`
	);

	/** 点标签就展开：收起的面板上标签仍可见可点，那时候点它显然是想看内容 */
	function selectTab(value: RequestPanelTab): void {
		httpStore.requestTab = value;
		httpStore.requestCollapsed = false;
	}

	// 请求头那两个按钮（本机 / 清空）都是**整块覆盖**且不可撤销，所以都要先问一句。
	// 确认框放在组件这一层（store 只管换文本），store 的方法才好在 node 里单测 ——
	// `confirm.ask()` 要 await，而 store 的方法是同步的。
	async function fillLocalHeaders(): Promise<void> {
		if (!(await confirm.ask('用本机浏览器的请求头覆盖输入框里的全部内容？'))) return;
		httpStore.fillLocalHeaders();
	}

	async function clearHeaders(): Promise<void> {
		if (!(await confirm.ask('清空全部请求头？'))) return;
		httpStore.clearHeaders();
	}
</script>

<!-- clip 关掉：请求体标签里的类型下拉是 Dropdown，菜单 absolute 挂在卡内，
     卡片默认的 overflow-hidden 会把展开的菜单裁掉（UI-STYLE §8）。
     卡内子元素都带内边距、不贴边，关掉后在圆角处看不出差别 -->
<Panel
	id="http-request-panel"
	headingId="http-request-heading"
	heading="请求构造"
	clip={false}
	bind:ref={panelEl}
	class={panelClass}
>
	{#snippet headingExtra()}
		<SegmentedControl
			tone="quiet"
			aria-label="请求配置"
			options={TABS}
			value={httpStore.requestTab}
			onchange={selectTab}
		/>
	{/snippet}

	{#snippet actions()}
		<!-- 全屏：收起状态下先展开，否则全屏里只剩一条标题行 -->
		<FullscreenButton
			bind:fullscreen
			name="请求构造"
			target={() => panelEl}
			onenter={() => (httpStore.requestCollapsed = false)}
		/>
		<Button
			icon
			label={collapsed ? '展开请求构造' : '收起请求构造'}
			title={collapsed ? '展开请求构造' : '收起请求构造（把高度让给响应）'}
			aria-expanded={!collapsed}
			aria-controls="http-request-body"
			onclick={() => httpStore.toggleRequestCollapsed()}
		>
			{#if collapsed}
				<ChevronDown class="size-3.5" aria-hidden="true" />
			{:else}
				<ChevronUp class="size-3.5" aria-hidden="true" />
			{/if}
		</Button>
	{/snippet}

	<div id="http-request-body" class="flex min-h-0 flex-1 flex-col" hidden={collapsed}>
		{#if httpStore.requestTab === 'params'}
			<ParamsSection />
		{:else if httpStore.requestTab === 'auth'}
			<AuthSection />
		{:else if httpStore.requestTab === 'headers'}
			<div class="flex min-h-0 flex-1 flex-col gap-1.5 p-4">
				<!-- 说明在左，两个按钮同一行靠右：先「本机」后「清空」 -->
				<div class="flex flex-wrap items-start justify-between gap-2">
					<p class="min-w-0 flex-1 text-[11px] leading-4 text-gray-600">{headerHint}</p>
					<div class="flex shrink-0 items-center gap-1.5">
						<Button
							size="xs"
							label="用本机浏览器的请求头覆盖当前内容"
							title="填入本机浏览器会带上那几个头（User-Agent / Accept / Accept-Language 等）；浏览器发请求时这几个由它自己接管，填在这里是给你照着改的"
							onclick={() => void fillLocalHeaders()}
						>
							本机
						</Button>
						<Button
							size="xs"
							variant="danger"
							label="清空全部请求头"
							title="清空输入框里全部请求头，回到占位提示"
							onclick={() => void clearHeaders()}
						>
							清空
						</Button>
					</div>
				</div>
				<EditorBox>
					<Textarea
						id="http-headers"
						label="请求头，每行一条「名称: 值」"
						mono
						textSize="text-xs leading-5"
						bind:value={httpStore.headersText}
						autocomplete="off"
						placeholder="Accept: application/json&#10;Authorization: Bearer your-token"
						class={PANEL_EDITOR}
					/>
				</EditorBox>
			</div>
		{:else}
			<BodySection />
		{/if}
	</div>
</Panel>
