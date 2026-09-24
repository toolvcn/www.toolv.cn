<script lang="ts">
	import { Radio } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Radio}
	name="摩斯密码速查与加解密"
	tagline="点划速查 · 双向编解码 · 自动分词"
	description="在线摩斯密码工具：A-Z / 0-9 / 标点对照速查表（点一行直接插到输入框），文本与摩斯密码双向实时转换，缺分隔符的不规范摩斯按最长匹配自动分词；点、划与字母 / 词分隔符都能改，编解码全程在浏览器里完成，不上传任何数据。"
	keywords="摩斯密码,摩斯电码,Morse code,摩斯密码翻译,摩斯密码对照表,摩斯密码解码,SOS,自动分词,在线工具"
	path="/morse"
	ogDescription="摩斯密码速查与双向编解码：自动分词处理不规范摩斯，点划与分隔符可自定义，纯本地运行。"
	width="full"
	fill="fill"
>
	<Workspace />
</ToolShell>
