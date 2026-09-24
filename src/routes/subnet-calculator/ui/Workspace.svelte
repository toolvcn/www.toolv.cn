<script lang="ts">
	// 子网计算器主界面：顶部一条输入（地址 / CIDR）+ 下面并排两块 —— 网段信息与子网划分。
	// lg 起并排、各自内部滚动；md 及以下上下堆叠、由页面自己滚（面板里封顶 60vh）。
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { subnetStore } from '../core/store.svelte.ts';
	import { CIDR_EXAMPLES } from '../core/subnet.ts';
	import InfoPanel from './InfoPanel.svelte';
	import SplitPanel from './SplitPanel.svelte';

	const EXAMPLE_OPTIONS = CIDR_EXAMPLES.map((example) => ({
		value: example.id,
		label: example.label,
		description: example.description
	}));

	/** 切分目标下拉要显示当前生效的那一档（没手选时是默认档） */
	const currentTarget = $derived(subnetStore.target === null ? '' : String(subnetStore.target));
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="subnet-toolbar" role="group" aria-label="子网计算输入" class={TOOLBAR}>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<!-- 可见 label 用 for 关联；Input 不再传 label（否则会再多一个 sr-only 的，读屏会念两遍） -->
			<label class={TOOLBAR_LABEL} for="subnet-input">IPv4 地址 / CIDR</label>
			<Input
				id="subnet-input"
				mono
				size="sm"
				bind:value={subnetStore.input}
				invalid={subnetStore.error !== ''}
				autocomplete="off"
				spellcheck="false"
				placeholder="192.168.1.10/24，也可写「192.168.1.10 255.255.255.0」"
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>子网划分到</span>
			{#if subnetStore.targets.length > 0}
				<Dropdown
					label="子网划分的目标前缀"
					size="sm"
					options={subnetStore.targets}
					value={currentTarget}
					onSelect={(value) => subnetStore.setTarget(value)}
				/>
			{:else}
				<!-- 没有可切的档位（/32）时占位常驻，免得工具条高度跳一下 -->
				<span class="inline-flex h-8 items-center text-xs text-gray-600">/32 无法再切</span>
			{/if}
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Dropdown
				label="填入示例"
				triggerLabel="示例"
				size="sm"
				options={EXAMPLE_OPTIONS}
				value=""
				onSelect={(value) => subnetStore.loadExample(value)}
			/>
			<Button label="清空输入" title="清空" onclick={() => subnetStore.clearInput()}>清空</Button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
		<InfoPanel />
		<SplitPanel />
	</div>
</div>

<Toast />
