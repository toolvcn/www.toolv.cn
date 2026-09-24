<script lang="ts">
	// 日志面板。日志的集合、筛选、折叠、渲染窗口都在 ws.logs 上，
	// 状态栏的文案规则在 core/labels.ts，这里只负责渲染。
	import { tick } from 'svelte';
	import {
		ArrowDown,
		ArrowUp,
		ChevronDown,
		ChevronRight,
		ChevronsDownUp,
		ChevronsUpDown,
		Copy,
		Download,
		Info,
		Trash
	} from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import type { Connection } from '../core/connection.svelte.ts';
	import type { JsonTokenKind } from '$lib/utils/json';
	import type { LogDirection } from '../core/types.ts';
	import { LOG_LIMIT } from '../config.ts';
	import { formatTime, typeText } from '../core/format.ts';
	import { connectionStatusText, logCountText } from '../core/labels.ts';
	import { FOCUS_RING } from '$lib/ui/styles';
	import { statusDotClass } from './styles.ts';
	import { copyText, downloadText } from '$lib/utils/browser';
	import { ws } from '../core/websocket.svelte.ts';
	import { toast } from '$lib/ui/toast.svelte';

	// 日志方向对应的文字颜色，跟筛选按钮的配色一致
	function directionClass(direction: LogDirection): string {
		if (direction === 'sent') return 'text-blue-600';
		// emerald-600 在 12px 下对白底只有 3.65:1，达不到 AA 的 4.5:1
		if (direction === 'received') return 'text-emerald-700';
		return 'text-gray-500';
	}

	/** 复制一条日志。剪贴板可能整体不可用（非安全上下文），失败要说出来，不能一律报成功 */
	async function copy(content: string): Promise<void> {
		const ok = await copyText(content);
		toast.show(ok ? '已复制消息内容' : '复制失败，请手动选择文本');
	}

	/**
	 * JSON 分词对应的文本颜色，全部用默认 Tailwind 调色板。
	 *
	 * 跟 $lib/ui/styles.ts 的 JSON_TOKEN_CLASS 不是一份：这里的 token 渲染在带底色的日志行里
	 * （收到的消息是 bg-emerald-50），共用那套 -700 配色在绿底上会糊，所以另配一套。
	 * 分词的 kind 则必须跟共用分词器一致，punct（括号逗号）这一档不能少。
	 */
	const TOKEN_CLASS: Record<JsonTokenKind, string> = {
		key: 'text-violet-600',
		string: 'text-emerald-700',
		// 用 -700 而不是 -600：收到的消息带 bg-emerald-50 背景，
		// rose-600 配它只有 4.29:1，达不到 AA
		number: 'text-rose-700',
		literal: 'text-amber-700',
		// 括号逗号：日志行底色比白底深，用 -600 而不是共用版的 -500
		punct: 'text-gray-600',
		plain: ''
	};

	// 同 Toggle：条件类名放脚本里算，避免 class 属性里的三元被拆行失效。
	// 激活时用各自方向的配色，跟日志里那条消息的颜色对上（见 directionClass）
	const FILTER_ACTIVE: Record<LogDirection, string> = {
		sent: 'bg-blue-600 text-white',
		// emerald-600 配白字达不到 4.5:1，用 -700
		received: 'bg-emerald-700 text-white',
		system: 'bg-gray-600 text-white'
	};

	// h-6 是这一排控件统一的小尺寸档：筛选按钮、勾选框都按 24px 走，
	// 混着 h-7 会让同一行出现两种高度。24px 正好卡在触控目标下限
	function filterClass(direction: LogDirection, active: boolean): string {
		const state = active ? FILTER_ACTIVE[direction] : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
		return `inline-flex h-6 items-center gap-1 rounded-lg px-1.5 text-xs font-medium ${FOCUS_RING} ${state}`;
	}

	/**
	 * 消息内容块的底色，按方向区分：发送蓝、接收绿、系统灰。
	 * 长日志里不用读文字也能分出来。
	 * 折叠态只留一行，加内边距会让行高不对，所以那里只上色不加 padding。
	 */
	const CONTENT_BG: Record<LogDirection, string> = {
		sent: 'bg-blue-50',
		received: 'bg-emerald-50',
		system: 'bg-gray-100'
	};

	function contentClass(direction: LogDirection, collapsed: boolean): string {
		const bg = CONTENT_BG[direction];
		// 折叠态文字用 gray-600 而不是 gray-500：配 system 的 bg-gray-100 时
		// gray-500 只有 3.58:1，12px 小字要 4.5:1 才达标
		if (collapsed) return `mt-1 block truncate rounded px-1 text-xs text-gray-600 ${bg}`;
		return `mt-1 rounded-md px-2 py-1.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-gray-800 ${bg}`;
	}

	const DIRECTIONS = [
		{ key: 'sent', label: '发送', hint: '发出的消息', icon: ArrowUp },
		{ key: 'received', label: '接收', hint: '收到的消息', icon: ArrowDown },
		{ key: 'system', label: '系统', hint: '连接与错误提示', icon: Info }
	] as const;

	/** 筛选按钮的无障碍名称与悬浮提示 */
	function filterHint(direction: (typeof DIRECTIONS)[number]): string {
		return `按筛选：${direction.hint}`;
	}

	function directionLabel(direction: LogDirection): string {
		return DIRECTIONS.find((item) => item.key === direction)?.label ?? direction;
	}

	function targetLabel(connection: Connection | undefined): string {
		return connection?.url ?? '系统消息';
	}

	// 全量统计只算一次（放在模板里每个筛选按钮都会重算一遍）
	const stats = $derived(ws.logs.stats);

	// 渲染窗口在 LogBook 里：切筛选、清空日志后要复位，放组件里会残留上一次的条数
	const logs = $derived(ws.logs.visible);
	const shown = $derived(ws.logs.shown);
	// 复用上面两个派生，别再调 ws.logs.hiddenCount —— 那个 getter 会把
	// visible 和 shown 各再遍历一遍（日志上限 5000 时每条新日志多两趟全量扫描）
	const hiddenCount = $derived(logs.length - shown.length);

	// 一键折叠 / 展开的文案与状态：全折叠了就提示展开，否则提示折叠
	const allCollapsed = $derived(ws.logs.allVisibleCollapsed);
	const collapseLabel = $derived(logs.length === 0 ? '暂无日志可折叠' : allCollapsed ? '展开全部日志' : '折叠全部日志');

	// 底部左侧的日志条数（规则在 labels.ts）
	const countLabel = $derived(logCountText(stats.all, logs.length));

	const selected = $derived(ws.connections.selected);
	// 底部状态栏里选中连接的那段「状态 · 时长 · 延迟」
	const selectedStatusText = $derived(selected ? connectionStatusText(selected, ws.now) : '');
	// 选中连接自己的收发条数，跟连接列表行里那个「收 X 发 Y」一个口径
	const selectedCounts = $derived(ws.logs.countsOf(selected?.id ?? null));

	let logList = $state<HTMLDivElement | null>(null);

	// 未选中连接时「仅看当前连接」勾了也不生效（LogBook 里 selectedId 为 null 会直接放行全部），
	// 与其静默失效，不如禁用并把原因写在 title 里
	const noSelection = $derived(selected === undefined);

	/**
	 * 加载更早会在列表顶部插入一批行，滚动位置不变的话
	 * 用户正在看的内容会被整体顶下去。这里记下第一条已渲染行的位置，
	 * DOM 更新后按差值把滚动条补回去，让它停在原地。
	 */
	async function loadEarlier(): Promise<void> {
		const container = logList;
		const anchor = container?.querySelector('[data-log-row]') ?? null;
		const beforeTop = anchor?.getBoundingClientRect().top ?? 0;
		ws.logs.loadEarlier();
		await tick();
		if (!container || !anchor) return;
		container.scrollTop += anchor.getBoundingClientRect().top - beforeTop;
	}

	// 拼文本在 LogBook（可单测），落盘在 browser.ts
	function exportLogs(): void {
		if (logs.length === 0) {
			toast.show('没有日志可导出');
			return;
		}
		const filename = `websocket-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
		downloadText(filename, ws.logs.buildExportText());
		toast.show('日志已导出');
	}

	// 日志或筛选变化时滚到底部
	$effect(() => {
		if (!ws.autoScroll || !logs.length) return;
		// 桌面：内部滚动容器跟到底
		if (logList && logList.scrollHeight > logList.clientHeight) {
			logList.scrollTop = logList.scrollHeight;
			return;
		}
		// 移动：整页滚动；只有用户本来就接近底部时才跟随，避免编辑消息时页面乱跳
		if (typeof window === 'undefined') return;
		const threshold = 120;
		const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - threshold;
		if (nearBottom) window.scrollTo({ top: document.body.scrollHeight });
	});
</script>

<Panel id="log-panel" headingId="log-heading" heading="日志面板" class="lg:h-full lg:min-h-0">
	{#snippet actions()}
		<Button label={collapseLabel} size="xs" disabled={logs.length === 0} onclick={() => ws.logs.toggleAllCollapsed()}>
			{#if allCollapsed}
				<ChevronsUpDown class="size-3" />展开
			{:else}
				<ChevronsDownUp class="size-3" />折叠
			{/if}
		</Button>
		<Button label="导出当前筛选出来的日志" title="导出为 .json（只包含当前筛选结果）" size="xs" onclick={exportLogs}>
			<Download class="size-3" />导出
		</Button>
		<Button
			label="清空全部日志"
			title="清空全部日志（所有连接的都会清掉）"
			size="xs"
			variant="danger"
			onclick={() => ws.logs.clear()}
		>
			<Trash class="size-3" />清空
		</Button>
	{/snippet}

	<div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2">
		{#each DIRECTIONS as direction (direction.key)}
			{@const Icon = direction.icon}
			<button
				type="button"
				onclick={() => ws.logs.toggleFilter(direction.key)}
				aria-label={filterHint(direction)}
				aria-pressed={ws.logs.filters[direction.key]}
				title={filterHint(direction)}
				class={filterClass(direction.key, ws.logs.filters[direction.key])}
			>
				<Icon class="size-3" />{direction.label}
				{stats[direction.key]}
			</button>
		{/each}
		<Checkbox
			bind:checked={ws.logs.filterCurrent}
			disabled={noSelection}
			title={noSelection ? '先选中一个连接' : '只看当前选中连接的日志'}
			class="ml-auto"
		>
			仅看当前连接
		</Checkbox>
		<Checkbox bind:checked={ws.autoScroll}>自动滚动</Checkbox>
	</div>

	<!-- 移动端限高 60vh 并内部滚动：一次最多渲染 300 条，不封顶整页会有两万多 px。
	     不加 overscroll-contain：滚到头时要让页面自然接续，否则手势会被锁在面板里；
	     lg 起交给栅格行 -->
	<div id="log-list" class="overflow-y-auto max-lg:max-h-[60vh] lg:min-h-0 lg:flex-1" bind:this={logList}>
		{#if logs.length === 0}
			<!-- 空态统一走 EmptyState（同 ConnectionList / PresetList）。`m-2` 是给
			     `#log-list` 补边距 —— 那个容器自己不带内边距（日志行自带），虚线框贴边会缺一圈 -->
			<EmptyState class="m-2">
				{ws.logs.all.length === 0 ? '暂无日志' : '当前筛选下没有日志'}
			</EmptyState>
		{:else}
			{#if ws.logs.droppedCount > 0}
				<p class="border-b border-gray-100 px-4 py-2 text-center text-xs text-gray-600">
					只保留最近 {LOG_LIMIT} 条，已丢弃更早的 {ws.logs.droppedCount} 条
				</p>
			{/if}
			{#if hiddenCount > 0}
				<div class="border-b border-gray-100 px-4 py-2 text-center">
					<Button label="加载更早的日志" onclick={loadEarlier}>
						加载更早（还有 {hiddenCount} 条未显示）
					</Button>
				</div>
			{/if}
			{#each shown as log (log.id)}
				{@const connection = ws.connections.connection(log.connectionId)}
				{@const collapsed = ws.logs.collapsed.has(log.id)}
				{@const bodyClass = contentClass(log.direction, collapsed)}
				<!-- 这里刻意不用 content-visibility: 未渲染的行只能按 contain-intrinsic-size 估算高度，
			     估算值和真实行高一对不上，滚动时位置就会漂（实测加载更早会漂 100~400px）。
			     真正限制 DOM 规模的是渲染窗口（一次最多 300 条） -->
				<div data-log-row class="border-b border-gray-100 px-4 py-2.5 hover:bg-gray-50">
					<div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
						<!-- 图标按钮视觉做小（size-5），用 after 伪元素把热区撑到 44px 满足触控要求 -->
						<Button
							icon
							label={collapsed ? `展开 #${log.id} 的消息内容` : `折叠 #${log.id} 的消息内容`}
							title={collapsed ? '展开消息内容' : '折叠消息内容'}
							size="sm"
							aria-expanded={!collapsed}
							onclick={() => ws.logs.toggleCollapsed(log.id)}
							class="relative rounded after:absolute after:-inset-3 after:content-['']"
						>
							{#if collapsed}
								<ChevronRight class="size-3.5" />
							{:else}
								<ChevronDown class="size-3.5" />
							{/if}
						</Button>
						<span class="tabular-nums">{formatTime(log.timestamp)}</span>
						{#if connection}
							<span class="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-600" title={connection.url}
								>#{connection.id}</span
							>
						{/if}
						<span class="inline-flex items-center gap-0.5 font-medium {directionClass(log.direction)}">
							{#if log.direction === 'sent'}
								<ArrowUp class="size-3" />
							{:else if log.direction === 'received'}
								<ArrowDown class="size-3" />
							{:else}
								<Info class="size-3" />
							{/if}
							{directionLabel(log.direction)}
						</span>
						<span class="max-w-40 truncate" title={targetLabel(connection)}>{targetLabel(connection)}</span>
						<!-- 类型与大小做成跟 #id 一样的浅色小标签：裸文本挤在时间戳和地址之间，扫读时分不出组 -->
						<span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{typeText(log.type)}</span>
						<span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 tabular-nums">{log.size}</span>
						<!-- 带文字的小操作，不是纯图标按钮，不套 Button 的 icon 形态；
						     after 伪元素把热区撑到 44px 满足触控要求 -->
						<button
							type="button"
							onclick={() => copy(log.content)}
							title="复制消息内容"
							aria-label="复制消息内容"
							class="relative inline-flex items-center gap-0.5 rounded px-0.5 after:absolute after:-inset-3 after:content-[''] hover:text-blue-600 {FOCUS_RING}"
						>
							<Copy class="size-3" />复制
						</button>
					</div>
					{#if collapsed}
						<span class={bodyClass}>{log.content.replace(/\s+/g, ' ')}</span>
					{:else if log.tokens}
						<pre class={bodyClass}>{#each log.tokens as token, index (index)}<span class={TOKEN_CLASS[token.kind]}
									>{token.text}</span
								>{/each}</pre>
					{:else}
						<pre class={bodyClass}>{log.content}</pre>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- 状态条走 Panel 的 footer：渲染在正文容器之外，分隔线贴卡片边框 -->
	{#snippet footer()}
		<div
			class="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 px-4 py-2 text-xs"
			role="status"
			aria-live="polite"
		>
			<!-- min-h-6：底部这一行跟连接列表底部等高（内容都按 24px 的触控下限） -->
			<span class="flex min-h-6 items-center gap-2 text-gray-600">
				<span>{countLabel}</span>
			</span>
			{#if selected}
				<!-- flex-1 + justify-end：整组占满剩余宽度并靠右。
				     地址按内容自适应，max-w-56 只兜底超长地址；不给它 flex-1，
				     否则短地址后面会拖出一片空白 -->
				<span class="inline-flex min-h-6 min-w-0 flex-1 items-center justify-end gap-1.5 text-gray-600">
					<span class="size-1.5 shrink-0 rounded-full {statusDotClass(selected.status)}"></span>
					<span class="shrink-0 font-semibold">#{selected.id}</span>
					<span class="hidden max-w-56 truncate md:inline" title={selected.url}>{selected.url}</span>
					<span class="shrink-0 text-gray-600">
						{selectedStatusText}
					</span>
					<span class="shrink-0 text-gray-600 tabular-nums">
						收 {selectedCounts.received} 发 {selectedCounts.sent}
					</span>
				</span>
			{:else}
				<span class="inline-flex min-h-6 items-center text-gray-600">未选择连接</span>
			{/if}
		</div>
	{/snippet}
</Panel>
