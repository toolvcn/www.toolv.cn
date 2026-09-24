<script lang="ts">
	import { Diff } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Compare from './ui/Compare.svelte';
</script>

<ToolShell
	icon={Diff}
	name="文本对比"
	tagline="行级 diff · 并排 / 合并 · 实时对比"
	description="在线文本对比工具：左右两栏粘贴文本，实时高亮新增、删除与未变的行，支持并排与合并两种视图，可忽略大小写、行首尾空白与空行，全程本地处理。"
	keywords="文本对比,文本差异,文本比对,在线diff,代码对比,行级diff,配置文件对比,在线工具"
	path="/text-diff"
	ogDescription="左右两栏逐行对比文本，新增与删除实时高亮，并排 / 合并两种视图，纯本地运行。"
	width="full"
	fill="fill"
>
	<Compare />
</ToolShell>
