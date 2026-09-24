// Docker 命令速查的**可配置参数**：占位符（变量）定义 —— 键名、中文标签、默认示例值。
// 要改示例值（换成自己常用的容器名 / 镜像）、加一个新的占位符，改这里就够了。
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
 * 第一个（`container`）是主要变量，常驻工具条；其余 `secondary` 的收进「更多变量」折叠。
 * 示例值之间是**配合好的一套**：拿默认值直接跑，`docker run -d --name web -p 8080:80 nginx:1.27`
 * 这类命令是完整可用的，不是各写各的占位符。
 */
export const VAR_DEFS: CheatsheetVarDef[] = [
	{
		key: 'container',
		label: '容器 ID / 名称',
		sample: 'my-nginx',
		hint: '`docker ps` 第一列那个值，名称和 ID 都认'
	},
	{ key: 'name', label: '容器名', sample: 'web', hint: '`--name` 给容器起的名字', secondary: true },
	{ key: 'image', label: '镜像', sample: 'nginx:1.27', hint: '仓库名:标签，不写标签默认 latest', secondary: true },
	{ key: 'port', label: '端口映射', sample: '8080:80', hint: '宿主端口:容器端口', secondary: true },
	{
		key: 'repo',
		label: '镜像仓库地址',
		sample: 'registry.example.com/app',
		hint: '推拉镜像用，含仓库前缀',
		secondary: true
	},
	{ key: 'volume', label: '卷名', sample: 'app-data', hint: '`docker volume ls` 里那个名字', secondary: true },
	{ key: 'network', label: '网络名', sample: 'app-net', hint: '自定义桥接网络的名字', secondary: true },
	{ key: 'hostPath', label: '宿主目录', sample: '/srv/app', hint: '绑定挂载时宿主机的绝对路径', secondary: true },
	{ key: 'containerPath', label: '容器内路径', sample: '/app', hint: '容器里的绝对路径', secondary: true },
	{ key: 'env', label: '环境变量', sample: 'TZ=Asia/Shanghai', hint: '`KEY=值`，多个用 `-e` 继续追加', secondary: true }
];

/**
 * 参数预设的 localStorage 键。
 *
 * 持久化本身在 `+page.svelte`（全局副作用只写在那里，STRUCTURE §2）—— 这里只定义键名，
 * 免得它散在页面里。（预设面板的其余逻辑在共享的 CheatsheetStore 与 $lib/components/PresetPanel。）
 */
export const PRESETS_STORAGE_KEY = 'toolv:docker-presets';
