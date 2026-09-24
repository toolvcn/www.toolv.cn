<script lang="ts">
	// URL 编解码工具的工作区：工具条（方向 / 策略 / 操作）+ 输入 / 输出双栏。
	// 输入栏有两种视图（文本 / 参数表），在标题行右侧切换：
	//   文本 —— 输入串直接编解码，输出是结果；
	//   参数表 —— 拆成 地址 / 参数 / # 片段 三段编辑，输出是合成出的整条串。
	// 两套原先分属两个页内标签，合并成一条流水线后共用这一副骨架，一屏即可、无常驻标签栏。
	import { Copy, Eraser, FileBraces } from '@lucide/svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { FOOTER_BAR, EDITOR_INPUT, TOOLBAR, TOOLBAR_GROUP, TOOLBAR_LABEL, TOOLBAR_ACTIONS } from '$lib/ui/styles';
	import { tokenizeUrl, type UrlTokenKind } from '../core/url.ts';
	import { urlStore } from '../core/store.svelte.ts';
	import ParamTable from './ParamTable.svelte';

	const DIRECTIONS = [
		{ value: 'encode', label: '编码' },
		{ value: 'decode', label: '解码' }
	] as const;

	const STRATEGIES = [
		{ value: 'component', label: '组件（严格）', title: '按 RFC 3986 对每个 URI 组件分别转义' },
		{ value: 'full', label: '整链（宽松）', title: '把整条 URL 当一个字符串转义，保留 : / ? # 等分隔符' }
	] as const;

	const INPUT_VIEWS = [
		{ value: 'text', label: '文本' },
		{ value: 'params', label: '参数表' }
	] as const;

	/**
	 * 输出上色的色板：只给**内容**上色（分隔符与 scheme 走中性灰），四类各一色。
	 * 白底一律 -700 一档，与 $lib/ui/styles 的 JSON_TOKEN_CLASS 同一口径。
	 */
	const URL_TOKEN_CLASS: Record<UrlTokenKind, string> = {
		scheme: 'text-gray-500',
		delim: 'text-gray-500',
		host: 'text-blue-700',
		path: 'text-emerald-700',
		query: 'text-amber-700',
		fragment: 'text-violet-700',
		plain: 'text-gray-900'
	};

	/**
	 * 输出区版式：等宽、占满框；长串 `break-all` 换行而不是横向滚 ——
	 * URL 是一整条没有空格的串，横滚看尾巴很难受。
	 */
	const OUTPUT_URL =
		'absolute inset-0 overflow-auto p-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-gray-900 focus-visible:outline-none sm:text-sm sm:leading-6';

	const isParams = $derived(urlStore.inputView === 'params');
	// 参数表视图不消费方向与策略，整组半透明 + aria-disabled 提示不生效
	const directionDim = $derived(isParams);
	// 策略只对编码有效：解码时也整组半透明（沿用原做法，点一下会切回编码）
	const strategyDim = $derived(isParams || urlStore.encDirection === 'decode');
	// 条件类名一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断）
	const directionGroup = $derived(directionDim ? `${TOOLBAR_GROUP} opacity-60` : TOOLBAR_GROUP);
	const strategyGroup = $derived(strategyDim ? `${TOOLBAR_GROUP} opacity-60` : TOOLBAR_GROUP);

	// ---- 两栏的标题、空态、状态随视图与方向变 ----
	const inputLabel = $derived(isParams ? '参数表' : urlStore.encDirection === 'encode' ? '原文' : 'URL 编码');
	// 参数表视图的输出：带地址前缀时是整条结果 URL，否则只是一段合成结果
	const outputLabel = $derived(
		isParams
			? urlStore.hasUrlPrefix
				? '结果 URL'
				: '合成结果'
			: urlStore.encDirection === 'encode'
				? 'URL 编码'
				: '原文'
	);
	const inputHint = $derived(
		isParams ? '三段（地址 / 参数 / # 片段）任一改动都实时合成整条串' : '方向 / 策略 / 示例 / 清空在顶部工具条'
	);
	const inputPlaceholder = $derived(
		urlStore.encDirection === 'encode'
			? '在此输入要编码的文本，例如 ?q=在线 工具'
			: '在此粘贴要解码的百分号编码，例如 %E5%9C%A8%E7%BA%BF'
	);
	// 输出区空态 / 错误态：错误文案放正文里（能完整读完），脚注只给一句结论
	const outputEmptyText = $derived(
		isParams
			? '在左侧三段里填写，合成结果会实时显示在这里'
			: urlStore.encError !== ''
				? urlStore.encError
				: urlStore.encDirection === 'encode'
					? '在左侧输入文本，编码结果会实时显示在这里'
					: '在左侧粘贴百分号编码，解码结果会实时显示在这里'
	);
	// 「有结果」= 输出区有文本；解码失败时 outputText 为空，退到错误态，判据对两种视图都成立
	const hasOutput = $derived(urlStore.outputText !== '');
	// 输出按 URL 结构分词上色（认不出结构就整段 plain）
	const outputTokens = $derived(tokenizeUrl(urlStore.outputText));
	const statusText = $derived(
		urlStore.encInput === ''
			? '等待输入'
			: isParams
				? '已按参数表合成'
				: urlStore.encError !== ''
					? '解码失败，原因见输出区'
					: urlStore.encDirection === 'encode'
						? '编码完成'
						: '解码完成'
	);
	const statusTone = $derived(
		urlStore.encInput === '' ? 'neutral' : !isParams && urlStore.encError !== '' ? 'error' : 'ok'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：小屏纵向堆叠，md 起并排，右侧操作 ml-auto 靠右 -->
	<div id="url-toolbar" role="group" aria-label="URL 编解码操作" class={TOOLBAR}>
		<!-- 方向切换：参数表视图不生效，整组半透明 -->
		<div class={directionGroup} aria-disabled={directionDim}>
			<span class={TOOLBAR_LABEL}>方向</span>
			<SegmentedControl
				options={DIRECTIONS}
				value={urlStore.encDirection}
				onchange={(v) => urlStore.setEncDirection(v)}
			/>
		</div>

		<!-- 策略：只在编码方向生效；解码或参数表视图下整组半透明提示不生效。
		     aria-disabled 跟 opacity-60 同源：半透明组里的文字对比度会掉到 3:1 以下，
		     标上 aria-disabled 后 axe 才按「当前不生效」而不是「对比度不合格」判定。 -->
		<div class={strategyGroup} aria-disabled={strategyDim}>
			<span class={TOOLBAR_LABEL}>策略</span>
			<SegmentedControl options={STRATEGIES} value={urlStore.strategy} onchange={(v) => urlStore.applyStrategy(v)} />
		</div>

		<!-- 右侧操作：md 起靠右 -->
		<div class={TOOLBAR_ACTIONS}>
			<Button label={isParams ? '填入示例查询串' : '填入示例 URL'} title="示例" onclick={() => urlStore.loadExample()}>
				<FileBraces class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入与输出" title="清空" onclick={() => urlStore.clearAll()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button variant="primary" label="复制输出结果" title="复制输出" onclick={() => void urlStore.copyOutput()}>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区：标题行右侧切「文本 / 参数表」两种视图 -->
		<EditorPane
			fullscreen
			id="url-input-panel"
			headingId="url-input-heading"
			heading={inputLabel}
			headingExtra={isParams
				? `${urlStore.queryRows.length + urlStore.fragmentRows.length} 行`
				: `${urlStore.encInputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			bare={isParams}
		>
			{#snippet actions()}
				<SegmentedControl
					tone="quiet"
					class="w-fit"
					options={INPUT_VIEWS}
					value={urlStore.inputView}
					onchange={(v) => urlStore.setInputView(v)}
					aria-label="输入视图"
				/>
			{/snippet}

			{#if isParams}
				<ParamTable />
			{:else}
				<Textarea
					id="url-input"
					mono
					label="{inputLabel}输入"
					bind:value={urlStore.encInput}
					placeholder={inputPlaceholder}
					class={EDITOR_INPUT}
				/>
			{/if}

			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="min-w-0 flex-1 truncate text-xs text-gray-600">{inputHint}</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态 / 错误态 / 结果三选一由 EditorPane 管，容器高度不跳变 -->
		<EditorPane
			fullscreen
			id="url-output-panel"
			headingId="url-output-heading"
			heading={outputLabel}
			headingExtra={`${urlStore.outputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			error={urlStore.outputError}
			empty={outputEmptyText}
			ready={hasOutput}
		>
			<!-- 上色走「分词 + span」，不经过 {@html}；可滚动区自己可聚焦（axe scrollable-region-focusable） -->
			<CodeView
				tokens={outputTokens}
				classMap={URL_TOKEN_CLASS}
				class={OUTPUT_URL}
				tabindex={0}
				role="region"
				aria-label="输出内容"
			/>
			{#snippet footer()}
				<!-- 底部状态条：校验状态是运行态文字，挂 role=status 给读屏 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone}>{statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
