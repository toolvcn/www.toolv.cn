<script lang="ts">
	import { onMount } from 'svelte';
	import { Calculator } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
	import { calcStore, HISTORY_KEY } from './core/store.svelte.ts';

	// 全局副作用（读 / 写 localStorage）只写在 +page.svelte（STRUCTURE §2 B）：
	// 历史是唯一要落盘的状态，读不到就当没有，不影响计算本身。
	onMount(() => {
		try {
			const raw = localStorage.getItem(HISTORY_KEY);
			if (raw !== null) calcStore.loadHistory(JSON.parse(raw));
		} catch {
			calcStore.clearHistory();
		}
	});

	$effect(() => {
		try {
			localStorage.setItem(HISTORY_KEY, JSON.stringify($state.snapshot(calcStore.history)));
		} catch {
			// 存不下（配额满或被浏览器禁掉）也不该影响这一页的计算
			return;
		}
	});
</script>

<ToolShell
	icon={Calculator}
	name="科学计算器"
	tagline="表达式求值 · 三角函数 · 历史记录"
	heading="科学计算器"
	description="在线科学计算器：支持括号、幂运算与隐式乘法，三角函数可在角度制与弧度制之间切换，带 pi / e 常量与 ln / log / 开方等常用函数，算式错了直接说清是哪一步；结果实时算、可一键复制，最近 20 条历史只存在本机浏览器。纯前端运行，不上传任何数据。"
	keywords="科学计算器,在线计算器,表达式求值,三角函数,角度制,弧度制,幂运算,开方,对数,历史记录,在线工具"
	path="/calculator"
	ogDescription="括号、幂、隐式乘法与三角函数都支持的表达式计算器，角度制 / 弧度制可切，历史只存本机。"
	width="wide"
	fill="fill"
	fillFrom="lg"
>
	<Workspace />
</ToolShell>
