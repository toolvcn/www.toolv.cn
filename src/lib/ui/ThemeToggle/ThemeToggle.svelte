<script lang="ts">
	// 主题切换：一个按钮走完三态（跟随系统 → 浅色 → 深色 → 跟随系统）。
	//
	// 两处用法共用这一个组件：
	//   ① 导航条：图标方块（size-9，跟左上角菜单按钮同档），class 由调用方给；
	//   ② 工具抽屉：图标 + 文字一行（showLabel），小屏导航条放不下时走这条路。
	// 组件只管「改哪一档」和显示当前档，颜色怎么变由 layout.css 的 .dark 变量组决定。
	import { Moon, Sun, SunMoon } from '@lucide/svelte';
	import type { LucideIcon } from '@lucide/svelte';
	import { FOCUS_RING } from '../styles.ts';
	import { theme, type ThemePreference } from '../theme.svelte.ts';

	let {
		/**
		 * 尺寸、圆角与配色一律由调用方给（导航条方块 / 抽屉整行两套）：
		 * 组件自己只带 items-center + gap-2 + 焦点环，免得跟调用方的 flex / rounded 撞车
		 * （撞了谁赢看 Tailwind 生成顺序，不是 class 属性顺序，很难查）。
		 */
		class: className = '',
		/** 抽屉里要带文字说明当前是哪一档 */
		showLabel = false
	}: { class?: string; showLabel?: boolean } = $props();

	const ICON: Record<ThemePreference, LucideIcon> = { system: SunMoon, light: Sun, dark: Moon };
	/** 这一档叫什么 */
	const NAME: Record<ThemePreference, string> = { system: '跟随系统', light: '浅色', dark: '深色' };
	/** 点一下会切到什么 */
	const NEXT: Record<ThemePreference, string> = { system: '浅色', light: '深色', dark: '跟随系统' };

	// 图标是 prop 查表得来的组件，得用大写变量才能当动态组件渲染
	const Icon = $derived(ICON[theme.preference]);
	const darkNow = $derived(theme.resolved === 'dark');
	const nowText = $derived(darkNow ? '深' : '浅');
	/** 读屏与悬浮提示：当前档 + 当前实际深浅 + 下一档，一次说全 */
	const label = $derived(`主题：${NAME[theme.preference]}（当前${nowText}色），点击切换为${NEXT[theme.preference]}`);
</script>

<button
	type="button"
	aria-label={label}
	title={label}
	onclick={() => theme.cycle()}
	class="items-center gap-2 transition-colors {FOCUS_RING} {className}"
>
	<Icon class="size-4 shrink-0" aria-hidden="true" />
	{#if showLabel}
		<span class="min-w-0 flex-1 truncate">{NAME[theme.preference]}（当前{nowText}色）</span>
	{/if}
</button>
