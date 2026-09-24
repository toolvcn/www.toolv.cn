<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Code, Hash, Type } from '@lucide/svelte';
	import Tabs from './Tabs.svelte';

	const { Story } = defineMeta({ title: 'UI/Tabs', component: Tabs });

	type Gen = 'uuid' | 'password' | 'lorem';
	const GEN_TABS: { value: Gen; label: string; icon?: typeof Type }[] = [
		{ value: 'uuid', label: 'UUID', icon: Hash },
		{ value: 'password', label: '密码', icon: Code },
		{ value: 'lorem', label: '假文', icon: Type }
	];

	type Ws = 'request' | 'curl' | 'codegen';
	const WS_TABS: { value: Ws; label: string; icon?: typeof Type }[] = [
		{ value: 'request', label: '请求调试', icon: Code },
		{ value: 'curl', label: 'cURL 工具', icon: Hash },
		{ value: 'codegen', label: '代码生成', icon: Type }
	];
</script>

<!-- card：独立卡片式 h-9，工具页顶部单独一行（generator / csv-json / date / text-tools / unit） -->
{#snippet card()}
	<Tabs aria-label="生成器类型" options={GEN_TABS} value="uuid" onchange={() => {}} />
{/snippet}

<!-- line：贴顶横线式 h-12，跟下方内容一体（regex / http 的工作区） -->
{#snippet line()}
	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
		<Tabs
			variant="line"
			class="rounded-t-xl"
			aria-label="工作区标签"
			options={WS_TABS}
			value="request"
			onchange={() => {}}
		/>
		<div class="p-4 text-xs text-gray-600">标签条下方就是当前工作区的内容</div>
	</div>
{/snippet}

<!-- 没有图标的纯文字标签 -->
{#snippet textOnly()}
	<Tabs
		aria-label="转换方向"
		options={[
			{ value: 'csv', label: 'CSV → JSON' },
			{ value: 'json', label: 'JSON → CSV' }
		]}
		value="csv"
		onchange={() => {}}
	/>
{/snippet}

<!-- 标签很多时：card 在小屏均分整宽，sm 起收成自然宽度 -->
{#snippet manyTabs()}
	<Tabs
		aria-label="标签很多的示例"
		options={[
			{ value: 'a', label: '统计' },
			{ value: 'b', label: '清理' },
			{ value: 'c', label: '格式化' },
			{ value: 'd', label: '去重' },
			{ value: 'e', label: '排序' }
		]}
		value="a"
		onchange={() => {}}
	/>
{/snippet}

<!-- 一行放不下时整条横向滚动：按钮不窄过自己的文字（min-w-fit + whitespace-nowrap）。
     窄屏（375）下这条要能滑动看到最后两档、且文字不被挤出按钮框 —— 单位换算 15 类、速查表 10 表都靠它 -->
{#snippet overflowTabs()}
	<Tabs
		aria-label="标签多到要滚动的示例"
		options={[
			{ value: '1', label: '长度' },
			{ value: '2', label: '面积' },
			{ value: '3', label: '体积' },
			{ value: '4', label: '重量' },
			{ value: '5', label: '温度' },
			{ value: '6', label: '速度' },
			{ value: '7', label: '时间' },
			{ value: '8', label: '角度' },
			{ value: '9', label: '力' },
			{ value: '10', label: '压力' },
			{ value: '11', label: '功率' },
			{ value: '12', label: '密度' },
			{ value: '13', label: '能量' },
			{ value: '14', label: '数据大小' },
			{ value: '15', label: 'CSS 长度' }
		]}
		value="1"
		onchange={() => {}}
	/>
{/snippet}

<Story name="Card" template={card} />
<Story name="Line" template={line} />
<Story name="TextOnly" template={textOnly} />
<Story name="ManyTabs" template={manyTabs} />
<Story name="OverflowTabs" template={overflowTabs} />
