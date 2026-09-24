<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TOOLBAR, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import SegmentedControl from './SegmentedControl.svelte';

	const { Story } = defineMeta({ title: 'UI/SegmentedControl', component: SegmentedControl });

	// 泛型组件在 story 里显式给类型：value 必须是 options 里出现过的字面量联合
	type Mode = 'format' | 'minify';
	const MODE_OPTIONS: { value: Mode; label: string }[] = [
		{ value: 'format', label: '格式化' },
		{ value: 'minify', label: '压缩' }
	];

	type Indent = '2' | '4' | 'tab';
	const INDENT_OPTIONS: { value: Indent; label: string }[] = [
		{ value: '2', label: '2 空格' },
		{ value: '4', label: '4 空格' },
		{ value: 'tab', label: 'Tab' }
	];

	type Strategy = 'component' | 'full';
	const STRATEGY_OPTIONS: { value: Strategy; label: string; title: string }[] = [
		{ value: 'component', label: '组件', title: '组件（严格）：按 RFC 3986 保留字符逐个转义' },
		{ value: 'full', label: '整链', title: '整链（宽松）：只转义必须转义的字符' }
	];
</script>

<!-- 工具条里的两组分段：最常见的用法（json-formatter 的形态） -->
{#snippet inToolbar()}
	{@const mode = 'format'}
	{@const indent = '2'}
	<div class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>模式</span>
			<SegmentedControl options={MODE_OPTIONS} value={mode} onchange={() => {}} />
		</div>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>缩进</span>
			<SegmentedControl options={INDENT_OPTIONS} value={indent} onchange={() => {}} />
		</div>
	</div>
{/snippet}

<!-- 带 aria-labelledby：分组名由外部标题提供（hash / timestamp / date 的形态） -->
{#snippet labelled()}
	<div class="flex flex-col gap-1">
		<span class="text-xs font-medium text-gray-600" id="seg-demo-label">结果大小写</span>
		<SegmentedControl
			aria-labelledby="seg-demo-label"
			options={[
				{ value: 'lower', label: 'a' },
				{ value: 'upper', label: 'A' }
			]}
			value="lower"
			onchange={() => {}}
		/>
	</div>
{/snippet}

<!-- card 档：边框与分隔线用 gray-300，配 w-fit（date-calculator / color-converter 的形态） -->
{#snippet inCard()}
	<div class="rounded-lg border border-gray-200 p-4">
		<SegmentedControl
			edge="dark"
			class="w-fit"
			aria-label="对比背景"
			options={[
				{ value: 'white', label: '白' },
				{ value: 'black', label: '黑' },
				{ value: 'custom', label: '自定义' }
			]}
			value="white"
			onchange={() => {}}
		/>
	</div>
{/snippet}

<!-- 全部禁用：整组半透明常驻，不因状态切换而改变高度。
     `aria-disabled` 与 `opacity-60` 成对出现是本站既定口径（见 json-formatter / url-encoder 的
     「当前不生效」分组）：半透明会把组里的文字对比度压到 3:1 以下，标上 aria-disabled 之后
     axe 才按「当前不生效」而不是「对比度不合格」判定。story 里少了它，会误报一条 color-contrast。 -->
{#snippet allDisabled()}
	<div class="flex flex-col gap-1 opacity-60" aria-disabled="true">
		<span class="text-xs font-medium text-gray-600">缩进（压缩模式下不生效）</span>
		<SegmentedControl
			options={INDENT_OPTIONS.map((option) => ({ ...option, disabled: true }))}
			value="2"
			onchange={() => {}}
		/>
	</div>
{/snippet}

<!-- 带 title 的短标签 -->
{#snippet withTitle()}
	<SegmentedControl options={STRATEGY_OPTIONS} value="component" onchange={() => {}} />
{/snippet}

<!-- 轻档：选中是浅蓝底 + 蓝字、按钮更矮更窄（h-7）。给「一屏里同时出现好几处」的小节标题行用 ——
     实心蓝块叠在一起会互相抢镜头，控件比它自己那行 12px 的标题还响；高度矮一档才跟标题齐平。 -->
{#snippet quiet()}
	<div class="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
		<div class="flex items-center justify-between gap-2">
			<span class="text-xs font-semibold text-gray-900">成交与广告</span>
			<SegmentedControl
				options={MODE_OPTIONS}
				value="format"
				tone="quiet"
				class="w-fit"
				aria-label="填法（轻档示例）"
				onchange={() => {}}
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span class="text-xs font-semibold text-gray-900">成本项</span>
			<SegmentedControl
				options={INDENT_OPTIONS}
				value="2"
				tone="quiet"
				class="w-fit"
				aria-label="填法（轻档示例）"
				onchange={() => {}}
			/>
		</div>
		<span class="text-[11px] leading-4 text-gray-600">两处叠在一起时，轻档不会有两个实心蓝块互相抢镜头。</span>
	</div>
{/snippet}

<Story name="InToolbar" template={inToolbar} />
<Story name="Labelled" template={labelled} />
<Story name="InCard" template={inCard} />
<Story name="AllDisabled" template={allDisabled} />
<Story name="WithTitle" template={withTitle} />
<Story name="Quiet" template={quiet} />
