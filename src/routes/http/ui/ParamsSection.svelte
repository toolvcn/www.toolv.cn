<script lang="ts">
	// 参数标签页：查询参数表格。与 URL 双向同步 —— 改表 URL 跟着变，改 URL 表跟着变。
	// 同步逻辑全在 store 的 setUrl / updateParam 里（一处真源），这里只做绑定与文案。
	import KeyValueTable from './KeyValueTable.svelte';
	import { httpStore } from '../core/store.svelte.ts';

	/** 真正会写进 URL 的行：启用的、且键名非空 */
	const activeCount = $derived(httpStore.params.filter((row) => row.enabled && row.name.trim() !== '').length);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<p class="shrink-0 px-4 pt-3 pb-2 text-[11px] leading-4 text-gray-600">
		与上面的 URL 双向同步：在这里改，URL 跟着变；直接改 URL，这里也跟着变。取消勾选的行留在表里但不发送（现启用 {activeCount}
		条）。
	</p>
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
		<KeyValueTable
			idPrefix="http-param"
			rows={httpStore.params}
			onchange={(id, patch) => httpStore.updateParam(id, patch)}
			onremove={(id) => httpStore.removeParam(id)}
			onadd={() => httpStore.addParam()}
			namePlaceholder="参数名"
			valuePlaceholder="值"
			emptyHint="还没有查询参数。点下面的「添加」加一条，或者直接在 URL 里写 ?a=1。"
			addLabel="添加查询参数"
		/>
	</div>
</div>
