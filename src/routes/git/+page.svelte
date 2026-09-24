<script lang="ts">
	// 页面外壳 + SEO head，组装共用的命令速查组件（docker / git / linux 三个页面都是这一套）。
	import { onMount } from 'svelte';
	import { GitBranch } from '@lucide/svelte';
	import CommandCheatsheet from '$lib/components/CommandCheatsheet/CommandCheatsheet.svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { parseCheatsheetPresets } from '$lib/utils/command-cheatsheet';
	import { PRESETS_STORAGE_KEY } from './config.ts';
	import { gitStore } from './core/store.svelte.ts';
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
				if (parsed.ok) gitStore.restorePresets(parsed.presets);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, gitStore.presetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});
</script>

<ToolShell
	icon={GitBranch}
	name="Git 命令速查"
	tagline="填分支名，示例命令自动替换"
	heading="Git 命令速查"
	description="在线 Git 常用命令速查表：配置与克隆、暂存与提交、分支与合并、远程与同步、历史查看、撤销与回退、stash、标签发布、高级排错九类常用命令按组列出，填一次分支名（可展开远程、文件路径、提交引用等变量），命令里的示例值自动替换，一键复制到终端即可执行；rebase / 强制推送 / reset --hard 等危险命令标注提醒并说明代价，纯前端运行不执行任何命令、不上传任何数据。"
	keywords="git命令,git常用命令,git命令速查,git commit,git rebase,git reset,git stash,git revert,git cherry-pick,git 分支,git 撤销提交,git 回退版本,git 教程"
	path="/git"
	ogDescription="九类 Git 常用命令速查：填入分支名，示例命令自动替换，危险命令标注代价，一键复制。"
	fill="fill"
	fillFrom="lg"
	docUrl="https://git-scm.com/docs"
	docLabel="Git 官方文档"
>
	<CommandCheatsheet
		store={gitStore}
		namePrefix="Git"
		heading="命令列表"
		searchPlaceholder="搜索：提交 / rebase / 撤销 / stash / 冲突"
		varsHint="填一次，命令跟着变"
		footerHint="命令里加绿底的是你填的值，纯绿字是示例值；本页不执行任何命令，复制到自己的仓库里运行。"
	>
		{#snippet presets()}
			<PresetPanel />
		{/snippet}
	</CommandCheatsheet>
	<Toast />
</ToolShell>
