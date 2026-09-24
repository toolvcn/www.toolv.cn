<script module lang="ts">
	// 通用组件必须配 story（AGENTS §10）。这里用一小份内联数据当样本，
	// 覆盖到四种呈现：featured、备选写法 chips、危险标记、带 note 的坑。
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { CheatsheetCommand, CheatsheetGroup, CheatsheetVarDef } from '$lib/utils/command-cheatsheet';
	import CommandCheatsheet from './CommandCheatsheet.svelte';
	import { CheatsheetStore } from './cheatsheet.svelte.ts';

	const GROUPS: CheatsheetGroup[] = [
		{ id: 'container', name: '容器' },
		{ id: 'clean', name: '清理' }
	];

	const VAR_DEFS: CheatsheetVarDef[] = [
		{ key: 'container', label: '容器 ID / 名称', sample: 'my-nginx', hint: '`docker ps` 第一列那个值' },
		{ key: 'image', label: '镜像', sample: 'nginx:1.27', secondary: true },
		{ key: 'volume', label: '卷名', sample: 'app-data', secondary: true }
	];

	const COMMANDS: CheatsheetCommand[] = [
		{
			id: 'c-exec',
			group: 'container',
			template: 'docker exec -it {{container}} /bin/bash',
			desc: '进入正在运行的容器，开一个交互式 shell',
			keywords: ['进入容器', 'exec', 'bash'],
			featured: true,
			variants: [{ label: '/bin/sh', template: 'docker exec -it {{container}} /bin/sh' }],
			note: '容器必须是**运行中**的；精简镜像没有 bash，用 `/bin/sh`'
		},
		{
			id: 'c-run',
			group: 'container',
			template: 'docker run -d --name web -v {{volume}}:/app {{image}}',
			desc: '后台跑一个容器并把命名卷挂进去',
			keywords: ['启动容器', 'run', '挂载'],
			featured: true
		},
		{
			id: 'k-rm',
			group: 'clean',
			template: 'docker rm -f {{container}}',
			desc: '强制删除容器（运行中的也删）',
			keywords: ['删除容器', 'rm', '强制'],
			danger: 'destructive',
			note: '没挂出来的数据会一起消失'
		},
		{
			id: 'k-prune',
			group: 'clean',
			template: 'docker system prune -f',
			desc: '一次清掉已停止的容器、悬空镜像、未使用网络与构建缓存',
			keywords: ['清理', 'prune', '释放空间'],
			danger: 'warn',
			note: '默认不动卷；加 `--volumes` 才会删未使用的卷'
		}
	];

	const baseStore = new CheatsheetStore(COMMANDS, GROUPS, VAR_DEFS);
	// 第二个实例演示「切到某个分组 + 展开更多变量」的样子
	const scopedStore = new CheatsheetStore(COMMANDS, GROUPS, VAR_DEFS);
	scopedStore.setFilter('clean');
	scopedStore.toggleMoreVars();
	// 第三个实例演示「用户填过值」的上色：填过的加绿底、没填的仍是纯绿字
	const filledStore = new CheatsheetStore(COMMANDS, GROUPS, VAR_DEFS);
	filledStore.setVar('container', 'web-prod');

	const { Story } = defineMeta({
		title: 'Components/CommandCheatsheet',
		component: CommandCheatsheet
	});
</script>

<!-- 满屏那一档要求**父级有确定高度**（真实页面由 ToolShell 的 `lg:h-dvh` 给），
     Storybook 画布是 auto 高度，不给的话 `lg:flex-1` 拿不到「剩余高度」、命令列表会一路撑开。
     所以三档 story 都套一层定高容器：小屏档不受影响（列表仍是 60vh 封顶）。 -->
{#snippet template()}
	<div class="flex h-[85vh] min-h-0 flex-col">
		<CommandCheatsheet
			store={baseStore}
			namePrefix="Docker"
			heading="命令列表"
			searchPlaceholder="搜索：进入容器 / exec / 日志"
			varsHint="填一次，命令跟着变"
			footerHint="加绿底的是你填的值，纯绿字是示例值；复制后到自己的终端里运行。"
		/>
	</div>
{/snippet}

{#snippet scoped()}
	<div class="flex h-[85vh] min-h-0 flex-col">
		<CommandCheatsheet
			store={scopedStore}
			namePrefix="Docker"
			heading="命令列表"
			searchPlaceholder="搜索：进入容器 / exec / 日志"
			varsHint="切到「清理」分组、并展开了更多变量"
			footerHint="加绿底的是你填的值，纯绿字是示例值；复制后到自己的终端里运行。"
		/>
	</div>
{/snippet}

{#snippet filled()}
	<div class="flex h-[85vh] min-h-0 flex-col">
		<CommandCheatsheet
			store={filledStore}
			namePrefix="Docker"
			heading="命令列表"
			searchPlaceholder="搜索：进入容器 / exec / 日志"
			varsHint="填了容器名：填过的值加绿底、没填的仍是示例值"
			footerHint="加绿底的是你填的值，纯绿字是示例值；复制后到自己的终端里运行。"
		/>
	</div>
{/snippet}

<Story name="Default" {template} />
<Story name="分组与更多变量" template={scoped} />
<Story name="已填变量高亮" template={filled} />
