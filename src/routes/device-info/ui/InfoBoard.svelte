<script lang="ts">
	// 浏览器信息的主界面：工具条 + 一张 UA 卡 + 十张分组卡 + 能力探测。
	// 分组是静态定义（core/types.ts 的 GROUP_DEFS），所以预渲染阶段骨架就完整，
	// 采集前后只有值在变，卡片数量与行名不变。
	import { Copy, Download, RefreshCw } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Switch from '$lib/ui/Switch/Switch.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { TOOLBAR, TOOLBAR_ACTIONS } from '$lib/ui/styles';
	import { deviceStore } from '../core/store.svelte.ts';
	import { GROUP_DEFS } from '../core/types.ts';
	import CapabilityPanel from './CapabilityPanel.svelte';
	import InfoGroup from './InfoGroup.svelte';
	import UaPanel from './UaPanel.svelte';

	const ready = $derived(deviceStore.ready);
	const highEntropyBusy = $derived(deviceStore.highEntropyState === 'loading');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- 工具条：左侧是采集范围开关，右侧是整块操作 -->
	<div id="device-toolbar" role="group" aria-label="浏览器信息操作" class={TOOLBAR}>
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-gray-700">显示 WebGL 渲染器</span>
				<Switch
					label="显示 WebGL 渲染器"
					title="开启后读取显卡渲染器名称（属于硬件指纹信息，默认关闭）"
					bind:checked={deviceStore.includeWebgl}
				/>
			</div>
			<Button
				size="sm"
				label="读取 UA Client Hints 的高精度版本（只有 Chromium 系支持）"
				disabled={highEntropyBusy || !ready}
				onclick={() => void deviceStore.loadHighEntropy()}
			>
				{deviceStore.highEntropyLabel}
			</Button>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Button size="sm" label="重新采集一次浏览器信息" onclick={() => deviceStore.reload()}>
				<RefreshCw class="size-3.5" aria-hidden="true" />刷新
			</Button>
			<Button size="sm" label="复制全部信息（JSON）" onclick={() => void deviceStore.copyAll()}>
				<Copy class="size-3.5" aria-hidden="true" />复制全部
			</Button>
			<Button size="sm" label="导出为 JSON 文件" onclick={() => deviceStore.exportJson()}>
				<Download class="size-3.5" aria-hidden="true" />导出 JSON
			</Button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<UaPanel class="lg:col-span-2" />
		{#each GROUP_DEFS as group (group.id)}
			<InfoGroup {group} />
		{/each}
		<CapabilityPanel class="lg:col-span-2" />
	</div>

	<p class="text-[11px] leading-4 text-gray-600">
		共 {deviceStore.fieldCount} 项{#if ready}，采集于 {deviceStore.collectedAt}{/if}：全部在浏览器本地读取，不上传、不落库。UA
		与系统版本是按常见约定推断的，浏览器可能出于兼容故意谎报。
	</p>
</div>

<Toast />
