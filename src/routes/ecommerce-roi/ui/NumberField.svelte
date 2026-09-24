<script lang="ts">
	// 数值字段：可见 label（带单位）+ 输入框 + 「清空本项」按钮 + 字段级红字。
	// 参数卡里二十个字段（整盘 12 + 单件 8）长得一模一样，逐个手写 label + Input 既啰嗦、也容易漏 label。
	//
	// 清空按钮在这里组合，不给 Input 加 adornment prop —— UI-STYLE §11.2 明确写过
	// 「前缀 / 后缀挂在输入框里」不是 Input 的职责。跟 regex 的「清空正则」同一套路：
	// **有内容才出现**，空字段上不摆一个点了没反应的按钮。
	//
	// 出现之后**默认透明、悬浮或聚焦才显形**：字段一多全摆一个 × 太吵，而且它跟输入框右边缘贴着，
	// 常显会让人以为那是输入框的一部分。键盘走 `group-focus-within`（Tab 进输入框就显形），
	// 触屏点一下输入框同样会聚焦、也就显形 —— 不必为触屏再开一条「常显」（那会让手机上
	// 十几个字段各挂一个 ×，很吵）。
	//
	// 清空 = 置空串：core/parse.ts 把空串按 0 处理（「没填这项」就是没有这笔成本），
	// 所以清掉一个字段等于把它按 0 重新参与计算，不会变成报错。
	//
	// `required` 只做**视觉与语义标记**，不在前端拦输入：这一页没有「提交」这个动作，
	// 每敲一个字符就算一次。标记的作用是提前说明「这一项空着会静默算出一个看起来合理的错数」。
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import type { ParsedField } from '../core/parse.ts';
	import { roiStore } from '../core/store.svelte.ts';
	import { NOTE_ERROR, NOTE_TEXT } from './styles.ts';

	let {
		id,
		field,
		label,
		value = $bindable(''),
		hint,
		required = false,
		labelExtra
	}: {
		/** 输入框 id，同时给 label 的 for 用 */
		id: string;
		/**
		 * 这一格在解析层里的键。用来认领 `roiStore.errorField` 指过来的那条错误。
		 *
		 * 本组件只服务这一页的参数卡，所以直接读 store、把 `field` 传进来就行 ——
		 * 不把 `invalid` / `error` 两个 prop 往二十个调用点上各写一遍
		 * （跟 `ui/PresetPanel.svelte` 的「只做业务绑定」同一个路数）。
		 */
		field: ParsedField;
		/** 可见标签文案，带单位（这些字段光看名字猜不出单位），也用作清空按钮的无障碍名称 */
		label: string;
		/** 双向绑定：bind:value */
		value?: string;
		/** 字段下方的补充说明，只有少数几个字段需要 */
		hint?: string;
		/** 必填标记：空着不会报错、只会算错，所以要提前说 */
		required?: boolean;
		/**
		 * 插在**字段名右端**的自定义内容：这一格的「填法交换」按钮
		 * （广告花费 / 订单数 / 商品成本三处，统一走 InputPanel 的 `fillModeSwap`）。
		 *
		 * 与分组标题行那个开关的分界：那个管一整组（退款那三个率），这里只管一格 ——
		 * 贴在字段名旁边才看得出管的是谁。宽度上只放得下一枚小按钮：
		 * 最窄的 lg 档字段只有 151px，字段名本身就占 77–99px。
		 */
		labelExtra?: Snippet;
	} = $props();

	const uid = $props.id();
	/** 说明与错误各一个 id：给输入框挂 `aria-describedby` 用（读屏 Tab 进来要把这句念出来） */
	const hintId = `${uid}-hint`;
	const errorId = `${uid}-error`;

	const hasValue = $derived(value !== '');
	/** 这一格就是解析层报错的那一格（一次只报一条，所以全页最多一格标红） */
	const invalid = $derived(roiStore.errorField === field);
	const errorText = $derived(invalid ? roiStore.error : '');
	/** 有错误时补充说明让位给错误 —— 两句一起念，会把「先修哪个」淹掉 */
	const describedBy = $derived(errorText !== '' ? errorId : hint !== undefined ? hintId : undefined);
</script>

<div class="flex flex-col gap-1">
	<!-- 标题行：左边字段名、右边只管这一格的小控件（填法交换）。
	     `flex-wrap` 不能省 —— 字段格在 lg / 2xl 两档只有约 150px，
	     名字加控件摆不下时换行，比硬挤成两行半好读。
	     relative 不能省：下面那个 sr-only 是 absolute，没有定位上下文时包含块是初始包含块，
	     会逃出所属滚动容器的 overflow 裁剪、把文档撑到内容之外（UI-STYLE §18）。
	     必填只靠颜色是通不过无障碍的，所以 * 之外还要给读屏一句「（必填）」。 -->
	<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
		<label class="relative text-xs font-medium text-gray-600" for={id}>
			{label}{#if required}<span class="text-red-700" aria-hidden="true"> *</span><span class="sr-only">（必填）</span
				>{/if}
		</label>
		{#if labelExtra}{@render labelExtra()}{/if}
	</div>
	<!-- relative 给绝对定位的清空按钮当定位上下文 -->
	<div class="group relative">
		<!-- pr-8 给按钮让位（Tailwind 里 pr 的规则排在 px 之后，能盖掉 Input 档位里的 px-3）；
		     不靠「有值才加内边距」，按钮出现 / 消失时输入框宽度与文字位置都不动 -->
		<Input {id} mono inputmode="decimal" {required} {invalid} aria-describedby={describedBy} bind:value class="pr-8" />
		{#if hasValue}
			<button
				type="button"
				class="absolute inset-y-0 right-1 my-auto flex size-6 items-center justify-center rounded-md text-gray-500 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
				aria-label={`清空${label}`}
				title={`清空${label}`}
				onclick={() => (value = '')}
			>
				<X class="size-3.5" aria-hidden="true" />
			</button>
		{/if}
	</div>
	{#if errorText !== ''}
		<p id={errorId} class={NOTE_ERROR}>{errorText}</p>
	{:else if hint}
		<p id={hintId} class={NOTE_TEXT}>{hint}</p>
	{/if}
</div>
