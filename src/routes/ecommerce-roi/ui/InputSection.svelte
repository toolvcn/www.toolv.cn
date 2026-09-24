<script lang="ts">
	// 参数卡里的一个分组：标题行（标题 + 右侧的口径开关）+ 字段网格。
	//
	// 手机上这一页要一路滚过十几个字段，所以每组给一个「收起 / 展开」；
	// 收起走 `max-lg:hidden` 而不是 `{#if}`：字段始终在 DOM 里，
	// 首屏 HTML 与表单语义都不能因为折叠而少一半。
	// lg 起三栏布局里每组本来就不长，按钮 `lg:hidden`（由 CollapseToggle 自带），桌面看不到它。
	// 高度 h-7 也在那一枚里：它跟标题行右侧的口径开关同排，同一行不混高度（UI-STYLE §9）。
	import type { Snippet } from 'svelte';
	import CollapseToggle from './CollapseToggle.svelte';
	import { SECTION_HEAD, SECTION_TITLE } from './styles.ts';

	let {
		title,
		actions,
		children
	}: {
		/** 分组名（成交与广告 / 成本项 / 退货 / 商品 / 平台） */
		title: string;
		/** 标题行右侧的口径开关 —— 放这里而不是字段格里，理由见 styles.ts 的 SECTION_HEAD */
		actions?: Snippet;
		/** 分组正文：字段网格（+ 组脚注） */
		children?: Snippet;
	} = $props();

	const uid = $props.id();
	const bodyId = `${uid}-body`;

	let expanded = $state(true);

	// 条件类名一律在脚本里拼：写在 class 属性里的三元会被 prettier 折行拆断而静默失效（AGENTS §6）
	const bodyClass = $derived(`flex flex-col gap-2${expanded ? '' : ' max-lg:hidden'}`);
</script>

<section class="flex flex-col gap-2">
	<div class={SECTION_HEAD}>
		<h3 class={SECTION_TITLE}>{title}</h3>
		<div class="flex items-center gap-2">
			{#if actions}
				{@render actions()}
			{/if}
			<CollapseToggle bind:expanded controls={bodyId} />
		</div>
	</div>
	<div id={bodyId} class={bodyClass}>
		{#if children}
			{@render children()}
		{/if}
	</div>
</section>
