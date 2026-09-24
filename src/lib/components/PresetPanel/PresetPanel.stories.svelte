<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PresetPanel from './PresetPanel.svelte';

	const { Story } = defineMeta({ title: '组件/PresetPanel', component: PresetPanel });
</script>

<script lang="ts">
	interface DemoPreset {
		id: number;
		name: string;
		method: string;
		url: string;
	}

	/** 悬浮参数卡的内容（电商 ROI 的形态：分组 + 左名右值） */
	interface DemoDetail {
		id: number;
		name: string;
		method: string;
		url: string;
		detail: readonly { name: string; fields: readonly { label: string; value: string }[] }[];
	}

	const PRESETS: DemoPreset[] = [
		{ id: 1, name: '取用户列表', method: 'GET', url: 'https://api.example.com/users?page=1' },
		{ id: 2, name: '创建订单', method: 'POST', url: 'https://api.example.com/orders' },
		{ id: 3, name: '删除会话', method: 'DELETE', url: 'https://api.example.com/sessions/42' }
	];

	const DETAIL_PRESETS: DemoDetail[] = [
		{
			id: 1,
			name: '成本率五成的盘',
			method: '整盘',
			url: '广告 1,165.00 元 · 成交额 6,990.00',
			detail: [
				{
					name: '成交与广告',
					fields: [
						{ label: '广告花费', value: '1165 元' },
						{ label: '成交额', value: '6990 元' },
						{ label: '订单数', value: '100 单' }
					]
				},
				{
					name: '成本项',
					fields: [
						{ label: '商品成本率', value: '50%' },
						{ label: '平台佣金率', value: '5%（退款退还）' },
						{ label: '单均发货成本', value: '3 元' }
					]
				},
				{ name: '退货', fields: [{ label: '未发货退款率', value: '20%' }] }
			]
		},
		{ id: 2, name: '只有名称、没有参数', method: '整盘', url: '—', detail: [] }
	];

	let name = $state('');
</script>

<!-- 有预设：标题右侧计数、条目徽章 + 摘要、右侧删除 -->
{#snippet filled()}
	<div class="flex h-[420px] flex-col">
		<PresetPanel
			idPrefix="story-presets"
			presets={PRESETS}
			bind:name
			exportFileName="story-presets.json"
			exportText="[]"
			onsave={() => {}}
			onapply={() => {}}
			ondelete={() => {}}
			onimport={() => {}}
			badgeText={(preset) => preset.method}
			summaryText={(preset) => preset.url}
			emptyHint="还没有预设：填好请求后在顶部填个名称点「保存」，整组参数就存在本地；也可导出 / 导入文件备份。"
		/>
	</div>
{/snippet}

<!-- 空态：列表区给一句「怎么用」，不渲染空列表 -->
{#snippet empty()}
	<div class="flex h-72 flex-col">
		<PresetPanel
			idPrefix="story-presets-empty"
			presets={[] as DemoPreset[]}
			bind:name
			exportFileName="story-presets.json"
			exportText="[]"
			onsave={() => {}}
			onapply={() => {}}
			ondelete={() => {}}
			onimport={() => {}}
			badgeText={(preset) => preset.method}
			summaryText={(preset) => preset.url}
			emptyHint="还没有预设：填好请求后在顶部填个名称点「保存」，整组参数就存在本地；也可导出 / 导入文件备份。"
		/>
	</div>
{/snippet}

<!-- 悬浮参数卡：给了 `detailGroups` 才有。鼠标停在条目上（或键盘 Tab 到条目）时在右侧弹出，
     一字段一行、左名右值；空组不画，一条都没填的预设不出卡（第二条就是这种） -->
{#snippet withDetail()}
	<div class="flex h-[420px] flex-col">
		<PresetPanel
			idPrefix="story-presets-detail"
			presets={DETAIL_PRESETS}
			bind:name
			exportFileName="story-presets.json"
			exportText="[]"
			onsave={() => {}}
			onapply={() => {}}
			ondelete={() => {}}
			onimport={() => {}}
			badgeText={(preset) => preset.method}
			summaryText={(preset) => preset.url}
			detailGroups={(preset) => preset.detail}
			emptyHint="还没有预设：填好参数后在顶部填个名称点「保存」，整组参数就存在本地；也可导出 / 导入文件备份。"
		/>
	</div>
{/snippet}

<Story name="Filled" template={filled} />
<Story name="WithDetail" template={withDetail} />
<Story name="Empty" template={empty} />
