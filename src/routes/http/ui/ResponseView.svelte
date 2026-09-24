<script lang="ts">
	// 响应面板：结果置顶一行（状态码 / 耗时 / 大小 / 代发测速），下面三个标签 —— 响应体 / 响应头 / 状态码。
	//
	// 结果放在**面板标题行**（Hoppscotch 的位置）：发完一眼就在视线焦点上，不用往下找。
	// 那段文案只有一份（store.statusText），既是结果摘要也是读屏播报 —— 它同时承担
	// 「等待发送 / 请求中… / 错误 / 结果」四种状态，所以不再另设底栏。
	//
	// 标题行右侧是「复制为」动作菜单（响应体 / 响应头 / 这条请求的五种搬运格式）。
	// 做成一个菜单而不是五个按钮：它们本来就属于「把这份东西拿走」同一件事，
	// 而且响应头与请求的几种格式都是低频动作，各占一个按钮会把标题行挤满。
	//
	// 面板还能**收起**（最右那枚箭头）：收起后只剩标题行 —— 而结果就在标题行里，
	// 所以收起不等于看不见结果，只是把正文的高度让给请求构造。
	import { ChevronDown, ChevronUp, Columns2, Download, Rows2 } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { tokenizeJson } from '$lib/utils/json';
	import { JSON_TOKEN_CLASS, OUTPUT_EMPTY } from '$lib/ui/styles';
	import { toast } from '$lib/ui/toast.svelte';
	import { lineCountOfText, lineCountOfTokens, lineNumbers } from '../core/line-numbers.ts';
	import { limitItems, limitText } from '../core/render-limit.ts';
	import { MAX_BODY_CHARS, MAX_BODY_TOKENS } from '../config.ts';
	import { LINE_BODY, LINE_GUTTER, RESULT_SURFACE, RESPONSE_BODY_PANE } from './styles.ts';
	import { FORMAT_OPTIONS } from '../core/request-text.ts';
	import type { RequestTextFormat } from '../core/request-text.ts';
	import { httpStore } from '../core/store.svelte.ts';
	import type { ResponsePanelTab, ResponseView } from '../core/types.ts';
	import StatusTab from './StatusTab.svelte';
	import FullscreenButton from '$lib/components/FullscreenButton/FullscreenButton.svelte';

	const RESPONSE_TABS = [
		{ value: 'body', label: '响应体' },
		{ value: 'headers', label: '响应头' },
		{ value: 'status', label: '状态码' }
	] as const;

	/** 「复制为」里请求那五项的说明（格式名沿用 FORMAT_OPTIONS，这里的文案只讲「复制什么」） */
	const REQUEST_COPY_DESCRIPTIONS: Record<RequestTextFormat, string> = {
		'curl-bash': '复制成 Linux / macOS 的 cURL 命令',
		'curl-cmd': '复制成 Windows 命令提示符的 cURL 命令',
		powershell: '复制成 PowerShell 的 Invoke-WebRequest',
		fetch: '复制成 DevTools「Copy as fetch」的样子',
		'node-fetch': '复制成 DevTools「Copy as Node.js fetch」的样子'
	};

	/**
	 * 「复制为」菜单：上两条是**这次响应**的，下面是**这条请求**的几种搬运格式。
	 * 请求那几项与「导入 / 导出」标签共用同一个生成器（core/request-text.ts），只是入口不同。
	 */
	const COPY_OPTIONS = [
		{ value: 'body', label: '响应体', description: '复制这次响应的正文' },
		{ value: 'headers', label: '响应头', description: '每行一条「名称: 值」，可直接粘进请求头' },
		...FORMAT_OPTIONS.map((option) => ({
			value: option.value,
			label: `请求 · ${option.label}`,
			description: REQUEST_COPY_DESCRIPTIONS[option.value]
		}))
	];

	const hasResponse = $derived(httpStore.response !== null);
	const bodyEmpty = $derived(httpStore.response !== null && httpStore.response.body === '');
	/** 完整 token 流：判「是不是 JSON」「能不能美化」只看它 */
	const allTokens = $derived(httpStore.response === null ? null : tokenizeJson(httpStore.response.body));
	const isJson = $derived(allTokens !== null);
	const showFormatted = $derived(httpStore.responseView === 'formatted' && allTokens !== null);
	/**
	 * 渲染窗口：默认只铺前 MAX_BODY_*，超出的部分**数据仍在**（复制 / 保存拿到的都是全文），
	 * 屏幕上少一截而已 —— 十几 MB 的响应全铺进 DOM 会把整页拖到无响应。
	 * 用户点过「仍显示全部」才解除，且每发一次新请求都收回（见 store 的 `bodyUncapped`）。
	 */
	const capped = $derived(!httpStore.bodyUncapped);
	const tokenWindow = $derived(limitItems(allTokens ?? [], MAX_BODY_TOKENS));
	const textWindow = $derived(limitText(httpStore.response?.body ?? '', MAX_BODY_CHARS));
	const visibleTokens = $derived(capped ? tokenWindow.items : (allTokens ?? []));
	const visibleText = $derived(capped ? textWindow.text : (httpStore.response?.body ?? ''));
	const bodyTruncated = $derived(capped && (showFormatted ? tokenWindow.truncated : textWindow.truncated));

	/**
	 * 正文按显示算有几行（美化视图 = 重排后的行），左侧行号槽与「共 N 行」都读它。
	 * 口径在 `core/line-numbers.ts`：美化视图数的是**重排后**的行 —— 紧凑 JSON 源文本只有一行，
	 * 数源文本的行会得出「1 行」这种没用的答案。
	 *
	 * **数的是渲染出来的这一截**：截断时行号得跟屏幕上看到的行一一对齐，
	 * 否则「共 N 行」说的是全文、行号却只到一半，两边对不上。
	 */
	const bodyLineCount = $derived(showFormatted ? lineCountOfTokens(visibleTokens) : lineCountOfText(visibleText));
	const lineGutter = $derived(lineNumbers(bodyLineCount));
	const collapsed = $derived(httpStore.responseCollapsed);

	/**
	 * 全屏看结果：目标元素（面板外壳）+ 一个布尔，其余交给 `FullscreenButton`（请求构造面板用的是同一件）。
	 * 元素要 `bind:ref` 拿到，所以状态只能留在这里 —— 面板的类名得随它切换。
	 */
	let panelEl = $state<HTMLElement | null>(null);
	let fullscreen = $state(false);

	/** 全屏时去掉小屏的高度封顶（那时面板是 h-dvh，内容该填满）；平时小屏必须封顶，否则整页会被撑到几千 px */
	const paneCapClass = $derived(fullscreen ? '' : 'max-lg:max-h-[60vh]');

	/**
	 * 响应是不是 HTML：先看 Content-Type；跨域拿不到响应头时退回看开头几个字符。
	 * 预览只对 HTML 开放 —— 图片、二进制得先留住原始字节，那是另一件事（见 README 的「暂不支持」）。
	 */
	const isHtml = $derived.by(() => {
		const res = httpStore.response;
		if (!res) return false;
		const contentType = res.headers.find((header) => header.name.toLowerCase() === 'content-type')?.value ?? '';
		if (contentType !== '') return contentType.toLowerCase().includes('html');
		return /^\s*<(!doctype|html)/i.test(res.body);
	});
	const showPreview = $derived(httpStore.responseView === 'preview' && isHtml);

	/**
	 * 控件上的选中态：按**实际显示**的那一档算，与正文分支同源。
	 * 不能让控件读 `httpStore.responseView` —— 那个值可能是上一份响应留下的（预览过 HTML 之后
	 * 再发一条 JSON，它仍是 `preview`），于是「美化」灰着却还挂着选中态、而正文显示的是原文。
	 */
	const effectiveView = $derived<ResponseView>(showFormatted ? 'formatted' : showPreview ? 'preview' : 'raw');

	/**
	 * 切视图。**不适用的视图不禁用，而是点了给出原因**。
	 *
	 * 原生 `disabled` 的按钮收不到鼠标事件，挂在它上面的 `title` **永远弹不出来** ——
	 * 用户只看到一颗灰掉的按钮，只能猜「这功能是不是坏了」。所以这里不禁用，
	 * 由这次点击换来一句说明（`title` 也就能正常显示了）。
	 * 选项本身仍常驻渲染，切状态不会让这一行跳高度。
	 */
	function selectView(value: ResponseView): void {
		if (value === 'formatted' && !isJson) {
			toast.show('当前响应不是 JSON，没有可格式化的内容；已按原文显示', true);
			return;
		}
		if (value === 'preview' && !isHtml) {
			toast.show('预览只支持 HTML 响应（看 Content-Type）；可以切「原始」看原文', true);
			return;
		}
		httpStore.responseView = value;
	}

	// 选项按状态算：不是 JSON 就没有美化，不是 HTML 就没有预览；可用性写在 title 与点击提示里
	const viewOptions = $derived([
		{
			value: 'formatted' as const,
			label: '美化',
			title: isJson ? '美化并高亮 JSON' : '当前响应不是 JSON，点一下看说明'
		},
		{ value: 'raw' as const, label: '原始', title: '显示原始响应文本' },
		{
			value: 'preview' as const,
			label: '预览',
			title: isHtml ? '在沙箱里渲染这段 HTML' : '只有 HTML 响应才提供预览，点一下看说明'
		}
	]);

	const layoutLabel = $derived(httpStore.layout === 'side' ? '切换为上下排列' : '切换为左右排列');
	const collapseLabel = $derived(collapsed ? '展开响应' : '收起响应');

	// 收起后不再吃 flex-1（否则它还会把高度占满），左右排列时把宽度也让出去
	const panelClass = $derived.by(() => {
		// 全屏：铺满视口。**必须给 h-dvh 而不是 h-full** —— 全屏元素的父级高度是 auto，百分比高度不成立
		// （`/clock` 的 frameClass 同款处置）；小屏那两处 max-h 封顶在全屏下也一并去掉
		if (fullscreen) return 'h-dvh w-full';
		if (collapsed) return httpStore.layout === 'side' ? 'min-w-0 shrink-0 lg:flex-none' : 'min-w-0 shrink-0';
		return 'min-w-0 min-h-0 flex-1 max-lg:max-h-[70vh]';
	});

	// 底部状态条文案：等待 / 请求中 / 错误 / 结果，配色随阶段走
	const statusTone = $derived(
		httpStore.phase === 'sending'
			? 'info'
			: httpStore.error !== null
				? 'error'
				: httpStore.response !== null
					? httpStore.response.ok
						? 'ok'
						: 'warn'
					: 'neutral'
	);

	function toggleLayout(): void {
		httpStore.layout = httpStore.layout === 'side' ? 'stack' : 'side';
	}

	/** 动作型菜单：value 没有「当前值」的含义，按它分派到具体复制动作 */
	function copyAs(value: string): void {
		if (value === 'body') void httpStore.copyResponse();
		else if (value === 'headers') void httpStore.copyResponseHeaders();
		else void httpStore.copyRequestAs(value as RequestTextFormat);
	}

	/** 点标签就展开（与请求构造面板同一套：收起的面板上标签仍可见可点） */
	function selectTab(value: ResponsePanelTab): void {
		httpStore.responseTab = value;
		httpStore.responseCollapsed = false;
	}
</script>

<!-- clip 关掉：标题行的「复制为」是 `absolute` 菜单，而面板总高只有 300-360px
     （移动端更矮），菜单一展开就超出面板底边被整块裁掉 —— 元素确实在 DOM 里、
     axe 也查不出来，只有点开菜单才看得见最后几项没了。
     正文那几块各自 `overflow-auto`，不需要面板这一层再兜底裁切 -->
<Panel
	id="http-response-panel"
	headingId="http-response-heading"
	heading="响应"
	bind:ref={panelEl}
	class={panelClass}
	clip={false}
>
	{#snippet header()}
		<!-- 标题行就是结果行：左边一条状态胶囊（结果 / 运行态都在这），右边复制、排列、全屏与收起 -->
		<div class="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-4">
			<div class="flex min-w-0 flex-1 items-center">
				<StatusPill tone={statusTone} truncate>{httpStore.statusText}</StatusPill>
			</div>
			<div class="flex shrink-0 items-center gap-1.5">
				<Dropdown
					size="xs"
					label="复制响应或这条请求为指定格式"
					triggerLabel="复制为"
					options={COPY_OPTIONS}
					value=""
					onSelect={copyAs}
				/>
				<!-- 排列方式只对 lg 起有意义，小屏恒为上下 -->
				<Button icon class="max-lg:hidden" label={layoutLabel} title={layoutLabel} onclick={toggleLayout}>
					{#if httpStore.layout === 'side'}
						<Rows2 class="size-3.5" aria-hidden="true" />
					{:else}
						<Columns2 class="size-3.5" aria-hidden="true" />
					{/if}
				</Button>
				<!-- 全屏看结果：收起状态下先展开，否则全屏里只剩一条标题行 -->
				<FullscreenButton
					bind:fullscreen
					name="响应"
					target={() => panelEl}
					onenter={() => (httpStore.responseCollapsed = false)}
				/>
				<Button
					icon
					label={collapseLabel}
					title={collapsed ? '展开响应（看正文）' : '收起响应（只留结果，把高度让给请求）'}
					aria-expanded={!collapsed}
					aria-controls="http-response-region"
					onclick={() => httpStore.toggleResponseCollapsed()}
				>
					{#if collapsed}
						<ChevronDown class="size-3.5" aria-hidden="true" />
					{:else}
						<ChevronUp class="size-3.5" aria-hidden="true" />
					{/if}
				</Button>
			</div>
		</div>
	{/snippet}

	<!-- 折叠区域 id 与里面的响应体区分开：响应体那一块自己要占 `http-response-body` -->
	<div id="http-response-region" class="flex min-h-0 flex-1 flex-col" hidden={collapsed}>
		<!-- 标签行：左边选看哪一块，右边只在「响应体」下出现视图切换 -->
		<div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2">
			<SegmentedControl
				tone="quiet"
				aria-label="响应视图"
				options={RESPONSE_TABS}
				value={httpStore.responseTab}
				onchange={selectTab}
			/>
			{#if httpStore.responseTab === 'body'}
				<div class="flex shrink-0 items-center gap-2">
					<!-- 行数：正文左侧的行号槽能看出「当前在第几行」，这里给出总量（不用滚到底） -->
					{#if hasResponse && !bodyEmpty}
						<span class="text-xs text-gray-600 tabular-nums" role="status" aria-live="polite"
							>共 {bodyLineCount} 行</span
						>
						<!-- 保存：存的是**完整**响应体（不受渲染窗口影响），文件名按 Content-Type 猜扩展名 -->
						<Button
							icon
							size="sm"
							label="保存响应体为文件"
							title="把完整响应体存成文件（不受「只渲染前若干」影响）"
							onclick={() => httpStore.saveResponse()}
						>
							<Download class="size-3.5" aria-hidden="true" />
						</Button>
					{/if}
					<SegmentedControl
						tone="quiet"
						aria-label="响应体显示方式"
						options={viewOptions}
						value={effectiveView}
						onchange={selectView}
					/>
				</div>
			{/if}
		</div>

		<!-- 渲染窗口提示：只截显示、数据完整，所以提示里要顺带给出「怎么拿到全文」 -->
		{#if httpStore.responseTab === 'body' && bodyTruncated}
			<div
				class="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-amber-50 px-4 py-1.5 text-xs text-gray-700"
				role="status"
			>
				<span class="min-w-0 flex-1">
					响应太大，屏幕上只渲染前 {showFormatted ? `${MAX_BODY_TOKENS} 个片段` : `${MAX_BODY_CHARS} 个字符`}（共
					{showFormatted ? tokenWindow.total : textWindow.total}）； 完整内容用「复制为 → 响应体」或上面的保存按钮拿走。
				</span>
				<Button
					size="xs"
					label="解除渲染上限，全部显示（响应很大时页面可能卡住）"
					title="解除渲染上限，全部显示（响应很大时页面可能卡住）"
					onclick={() => (httpStore.bodyUncapped = true)}
				>
					仍显示全部
				</Button>
			</div>
		{/if}

		{#if httpStore.responseTab === 'headers'}
			<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable） -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="min-h-0 flex-1 overflow-y-auto p-4 {RESULT_SURFACE} {paneCapClass}"
				tabindex="0"
				role="region"
				aria-label="响应头列表"
			>
				{#if !hasResponse}
					<p class="text-xs leading-5 text-gray-600">还没发送请求。</p>
				{:else if httpStore.response?.headers.length}
					<ul class="flex flex-col gap-1.5">
						{#each httpStore.response.headers as header, i (i)}
							<li class="flex items-start gap-3 font-mono text-xs leading-5">
								<span class="w-40 shrink-0 break-all text-gray-600">{header.name}</span>
								<span class="min-w-0 flex-1 break-all text-gray-900">{header.value}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs leading-5 text-gray-600">
						这次响应没有暴露任何响应头。浏览器直发跨域响应只给出少数几个头，需要看全就用「服务器代发」。
					</p>
				{/if}
			</div>
		{:else if httpStore.responseTab === 'status'}
			<StatusTab />
		{:else}
			<!-- 结果面：一整块浅底（见 styles.ts 的 RESPONSE_BODY_PANE，含为什么不是改共享的 OUTPUT_PRE） -->
			<div class={RESPONSE_BODY_PANE}>
				{#if httpStore.error}
					<div class={OUTPUT_EMPTY}>
						<div class="flex flex-col items-center gap-2">
							<p class="max-w-2xl">{httpStore.error.message}</p>
							{#if httpStore.error.kind === 'network'}
								<!-- 跨域 / 不可达：这是本工具唯一能给的两条「把执行搬出浏览器」的路。
								     两条都摆出来、并说清各自在哪跑 —— 只告诉用户「失败了」等于把人留在原地 -->
								<div class="flex flex-wrap items-center justify-center gap-2">
									<Button label="复制 cURL 命令到终端运行" size="sm" onclick={() => void httpStore.copyCurl()}
										>复制 cURL 到终端</Button
									>
									<Button
										size="sm"
										label="复制 fetch 代码，粘到目标站点自己打开的控制台里跑（同源，不受 CORS 限制）"
										onclick={() => void httpStore.copyRequestAs('fetch')}>复制 fetch 代码</Button
									>
								</div>
								<p class="max-w-xl text-[11px] leading-4">
									前一条在本机终端里跑；后一条要粘到「目标站点自己」打开的控制台（F12 → Console）里 —— 同源请求天然没有
									CORS 限制，也不需要目标服务端做任何配置。
								</p>
							{:else}
								<Button label="复制 cURL 命令到终端" size="sm" onclick={() => void httpStore.copyCurl()}
									>复制 cURL 到终端</Button
								>
							{/if}
						</div>
					</div>
				{:else if httpStore.response === null}
					<p class={OUTPUT_EMPTY}>填写上方请求并点击「发送」，响应会显示在这里。</p>
				{:else if showPreview}
					<!-- sandbox 留空 = 禁止脚本 / 表单 / 跳转 / 同源，只用来「看」这段 HTML -->
					<iframe
						title="响应预览"
						sandbox=""
						srcdoc={httpStore.response.body}
						class="absolute inset-0 size-full border-0 bg-white"
					></iframe>
				{:else}
					<!-- 正文 + 左侧行号槽：两列在同一块里滚（横向也是），行号 `sticky left-0` 钉在左边缘。
					     可滚动区要能键盘滚动（axe 的 scrollable-region-focusable），所以 tabindex / role
					     挂在这一层，不挂里面的 <pre> -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						id="http-response-body"
						class="absolute inset-0 overflow-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-inset"
						tabindex="0"
						role="region"
						aria-label="响应体"
					>
						<!-- w-max：两列按内容宽展开（长行交给外层横向滚）；min-w-full：内容短时也铺满 -->
						<div class="flex w-max min-w-full">
							{#if !bodyEmpty}
								<!-- 行号只给眼睛看：整槽 aria-hidden，总量由标签行的「共 N 行」播报 -->
								<pre class={LINE_GUTTER} aria-hidden="true">{lineGutter}</pre>
							{/if}
							{#if showFormatted}
								<CodeView tokens={visibleTokens} classMap={JSON_TOKEN_CLASS} class={LINE_BODY} />
							{:else}
								<!-- 原始视图 / 非 JSON 响应：原文展示（截断时显示的是前 MAX_BODY_CHARS 个字符） -->
								<pre class={LINE_BODY}>{bodyEmpty ? '（空响应体）' : visibleText}</pre>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</Panel>
