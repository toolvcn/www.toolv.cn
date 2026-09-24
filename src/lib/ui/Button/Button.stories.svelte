<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Copy, Trash } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import Button from './Button.svelte';

	type Args = Omit<ComponentProps<typeof Button>, 'children'>;

	// 四档尺寸（UI-STYLE §9）
	const SIZES = ['xs', 'sm', 'md', 'lg'] as const;
	// 图标形态的五个语义色（UI-STYLE §9）
	const ICON_VARIANTS = ['neutral', 'primary', 'success', 'warning', 'danger'] as const;

	const { Story } = defineMeta({
		title: 'UI/Button',
		component: Button,
		args: { label: '复制结果', variant: 'secondary', size: 'sm' }
	});
</script>

{#snippet template(args: Args)}
	<Button {...args}>{args.label}</Button>
{/snippet}

<!-- 不给 children 时直接显示 label，单行调用更省事 -->
{#snippet labelOnly(args: Args)}
	<Button {...args} />
{/snippet}

<!-- 图标形态：圆形 + 另一张尺寸表，children 即图标本体 -->
{#snippet iconTemplate(args: Args)}
	<Button icon {...args}>
		{#if args.variant === 'danger'}
			<Trash class="size-3.5" />
		{:else}
			<Copy class="size-3.5" />
		{/if}
	</Button>
{/snippet}

<!-- 四档尺寸并排对比 -->
{#snippet allSizes()}
	<div class="flex items-end gap-3">
		{#each SIZES as size (size)}
			<Button variant="primary" {size} label={`size ${size}`}>{size}</Button>
		{/each}
	</div>
{/snippet}

<!-- 图标的五个语义色并排：同一行内高度一致，只有颜色不同 -->
{#snippet allIconVariants()}
	<div class="flex items-center gap-1">
		{#each ICON_VARIANTS as variant (variant)}
			<Button icon label={`${variant} 色`} {variant}>
				<Copy class="size-3.5" />
			</Button>
		{/each}
	</div>
{/snippet}

<!-- sm 档视觉更小，调用方需自己用 after 伪元素把热区撑到 24px -->
{#snippet smallWithHitArea()}
	<Button
		icon
		label="复制（小号，已扩热区）"
		size="sm"
		class="relative rounded after:absolute after:-inset-1.5 after:content-['']"
	>
		<Copy class="size-3.5" />
	</Button>
{/snippet}

<Story name="Primary" {template} args={{ variant: 'primary', size: 'md' }} />
<Story name="PrimaryLarge" {template} args={{ variant: 'primary', size: 'lg', label: '开始转换' }} />
<Story name="Sizes" template={allSizes} />
<Story name="Secondary" {template} />
<Story name="Danger" {template} args={{ variant: 'danger', label: '删除连接' }} />
<Story name="Ghost" {template} args={{ variant: 'ghost', label: '清空日志' }} />
<Story name="Disabled" {template} args={{ disabled: true }} />
<Story name="LabelOnly" template={labelOnly} args={{ label: '不需要 children' }} />
<!-- rest 透传：原生属性直接落到 button 上，不用在组件里加 prop -->
<Story name="AriaExpanded" {template} args={{ label: '展开详情', 'aria-expanded': true }} />

<Story name="IconNeutral" template={iconTemplate} args={{ label: '复制这条日志', variant: 'neutral', size: 'md' }} />
<Story name="IconPrimary" template={iconTemplate} args={{ variant: 'primary', label: '复制这条日志' }} />
<Story name="IconDanger" template={iconTemplate} args={{ variant: 'danger', label: '删除这条日志' }} />
<Story name="IconVariants" template={allIconVariants} />
<Story name="IconSizeSm" template={smallWithHitArea} />
<Story name="IconDisabled" template={iconTemplate} args={{ disabled: true }} />
<Story name="IconAriaExpanded" template={iconTemplate} args={{ label: '展开详情', 'aria-expanded': true }} />
