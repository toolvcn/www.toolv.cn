<script lang="ts">
	// 消息面板外壳：面板头部 + 消息编辑区。
	// 「建连后自动发送」只在添加连接时设置（连接栏），列表里用图标开关，
	// 所以这里不设它的编辑区；定时任务与快捷预设各自拆成独立组件。
	import { Clock, Plug, SendHorizontal, Unplug } from '@lucide/svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import PresetList from './PresetList.svelte';
	import ScheduledTaskList from './ScheduledTaskList.svelte';
	import { statusText } from '../core/format.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { DISABLED, FOCUS_RING } from '$lib/ui/styles';
	import { statusDotClass } from './styles.ts';
	import { ws } from '../core/websocket.svelte.ts';

	const messagePlaceholder = '输入要发送的消息，支持 JSON 格式。例如：{"type": "ping", "time": 1704067200000}';

	const selected = $derived(ws.connections.selected);
	const connected = $derived(selected?.status === 'connected');

	// 只清当前选中连接的日志，其它连接的保留 —— 跨了 selected 与 logs 两个对象，就地拼一下
	function clearCurrentLogs(): void {
		if (selected) ws.logs.clearOf(selected.id);
	}
</script>

<Panel id="composer" headingId="composer-heading" heading="消息面板" class="lg:h-full lg:min-h-0">
	{#snippet headingExtra()}
		{#if selected}
			<!-- 带上 #序号：光看地址认不出是哪条连接，日志面板底部也是这个写法 -->
			<span class="inline-flex min-w-0 items-center gap-1.5">
				<span class="shrink-0 text-xs font-semibold text-gray-700">#{selected.id}</span>
				<span class="max-w-40 truncate text-xs text-gray-500" title={selected.url}>{selected.url}</span>
			</span>
		{:else}
			<span class="text-xs text-gray-500">请选择连接</span>
		{/if}
	{/snippet}
	<!-- 右侧常驻（未选中时按钮禁用）：避免选中前后头部高度来回跳 -->
	{#snippet actions()}
		<span class="inline-flex h-7 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2">
			<span class="size-2 rounded-full {statusDotClass(selected?.status ?? 'disconnected')}"></span>
			<span class="text-xs text-gray-700">{selected ? statusText(selected.status) : '未连接'}</span>
			{#if connected && selected && selected.latency !== null}
				<span class="text-xs text-gray-600 tabular-nums">{selected.latency}ms</span>
			{/if}
		</span>
		<button
			type="button"
			disabled={!selected}
			aria-label={connected ? '断开连接' : '连接'}
			title={connected ? '断开连接' : '连接'}
			onclick={() => selected && ws.connections.toggle(selected.id)}
			class="inline-flex size-7 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 {FOCUS_RING} {DISABLED}"
		>
			{#if connected}
				<Unplug class="size-3.5" />
			{:else}
				<Plug class="size-3.5" />
			{/if}
		</button>
	{/snippet}

	<!--
		滚动容器必须是这一层，不能让 Panel 外壳自己滚：
		外壳一滚，h-12 的标题栏（状态胶囊、#序号、连接按钮）会跟着滚出去再也回不来，
		在下面的预设输入框里打个字就能把面板顶飞。连接列表和日志面板都是这个结构。
		移动端不限高，容器跟着内容长，滚动交回整页。
	-->
	<div class="overflow-y-auto lg:min-h-0 lg:flex-1">
		<div class="flex flex-col gap-3 p-4">
			<!-- 快捷键提示常驻：Ctrl / Cmd + Enter 发送只写在 title 里等于没人知道 -->
			<div class="flex min-h-6 flex-wrap items-center gap-x-2">
				<label for="message-input" class="text-xs font-medium text-gray-600">消息内容</label>
				<span class="ml-auto text-xs text-gray-500">Ctrl / Cmd + Enter 发送</span>
			</div>
			<EditorBox>
				<Textarea
					id="message-input"
					rows={6}
					mono
					resize="y"
					textSize="text-xs"
					placeholder={messagePlaceholder}
					autocapitalize="off"
					bind:value={ws.msgInput}
					onkeydown={(event) => (event.ctrlKey || event.metaKey) && event.key === 'Enter' && ws.send()}
				/>
			</EditorBox>

			<div class="flex flex-wrap items-center gap-2">
				<Button
					label="把输入框的内容发送到当前选中的连接"
					title="发送到当前选中的连接（Ctrl / Cmd + Enter）"
					variant="primary"
					size="md"
					disabled={!selected}
					onclick={() => ws.send()}
				>
					<SendHorizontal class="size-4" />发送
				</Button>
				<Button
					label="把输入框的内容广播到所有已连接的连接"
					title="广播到所有已连接的连接"
					onclick={() => ws.broadcast(ws.msgInput)}>广播</Button
				>
				<Button
					label="把输入框里的 JSON 格式化并缩进"
					title="格式化 JSON（缩进 2 空格）"
					onclick={() => ws.formatMsgInput()}>格式化</Button
				>
				<Button
					label="把输入框里的 JSON 压缩成一行"
					title="压缩 JSON（去掉所有空白）"
					onclick={() => ws.compressMsgInput()}>压缩</Button
				>
				<Button
					label="把消息里的 time 字段换成当前时间戳"
					title="把消息里的 time 字段换成当前时间戳（用于 ping/pong 延迟测量）"
					onclick={() => ws.insertTimestamp()}
				>
					<Clock class="size-4" />插入时间戳
				</Button>
				<Button
					label="只清空当前选中连接的日志"
					title="只清空当前选中连接的日志，其它连接的保留"
					onclick={clearCurrentLogs}>清空当前连接日志</Button
				>
			</div>
		</div>

		<ScheduledTaskList />
		<PresetList />
	</div>
</Panel>
