<script lang="ts">
	// CSV ↔ JSON 主界面：标签条切方向，工具条放分隔符、解析选项与操作，
	// 下方输入、输出双栏，转换结果随输入与选项实时刷新。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';
	import { Braces, Copy, Download, Eraser, Lightbulb, Table } from '@lucide/svelte';
	import { csvJsonStore } from '../core/store.svelte.ts';
	import { DELIMITER_OPTIONS } from '../core/types.ts';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import EditorPane from '$lib/components/EditorPane/EditorPane.svelte';
	import Tabs from '$lib/components/Tabs/Tabs.svelte';
	import {
		FOOTER_BAR,
		EDITOR_INPUT,
		EDITOR_OUTPUT,
		TOOLBAR,
		TOOLBAR_GROUP,
		TOOLBAR_LABEL,
		TOOLBAR_ACTIONS
	} from '$lib/ui/styles';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	// 方向切换的互斥按钮组：不用 role=tab（它要求额外的箭头键导航，收益不大）
	const DIRECTIONS = [
		{ value: 'csv-to-json', label: 'CSV → JSON', icon: Table },
		{ value: 'json-to-csv', label: 'JSON → CSV', icon: Braces }
	] as const;

	const isCsvToJson = $derived(csvJsonStore.direction === 'csv-to-json');

	// 派生视图先在脚本里算好：class 属性里不写裸三元（prettier 拆行后条件会静默失效）
	const isEmpty = $derived(csvJsonStore.isEmpty);
	const hasError = $derived(csvJsonStore.hasError);
	const output = $derived(csvJsonStore.output);
	const copyDisabled = $derived(isEmpty || hasError);
	const downloadDisabled = $derived(isEmpty || hasError || output === '');

	// 输入输出区的标题随方向切换
	const inputHeading = $derived(isCsvToJson ? 'CSV 输入' : 'JSON 输入');
	const outputHeading = $derived(isCsvToJson ? 'JSON 数组' : 'CSV 文本');

	// 占位文案含换行与花括号，写成 JS 字符串再传（模板里 {} 会被当表达式）
	const csvPlaceholder = 'name,role\n无情,admin\nalice,dev';
	const jsonPlaceholder = '[{ "id": 1, "name": "无情" }]';

	// 底部状态栏：错误优先展示，其次统计，空态给引导文案
	const statusText = $derived.by(() => {
		if (isEmpty) {
			return isCsvToJson ? '粘贴一段 CSV，JSON 会实时出现在这里' : '粘贴一个 JSON 数组，CSV 会实时出现在这里';
		}
		const result = csvJsonStore.result;
		if (!result.ok) return result.error;
		if (isCsvToJson) {
			const shape = csvJsonStore.headerRow ? '对象数组' : '二维数组';
			return `${result.rows} 行 · ${result.columns} 列 · ${shape}`;
		}
		return `${result.rows} 行数据 · ${result.columns} 列${csvJsonStore.writeHeader ? ' · 含表头' : ''}`;
	});
	const statusTone = $derived(hasError ? 'error' : isEmpty ? 'neutral' : 'ok');

	// 输出空态：非空但有错时是语法错误，跟「还没输入」区分开
	const outputEmptyText = $derived(
		isEmpty
			? isCsvToJson
				? '在左侧粘贴 CSV，转换结果会实时出现在这里'
				: '在左侧粘贴 JSON 数组，转换结果会实时出现在这里'
			: '输入有误，修正后转换结果会实时出现在这里'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 标签条：方向切换，独立一行放在工具条之上 -->
	<Tabs
		aria-label="转换方向"
		options={DIRECTIONS}
		value={csvJsonStore.direction}
		onchange={(v) => csvJsonStore.setDirection(v)}
	/>

	<!-- 工具条：分隔符与解析选项在左，操作 md:ml-auto 靠右。
	     三个选项常驻渲染、按方向禁用，切方向不会引起高度跳变（UI-STYLE §8.2） -->
	<div id="csv-json-toolbar" role="group" aria-label="CSV 与 JSON 互转操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>分隔符</span>
			<Dropdown
				label="分隔符"
				size="sm"
				options={DELIMITER_OPTIONS}
				value={csvJsonStore.delimiter}
				onSelect={(value) => csvJsonStore.setDelimiter(value)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>解析选项</span>
			<div class="flex h-8 flex-wrap items-center gap-3">
				<Checkbox
					bind:checked={csvJsonStore.headerRow}
					disabled={!isCsvToJson}
					title={isCsvToJson ? '首行当键名，其余行变对象；关闭则输出二维数组' : '只在 CSV → JSON 方向生效'}
				>
					首行为表头
				</Checkbox>
				<Checkbox
					bind:checked={csvJsonStore.inferTypes}
					disabled={!isCsvToJson}
					title={isCsvToJson
						? '数字、true / false、null 自动转对应类型；关闭则全部按字符串'
						: '只在 CSV → JSON 方向生效'}
				>
					推断类型
				</Checkbox>
				<Checkbox
					bind:checked={csvJsonStore.writeHeader}
					disabled={isCsvToJson}
					title={isCsvToJson ? '只在 JSON → CSV 方向生效' : '把所有键名写成首行；二维数组没有表头概念，本项不生效'}
				>
					写入表头
				</Checkbox>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="填入示例数据" title="示例" onclick={() => csvJsonStore.loadExample()}>
				<Lightbulb class="size-4 shrink-0" aria-hidden="true" />示例
			</Button>
			<Button label="清空输入" title="清空" onclick={() => csvJsonStore.clearInput()}>
				<Eraser class="size-4 shrink-0" aria-hidden="true" />清空
			</Button>
			<Button
				label="下载转换结果"
				title="下载"
				disabled={downloadDisabled}
				onclick={() => csvJsonStore.downloadOutput()}
			>
				<Download class="size-4 shrink-0" aria-hidden="true" />下载
			</Button>
			<Button
				variant="primary"
				label="复制转换结果"
				title="复制输出"
				disabled={copyDisabled}
				onclick={() => void csvJsonStore.copyOutput()}
			>
				<Copy class="size-4 shrink-0" aria-hidden="true" />复制输出
			</Button>
		</div>
	</div>

	<!-- 输入 / 输出双栏：移动端上下堆叠，md 起并排占满剩余高度 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- 输入区 -->
		<EditorPane
			fullscreen
			id="csv-json-input"
			headingId="csv-json-input-heading"
			heading={inputHeading}
			headingExtra="粘贴即转换"
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			{#if isCsvToJson}
				<Textarea
					id="csv-json-csv-input"
					mono
					label="CSV 输入"
					bind:value={csvJsonStore.csvInput}
					placeholder={csvPlaceholder}
					class={EDITOR_INPUT}
				/>
			{:else}
				<Textarea
					id="csv-json-json-input"
					mono
					label="JSON 输入"
					bind:value={csvJsonStore.jsonInput}
					placeholder={jsonPlaceholder}
					class={EDITOR_INPUT}
				/>
			{/if}
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<p class="truncate text-xs text-gray-600">方向之上，分隔符与解析选项在顶部工具条</p>
				</div>
			{/snippet}
		</EditorPane>

		<!-- 输出区：空态与结果二选一由 EditorPane 管（错误详情走脚注的 StatusPill） -->
		<EditorPane
			fullscreen
			id="csv-json-output"
			headingId="csv-json-output-heading"
			heading={outputHeading}
			headingExtra={isCsvToJson ? 'JSON 数组' : 'CSV 文本'}
			class="relative min-w-0 flex-1 md:min-h-0"
			empty={outputEmptyText}
			ready={!isEmpty && !hasError}
		>
			<Textarea
				id="csv-json-output-area"
				mono
				label={outputHeading}
				size="sm"
				readonly
				value={output}
				class={EDITOR_OUTPUT}
			/>
			{#snippet footer()}
				<!-- 固定高度脚注：错误与统计都在这里，不会把卡片撑高 -->
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone}>{statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>

<Toast />
