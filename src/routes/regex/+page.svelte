<script lang="ts">
	import { onMount } from 'svelte';
	import { Regex } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { SAVED_STORAGE_KEY } from './config.ts';
	import { parseSaved } from './core/saved.ts';
	import { regexStore } from './core/store.svelte.ts';
	import Panel from './ui/Panel.svelte';

	// 已保存表达式的本地持久化：挂载时恢复，之后任何改动自动写回。
	// 隐私模式下 localStorage 不可用，整个读写都包 try/catch 静默忽略。
	onMount(() => {
		try {
			const raw = localStorage.getItem(SAVED_STORAGE_KEY);
			if (raw) {
				const parsed = parseSaved(raw);
				if (parsed.ok) regexStore.restoreSaved(parsed.saved);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});

	$effect(() => {
		try {
			localStorage.setItem(SAVED_STORAGE_KEY, regexStore.savedText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={Regex}
	name="正则表达式测试"
	tagline="实时匹配 · 文本替换 · 代码生成 · 正则图解"
	description="在线正则表达式测试工具：输入即着色的实时匹配高亮、捕获组按需展开、文本替换、8 种语言代码生成、正则图解、46 条常用正则一键填入、调好的表达式可存到本地下次接着用、57 条速查表点击插入，支持 g/i/m/s/u/y 修饰符，纯本地运行。"
	keywords="正则表达式测试,正则在线,regex测试,正则替换,正则代码生成,正则图解,捕获组,常用正则表达式,正则速查表,在线工具"
	path="/regex"
	width="full"
	fillFrom="lg"
	docUrl="https://www.runoob.com/regexp/regexp-tutorial.html"
	docLabel="正则教程"
	ogDescription="实时匹配、文本替换、代码生成、正则图解，常用表达式可存本地，纯本地运行。"
	fill="fill"
>
	<Panel />
</ToolShell>
