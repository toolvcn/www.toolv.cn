<script lang="ts" generics="T extends { id: number }">
	// 可排序的行列表（参数表里「参数」段与「# 片段」段共用）。
	// 行内容由调用方用 `rowBody` snippet 给，这里只管排序手柄、序号、删除与拖动状态。
	//
	// 排序走**指针事件**，不用 HTML5 拖放（draggable + dataTransfer）—— 后者在触屏上一次都不触发，
	// 而这两段在手机上同样要能排。按住手柄后把指针捕获到手柄上，手指滑出那个 32px 图标也照样收得到 move。
	// **手柄还带键盘等价操作**（聚焦后 ↑ / ↓ 与相邻那条交换）：只给拖动不补这一条，
	// 键盘用户就完全排不动（WCAG 2.2 的拖动替代）。
	import type { Snippet } from 'svelte';
	import { GripVertical, Trash } from '@lucide/svelte';

	let {
		/** 列表标识：拖动时靠它只在同一段里找落点（页面上有两段这种列表） */
		listId,
		rows,
		/** 无障碍名，拼进 <ul> */
		ariaLabel,
		/** 没有行时的提示 */
		emptyHint,
		onremove,
		onreorder,
		onmove,
		rowBody
	}: {
		listId: string;
		rows: readonly T[];
		ariaLabel: string;
		emptyHint: string;
		onremove: (id: number) => void;
		onreorder: (dragId: number, targetId: number) => void;
		onmove: (id: number, delta: number) => void;
		rowBody: Snippet<[T, number]>;
	} = $props();

	/** 这一段正在被拖的是哪条 */
	let draggingId = $state<number | null>(null);

	/**
	 * 按住手柄开始拖。不拦默认行为的话，按住横拖会变成选中行里的文字。
	 * 指针捕获由浏览器在 pointerup / pointercancel 时自动释放。
	 */
	function startDrag(event: PointerEvent, id: number): void {
		if (!event.isPrimary || event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		draggingId = id;
	}

	/**
	 * 指针底下是哪条就排到哪条的位置。**只认本段的行**（`data-sort-list` 对不上就跳过），
	 * **并跳过自己**：排完之后指针底下正是这一条，不跳会在两条之间来回抖。
	 */
	function dragOver(event: PointerEvent): void {
		if (draggingId === null) return;
		const raw = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest(`li[data-sort-list="${listId}"]`)
			?.getAttribute('data-sort-id');
		if (raw === null || raw === undefined) return;
		const targetId = Number(raw);
		if (!Number.isFinite(targetId) || targetId === draggingId) return;
		onreorder(draggingId, targetId);
	}

	function endDrag(): void {
		draggingId = null;
	}

	/** ↑ / ↓ 移动一条：拦掉默认滚动，否则排在列表中间时会顺带把面板滚走 */
	function handleKeydown(event: KeyboardEvent, id: number): void {
		let delta = 0;
		if (event.key === 'ArrowUp') delta = -1;
		else if (event.key === 'ArrowDown') delta = 1;
		if (delta === 0) return;
		event.preventDefault();
		onmove(id, delta);
	}

	/** `touch-none` 不能省：触屏上不关掉手势，按住手柄一拖就变成滚面板 */
	const HANDLE =
		'flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none active:cursor-grabbing';
	const ROW_DELETE =
		'flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none';
	const ROW = 'relative flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-b-0';
	const ROW_DRAGGING = `${ROW} rounded-lg bg-blue-50`;

	/** 条件类名一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） */
	const rowClass = (id: number): string => (id === draggingId ? ROW_DRAGGING : ROW);
</script>

<!-- 这里不自己滚：整张参数表共用一个滚动容器（见 ParamTable），段内列表按内容撑开 -->
{#if rows.length === 0}
	<p class="px-4 py-3 text-center text-xs leading-5 text-gray-600">{emptyHint}</p>
{:else}
	<ul class="px-4" aria-label={ariaLabel}>
		{#each rows as item, index (item.id)}
			<li class={rowClass(item.id)} data-sort-list={listId} data-sort-id={item.id}>
				<button
					type="button"
					class={HANDLE}
					aria-label={`拖动排序第 ${index + 1} 行，或按 ↑ ↓ 键移动`}
					title="拖动排序（聚焦后按 ↑ ↓）"
					onpointerdown={(event) => startDrag(event, item.id)}
					onpointermove={dragOver}
					onpointerup={endDrag}
					onpointercancel={endDrag}
					onkeydown={(event) => handleKeydown(event, item.id)}
				>
					<GripVertical class="size-3.5" aria-hidden="true" />
				</button>
				<span class="hidden w-5 shrink-0 text-right text-xs text-gray-600 sm:block">{index + 1}</span>
				{@render rowBody(item, index)}
				<button
					type="button"
					class={ROW_DELETE}
					onclick={() => onremove(item.id)}
					aria-label={`删除第 ${index + 1} 行`}
				>
					<Trash class="size-4" aria-hidden="true" />
				</button>
			</li>
		{/each}
	</ul>
{/if}
