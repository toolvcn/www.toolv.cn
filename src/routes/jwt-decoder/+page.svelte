<script lang="ts">
	import { KeyRound } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { jwtStore } from './core/store.svelte.ts';
	import Converter from './ui/Converter.svelte';

	// 当前时间只在客户端补写：SSR / 预渲染的 HTML 里不烘构建机的时刻，
	// 声明表的「有效中 / 已过期」相对状态在 hydration 后出现。
	$effect(() => {
		jwtStore.now = Date.now();
	});
</script>

<ToolShell
	icon={KeyRound}
	name="JWT 解码"
	tagline="Header / Payload 高亮 · 声明本地化 · HS/RS 验签"
	description="在线 JWT 解码工具：粘贴 token 即解出 Header 与 Payload，JSON 语法高亮，注册声明转本地时间并提示过期状态；填入密钥可按 HS256/384/512 与 RS256/384/512 验签，密钥只在内存、不落盘不上传。"
	keywords="JWT解码,JWT解析,token解码,JWT在线工具,Header Payload,JSON Web Token,JWT验签,HS256验签,RS256验签"
	path="/jwt-decoder"
	ogDescription="粘贴 JWT 即解出 Header 与 Payload，声明转本地时间；填入密钥可本地验签 HS/RS 六档，不上传。"
	width="full"
	fill="fill"
	fillFrom="lg"
>
	<Converter />
</ToolShell>
