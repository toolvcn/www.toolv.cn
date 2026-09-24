<script lang="ts">
	import { onMount } from 'svelte';
	import { Send } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { httpStore } from './core/store.svelte.ts';
	import { parsePresets } from './core/presets.ts';
	import Workspace from './ui/Workspace.svelte';
	import { PRESETS_STORAGE_KEY } from './config.ts';

	// 参数预设的本地持久化：挂载时恢复，之后任何改动自动写回。
	// 隐私模式下 localStorage 不可用，整个读写都包 try/catch 静默忽略。

	onMount(() => {
		try {
			const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
			if (raw) {
				const parsed = parsePresets(raw);
				if (parsed.ok) httpStore.restorePresets(parsed.presets);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});

	$effect(() => {
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, httpStore.presetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={Send}
	name="HTTP 请求调试"
	tagline="参数与认证 · 构造请求 · 查看响应 · 导入导出 · 代码生成"
	heading="HTTP 请求调试工具"
	description="在线 HTTP 请求调试工具：请求参数表、Bearer / Basic / API Key 认证、方法 / URL / Headers / Body 构造请求并实时查看响应，与浏览器 DevTools 的复制格式（cURL / PowerShell / fetch）双向互转，8 种语言请求代码一键生成，HTTP 状态码速查；默认浏览器直发，可开启「服务器代发」绕开 CORS 并测速。"
	keywords="HTTP,请求调试,POST,GET,cURL,PowerShell,fetch,状态码,Headers,请求头,参数,认证,Bearer,API Key,在线工具,测速"
	path="/http"
	ogDescription="构造请求看响应、cURL 互转、状态码速查；默认纯本地运行，可选服务器代发测速。"
	width="full"
	fill="fill"
	docUrl="https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status"
	docLabel="HTTP 状态码文档"
>
	<Workspace />
</ToolShell>
