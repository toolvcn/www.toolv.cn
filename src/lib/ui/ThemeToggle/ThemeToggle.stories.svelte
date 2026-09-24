<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ThemeToggle from './ThemeToggle.svelte';
	import { theme, type ThemePreference } from '../theme.svelte.ts';

	const { Story } = defineMeta({ title: 'UI/ThemeToggle', component: ThemeToggle });

	// 三档各一个按钮，点了就能看 ThemeToggle 的图标与文案跟着变
	const OPTIONS: { value: ThemePreference; label: string }[] = [
		{ value: 'system', label: '跟随系统' },
		{ value: 'light', label: '浅色' },
		{ value: 'dark', label: '深色' }
	];

	// 导航条与抽屉两处用法各一份：尺寸 / 圆角 / 配色由调用方给，组件只带 items-center + gap-2 + 焦点环
	const NAV_ICON =
		'inline-flex size-9 shrink-0 justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	const MENU_ROW = 'flex h-9 w-full rounded px-2 text-xs font-medium text-gray-700 hover:bg-gray-100';
</script>

<!-- 导航条形态：36px 方块，跟左上角菜单按钮同一档 -->
{#snippet navIcon()}
	<ThemeToggle class={NAV_ICON} />
{/snippet}

<!-- 工具抽屉形态：图标 + 文字一行，宽度撑满 -->
{#snippet menuRow()}
	<ThemeToggle showLabel class={MENU_ROW} />
{/snippet}

<!-- 三档切换：验证图标与文案跟着 theme.preference 走 -->
{#snippet threeStates()}
	<div class="flex flex-wrap items-center gap-2">
		{#each OPTIONS as option (option.value)}
			<button
				type="button"
				class="rounded border border-gray-300 px-2 py-1 text-xs"
				onclick={() => theme.set(option.value)}
			>
				设为{option.label}
			</button>
		{/each}
		<ThemeToggle showLabel class={MENU_ROW} />
	</div>
{/snippet}

<!-- 深色容器里的样子：.dark 是类选择器，变量组在非 html 元素上也生效 -->
{#snippet inDarkSurface()}
	<div class="dark flex items-center gap-2 rounded-lg bg-gray-900 p-4">
		<ThemeToggle class={NAV_ICON} />
		<ThemeToggle showLabel class={MENU_ROW} />
	</div>
{/snippet}

<Story name="NavIcon" template={navIcon} />
<Story name="MenuRow" template={menuRow} />
<Story name="ThreeStates" template={threeStates} />
<Story name="InDarkSurface" template={inDarkSurface} />
