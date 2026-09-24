<script lang="ts">
	// 页面外壳 + SEO head，组装共用的命令速查组件（docker / git / linux 三个页面都是这一套）。
	import { onMount } from 'svelte';
	import { SquareTerminal } from '@lucide/svelte';
	import CommandCheatsheet from '$lib/components/CommandCheatsheet/CommandCheatsheet.svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { parseCheatsheetPresets } from '$lib/utils/command-cheatsheet';
	import { PRESETS_STORAGE_KEY } from './config.ts';
	import { linuxStore } from './core/store.svelte.ts';
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
				if (parsed.ok) linuxStore.restorePresets(parsed.presets);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, linuxStore.presetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={SquareTerminal}
	name="Linux 命令速查"
	tagline="填路径与文件，示例命令自动替换"
	heading="Linux 命令速查"
	description="在线 Linux 常用命令速查表：文件与目录、查找与搜索、查看与编辑、文本处理、权限与属主、进程与作业、系统与资源、网络与传输、压缩与归档九类常用命令按组列出，填一次路径（可展开文件名、关键词、端口、服务名、进程号等变量），命令里的示例值自动替换，一键复制到终端即可执行；rm -rf / find -delete / sed -i 等危险命令标注提醒并说明代价，纯前端运行不执行任何命令、不上传任何数据。"
	keywords="linux命令,linux常用命令,linux命令速查,linux 教程,chmod,chown,grep,find,sed,awk,tar 解压,ss 端口,ps 进程,tar linux,linux 磁盘空间"
	path="/linux"
	ogDescription="九类 Linux 常用命令速查：填入路径与文件名，示例命令自动替换，危险命令标注代价，一键复制。"
	fill="fill"
	fillFrom="lg"
	docUrl="https://www.gnu.org/software/coreutils/manual/coreutils.html"
	docLabel="GNU coreutils 手册"
>
	<CommandCheatsheet
		store={linuxStore}
		namePrefix="Linux"
		heading="命令列表"
		searchPlaceholder="搜索：端口占用 / 解压 / 权限 / 磁盘满了 / 日志"
		varsHint="填一次，命令跟着变"
		footerHint="命令里加绿底的是你填的值，纯绿字是示例值；本页不执行任何命令，复制到自己的终端里运行。"
	>
		{#snippet presets()}
			<PresetPanel />
		{/snippet}
	</CommandCheatsheet>
	<Toast />
</ToolShell>
