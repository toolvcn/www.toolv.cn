<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CopyButton from './CopyButton.svelte';

	// 这里刻意不声明 Args、也不用 {...args}：CopyButton 的 Props 是从 Button 派生再 Omit 出来的，
	// 一经 Args 展开，svelte-check 会报「union type that is too complex to represent」。
	// 各 story 直接写死参数，反而更清楚。
	const { Story } = defineMeta({ title: 'UI/CopyButton', component: CopyButton });
</script>

<!-- 文字形态：工具条上的整块复制（但守卫文案需工具自己传） -->
{#snippet textDefault()}
	<CopyButton text={'{"a": 1}'} ok="已复制内容" label="复制内容" />
{/snippet}

<!-- 图标形态：结果行 / 逐行结果的行尾按钮。图标由组件自备，点一下复制成功会换成对勾 -->
{#snippet iconDefault()}
	<CopyButton icon text="0f8fad5b-d9cb-469f-a165-70867728950e" ok="已复制这条 UUID" label="复制这一行" />
{/snippet}

<!-- 内容为空时不碰剪贴板，直接弹 empty 那条错误色提示 -->
{#snippet emptyText()}
	<CopyButton text="" empty="结果为空，没有可复制的内容" label="复制（内容为空）" />
{/snippet}

<!-- 用「—」当占位符的结果：调用方放宽 isEmpty，否则点了会误报「没有可复制的内容」 -->
{#snippet dashPlaceholder()}
	<CopyButton text="—" isEmpty={(t) => t === '' || t === '—'} empty="还没有可复制的结果" label="复制（占位符）" />
{/snippet}

<!-- 成功 / 失败 / 空内容三条提示都可由调用方改写 -->
{#snippet customMessages()}
	<CopyButton
		text="abc"
		ok="已复制 SHA-256 结果"
		fail="复制失败，请手动选中输出内容复制"
		empty="还没有可复制的结果，先输入内容"
		label="复制（自定义文案）"
	/>
{/snippet}

<!-- 尺寸与配色经 rest 透传给 Button -->
{#snippet passthrough()}
	<div class="flex items-center gap-2">
		<CopyButton text="x" variant="primary" size="md" label="主按钮档" />
	</div>
{/snippet}

<!-- 禁用态：调用方自己判空后透传 disabled -->
{#snippet disabledWhenEmpty()}
	<CopyButton text="" disabled label="复制（禁用）" />
{/snippet}

<Story name="TextDefault" template={textDefault} />
<Story name="IconDefault" template={iconDefault} />
<Story name="EmptyText" template={emptyText} />
<Story name="DashPlaceholder" template={dashPlaceholder} />
<Story name="CustomMessages" template={customMessages} />
<Story name="PrimaryPassthrough" template={passthrough} />
<Story name="DisabledWhenEmpty" template={disabledWhenEmpty} />
