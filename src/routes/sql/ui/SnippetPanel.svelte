<script lang="ts">
	// 我的片段面板（本工具的业务绑定）：版式与导出 / 导入 / 列表交互在
	// $lib/components/PresetPanel，这里只把 store 与几处文案接上，外加两条**二次确认**。
	//
	// 与参数预设的区别：那份存的是「一组变量值」（键值快照），这份存的是「用户写的整段 SQL」。
	// 两者共用同一个共享面板组件（它只认 `{ id, name }` 这个最小形状），但 localStorage 键分开。
	import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { sqlStore, type SqlSnippet } from '../core/store.svelte.ts';

	/** 徽章放行数：片段列表里「多长」是最有用的信息 */
	function badgeText(item: SqlSnippet): string {
		return `${item.sql.trim().split('\n').length} 行`;
	}

	/** 摘要放 SQL 首行 —— 名称是用户起的，首行才是「这段到底写了什么」 */
	function summaryText(item: SqlSnippet): string {
		return item.sql.trim().split('\n')[0] ?? '';
	}

	/** 删除前先确认：本地存档删掉就找不回来了（与 regex 的已保存配置同一套确认框） */
	async function confirmDelete(id: number): Promise<void> {
		const item = sqlStore.snippets.find((snippet) => snippet.id === id);
		if (item === undefined) return;
		if (!(await confirm.ask(`确定删除片段「${item.name}」吗？删除后无法恢复。`))) return;
		sqlStore.deleteSnippet(id);
	}

	/** 点一条片段：会盖掉编辑器里已写的内容时先问一句，其余情况直接放回去 */
	async function applySnippet(id: number): Promise<void> {
		const item = sqlStore.snippets.find((snippet) => snippet.id === id);
		if (item === undefined) return;
		const overwrite = sqlStore.needsOverwriteConfirm(id)
			? await confirm.ask(`「${item.name}」会覆盖你当前编辑的 SQL。是否覆盖？`)
			: true;
		if (!overwrite) return;
		sqlStore.applySnippet(id);
	}
</script>

<PresetPanel
	idPrefix="sql-snippets"
	heading="我的片段"
	noun="片段"
	presets={sqlStore.snippets}
	bind:name={sqlStore.snippetName}
	exportFileName="sql-snippets.json"
	exportText={sqlStore.snippetsText}
	onsave={() => sqlStore.saveSnippet()}
	onapply={applySnippet}
	ondelete={confirmDelete}
	onimport={(text) => sqlStore.importSnippetsText(text)}
	{badgeText}
	{summaryText}
	emptyHint="还没有片段：在编辑器里写好一段 SQL，起个名字点「保存」（名称留空就用 SQL 首行），下次一键放回编辑器；也可导出 / 导入 JSON 备份。"
/>
