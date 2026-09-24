<script lang="ts">
	// 颜色转换主布局：左列输入 + 预览、右列格式 + 对比度；移动端单列自然流。
	import ContrastCard from './ContrastCard.svelte';
	import FormatsCard from './FormatsCard.svelte';
	import InputCard from './InputCard.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	<!-- 左列：输入（含预览）+ 各格式 -->
	<div class="flex min-h-0 flex-col gap-4">
		<InputCard />
		<FormatsCard />
	</div>

	<!-- 右列：WCAG 对比度 -->
	<ContrastCard />
</div>

<Toast />
