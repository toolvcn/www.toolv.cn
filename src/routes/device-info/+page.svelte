<script lang="ts">
	import { Monitor } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { deviceStore } from './core/store.svelte.ts';
	import InfoBoard from './ui/InfoBoard.svelte';

	// 全局副作用的唯一位置（AGENTS §6 / STRUCTURE §2 B）：采集一次，然后跟着环境变化重采。
	// 听的不只是 resize —— 窗口尺寸没变时，转屏、系统切深色、断网也会改变这里的答案。
	$effect(() => {
		deviceStore.reload();
		// LCP 会随页面继续加载更新，观察器挂着才有最新值，卸载时要断开
		const stopLcp = deviceStore.watchLcp();

		// 环境变化只走同步重采：异步那批（电池 / 设备枚举）不跟着 resize 反复请求
		const recollect = (): void => deviceStore.refresh();
		const queries = ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)']
			.map((query) => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : null))
			.filter((list): list is MediaQueryList => list !== null);

		window.addEventListener('resize', recollect);
		window.addEventListener('orientationchange', recollect);
		window.addEventListener('online', recollect);
		window.addEventListener('offline', recollect);
		for (const list of queries) list.addEventListener('change', recollect);

		return () => {
			stopLcp();
			window.removeEventListener('resize', recollect);
			window.removeEventListener('orientationchange', recollect);
			window.removeEventListener('online', recollect);
			window.removeEventListener('offline', recollect);
			for (const list of queries) list.removeEventListener('change', recollect);
		};
	});
</script>

<ToolShell
	icon={Monitor}
	name="浏览器信息 & UA 解析"
	tagline="浏览器 · 硬件 · 网络 · 性能 · 能力"
	description="在线浏览器信息工具：一眼看完浏览器与版本、渲染引擎、操作系统、设备类型、屏幕与 DPR、时区与网络、存储配额、电池与手柄、摄像头与麦克风数量、权限状态、页面性能指标（TTFB / FCP / LCP），附 UA 解析与任意 UA 串解析、能力探测与 JSON 导出，纯本地读取不上传。"
	keywords="浏览器信息,UA 解析,User-Agent 解析,设备信息,屏幕分辨率,DPR 查询,时区查询,电池状态,键盘布局,权限查询,性能指标,浏览器能力探测,在线工具"
	path="/device-info"
	ogDescription="浏览器、系统、屏幕、网络与存储一屏看完，UA 与任意 UA 串都能解析，纯本地读取。"
	docUrl="https://developer.mozilla.org/zh-CN/docs/Web/API/Navigator/userAgent"
	docLabel="MDN"
	width="wide"
>
	<InfoBoard />
</ToolShell>
