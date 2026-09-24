<script lang="ts">
	// 参数表：把输入串拆成三段编辑 —— 地址（`?` 之前）/ 参数（`?` 与 `#` 之间的键值行）/ # 片段（`#` 之后的键值行）。
	// 三段任一改动都合成回输入串（写回在 store），这里只做版式与事件分发。
	// 三段常驻：没有也能直接补，不必先回文本视图。滚动由外层的**一整块**负责，段内列表不各自滚。
	import { ListPlus } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import type { QueryParamRow } from '../core/types.ts';
	import SortableList from './SortableList.svelte';
	import { urlStore } from '../core/store.svelte.ts';
	import { PANEL_SCROLL } from '$lib/ui/styles';

	/** 三段共用的小节标题行：标题在左，「添加」按钮靠右 */
	const SECTION_HEAD = 'flex shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-1';
	const SECTION_LABEL = 'text-xs font-medium text-gray-600';
</script>

<!-- 三段共用一条滚动条：滚的是整张参数表的正文，不是各段自己的列表。
     可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
     svelte 的静态规则不认识 role="region"，这里放行。小屏封顶，桌面交给卡片高度 -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class={PANEL_SCROLL} tabindex="0" role="region" aria-label="参数表">
	<!-- 地址：`?` 之前（含 `?`）。留空就不带前缀 -->
	<section class="border-b border-gray-200 pb-2" aria-label="地址">
		<div class={SECTION_HEAD}>
			<h3 class={SECTION_LABEL}>地址</h3>
		</div>
		<div class="px-4 pb-1">
			<label class="sr-only" for="url-param-prefix">地址（域名 / 路径 + ?，留空则不带前缀）</label>
			<Input
				id="url-param-prefix"
				size="sm"
				mono
				class="min-w-0"
				value={urlStore.prefix}
				oninput={(event) => urlStore.setPrefix(event.currentTarget.value)}
				placeholder="https://example.com/s?"
			/>
		</div>
	</section>

	<!-- 参数：键值行，& 连接，键值两边各自 encodeURIComponent -->
	<section class="border-b border-gray-200 pb-2" aria-label="参数">
		<div class={SECTION_HEAD}>
			<h3 class={SECTION_LABEL}>参数</h3>
			<Button size="xs" label="在参数末尾添加一行参数" title="添加参数" onclick={() => urlStore.addRow('query')}>
				<ListPlus class="size-3.5 shrink-0" aria-hidden="true" />添加参数
			</Button>
		</div>
		<SortableList
			listId="url-query"
			ariaLabel="URL 查询参数"
			emptyHint="还没有参数，点右上角「添加参数」加一行。"
			rows={urlStore.queryRows}
			onremove={(id) => urlStore.removeRow('query', id)}
			onreorder={(dragId, targetId) => urlStore.moveRow('query', dragId, targetId)}
			onmove={(id, delta) => urlStore.nudgeRow('query', id, delta)}
		>
			{#snippet rowBody(item: QueryParamRow, index: number)}
				<label class="sr-only" for="url-param-key-{item.id}">第 {index + 1} 行键名</label>
				<Input
					id="url-param-key-{item.id}"
					size="sm"
					mono
					class="min-w-0 basis-1/3"
					value={item.key}
					oninput={(event) => urlStore.updateQueryRow(item.id, event.currentTarget.value, item.value)}
					placeholder="键"
				/>
				<span class="shrink-0 text-xs text-gray-600" aria-hidden="true">=</span>
				<label class="sr-only" for="url-param-value-{item.id}">第 {index + 1} 行值</label>
				<Input
					id="url-param-value-{item.id}"
					size="sm"
					mono
					class="min-w-0 basis-2/3"
					value={item.value}
					oninput={(event) => urlStore.updateQueryRow(item.id, item.key, event.currentTarget.value)}
					placeholder="值"
				/>
			{/snippet}
		</SortableList>
	</section>

	<!-- # 片段：与参数段同形同编码（&=连接、键值各自编码），唯一差别是值为空时只留键 -->
	<section class="pb-2" aria-label="片段">
		<div class={SECTION_HEAD}>
			<h3 class={SECTION_LABEL}># 片段</h3>
			<Button size="xs" label="在片段末尾添加一行" title="添加一行" onclick={() => urlStore.addRow('fragment')}>
				<ListPlus class="size-3.5 shrink-0" aria-hidden="true" />添加一行
			</Button>
		</div>
		<SortableList
			listId="url-fragment"
			ariaLabel="URL # 片段"
			emptyHint="还没有片段行，点右上角「添加一行」加一行。"
			rows={urlStore.fragmentRows}
			onremove={(id) => urlStore.removeRow('fragment', id)}
			onreorder={(dragId, targetId) => urlStore.moveRow('fragment', dragId, targetId)}
			onmove={(id, delta) => urlStore.nudgeRow('fragment', id, delta)}
		>
			{#snippet rowBody(item: QueryParamRow, index: number)}
				<label class="sr-only" for="url-fragment-key-{item.id}">第 {index + 1} 行片段键名（可空）</label>
				<Input
					id="url-fragment-key-{item.id}"
					size="sm"
					mono
					class="min-w-0 basis-1/3"
					value={item.key}
					oninput={(event) => urlStore.updateFragmentRow(item.id, event.currentTarget.value, item.value)}
					placeholder="键"
				/>
				<span class="shrink-0 text-xs text-gray-600" aria-hidden="true">=</span>
				<label class="sr-only" for="url-fragment-value-{item.id}">第 {index + 1} 行片段值（可空）</label>
				<Input
					id="url-fragment-value-{item.id}"
					size="sm"
					mono
					class="min-w-0 basis-2/3"
					value={item.value}
					oninput={(event) => urlStore.updateFragmentRow(item.id, item.key, event.currentTarget.value)}
					placeholder="值"
				/>
			{/snippet}
		</SortableList>
	</section>
</div>
