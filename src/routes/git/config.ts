// Git 命令速查的**可配置参数**：占位符（变量）定义 —— 键名、中文标签、默认示例值。
// 要改示例值（换成自己仓库常填的分支名 / 地址）、加一个新的占位符，改这里就够了。
//
// 为什么建这个文件（STRUCTURE §2 B 的门槛）：同一份定义被**两处**引用 ——
// ① `core/store.svelte.ts` 把它交给共享的 CheatsheetStore（取 `sample` 当初始值与留空时的回落值）；
// ② 变量条（`$lib/components/CommandCheatsheet/VarBar`）取 `label` / `hint` 渲染输入框，
//    并按 `secondary` 决定哪些收进「更多变量」。分开写迟早出现「改了示例值、输入框提示没变」。
//
// 边界（免得这个文件越长越杂）：
//   - 只放**占位符的数值与文案**。命令数据与分组在 `core/commands.ts`、类型在
//     `$lib/utils/command-cheatsheet`、界面样式在 `$lib/ui/styles` —— 都不进这里。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放工具根目录（不在 `core/` 下）：它是面向人的调参入口，跟 `+page.svelte` 同级最好找。

import type { CheatsheetVarDef } from '$lib/utils/command-cheatsheet';

/**
 * 全部占位符，顺序即「更多变量」里的渲染顺序。
 *
 * 第一个（`branch`）是主要变量，常驻工具条；其余 `secondary` 的收进「更多变量」折叠。
 * 示例值之间是**配合好的一套**：拿默认值直接跑，`git switch -c main`、
 * `git push -u origin main` 这类命令是完整可用的，不是各写各的占位符。
 */
export const VAR_DEFS: CheatsheetVarDef[] = [
	{
		key: 'branch',
		label: '分支名',
		sample: 'main',
		hint: '`git branch` 列出来的那个；新建分支时填你想要的名字'
	},
	{ key: 'remote', label: '远程名', sample: 'origin', hint: '`git remote -v` 第一列，默认叫 origin', secondary: true },
	{
		key: 'repo',
		label: '仓库地址',
		sample: 'https://github.com/toolvcn/www.toolv.cn.git',
		hint: 'clone / 加远程用；https 与 ssh 两种写法都行',
		secondary: true
	},
	{ key: 'file', label: '文件路径', sample: 'src/lib/tools.ts', hint: '仓库内的相对路径', secondary: true },
	{
		key: 'commit',
		label: '提交引用',
		sample: '31d037b',
		hint: '提交哈希 / HEAD~1 / 标签名都能填',
		secondary: true
	},
	{ key: 'tag', label: '标签名', sample: 'v1.0.0', hint: '版本标签的写法，通常带 `v` 前缀', secondary: true },
	{ key: 'msg', label: '提交信息', sample: 'fix(tools): 修首页卡片间距', hint: '`-m` 后面那句话', secondary: true },
	{ key: 'user', label: '用户名', sample: 'wuqing', hint: '提交记录里显示的名字（`user.name`）', secondary: true },
	{
		key: 'email',
		label: '邮箱',
		sample: 'wuqing@example.com',
		hint: '提交记录里的邮箱（`user.email`）',
		secondary: true
	},
	{ key: 'dir', label: '检出目录', sample: '../www.toolv.cn', hint: 'clone / worktree 的目标目录', secondary: true }
];

/**
 * 参数预设的 localStorage 键。
 *
 * 持久化本身在 `+page.svelte`（全局副作用只写在那里，STRUCTURE §2）—— 这里只定义键名，
 * 免得它散在页面里。（预设面板的其余逻辑在共享的 CheatsheetStore 与 $lib/components/PresetPanel。）
 */
export const PRESETS_STORAGE_KEY = 'toolv:git-presets';
