// Linux 命令速查的**可配置参数**：占位符（变量）定义 —— 键名、中文标签、默认示例值。
// 要改示例值（换成自己机器上的路径 / 服务名）、加一个新的占位符，改这里就够了。
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
 * 第一个（`path`）是主要变量，常驻工具条；其余 `secondary` 的收进「更多变量」折叠。
 * 示例值之间是**配合好的一套**：拿默认值直接跑，`ls -alh /var/log`、
 * `grep -rn "error" /var/log` 这类命令是完整可用的，不是各写各的占位符。
 */
export const VAR_DEFS: CheatsheetVarDef[] = [
	{
		key: 'path',
		label: '目标路径',
		sample: '/var/log',
		hint: '目录或文件的绝对 / 相对路径都行'
	},
	{ key: 'file', label: '文件名', sample: 'app.log', hint: '已定位到具体文件时填这个', secondary: true },
	{
		key: 'pattern',
		label: '关键词 / 模式',
		sample: 'error',
		hint: 'grep 找的词、find 匹配的名字片段、pkill 匹配的命令行',
		secondary: true
	},
	{ key: 'port', label: '端口', sample: '8080', hint: '被占用的那个端口号', secondary: true },
	{
		key: 'host',
		label: '主机 / 域名',
		sample: '192.168.1.10',
		hint: 'IP 或域名；远程命令里的那一截',
		secondary: true
	},
	{ key: 'user', label: '用户', sample: 'deploy', hint: '登录名 / 属主名', secondary: true },
	{ key: 'service', label: '服务名', sample: 'nginx', hint: 'systemctl 里的单元名，不带 .service', secondary: true },
	{ key: 'src', label: '源路径', sample: '/srv/app', hint: '复制 / 打包 / 传输的起点', secondary: true },
	{ key: 'archive', label: '压缩包名', sample: 'backup.tar.gz', hint: '打包产物的名字与后缀', secondary: true },
	{ key: 'days', label: '天数', sample: '7', hint: '按修改时间筛选时用（`-mtime +7` 是 7 天以前）', secondary: true },
	{ key: 'pid', label: '进程号', sample: '12345', hint: '`ps aux` 第二列那个 PID', secondary: true }
];

/**
 * 参数预设的 localStorage 键。
 *
 * 持久化本身在 `+page.svelte`（全局副作用只写在那里，STRUCTURE §2）—— 这里只定义键名，
 * 免得它散在页面里。（预设面板的其余逻辑在共享的 CheatsheetStore 与 $lib/components/PresetPanel。）
 */
export const PRESETS_STORAGE_KEY = 'toolv:linux-presets';
