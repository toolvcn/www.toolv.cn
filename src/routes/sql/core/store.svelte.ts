// SQL 速查表的 store：继承共享的 CheatsheetStore（变量表 / 搜索 / 分组 / 参数预设），
// 再挂上编辑器特有的状态 —— 当前标签、编辑器内容、自定义片段。
//
// 为什么用**继承**而不是再包一层：`CommandCheatsheet` 组装件要的就是一个 `CheatsheetStore`，
// 再加一个 `sqlStore.cheatsheet` 字段会让调用方处处多写一层、也让「本页只有一份状态」这件事变形。
// 片段相关的方法**刻意不放进 `$lib`**：docker / git / linux 没有编辑器，那是 sql 独有的。
//
// 注意 `$lib` 下的 `.svelte.ts` 模块**不带 `.ts` 后缀**引入（与 `$lib/ui/favorites.svelte` 同一写法）：
// 带上后缀会触发 svelte-check 的「导入用了 .ts 扩展名但不是相对路径」报错。
import { CheatsheetStore } from '$lib/components/CommandCheatsheet/cheatsheet.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { EXAMPLE_SQL, MAX_SNIPPETS, MAX_SNIPPET_NAME, VAR_DEFS } from '../config.ts';
import { SQL_COMMANDS, SQL_GROUPS } from './commands.ts';
import { fallbackSnippetName, parseSnippets, serializeSnippets, type SnippetEntry } from './snippets.ts';
import type { SqlSnippet } from './snippets.ts';

export type { SqlSnippet };

/** 两个标签页：速查表（主用途，默认）/ SQL 编辑器 */
export type SqlTab = 'cheatsheet' | 'editor';

class SqlStore extends CheatsheetStore {
	tab = $state<SqlTab>('cheatsheet');

	/** 编辑器内容。首屏给一段示例：空编辑器对新用户没有信息量，示例还顺带展示了高亮效果 */
	sql = $state(EXAMPLE_SQL);

	/** 保存片段时的名称输入框 */
	snippetName = $state('');

	/** 本地保存的片段；持久化在 `+page.svelte`（全站唯一副作用处） */
	snippets = $state<SqlSnippet[]>([]);

	/** 片段自增 id（keyed each 的 key；导入 / 恢复时重新分配） */
	#snippetSeq = 0;

	setTab(tab: SqlTab): void {
		this.tab = tab;
	}

	loadExample(): void {
		this.sql = EXAMPLE_SQL;
		toast.show('已填入示例 SQL');
	}

	clearSql(): void {
		this.sql = '';
	}

	// ---------------------------------------------------------------- 自定义片段

	saveSnippet(): void {
		const sql = this.sql.trim();
		if (sql === '') {
			toast.show('编辑器还是空的，先写点 SQL 再保存', true);
			return;
		}
		if (this.snippets.length >= MAX_SNIPPETS) {
			toast.show(`最多保存 ${MAX_SNIPPETS} 条片段，先删掉几条旧的`, true);
			return;
		}
		const name = (this.snippetName.trim() || fallbackSnippetName(sql)).slice(0, MAX_SNIPPET_NAME);
		this.snippets = [...this.snippets, { id: ++this.#snippetSeq, name, sql }];
		this.snippetName = '';
		toast.show(`已保存片段「${name}」`);
	}

	deleteSnippet(id: number): void {
		this.snippets = this.snippets.filter((snippet) => snippet.id !== id);
		toast.show('已删除片段');
	}

	/**
	 * 应用片段会不会盖掉编辑器里已有的内容 —— UI 拿它决定要不要先问一句。
	 * 编辑器是空的、或内容与这条片段一致时不必问（问也是白问）。
	 */
	needsOverwriteConfirm(id: number): boolean {
		const snippet = this.snippets.find((item) => item.id === id);
		if (!snippet) return false;
		const current = this.sql.trim();
		return current !== '' && current !== snippet.sql.trim();
	}

	/** 把片段放回编辑器（覆盖确认由 UI 层用 `needsOverwriteConfirm` 先问） */
	applySnippet(id: number): void {
		const snippet = this.snippets.find((item) => item.id === id);
		if (!snippet) return;
		this.sql = snippet.sql;
		toast.show(`已应用片段「${snippet.name}」`);
	}

	/** 片段导出文本（JSON），供下载 */
	get snippetsText(): string {
		return serializeSnippets(this.snippets);
	}

	/** 导入片段文本：校验通过则合并进列表，失败用 toast 告知原因 */
	importSnippetsText(text: string): void {
		const parsed = parseSnippets(text);
		if (!parsed.ok) {
			toast.show(`导入失败：${parsed.error}`, true);
			return;
		}
		this.snippets = [...this.snippets, ...parsed.snippets.map((snippet) => ({ ...snippet, id: ++this.#snippetSeq }))];
		toast.show(`已导入 ${parsed.snippets.length} 条片段`);
	}

	/** 从 localStorage 恢复片段（`+page.svelte` 在挂载时调用）；id 重新分配 */
	restoreSnippets(entries: SnippetEntry[]): void {
		this.snippets = entries.map((entry) => ({ ...entry, id: ++this.#snippetSeq }));
	}
}

export const sqlStore = new SqlStore(SQL_COMMANDS, SQL_GROUPS, VAR_DEFS);
