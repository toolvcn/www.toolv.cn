<script lang="ts">
	// 页面外壳 + SEO head，组装共用的命令速查组件（docker / git / linux 三个页面都是这一套）。
	import { onMount } from 'svelte';
	import { Container } from '@lucide/svelte';
	import CommandCheatsheet from '$lib/components/CommandCheatsheet/CommandCheatsheet.svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { parseCheatsheetPresets } from '$lib/utils/command-cheatsheet';
	import { PRESETS_STORAGE_KEY } from './config.ts';
	import { dockerStore } from './core/store.svelte.ts';
	import PresetPanel from './ui/PresetPanel.svelte';

	// 参数预设的本地持久化：挂载时恢复，之后任何改动自动写回。
	// restored 开关不能省：首帧预设还是空的，没有它就会先写一次空值，把上次存的覆盖掉。
	// 隐私模式下 localStorage 不可用，整个读写都包 try/catch 静默忽略。

	let restored = $state(false);

	onMount(() => {
		try {
			const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
			if (raw) {
				const parsed = parseCheatsheetPresets(raw);
				if (parsed.ok) dockerStore.restorePresets(parsed.presets);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, dockerStore.presetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={Container}
	name="Docker 命令速查"
	tagline="填容器名，示例命令自动替换"
	heading="Docker 命令速查"
	description="在线 Docker 常用命令速查表：容器、镜像、构建、网络、卷、日志排查、资源、清理与 Compose 九类常用命令按组列出，填一次容器 ID / 名称（可展开镜像、端口、卷、网络等变量），命令里的示例值自动替换，一键复制到终端即可执行；危险命令标注提醒，纯前端运行不执行任何命令、不上传任何数据。"
	keywords="docker命令,docker常用命令,docker命令速查,docker run,docker exec,docker logs,docker compose,docker 容器,docker 镜像,docker 清理,docker prune,docker 教程"
	path="/docker"
	ogDescription="九类 Docker 常用命令速查：填入容器 ID / 名称，示例命令自动替换，一键复制。"
	fill="fill"
	fillFrom="lg"
	docUrl="https://docs.docker.com/reference/cli/docker/"
	docLabel="Docker CLI 文档"
>
	<CommandCheatsheet
		store={dockerStore}
		namePrefix="Docker"
		heading="命令列表"
		searchPlaceholder="搜索：进入容器 / exec / 日志 / 端口 / 网络"
		varsHint="填一次，命令跟着变"
		footerHint="命令里加绿底的是你填的值，纯绿字是示例值；本页不执行任何命令，复制到终端里运行。"
	>
		{#snippet presets()}
			<PresetPanel />
		{/snippet}
	</CommandCheatsheet>
	<Toast />
</ToolShell>
