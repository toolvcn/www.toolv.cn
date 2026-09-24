<script lang="ts">
	// 页面外壳 + SEO head：两个标签（速查表 / SQL 编辑器），速查那套复用 docker / git / linux 的
	// 共享组装件，编辑器与片段存档是本页独有的。
	//
	// 为什么分标签而不是同屏两栏：速查是主用途（打开就要能查），编辑器是「顺手拼一段」。
	// 同屏会让两块抢高度（尤其 375 那档），分标签后各自独占满屏、各管一层滚动。
	import { onMount } from 'svelte';
	import { Database, ListChecks, SquarePen } from '@lucide/svelte';
	import CommandCheatsheet from '$lib/components/CommandCheatsheet/CommandCheatsheet.svelte';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { parseCheatsheetPresets } from '$lib/utils/command-cheatsheet';
	import { PRESETS_STORAGE_KEY, SNIPPETS_STORAGE_KEY } from './config.ts';
	import { parseSnippets } from './core/snippets.ts';
	import { sqlStore } from './core/store.svelte.ts';
	import PresetPanel from './ui/PresetPanel.svelte';
	import SnippetPanel from './ui/SnippetPanel.svelte';
	import SqlEditor from './ui/SqlEditor.svelte';

	const TABS = [
		{ value: 'cheatsheet', label: '速查表', icon: ListChecks },
		{ value: 'editor', label: 'SQL 编辑器', icon: SquarePen }
	] as const;

	// 两处本地数据的持久化：挂载时恢复，之后任何改动自动写回。
	// restored 开关不能省：首帧预设与片段都还是空的，没有它就会先写一次空值，把上次存的覆盖掉。
	// 隐私模式下 localStorage 不可用，整个读写都包 try/catch 静默忽略。
	let restored = $state(false);

	onMount(() => {
		try {
			const rawPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
			if (rawPresets) {
				const parsed = parseCheatsheetPresets(rawPresets);
				if (parsed.ok) sqlStore.restorePresets(parsed.presets);
			}
			const rawSnippets = localStorage.getItem(SNIPPETS_STORAGE_KEY);
			if (rawSnippets) {
				const parsed = parseSnippets(rawSnippets);
				if (parsed.ok) sqlStore.restoreSnippets(parsed.snippets);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, sqlStore.presetsText);
			localStorage.setItem(SNIPPETS_STORAGE_KEY, sqlStore.snippetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={Database}
	name="SQL 速查表"
	tagline="九类语句速查 · 填值即换 · 本地片段编辑器"
	heading="SQL 速查表"
	description="在线 SQL 速查表与语句编辑器：查询、筛选排序、聚合分组、连接、子查询与 CTE、建表改表、索引与性能、事务与锁、排错与元信息九类常用语句按组列出，填一次表名（可展开字段、条件、排序、关联表、索引名、schema 等变量），语句里的示例值自动替换，一键复制；另有一块带词法高亮的编辑器，写好的语句可存成本地片段（存在你自己的浏览器里，可导出 / 导入 JSON 备份），覆盖前会先确认。纯前端运行，不连数据库、不执行任何语句、不上传任何数据。"
	keywords="SQL速查,sql语句,sql语法,查询语句,select,join,group by,子查询,CTE,建表语句,索引,事务,explain 执行计划,慢查询,SQL在线工具"
	path="/sql"
	ogDescription="九类 SQL 常用语句速查：填表名等变量自动替换、一键复制，另带词法高亮的编辑器与本地片段存档，不连库不上传。"
	fill="fill"
	fillFrom="lg"
>
	<TabShell
		options={TABS}
		value={sqlStore.tab}
		onchange={(tab) => sqlStore.setTab(tab)}
		variant="line"
		aria-label="SQL 工具视图"
	>
		{#if sqlStore.tab === 'cheatsheet'}
			<CommandCheatsheet
				store={sqlStore}
				namePrefix="SQL"
				heading="语句列表"
				searchPlaceholder="搜索：慢查询 / 分页 / 去重 / 建索引 / 加字段 / 锁"
				varsHint="填一次，语句跟着变"
				footerHint="语句里加绿底的是你填的值，纯绿字是示例值；本页不连数据库、不执行任何语句，复制到自己客户端里跑。"
			>
				{#snippet presets()}
					<PresetPanel />
				{/snippet}
			</CommandCheatsheet>
		{:else}
			<!-- 编辑器标签：宽屏左编辑器右片段列表，窄屏上下堆叠（编辑器在上，先写后存） -->
			<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
				<SqlEditor />
				<!-- 1fr 栅格把共享的 PresetPanel 拉到满高：它自己不接受 class，拉伸只能由外面这层给 -->
				<div class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] max-lg:shrink-0">
					<SnippetPanel />
				</div>
			</div>
		{/if}
	</TabShell>
	<Toast />
</ToolShell>
