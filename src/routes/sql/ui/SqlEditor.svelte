<script lang="ts">
	// SQL 编辑器：透明 textarea 叠在镜像高亮层上，边打字边着色（与 regex 的测试文本同一套做法）。
	// 两层共用 styles.ts 里的 EDITOR_TYPE（字体 / 行高 / 内边距 / 断行 / 滚动条占位），
	// 任一项不一致高亮就会整片飘走；滚动只由 textarea 负责，镜像层跟着挪 scrollTop。
	//
	// 高亮渲染交给**共享的** $lib/components/CodeView（它只管铺 token，排版从镜像层继承）——
	// 「渲染层共享、分词留在工具内」是 SQL 页定下的分法（见 UI-STYLE §14）。
	import { Copy, Eraser, Lightbulb, Save } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import CodeView from '$lib/components/CodeView/CodeView.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import PanelCard from '$lib/components/Panel/Panel.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';
	import { toast } from '$lib/ui/toast.svelte';
	import { MAX_HIGHLIGHT_CHARS, MAX_SNIPPETS } from '../config.ts';
	import { tokenizeSql } from '../core/highlight.ts';
	import { sqlStore } from '../core/store.svelte.ts';
	import { EDITOR_INPUT, EDITOR_MIRROR, SQL_TOKEN_CLASS } from './styles.ts';

	let mirror = $state<HTMLDivElement | null>(null);

	// 镜像层末尾补一个换行：文本以换行结尾时 textarea 会多出一行，不补高亮会错位
	const TRAILING_NEWLINE = '\n';

	const sql = $derived(sqlStore.sql);
	const isEmpty = $derived(sql.trim() === '');
	const overLimit = $derived(sql.length > MAX_HIGHLIGHT_CHARS);
	// 超过上限时分词器整段降级成 plain，镜像层照常渲染（只是没颜色）
	const tokens = $derived(tokenizeSql(sql));
	const lineCount = $derived(isEmpty ? 0 : sql.split('\n').length);

	const statusText = $derived(
		isEmpty
			? '在上面写或粘贴 SQL：本页只在本地高亮与暂存，不连数据库、不执行语句'
			: overLimit
				? `${lineCount} 行 · ${sql.length} 字符 · 已超过高亮上限（${MAX_HIGHLIGHT_CHARS} 字符），这段按纯文本显示`
				: `${lineCount} 行 · ${sql.length} 字符 · 高亮只做词法上色，不校验语法`
	);
	const statusTone = $derived(isEmpty ? 'neutral' : overLimit ? 'warn' : 'ok');

	function syncScroll(event: Event & { currentTarget: HTMLTextAreaElement }): void {
		if (mirror) mirror.scrollTop = event.currentTarget.scrollTop;
	}

	async function copySql(): Promise<void> {
		try {
			await navigator.clipboard.writeText(sqlStore.sql);
			toast.show('已复制编辑器里的 SQL');
		} catch {
			toast.show('复制失败，请手动选中复制', true);
		}
	}
</script>

<PanelCard id="sql-editor" headingId="sql-editor-heading" heading="SQL 编辑器" class="min-w-0">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>片段上限 {MAX_SNIPPETS} 条</span>
	{/snippet}
	{#snippet actions()}
		<Button label="填入示例 SQL" title="示例" size="xs" onclick={() => sqlStore.loadExample()}>
			<Lightbulb class="size-3.5" aria-hidden="true" />示例
		</Button>
		<Button label="复制编辑器里的 SQL" title="复制" size="xs" disabled={isEmpty} onclick={copySql}>
			<Copy class="size-3.5" aria-hidden="true" />复制
		</Button>
		<Button label="清空编辑器" title="清空" size="xs" disabled={isEmpty} onclick={() => sqlStore.clearSql()}>
			<Eraser class="size-3.5" aria-hidden="true" />清空
		</Button>
		<Button
			label="把编辑器内容保存为片段"
			title="保存片段（名称取「我的片段」里填的那个，没填就用 SQL 首行）"
			size="xs"
			variant="primary"
			disabled={isEmpty}
			onclick={() => sqlStore.saveSnippet()}
		>
			<Save class="size-3.5" aria-hidden="true" />保存片段
		</Button>
	{/snippet}

	<!-- relative 给 sr-only 的 label 用；编辑区移动端定高，桌面交回卡片剩下的高度。
	     镜像层只跟着 textarea 的滚动走（它自己 overflow-hidden），两层因此不会各滚各的。 -->
	<div class="relative flex min-h-0 flex-1 flex-col p-4">
		<label for="sql-editor-input" class="sr-only">SQL 编辑器</label>
		<EditorBox class="h-56 lg:h-auto lg:min-h-32 lg:flex-1">
			<div bind:this={mirror} class={EDITOR_MIRROR} aria-hidden="true">
				<CodeView {tokens} classMap={SQL_TOKEN_CLASS} />
				{TRAILING_NEWLINE}
			</div>
			<!-- 这个 textarea **刻意不用 <Textarea>**：它的文字是透明的（看到的字来自上面的镜像层），
			     必须与 EDITOR_MIRROR 逐字共用 EDITOR_TYPE 才能保证两层断行位置一致。
			     组件那套底色 / 字色 / 焦点环在这里全不适用。 -->
			<textarea
				id="sql-editor-input"
				bind:value={sqlStore.sql}
				spellcheck="false"
				autocomplete="off"
				placeholder="SELECT id, name FROM users WHERE status = 'active' LIMIT 10;"
				onscroll={syncScroll}
				class={EDITOR_INPUT}></textarea>
		</EditorBox>
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<StatusPill tone={statusTone} truncate>{statusText}</StatusPill>
		</div>
	{/snippet}
</PanelCard>
