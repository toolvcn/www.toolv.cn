<script lang="ts">
	// htaccess ↔ Nginx 的主界面：顶部工具条（方向 / 缩进 / 示例 / 互换 / 清空 / 复制），下方输入、输出与参数速查表。
	// 「不支持的指令」不另开一个面板：它就地在输出里落成 `# ⚠️` 注释，
	// 输出与源文件逐条对应才好逐行核对（状态栏只报数量）。
	import { ArrowDownUp, Copy, Eraser, Lightbulb } from '@lucide/svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import {
		EDITOR_INPUT,
		FOOTER_BAR,
		OUTPUT_PRE,
		TOOLBAR,
		TOOLBAR_ACTIONS,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL
	} from '$lib/ui/styles';
	import { htaccessStore } from '../core/store.svelte.ts';
	import type { Direction, IndentStyle } from '../core/types.ts';
	import Cheatsheet from './Cheatsheet.svelte';

	/**
	 * 方向标签两个都写全（不靠悬浮补全）：这一页只有这一个主开关，
	 * 「→ 谁」写全了，两侧卡片的标题、示例与提示才说得通。
	 */
	const DIRECTIONS: ReadonlyArray<{ value: Direction; label: string; title: string }> = [
		{ value: 'toNginx', label: 'htaccess → nginx', title: '.htaccess 转 nginx 配置' },
		{ value: 'toHtaccess', label: 'nginx → htaccess', title: 'nginx 配置转 .htaccess' }
	];

	/** 缩进档：值就是 IndentStyle，label 给人看 */
	const INDENTS: Array<{ value: string; label: string; description: string }> = [
		{ value: '4spaces', label: '4 个空格', description: '推荐，也是 nginx 官方示例的写法' },
		{ value: '2spaces', label: '2 个空格', description: '更紧凑，适合本来就用两格的配置库' },
		{ value: 'tab', label: 'Tab', description: '制表符缩进' }
	];

	// ---- 派生类：条件类名与文案一律在脚本里拼好（写在 class 里的三元会被 prettier 拆断） ----
	const isToNginx = $derived(htaccessStore.direction === 'toNginx');
	const inputHeading = $derived(isToNginx ? '.htaccess' : 'nginx 配置');
	const outputHeading = $derived(isToNginx ? 'nginx 配置' : '.htaccess');
	const inputAreaLabel = $derived(isToNginx ? '.htaccess 内容' : 'nginx 配置内容');
	const inputPlaceholder = $derived(
		isToNginx
			? '粘贴 .htaccess 内容，例如 RewriteEngine On / RewriteRule …'
			: '粘贴 nginx 配置，例如 rewrite ^/old/(.*)$ /new/$1 permanent; / add_header …'
	);
	const outputEmptyText = $derived(
		isToNginx ? '在左侧粘贴 .htaccess，nginx 配置会实时出现在这里' : '在左侧粘贴 nginx 配置，.htaccess 会实时出现在这里'
	);
	const outputRegionLabel = $derived(isToNginx ? '转换出的 nginx 配置' : '转换出的 .htaccess 配置');
	const footerHint = $derived(
		isToNginx
			? '粘贴即转换；输出的缩进档在顶部工具条'
			: '粘贴即转换；nginx 的 location / map / try_files 这类写法只能就地点名，请看输出里的 ⚠️'
	);
	const outputCount = $derived(htaccessStore.output.split('\n').length - 1);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 顶部工具条：方向与缩进在左，操作 md:ml-auto 靠右 -->
	<div id="htaccess-toolbar" role="group" aria-label="htaccess 与 nginx 互转操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>方向</span>
			<SegmentedControl
				options={DIRECTIONS}
				value={htaccessStore.direction}
				onchange={(value) => (htaccessStore.direction = value)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>输出缩进</span>
			<Dropdown
				label="输出缩进"
				size="sm"
				options={INDENTS}
				value={htaccessStore.indent}
				onSelect={(value) => (htaccessStore.indent = value as IndentStyle)}
			/>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例配置" title="示例" onclick={() => htaccessStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button
				label="把输出搬到输入框并切换方向"
				title="把当前输出搬进输入框并切换方向，来回验证不用手动复制"
				onclick={() => htaccessStore.swapDirection()}
			>
				<ArrowDownUp class="size-4 shrink-0" aria-hidden="true" />互换
			</Button>
			<Button label="清空输入框" title="清空" onclick={() => htaccessStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button
				variant="primary"
				label="复制生成的配置"
				title="复制输出"
				disabled={htaccessStore.isEmpty}
				onclick={() => void htaccessStore.copyOutput()}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出 / 速查表：窄屏三块上下堆叠（速查表在下方定高带子里），md 起输入输出并排，xl 起速查表转到右侧第三栏。
	     速查表不参与平分高度 —— 三块都 flex-1 会把编辑框压到不可用（见 ui/Cheatsheet.svelte 的注释） -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
		<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
		<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
			<EditorPane
				fullscreen
				id="htaccess-input"
				headingId="htaccess-input-heading"
				heading={inputHeading}
				headingExtra={`${htaccessStore.input.length} 字符`}
				class="relative min-w-0 flex-1 md:min-h-0"
			>
				<Textarea
					id="htaccess-input-area"
					mono
					label={inputAreaLabel}
					bind:value={htaccessStore.input}
					placeholder={inputPlaceholder}
					class={EDITOR_INPUT}
				/>
				{#snippet footer()}
					<div class={FOOTER_BAR}>
						<p class="truncate text-xs text-gray-600">{footerHint}</p>
					</div>
				{/snippet}
			</EditorPane>

			<!-- 空态与结果二选一由 EditorPane 管（提示明细在输出的 ⚠️ 注释里） -->
			<EditorPane
				fullscreen
				id="htaccess-output"
				headingId="htaccess-output-heading"
				heading={outputHeading}
				headingExtra={htaccessStore.isEmpty ? '待转换' : `${outputCount} 行`}
				class="relative min-w-0 flex-1 md:min-h-0"
				empty={outputEmptyText}
				ready={!htaccessStore.isEmpty}
			>
				<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable） -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre
					id="htaccess-output-area"
					class={OUTPUT_PRE}
					tabindex="0"
					role="region"
					aria-label={outputRegionLabel}>{htaccessStore.output}</pre>
				{#snippet footer()}
					<div class={FOOTER_BAR}>
						<StatusPill tone={htaccessStore.statusTone} truncate>{htaccessStore.statusText}</StatusPill>
					</div>
				{/snippet}
			</EditorPane>
		</div>

		<Cheatsheet />
	</div>
</div>

<Toast />
