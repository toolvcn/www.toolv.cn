<script lang="ts">
	// 连接列表面板。集合、筛选、批量操作都在 ws.connections 上，文案规则在 core/labels.ts，
	// 这里只负责把它们摆进 DOM。
	import { Plug, SendHorizontal, Timer, Trash, Unplug } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import type { Connection } from '../core/connection.svelte.ts';
	import {
		autoSendLabel,
		batchActionLabel,
		batchActionText,
		batchRemoveConfirm,
		scheduledLabel
	} from '../core/labels.ts';
	import { formatDuration, statusText } from '../core/format.ts';
	import { FOCUS_RING } from '$lib/ui/styles';
	import { statusDotClass } from './styles.ts';
	import { ws } from '../core/websocket.svelte.ts';
	import { toast } from '$lib/ui/toast.svelte';

	function connectionDuration(connection: { connectedAt: number | null }): string {
		return connection.connectedAt ? formatDuration(ws.now - connection.connectedAt) : '未连接';
	}

	async function remove(connectionId: number): Promise<void> {
		if (await confirm.ask('确定要移除该连接吗？')) ws.removeConnection(connectionId);
	}

	async function removeVisible(): Promise<void> {
		const count = ws.connections.visible.length;
		if (count === 0) return;
		const filtered = count < ws.connections.all.length;
		if (await confirm.ask(batchRemoveConfirm(count, filtered))) ws.removeVisibleConnections();
	}

	// 启停自动发送：切换在 Connection 上，提示语在这里 ——
	// 对象不认识 toast，「已开启 #x」这种话归 UI 说
	function toggleAutoSend(connection: Connection): void {
		const wasEnabled = connection.autoSendEnabled;
		if (!connection.toggleAutoSend()) {
			toast.show('这条连接没有自动发送内容，需在添加连接时设置');
			return;
		}
		toast.show(`已${wasEnabled ? '停用' : '开启'} #${connection.id} 的连接成功后发送`);
	}

	// 全量收发统计只算一次，供所有行共用（放在 {@const} 里会每行重建一遍 Map）
	const counts = $derived(ws.logs.countsByConnection);

	// 可见连接为 0 时三个批量操作都禁用
	const noVisible = $derived(ws.connections.visible.length === 0);

	/**
	 * 整行都可点，但图标区（data-row-actions）和里面的按钮有自己的行为，
	 * 不能让整行的选中把它们盖掉 —— 所以先看事件是不是从那儿冒出来的。
	 */
	function isFromRowActions(event: Event): boolean {
		return !!(event.target as HTMLElement | null)?.closest('[data-row-actions]');
	}

	function selectFromRow(event: MouseEvent, id: number): void {
		const el = event.target as HTMLElement | null;
		// 地址按钮自己会 select，其余互动元素各自处理，这里不重复
		if (isFromRowActions(event) || el?.closest('button, a, input, label')) return;
		ws.connections.select(id);
	}

	function toggleFromRow(event: MouseEvent, id: number): void {
		if (isFromRowActions(event)) return;
		ws.connections.toggle(id);
	}

	// 定时任务指示器要带数字，不能锁死成 size-6。
	// relative 不能省：里面的 sr-only 是 position:absolute，没有定位上下文时它的包含块是初始包含块，
	// 会逃出面板滚动容器的裁剪，把整个文档撑到几千 px（桌面端页面居然能滚就是这个原因）。
	function timerIndicatorClass(active: boolean): string {
		return active
			? 'relative inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1 text-blue-600'
			: 'relative inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1 text-gray-600';
	}

	// 连接 / 断开 / 删除三个动作三种颜色，光看图标分不出「连上」和「断开」的区别：
	// 绿=连接（正向）、琥珀=断开（中断）、红=删除（不可恢复）。
	// 内容为空的自动发送图标直接置灰禁用，比点了才弹一句提示清楚

	// cursor-pointer：整行可点却没给光标，鼠标用户看不出来；
	// select-none：双击切换连接时不会顺带把整行文字刷成选区
	function rowClass(selected: boolean): string {
		return selected
			? 'cursor-pointer rounded-lg border border-blue-500 bg-blue-50 p-2.5 select-none'
			: 'cursor-pointer rounded-lg border border-gray-200 bg-white p-2.5 select-none hover:bg-gray-50';
	}
</script>

<Panel id="sidebar" headingId="sidebar-heading" heading="连接列表" tag="aside" class="lg:h-full lg:min-h-0">
	{#snippet actions()}
		<Button
			label={batchActionLabel('连接', ws.connections.visible.length, ws.connections.all.length)}
			size="xs"
			disabled={noVisible}
			onclick={() => ws.connections.connectVisible()}
		>
			<Plug class="size-3" />{batchActionText('连接', ws.connections.visible.length, ws.connections.all.length)}
		</Button>
		<Button
			label={batchActionLabel('断开', ws.connections.visible.length, ws.connections.all.length)}
			size="xs"
			disabled={noVisible}
			onclick={() => ws.connections.disconnectVisible()}
		>
			<Unplug class="size-3" />{batchActionText('断开', ws.connections.visible.length, ws.connections.all.length)}
		</Button>
		<Button
			label={batchActionLabel('删除', ws.connections.visible.length, ws.connections.all.length)}
			size="xs"
			variant="danger"
			disabled={noVisible}
			onclick={() => void removeVisible()}
		>
			<Trash class="size-3" />{batchActionText('删除', ws.connections.visible.length, ws.connections.all.length)}
		</Button>
	{/snippet}

	<!-- 移动端限高 45vh 并内部滚动：连接可以加到几十条，不封顶会把整页撑到几千 px；
	     overscroll-contain 防止滚到头时把页面一起带走；lg 起交给栅格行 -->
	<div class="space-y-1.5 overflow-y-auto p-2 max-lg:max-h-[45vh] lg:min-h-0 lg:flex-1">
		{#if ws.connections.all.length === 0}
			<!-- 空态走 EmptyState（本工具另外两张面板也是它）：一句话 + 虚线框，
			     跟「当前筛选下没有连接」用同一个盒子区分两种「空」—— 逐处手写 <p> 时字号会各挑各的 -->
			<EmptyState>暂无连接，添加一个吧</EmptyState>
		{:else if ws.connections.visible.length === 0}
			<EmptyState>当前筛选下没有连接</EmptyState>
		{:else}
			{#each ws.connections.visible as connection (connection.id)}
				{@const stat = counts.get(connection.id) ?? { sent: 0, received: 0 }}
				{@const connected = connection.status === 'connected'}
				{@const autoSendOn = connection.autoSendEnabled}
				{@const autoSendEmpty = !connection.autoSendMsg.trim()}
				{@const taskCount = connection.enabledTaskCount}
				<!-- 整行都可点：点击任意空白处选中，双击切换连接。
				     两项 a11y 警告是有意放过的：整行只是给鼠标的便捷区，
				     键盘路径由里面的地址按钮（可聚焦）和图标按钮提供，
				     给整行加 role="button" 反而会造成嵌套可交互元素。
				     图标区用 data-row-actions 排除在整行点击之外 -->
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<div
					class={rowClass(ws.connections.selectedId === connection.id)}
					onclick={(event) => selectFromRow(event, connection.id)}
					ondblclick={(event) => toggleFromRow(event, connection.id)}
				>
					<!-- 第一行：编号 + 地址 + 收发统计。地址拿 flex-1，
					     统计固定靠右，这样第二行放得下、不会换行 -->
					<div class="flex min-h-6 items-center gap-2">
						<span
							class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
							>{connection.id}</span
						>
						<button
							type="button"
							aria-label="选择连接 {connection.url}"
							title={connection.url}
							aria-current={ws.connections.selectedId === connection.id}
							onclick={() => ws.connections.select(connection.id)}
							class="flex min-h-6 min-w-0 flex-1 items-center truncate rounded text-left text-sm font-medium text-gray-900 {FOCUS_RING}"
						>
							{connection.url}
						</button>
						<span class="shrink-0 text-xs text-gray-600 tabular-nums">收 {stat.received} 发 {stat.sent}</span>
					</div>

					<!-- 第二行：状态 / 时长，右边是功能图标 -->
					<div class="mt-1 flex min-h-6 items-center gap-x-2 text-xs text-gray-600">
						<span class="flex shrink-0 items-center gap-1.5">
							<span class="size-1.5 shrink-0 rounded-full {statusDotClass(connection.status)}"></span>
							{statusText(connection.status)}
							{#if connected && connection.latency !== null}
								<span class="text-emerald-700 tabular-nums">{connection.latency}ms</span>
							{/if}
						</span>
						<span class="shrink-0 tabular-nums">{connectionDuration(connection)}</span>
						<span data-row-actions class="ml-auto flex shrink-0 items-center gap-0.5">
							<Button
								icon
								label={autoSendLabel(connection)}
								variant={autoSendOn ? 'primary' : 'neutral'}
								disabled={autoSendEmpty}
								onclick={() => toggleAutoSend(connection)}
							>
								<SendHorizontal class="size-3.5" />
							</Button>
							<!-- 纯指示器：任务的增删改都在消息面板里做，这里只显示有几个在跑 -->
							<span class={timerIndicatorClass(taskCount > 0)} title={scheduledLabel(connection)}>
								<Timer class="size-3.5" />
								<span class="text-xs font-semibold tabular-nums">{taskCount}</span>
								<span class="sr-only">{scheduledLabel(connection)}</span>
							</span>
							<Button
								icon
								label={connected ? `断开 #${connection.id}` : `连接 #${connection.id}`}
								title={connected ? '断开连接' : '连接'}
								variant={connected ? 'warning' : 'success'}
								onclick={() => ws.connections.toggle(connection.id)}
							>
								{#if connected}
									<Unplug class="size-3.5" />
								{:else}
									<Plug class="size-3.5" />
								{/if}
							</Button>
							<Button
								icon
								label="移除连接 {connection.url}"
								title="移除连接"
								variant="danger"
								onclick={() => void remove(connection.id)}
							>
								<Trash class="size-3.5" />
							</Button>
						</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- 底部：三个计数居中，后两个勾选框兼作状态筛选。
	     走 Panel 的 footer：渲染在正文容器之外，分隔线贴卡片边框。
	     live region 只包住「会变的数字」那段，不包勾选框本身：
	     整块放进 aria-live 时勾一下会把「总 11 已连接 0 未连接 11」整段重念一遍 -->
	{#snippet footer()}
		<div
			class="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-gray-200 px-4 py-2 text-xs"
		>
			<span aria-live="polite" class="inline-flex h-6 items-center gap-1.5 text-gray-600">
				<span class="size-2 rounded-full bg-blue-600"></span>总
				<span class="tabular-nums">{ws.connections.all.length}</span>
			</span>
			<Checkbox bind:checked={ws.connections.statusFilter.connected}>
				<span class="size-2 rounded-full bg-emerald-500"></span>
				<!-- 只写 aria-live 不写 role="status"：带 role 的 span 会被从 label 的无障碍名称里
				     排除掉，勾选框就没名字了（axe 的 label 规则实测会报） -->
				<span aria-live="polite">已连接 {ws.connections.connectedCount}</span>
			</Checkbox>
			<Checkbox bind:checked={ws.connections.statusFilter.disconnected}>
				<span class="size-2 rounded-full bg-gray-300"></span>
				<span aria-live="polite">未连接 {ws.connections.disconnectedCount}</span>
			</Checkbox>
		</div>
	{/snippet}
</Panel>
