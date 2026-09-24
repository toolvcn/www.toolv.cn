<script lang="ts">
	// 「退款时平台退还佣金？」开关：整盘与单件两套输入各有一个，文案与版式完全一样，
	// 所以抽成一件 —— 原先在 InputPanel 里写了两遍，改一句文案要改两处。
	import Switch from '$lib/ui/Switch/Switch.svelte';

	let { checked = $bindable(true) }: { /** 双向绑定：bind:checked */ checked?: boolean } = $props();
</script>

<div class="flex flex-col gap-1">
	<span class="text-xs font-medium text-gray-600">退款时平台退还佣金？</span>
	<div class="flex h-9 items-center gap-2">
		<Switch
			label="退款时平台退还佣金"
			title="天猫 / 抖音退款后退还佣金，部分平台不退；不退时退货那部分也要交佣金"
			bind:checked
		/>
		<!-- 可见文案对读屏隐藏：Switch 自带 aria-label（同一句话），
		     不隐藏会被念两遍「退款时平台退还佣金？」 -->
		<span class="text-xs text-gray-600" aria-hidden="true">{checked ? '退还（常见）' : '不退还'}</span>
	</div>
</div>
