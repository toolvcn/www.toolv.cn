<script lang="ts">
	// 定时任务列表。状态来自模块级单例 ws，所以不用传参 ——
	// 拆出来只是为了把「定时任务」这一块从 Composer 里独立出去。
	import { CircleStop, Play, Plus, Timer, Trash } from '@lucide/svelte';
	import type { Connection } from '../core/connection.svelte.ts';
	import type { ScheduledTask } from '../core/types.ts';
	import { scheduledStatusText } from '../core/labels.ts';
	import Button from '$lib/ui/Button/Button.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import { INPUT_BASE, INPUT_FOCUS } from '$lib/ui/styles';
	import { ws } from '../core/websocket.svelte.ts';
	import { toast } from '$lib/ui/toast.svelte';

	const selected = $derived(ws.connections.selected);
	// 各条连接的任务列表互不影响
	const tasks = $derived(selected?.scheduled ?? []);
	const enabledCount = $derived(selected?.enabledTaskCount ?? 0);

	// 条件类名一律在脚本里算好：写在 class 属性里会被 prettier 拆行而静默失效
	const titleIconClass = $derived(timerIconClass(enabledCount > 0));
	const statusClass = $derived(
		enabledCount > 0
			? 'flex min-h-6 items-center gap-1.5 text-xs text-blue-700'
			: 'flex min-h-6 items-center gap-1.5 text-xs text-gray-600'
	);

	// 状态播报的拼装规则在 labels.ts；其它连接上还有几个在跑也要说一声
	const status = $derived(
		scheduledStatusText(
			selected?.id ?? null,
			tasks.length,
			enabledCount,
			ws.connections.enabledTaskCount - enabledCount
		)
	);

	// 任务的增删改在 Connection 上，提示语在这里 —— 对象不认识 toast
	function addTask(connection: Connection): void {
		connection.addTask();
		toast.show(`已为 #${connection.id} 新增一条定时发送任务`);
	}

	function removeTask(connection: Connection, taskId: number): void {
		if (connection.removeTask(taskId)) toast.show(`已删除 #${connection.id} 的定时发送任务`);
	}

	function toggleTask(connection: Connection, taskId: number): void {
		const result = connection.toggleTask(taskId);
		if (result === 'need-interval') toast.show('定时发送间隔必须大于 0 秒');
		else if (result === 'need-message') toast.show('请先填写定时发送的消息内容');
	}

	function updateInterval(task: ScheduledTask, event: Event & { currentTarget: HTMLInputElement }): void {
		const next = Number(event.currentTarget.value);
		if (!Number.isFinite(next)) return;
		task.interval = next;
	}

	// 任务行里的条件类名同样放脚本里算。
	// 图标颜色与区块标题那个图标共用同一套规则，只需要一个函数
	function timerIconClass(enabled: boolean): string {
		return enabled ? 'size-4 text-blue-600' : 'size-4 text-gray-500';
	}

	function taskActionLabel(task: ScheduledTask): string {
		return task.enabled
			? `停用这条每 ${task.interval} 秒发送的定时发送任务`
			: `启用这条每 ${task.interval} 秒发送的定时发送任务`;
	}
</script>

<!-- 整块常驻，任务行增删时才变高度，开关任务不会跳 -->
<div class="flex flex-col gap-2 border-t border-gray-200 p-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h3 class="inline-flex h-8 items-center gap-1.5 text-sm font-semibold text-gray-900">
			<Timer class={titleIconClass} />
			定时任务 <span class="text-xs font-normal text-gray-600">（填好间隔与消息后再启用）</span>
		</h3>
		<Button
			label="为当前连接新增一条定时发送任务"
			title="新增一条定时发送任务（默认关闭，填好间隔与消息再启用）"
			disabled={!selected}
			onclick={() => selected && addTask(selected)}
		>
			<Plus class="size-3.5" />添加任务
		</Button>
	</div>

	<!-- 状态行常驻：开关任务时用 aria-live 播报 -->
	<p role="status" aria-live="polite" class={statusClass}>{status}</p>

	{#if selected}
		{#if tasks.length === 0}
			<EmptyState>还没有定时任务，点右上角「添加任务」新建</EmptyState>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each tasks as task (task.id)}
					<!-- relative 不能省：行内的 sr-only 是 absolute，没有定位上下文会逃出裁剪撑高文档 -->
					<li class="relative flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
						<Timer class={timerIconClass(task.enabled)} />
						<label for="task-interval-{task.id}" class="sr-only">定时任务 {task.id} 的间隔（秒）</label>
						<input
							id="task-interval-{task.id}"
							type="number"
							min="1"
							value={task.interval}
							oninput={(event) => updateInterval(task, event)}
							class="h-8 w-16 {INPUT_BASE} px-2 text-center text-xs text-gray-900 {INPUT_FOCUS}"
						/>
						<span class="text-xs text-gray-500">秒</span>
						<label for="task-message-{task.id}" class="sr-only">定时任务 {task.id} 的消息内容</label>
						<input
							id="task-message-{task.id}"
							type="text"
							placeholder="定时发送的消息内容"
							bind:value={task.message}
							class="h-8 min-w-0 flex-1 basis-40 {INPUT_BASE} px-2.5 text-xs text-gray-900 placeholder:text-gray-600 {INPUT_FOCUS}"
						/>
						<Button
							icon
							label={taskActionLabel(task)}
							variant={task.enabled ? 'danger' : 'primary'}
							onclick={() => selected && toggleTask(selected, task.id)}
						>
							{#if task.enabled}
								<CircleStop class="size-3.5" />
							{:else}
								<Play class="size-3.5" />
							{/if}
						</Button>
						<Button
							icon
							label="删除这条定时发送任务"
							variant="danger"
							onclick={() => selected && removeTask(selected, task.id)}
						>
							<Trash class="size-3.5" />
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
