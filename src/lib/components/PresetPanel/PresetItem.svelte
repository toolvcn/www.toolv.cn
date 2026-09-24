<script lang="ts" generics="T extends { id: number; name: string }">
	// 预设列表里的一条。从 PresetPanel 里抽出来，理由是两件事的性质不同：
	// 面板（头部 / 名称输入 / 列表 / 导入导出）是工具无关的壳，
	// 而「一条预设长什么样、摘要给哪几个数」各工具想改的地方多得多。
	//
	// 抽出来之后还有第二个好处：调用方可以用 `PresetPanel` 的 `item` snippet 把它整个换掉，
	// 不必再往面板里加 prop。这里给的是**默认版式**，够用就不必自定义。
	//
	// 版式是两行：
	//   第一行 名称（占满）+ 口径徽章，右端悬浮出「复制名称」
	//   第二行 摘要（可折行），右下角悬浮出「删除」
	// 悬浮条目还会在右侧摊开参数卡（`detailGroups`）：按组排成**一字段一行、左名右值**，
	// 不是一整段话 —— 扫一眼找「成本率是多少」比在一行里数分隔点快得多。
	//
	// **两个图标按钮都是条目那条 `<button>` 的兄弟节点**：HTML 不允许 button 嵌 button，
	// 而整条可点 = 应用预设。所以它们靠绝对定位落进条目内，`group` 也因此挂在 `<li>` 上。
	import { Copy, GripVertical, Trash } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { copyToClipboard } from '$lib/ui/copy';
	import { HOVER_CARD, PRESET_BADGE, PRESET_NAME, PRESET_ROW } from '$lib/ui/styles';

	interface Props {
		preset: T;
		/** 右上角的小徽章（http 放请求方法，电商 ROI 放口径） */
		badgeText: (preset: T) => string;
		/** 名称下面那行摘要 */
		summaryText: (preset: T) => string;
		/**
		 * 悬浮时摊开的参数卡：一组一块、块内一字段一行（左名右值，多行）。
		 *
		 * 结构不在这里定义 —— 调用方按这个形状给就行（同 `SegmentedControl` 的 `options`：
		 * 组件只声明结构，类型留在各自的 core 里）。空组、空数组都不出卡。
		 */
		detailGroups?: (preset: T) => readonly PresetDetailGroup[];
		onapply: (id: number) => void;
		ondelete: (id: number) => void;
		/**
		 * 拖动排序：把 `dragId` 那条移到 `targetId` 那条**所在的位置**（目标整体让一格）。
		 * **给了才出手柄** —— http 没传，那边就没有这一列。
		 */
		onreorder?: (dragId: number, targetId: number) => void;
		/**
		 * 手柄聚焦后按 ↑ / ↓ 移动一条：**拖动的键盘等价操作**。
		 * 只给拖动不补这一条，键盘用户就完全排不动（WCAG 2.2 的「拖动替代」）。
		 */
		onmove?: (id: number, delta: number) => void;
	}

	/** 参数卡里的一组：组名 + 组内字段（`fields` 为空时这一组整组不画） */
	interface PresetDetailGroup {
		name: string;
		fields: readonly { label: string; value: string }[];
	}

	let { preset, badgeText, summaryText, detailGroups, onapply, ondelete, onreorder, onmove }: Props = $props();

	/** 这一条正在被拖：给它加蓝环，拖的时候看得出「手上拿的是哪条」 */
	let dragging = $state(false);

	/** 条目内容那一列的基础类名：名称行 + 摘要行竖排 */
	const CONTENT_COLUMN = 'flex min-w-0 flex-1 flex-col gap-1';

	/** 行的类名（条件类名一律在脚本里拼 —— 写在 class 属性里的三元会被 prettier 拆断而静默失效） */
	const rowClass = $derived(dragging ? `${PRESET_ROW} ring-2 ring-blue-500` : PRESET_ROW);

	/**
	 * 内容那一列的类名。**左侧内边距只给有手柄的工具**：手柄 24px、贴边 4px，
	 * 条目自己是 `p-2`，所以让 24px 正好把文字推到手柄右边还留 4px 间隙。
	 * 缩进加在**这一列**而不是行上 —— 行的 `PRESET_ROW` 自带 `p-2`，
	 * 在它后面再补一个 `pl-*` 得靠 Tailwind 的排序压过去，不如干脆不跟它撞。
	 */
	const contentClass = $derived(onreorder === undefined ? CONTENT_COLUMN : `${CONTENT_COLUMN} pl-6`);

	/**
	 * 悬浮参数卡的宽度，跟下面那个 `w-64`（16rem）必须一致 —— 定位要拿它算右边界。
	 * 16rem 而不是更宽：一行里就是「字段名 + 一个短值」，最长的一组
	 * 「其中在途退款金额 1,048.50 元」还不到 200px，再宽出来的都是空白。
	 */
	const CARD_WIDTH = 256;
	/** 卡高只用于「贴到视口底部时往上收」，估一个够用的值即可，不必量 —— 按最满的一条估（十几个字段 + 三组标题） */
	const CARD_HEIGHT = 340;

	/**
	 * 悬浮参数卡用**固定定位**，不用 absolute：列表是个 `overflow-y-auto` 的滚动容器，
	 * 绝对定位的卡探出容器就被裁掉，参数一多就看不全。固定定位只跟视口算，代价是自己算坐标
	 * （跟说明栏里那个公式气泡同一套路）。
	 */
	let card = $state<{ groups: readonly PresetDetailGroup[]; top: number; left: number } | null>(null);

	function showCard(el: HTMLElement): void {
		// 一个字段都没填的组不画（空组标题摆在那儿只是占地方）
		const groups = (detailGroups?.(preset) ?? []).filter((group) => group.fields.length > 0);
		if (groups.length === 0) return;
		const r = el.getBoundingClientRect();
		// 默认贴在条目右侧；右边放不下就翻到左侧；两侧都放不下（窄屏）就贴视口左边、盖住条目
		const right = r.right + 8;
		const left = right + CARD_WIDTH <= window.innerWidth - 8 ? right : Math.max(8, r.left - CARD_WIDTH - 8);
		card = { groups, top: Math.max(8, Math.min(r.top, window.innerHeight - CARD_HEIGHT)), left };
	}

	/**
	 * 复制预设名称。
	 * 名称那串字没法直接选中 —— 整条是 `<button>`（点哪都是应用预设），鼠标拖不出选择。
	 * 而名字常常要贴到别处（群里、备注、文件命名），所以给一个显式的复制入口。
	 */
	async function copyName(): Promise<void> {
		await copyToClipboard(preset.name, { ok: `已复制「${preset.name}」`, fail: '复制失败，请手动选中复制' });
	}

	// ---------------------------------------------------------------- 拖动排序

	/**
	 * 排序走**指针事件**，不用 HTML5 拖放（`draggable` + `dataTransfer`）：
	 * 后者在触屏上一次都不触发，而这一栏在手机上同样要能排。
	 * 按住手柄后把指针捕获到手柄上 —— 手指 / 鼠标滑出那个 24px 的图标也照样收得到 move，
	 * 不必全程按在图标上（拖动结束由浏览器在 pointerup / pointercancel 时自动释放捕获）。
	 */
	function startDrag(event: PointerEvent): void {
		if (onreorder === undefined || !event.isPrimary || event.button !== 0) return;
		// 不拦默认行为的话，按住横拖会变成选中条目里的字
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragging = true;
	}

	/**
	 * 指针底下是哪条就排到哪条的位置。**跳过自己**：排完之后指针底下正是这一条，
	 * 后续 move 拿回来的还是自己的 id，所以不会在两条之间来回抖。
	 * `elementFromPoint` 取的是「这一点的**最上层**元素」，命中条目里的按钮 / 文字都一样，
	 * 统一用 `closest` 往上找那条 `<li>`；悬浮参数卡是 `pointer-events-none`，不会被它挡住。
	 */
	function onDragMove(event: PointerEvent): void {
		if (!dragging) return;
		const raw = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest('li[data-preset-id]')
			?.getAttribute('data-preset-id');
		if (raw === null || raw === undefined) return;
		const targetId = Number(raw);
		if (!Number.isFinite(targetId) || targetId === preset.id) return;
		onreorder?.(preset.id, targetId);
	}

	/** 抬手即结束：指针捕获由浏览器释放，这里只收状态 */
	function endDrag(): void {
		dragging = false;
	}

	/** ↑ / ↓ 移动一条：拖动的键盘等价操作（也是触屏之外唯一不需要指针的出路） */
	function onHandleKeydown(event: KeyboardEvent): void {
		let delta = 0;
		if (event.key === 'ArrowUp') delta = -1;
		else if (event.key === 'ArrowDown') delta = 1;
		if (delta === 0 || onmove === undefined) return;
		// 拦掉默认的滚动，否则排在列表中间时会顺带把面板滚走
		event.preventDefault();
		onmove(preset.id, delta);
	}

	// 整条的可交互区由里面那条 button 承担；这里只借 hover / 焦点来展开参数卡
	// （真正的交互元素是子节点，li 只是监听它的冒泡，所以不需要自己可聚焦）
</script>

<!-- 滚动或改视口尺寸时收起卡片：它是固定定位的，坐标是**算出来的**，
     条目一滚走那组坐标就失效了 —— 不收起会留一张卡悬在原地。
     `capture` 必须加：滚动发生在列表那个 overflow 容器上，scroll 事件不冒泡到 window -->
<svelte:window onscrollcapture={() => (card = null)} onresize={() => (card = null)} />

<!-- `data-preset-id` 是拖动时的命中标记：指针底下是哪条，靠它认（见 `onDragMove`） -->
<li
	class="group relative"
	data-preset-id={preset.id}
	onmouseenter={(e) => showCard(e.currentTarget)}
	onmouseleave={() => (card = null)}
	onfocusin={(e) => showCard(e.currentTarget)}
	onfocusout={() => (card = null)}
>
	<!-- 拖动排序的手柄。跟复制 / 删除同源：整条是「应用预设」的按钮，
	     button 不能嵌 button，所以它也只能是兄弟节点、靠绝对定位落进条目里。
	     摆在**左侧**而不是跟着那两个挤在右侧：它管的不是某一段文字，而是整条的位置。

	     **显形范围只有它自己这一块（`hover:` 而不是 `group-hover:`）**：
	     排序不是每条都要做的事，悬浮整条就冒出来会跟复制 / 删除一起抢位置，
	     而这一块是 `opacity-0` 但**照样接得住指针事件**（透明不等于不命中），
	     所以鼠标移到这 24px 上就会显形、再按住就能拖。
	     `touch-none` 不能省 —— 触屏上不关掉手势，按住手柄一拖变成滚面板；
	     触屏没有 hover，走 `[@media(hover:none)]` 常显。 -->
	{#if onreorder !== undefined}
		<Button
			icon
			label={`拖动排序「${preset.name}」，或用 ↑ ↓ 键移动`}
			title="拖动排序"
			class="absolute top-1 left-1 cursor-grab touch-none opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
			onpointerdown={startDrag}
			onpointermove={onDragMove}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onkeydown={onHandleKeydown}
		>
			<GripVertical class="size-3.5" />
		</Button>
	{/if}
	<button type="button" class={rowClass} title={`应用预设「${preset.name}」`} onclick={() => onapply(preset.id)}>
		<span class={contentClass}>
			<!-- 名称占满、徽章靠右固定：徽章跟着名称走之后，长了也不会把摘要挤没。
			     `pr-7` 给右上角那个复制按钮让位，不然徽章会被它压住 ——
			     28px = 按钮 24px（贴边 4px）+ 与徽章之间留 8px 的间距。
			     原先 pr-6（24px）算出来的间隙只有 2px，按钮像是压在徽章上 -->
			<span class="flex min-w-0 items-center gap-2 pr-7">
				<span class={`${PRESET_NAME} flex-1`}>{preset.name}</span>
				<span class={PRESET_BADGE}>{badgeText(preset)}</span>
			</span>
			<!-- 摘要允许折行：用 break-words 而不是 truncate —— 这一栏窄，几段参数拼起来
			     必然超一行，截断等于只剩第一段；用 break-words 而不是 break-all，像「12,000.00」
			     这种数字会整体换行，不会从中间裂开。
			     `pr-8` = 32px，给右下角那个 24px 的删除按钮 + 6px 边距让位，
			     留出约 10px 的间距 —— 只让 24px 的话末行最后一个字会贴在按钮边上 -->
			<span class="pr-8 font-mono text-[11px] leading-4 wrap-break-word text-gray-600">{summaryText(preset)}</span>
		</span>
	</button>
	<!-- 复制名称：与删除同源 —— 都是那条 button 的兄弟节点（嵌不进去），靠绝对定位落位。
	     **放在名称行右端**而不是右下角：右下角已经给了删除，两个图标并排会让摘要一次让出
	     六十多像素，16rem 的栏里那是好几行的高度。

	     定位 `top-1 right-1`（4px）：条目是 `p-2`（8px），名称行占 8–24px、
	     中心在 16px；按钮 4–28px、中心也在 16px —— **跟它管的那一行垂直居中**，
	     而不是贴着条目外框（`top-1.5` 时中心偏下 2px、看着像往下掉）。 -->
	<Button
		icon
		label={`复制预设名称「${preset.name}」`}
		title="复制名称"
		class="absolute top-1 right-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
		onclick={() => void copyName()}
	>
		<Copy class="size-3.5" />
	</Button>
	<!-- 删除收进条目内部（不再单独占一列）：16rem 宽的左栏里，外侧那个按钮要吃掉三十多像素，
	     全是从摘要身上拿的。默认透明、悬浮或键盘聚焦才显形 —— 跟 NumberField 的清空按钮同一套路；
	     触屏没有 hover，`[@media(hover:none)]` 下常显。
	     定位 `right-1 bottom-1`：与上面那个复制图标**同一条竖线**（都离边 4px），
	     并与摘要末行垂直居中 —— 两个图标因此是上下对称的一对，不是一个贴边一个内缩。 -->
	<Button
		icon
		label={`删除预设「${preset.name}」`}
		title="删除"
		variant="danger"
		class="absolute right-1 bottom-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
		onclick={() => ondelete(preset.id)}
	>
		<Trash class="size-3.5" />
	</Button>

	<!-- 悬浮参数卡挂在 li 末尾：fixed 不受任何祖先的 overflow 影响，放在哪层都能全屏显示。
	     `pointer-events-none` 保证它不挡鼠标（否则鼠标一进去 hover 就断，卡片自己闪）。
	     一字段一行、左名右值：值右对齐 + `tabular-nums`，同一列数字上下对得齐才好扫。
	     组与组之间靠 `mt-2 first:mt-0` 拉开（不用写在 class 里的三元 —— 那种会被 prettier 折行拆断）。 -->
	{#if card !== null}
		<div class="{HOVER_CARD} w-64 text-[11px] leading-4" style="top: {card.top}px; left: {card.left}px" role="tooltip">
			{#each card.groups as group, groupIndex (groupIndex)}
				<div class="mt-2 first:mt-0">
					<p class="font-medium text-gray-600">{group.name}</p>
					<dl class="mt-0.5">
						{#each group.fields as field, fieldIndex (fieldIndex)}
							<div class="flex items-baseline justify-between gap-3">
								<dt class="shrink-0 text-gray-600">{field.label}</dt>
								<dd class="text-right font-mono text-gray-900 tabular-nums">{field.value}</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/each}
		</div>
	{/if}
</li>
