<script lang="ts">
	// 变量条：把占位符的值在这里填一次，下面所有命令跟着变。
	//
	// 主要的那个（如容器的 ID / 名称）常驻工具条；其余收进「更多变量」——
	// 十几个输入框全摊开，首屏就被输入区吃掉了，而速查表的第一眼价值是命令本身。
	//
	// 输入框留空时**命令回落到示例值**（见 $lib/utils/command-cheatsheet 的 resolveVars），
	// 所以 placeholder 显示的就是那个示例值：不填也能复制即用，填了才是自己的。
	import { SlidersHorizontal } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import { TOOLBAR, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import type { CheatsheetStore } from './cheatsheet.svelte.ts';
	import type { CheatsheetVarDef } from '$lib/utils/command-cheatsheet';

	type Props = {
		store: CheatsheetStore;
		/** 工具条右侧的一句提示（各工具的措辞不同） */
		hint: string;
		/** 无障碍名字的前缀，如「Docker」——拼成「Docker 变量」 */
		namePrefix: string;
	};

	let { store, hint, namePrefix }: Props = $props();

	const primaryVars = $derived(store.varDefs.filter((def) => !def.secondary));
	const secondaryVars = $derived(store.varDefs.filter((def) => def.secondary));
	const moreVarsId = $props.id();

	// 「更多变量」折叠：展开时是网格，收起时用 hidden 类**留在 DOM 里** ——
	// 一是 aria-controls 指向的元素始终存在，二是变量名也跟着 SSR 出去。
	//
	// 列数用**自适应网格**，不再写死 `sm:grid-cols-2 lg:grid-cols-3`：写死 3 列时
	// 9~10 个次要变量要占 3 行、还把右半边空着。
	// 每列下限取 **9rem 而不是 12rem**：docker 把变量条放进了 22rem 的左栏（见该工具 README），
	// 12rem 时那一栏只排得下 1 列、9 个变量拖成 9 行；9rem 才排得下 2 列。
	// 整页宽的工具（git / linux）则吃到 7 列、9~10 个变量只占 2 行。
	// 类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效。
	const moreVarsClass = $derived(
		store.showMoreVars
			? 'grid shrink-0 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm'
			: 'hidden'
	);

	/**
	 * 输入框宽度：次要变量在自适应网格里用 `w-full` 吃满单元格；主要变量在工具条里是横排的
	 * flex 子项，仍固定 `md:w-60` —— 给它 `w-full` 会把「更多变量 / 重置」按钮挤走。
	 */
	function fieldClass(def: CheatsheetVarDef): string {
		return def.secondary ? 'w-full' : 'w-full md:w-60';
	}
</script>

{#snippet varField(def: CheatsheetVarDef)}
	<div class={TOOLBAR_GROUP}>
		<label class={TOOLBAR_LABEL} for="{moreVarsId}-{def.key}" title={def.hint}>{def.label}</label>
		<Input
			id="{moreVarsId}-{def.key}"
			size="sm"
			mono
			placeholder={def.sample}
			value={store.vars[def.key]}
			oninput={(event) => store.setVar(def.key, event.currentTarget.value)}
			class={fieldClass(def)}
		/>
	</div>
{/snippet}

<div class={TOOLBAR}>
	{#each primaryVars as def (def.key)}
		{@render varField(def)}
	{/each}

	{#if secondaryVars.length > 0}
		<div class="flex shrink-0 items-center gap-2">
			<Button
				size="sm"
				label={store.showMoreVars ? '收起更多变量' : `展开更多变量（${secondaryVars.length} 个）`}
				aria-expanded={store.showMoreVars}
				aria-controls={moreVarsId}
				onclick={() => store.toggleMoreVars()}
			>
				<SlidersHorizontal class="size-3.5" aria-hidden="true" />
				更多变量（{secondaryVars.length}）
			</Button>
			<Button size="sm" label="重置全部变量" title="清空输入，命令回落到示例值" onclick={() => store.resetVars()}>
				重置
			</Button>
		</div>
	{/if}

	<span class="{TOOLBAR_LABEL} md:ml-auto">{hint}</span>
</div>

{#if secondaryVars.length > 0}
	<div id={moreVarsId} class={moreVarsClass} role="group" aria-label="{namePrefix}更多变量">
		{#each secondaryVars as def (def.key)}
			{@render varField(def)}
		{/each}
	</div>
{/if}
