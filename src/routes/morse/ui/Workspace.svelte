<script lang="ts">
	// 编解码与速查并排：桌面端左右两栏（左编解码、右速查表），窄屏上下堆叠 —— 速查常驻可见，不用切标签。
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import Cheatsheet from './Cheatsheet.svelte';
	import Converter from './Converter.svelte';
</script>

<!-- 两栏：lg 起并排（左编解码自适应、右速查表定宽），窄屏上下堆叠、各占一半高度 -->
<div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
	<Converter />
	<Cheatsheet />
</div>

<Toast />
