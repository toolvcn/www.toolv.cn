<script lang="ts">
	// 按钮式下拉（跨工具公共组件）：点击弹出菜单、点外部关闭、Esc 关闭、当前项打勾。
	// 取代原生 select：原生下拉的选项面板无法自定义描述文案，且各端观感不一致。
	//
	// 与 Button 同构：触发按钮继承 HTMLButtonAttributes + rest 透传，
	// 并给出 size 档位（md = h-9 / sm = h-8），上一版只有硬编码的 h-9。
	import { Check, ChevronDown } from '@lucide/svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { DISABLED, FOCUS_RING } from '../styles.ts';

	/** 下拉的一个选项：description 同时写进菜单行与 title，光看 label 不够时要能知道差异 */
	export interface DropdownOption {
		value: string;
		label: string;
		description: string;
	}

	type Props = Omit<HTMLButtonAttributes, 'class' | 'children' | 'size' | 'type' | 'value' | 'onclick' | 'title'> & {
		/** 无障碍名称，同时作为菜单的 aria-label */
		label: string;
		/**
		 * 触发按钮上显示的字，省略则显示 `label`。
		 * 动作型菜单（点一下就执行）没有「当前值」，label 得写成一句完整的话，
		 * 但那句话长到摆不进按钮 —— 这时短的那句写这里。
		 */
		triggerLabel?: string;
		options: ReadonlyArray<DropdownOption>;
		value: string;
		onSelect: (value: string) => void;
		/** md = h-9（默认，与 Button md 同高）；sm = h-8 密集工具条；xs = h-7 面板标题行 */
		size?: 'xs' | 'sm' | 'md';
		disabled?: boolean;
		/** 禁用时的悬浮提示（说明怎么解除禁用），省略则退回 label */
		disabledTitle?: string;
		/** 附加类 */
		class?: string;
		/** 要拿到触发按钮 DOM 时 bind:ref={el} */
		ref?: HTMLButtonElement | null;
	};

	let {
		label,
		triggerLabel,
		options,
		value,
		onSelect,
		size = 'md',
		disabled = false,
		disabledTitle,
		class: className = '',
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let open = $state(false);
	/** 菜单节点：键盘移动焦点时按它里面的 menuitem 顺序走 */
	let menuEl = $state<HTMLUListElement | null>(null);
	/** 菜单锚定方向：打开时按按钮相对视口的位置计算，避免窄屏被屏幕边缘裁掉 */
	let anchor = $state<'left' | 'right'>('left');
	/** 菜单宽度（px）：按可用空间收紧，最多 320px */
	let menuWidth = $state(320);
	/** 菜单是否向上展开：按钮下方放不下、而上方的余量更大时（窄屏、或按钮贴近视口底） */
	let dropUp = $state(false);
	/** 菜单最大高度（px）：按展开方向的剩余空间收紧，上限仍是 320（原写死的 max-h-80） */
	let menuMaxHeight = $state(320);

	const current = $derived(options.find((option) => option.value === value));

	// xs = h-7：面板标题行那一档（跟 HEADER_BTN / SEG_BTN_QUIET 同高），
	// 同一行不混高度（UI-STYLE §9）
	const SIZE = { md: 'h-9 gap-1 px-3 text-sm', sm: 'h-8 gap-1 px-2.5 text-xs', xs: 'h-7 gap-1 px-2 text-xs' } as const;

	// 展开时按钮要有可见的激活态，否则点了只有菜单弹出、按钮本身毫无反应。
	// 条件类名在脚本里算好：class 属性里的三元会被 prettier 拆断而静默失效
	const buttonClass = $derived(
		[
			'inline-flex items-center rounded-lg font-medium',
			SIZE[size],
			open
				? 'border border-blue-300 bg-blue-50 text-blue-700'
				: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
			FOCUS_RING,
			DISABLED,
			className
		].join(' ')
	);
	const chevronClass = $derived(open ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform');

	/**
	 * 展开前量一次按钮位置：菜单往空间大的一侧展开，宽度不超过该侧余量。
	 * 纯 CSS 的 left-0 + 固定宽度在按钮靠近屏幕右边时会跑出屏幕（Content-Type 下拉即如此）。
	 */
	function toggle(): void {
		open = !open;
		if (!open) return;
		const btn = ref;
		if (!btn) return;
		const rect = btn.getBoundingClientRect();
		const GAP = 8;
		const roomRight = window.innerWidth - rect.left - GAP; // 按钮左侧对齐时右侧剩余
		const roomLeft = rect.right - GAP; // 按钮右侧对齐时左侧剩余
		if (roomRight >= roomLeft) {
			anchor = 'left';
			menuWidth = Math.min(320, Math.max(224, roomRight));
		} else {
			anchor = 'right';
			menuWidth = Math.min(320, Math.max(224, roomLeft));
		}
		// 纵向同理：默认向下展开，但按钮下方剩不下、上方更宽裕时就翻上去（手机上按钮常在
		// 视口底部：收起后的响应面板、页面最后一张卡的标题行都是这种位置），高度按所选方向的
		// 余量收紧 —— 否则固定 320px 会把菜单顶出屏幕，最后几项连滚动都够不着。
		// 下限 160px：再短就只剩一行，宁可让它略微溢出，也要看得见内容（内部还能滚）
		const roomBelow = window.innerHeight - rect.bottom - GAP;
		const roomAbove = rect.top - GAP;
		dropUp = roomBelow < 200 && roomAbove > roomBelow;
		menuMaxHeight = Math.max(160, Math.min(320, dropUp ? roomAbove : roomBelow));
	}

	function choose(value: string): void {
		onSelect(value);
		open = false;
	}

	/** 菜单里当前可聚焦的项（菜单未展开时为空数组） */
	function menuItems(): HTMLButtonElement[] {
		return menuEl ? [...menuEl.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')] : [];
	}

	/**
	 * 把焦点交给第 index 项，越界按取模绕回（菜单是循环的一串）。
	 * 索引用 -1 传入时落到最后一项 —— 向上键从触发器进菜单就该落在末尾。
	 */
	function focusItem(index: number): void {
		const list = menuItems();
		if (list.length === 0) return;
		list[((index % list.length) + list.length) % list.length].focus();
	}

	/**
	 * 触发器上的向下 / 向上键：这是 `role="menu"` 的常规做法 ——
	 * 按向下就该展开菜单并把焦点交给第一项，而不是像 Tab 那样让它停在按钮上
	 * （那样键盘用户还得再按一次 Tab 才进得来）。
	 */
	function onTriggerKeydown(event: KeyboardEvent): void {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		if (!open) toggle();
		// 展开后菜单才挂上 DOM，取 Item 要放到下一轮
		const toFirst = event.key === 'ArrowDown';
		queueMicrotask(() => focusItem(toFirst ? 0 : -1));
	}

	/** 菜单内的键盘导航：上下循环 / Home·End 跳首尾 / Esc 关菜单并把焦点还给触发按钮 */
	function onMenuKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				focusItem(menuItems().indexOf(document.activeElement as HTMLButtonElement) + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusItem(menuItems().indexOf(document.activeElement as HTMLButtonElement) - 1);
				break;
			case 'Home':
				event.preventDefault();
				focusItem(0);
				break;
			case 'End':
				event.preventDefault();
				focusItem(-1);
				break;
			case 'Escape':
				// 先于 window 上的那一份执行：焦点要回到触发按钮，不能掉到 body 上
				open = false;
				ref?.focus();
				break;
		}
	}

	/** 点到下拉外面就收起 */
	function onWindowPointerDown(event: Event): void {
		if (!open) return;
		if ((event.target as HTMLElement | null)?.closest('[data-dropdown-box]')) return;
		open = false;
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (open && event.key === 'Escape') open = false;
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<div class="relative" data-dropdown-box>
	<button
		bind:this={ref}
		type="button"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		{disabled}
		title={disabled ? (disabledTitle ?? label) : (current?.description ?? label)}
		onclick={toggle}
		onkeydown={onTriggerKeydown}
		{...rest}
		class={buttonClass}
	>
		{current?.label ?? triggerLabel ?? label}<ChevronDown class={chevronClass} />
	</button>
	{#if open}
		<!-- 菜单宽高与展开方向都按打开时的测量值走：往空间大的一侧展开、往空间大的一侧翻，
		     超高内部滚动，避免窄屏跑出屏幕 -->
		<ul
			bind:this={menuEl}
			role="menu"
			aria-label={label}
			onkeydown={onMenuKeydown}
			style:width={menuWidth + 'px'}
			style:max-height={menuMaxHeight + 'px'}
			class="absolute z-10 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg {dropUp
				? 'bottom-full mb-1'
				: 'top-full mt-1'} {anchor === 'left' ? 'left-0' : 'right-0'}"
		>
			{#each options as option (option.value)}
				{@const inUse = option.value === value}
				<li role="none">
					<button
						type="button"
						role="menuitem"
						onclick={() => choose(option.value)}
						aria-label="{option.label}，{option.description}{inUse ? '（当前选择）' : ''}"
						title={inUse ? `当前选择：${option.label}` : option.description}
						class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-100 {FOCUS_RING}"
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm text-gray-900">{option.label}</span>
							<span class="mt-0.5 block text-xs text-gray-600">{option.description}</span>
						</span>
						<!-- 当前选中的给个勾，省得打开菜单还得自己比对 -->
						{#if inUse}
							<Check class="mt-0.5 size-3.5 shrink-0 text-blue-600" />
							<span class="sr-only">（当前选择）</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
