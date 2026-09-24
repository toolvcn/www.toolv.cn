<script lang="ts">
	// 参数预设面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel，这里只把 store 与两处文案接上。
	// localStorage 持久化在 +page.svelte（全站唯一的副作用处）。
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import { httpStore } from '../core/store.svelte.ts';
</script>

<PresetPanel
	idPrefix="http"
	presets={httpStore.presets}
	bind:name={httpStore.presetName}
	exportFileName="http-presets.json"
	exportText={httpStore.presetsText}
	onsave={() => httpStore.savePreset()}
	onapply={(id) => httpStore.applyPreset(id)}
	ondelete={(id) => httpStore.deletePreset(id)}
	onimport={(text) => void httpStore.importPresetsText(text)}
	badgeText={(preset) => preset.method}
	summaryText={(preset) => preset.url}
	emptyHint="还没有预设：填好请求后在顶部填个名称点「保存」，整组参数就存在本地；也可导出 / 导入文件备份。"
/>
