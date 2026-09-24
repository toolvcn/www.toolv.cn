<script lang="ts">
	import { Dices } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Dices}
	name="随机生成器"
	tagline="UUID · 密码 · 随机数 · 假文"
	description="在线随机生成器：UUID v4 批量生成、强随机密码（含熵强度估算）、随机数（去重 / 排序 / 小数位）与中英占位假文，crypto 加密级随机本地生成，不上传任何数据。"
	keywords="UUID 生成器,随机密码生成,随机数生成器,占位文本,Lorem Ipsum,在线工具"
	path="/generator"
	ogDescription="UUID v4、强随机密码、随机数、中英占位假文，加密级随机本地生成。"
	width="full"
>
	<Workspace />
</ToolShell>
