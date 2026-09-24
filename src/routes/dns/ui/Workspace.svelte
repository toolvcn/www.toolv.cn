<script lang="ts">
	// /dns 的工作区：顶部工具条（地区 + 搜索 + 重置），下面两栏 —— 左列表、右命令面板 + 说明面板。
	//
	// 布局取舍：桌面端整页钉住视口（ToolShell 的 fill），**滚动交给各面板自己**；
	// 右栏整体不滚（滚了会裁命令面板的下拉浮层），只让「为什么换 DNS」那张面板自己滚。
	import { RotateCcw, Search } from '@lucide/svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { SEARCH_ICON, SEARCH_INPUT, TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { dnsStore } from '../core/store.svelte.ts';
	import CommandPanel from './CommandPanel.svelte';
	import ListPanel from './ListPanel.svelte';
	import WhyPanel from './WhyPanel.svelte';

	const REGION_OPTIONS = [
		{ value: 'all', label: '全部' },
		{ value: 'cn', label: '国内' },
		{ value: 'global', label: '国外' }
	] as const;
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：地区档位 + 搜索在左，重置靠右 -->
	<div id="dns-toolbar" role="group" aria-label="筛选公共 DNS" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="dns-region-label">地区</span>
			<SegmentedControl
				aria-labelledby="dns-region-label"
				options={REGION_OPTIONS}
				value={dnsStore.region}
				onchange={(value) => dnsStore.setRegion(value)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="dns-search">搜索</label>
			<div class="relative">
				<Search class={SEARCH_ICON} aria-hidden="true" />
				<input
					id="dns-search"
					type="search"
					value={dnsStore.query}
					oninput={(event) => dnsStore.setQuery(event.currentTarget.value)}
					placeholder="搜索：腾讯 / 223.5.5.5 / 过滤"
					class="{SEARCH_INPUT} md:w-72"
				/>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button label="重置筛选条件" title="重置" disabled={!dnsStore.filtered} onclick={() => dnsStore.resetFilter()}>
				<RotateCcw class="size-4 shrink-0" aria-hidden="true" />重置
			</Button>
		</div>
	</div>

	<!-- 两栏：lg 起并排（左列表自适应、右栏定宽 24rem），窄屏上下堆叠 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
		<ListPanel />
		<div class="flex flex-col gap-4 lg:min-h-0 lg:w-[24rem] lg:shrink-0">
			<CommandPanel />
			<WhyPanel />
		</div>
	</div>
</div>

<Toast />
