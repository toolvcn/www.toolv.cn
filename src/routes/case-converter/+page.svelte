<script lang="ts">
	import { CaseSensitive } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Converter from './ui/Converter.svelte';
</script>

<ToolShell
	icon={CaseSensitive}
	name="命名风格转换"
	tagline="七种命名风格 · 自动分词 · 缩写识别"
	description="在线命名风格转换工具：camelCase、PascalCase、snake_case、kebab-case、CONSTANT_CASE 等互转，自动分词识别缩写，纯本地运行。"
	keywords="命名风格转换,驼峰转换,camelCase,snake_case,kebab-case,PascalCase,命名规范,在线工具"
	path="/case-converter"
	ogDescription="camel / snake / kebab / Pascal / 常量等七种命名风格互转，自动分词，纯本地运行。"
	width="full"
	fill="fill"
>
	<Converter />
</ToolShell>
