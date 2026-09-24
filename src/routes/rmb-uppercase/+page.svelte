<script lang="ts">
	import { Banknote } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Converter from './ui/Converter.svelte';
</script>

<ToolShell
	icon={Banknote}
	name="人民币大写"
	tagline="票据规范 · 实时转换 · 一键复制"
	description="在线人民币大写金额转换工具：数字金额一键转中文大写，按票据填写规范输出，支持千分位逗号、小数四舍五入与负数金额，纯本地运行。"
	keywords="人民币大写,金额大写转换,数字转中文大写,票据大写,财务工具,在线工具"
	path="/rmb-uppercase"
	ogDescription="数字金额一键转中文大写，按票据填写规范输出，纯本地运行。"
	width="full"
>
	<Converter />
</ToolShell>
