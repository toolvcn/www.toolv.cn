// 各平台「换 DNS」命令的生成：纯字符串拼接，喂进去的是某家的 IPv4 列表与用户填的那个名字。
//
// 三条口径（与 `$lib/utils/command-cheatsheet` 一致：给**可直接粘进终端的真命令**，不是占位符）：
//   1. 接口 / 服务 / 连接名**由面板的输入框填，留空回落到各平台的样本值**（见 `resolveInterfaceName`）。
//      早先把名字写死成 `Wi-Fi`：那是网卡的**本地化显示名**，中文 Windows 上叫 `WLAN`、有线叫 `以太网`，
//      于是默认状态下命令在多数中文机器上直接报「找不到适配器」。名字这步没法自动化（各机器不同），
//      但写死会逼着用户手改命令文本（引号很容易改坏），所以改成填一次、②③ 一起更新。
//   2. **每个平台都配一条「查名字」和一条「还原」**：不给还原，用户不敢动全局 DNS。
//   3. Linux 没有统一命令，所以给了两条路线（NetworkManager 持久 / systemd-resolved 临时），
//      各自的效果与代价都写进 label，不靠正文解释。
import type { DnsProvider } from './dns.ts';

export type CommandPlatform = 'windows' | 'macos' | 'linux';

/** 一行命令：label 既是步骤名，也当复制按钮的无障碍名 */
export interface CommandLine {
	label: string;
	command: string;
}

/** 平台顺序即界面展示顺序；文案给 SegmentedControl 用 */
export const PLATFORMS: readonly { value: CommandPlatform; label: string }[] = [
	{ value: 'windows', label: 'Windows' },
	{ value: 'macos', label: 'macOS' },
	{ value: 'linux', label: 'Linux' }
];

/**
 * 各平台那个名字的称呼（输入框的标签）、留空回落的样本值、以及有哪些坑。
 * 样本值是**给中文用户挑的最常见值**：Windows 的网卡名按语言包本地化（中文无线 `WLAN`、有线 `以太网`）。
 */
export const PLATFORM_META: Record<CommandPlatform, { nameLabel: string; sample: string; hint: string }> = {
	windows: {
		nameLabel: '网卡名',
		sample: 'WLAN',
		hint: '两条都要在「以管理员身份运行」的 PowerShell 里跑。网卡名是本地化显示名（中文无线通常是 "WLAN"、有线是 "以太网"），先跑 ① 看清楚，再把名字填进输入框。'
	},
	macos: {
		nameLabel: '网络服务名',
		sample: 'Wi-Fi',
		hint: '要加 sudo。填的是网络服务名（不是网卡名 en0，常见值有 Wi-Fi / Ethernet / USB 10/100/1000 LAN），先跑 ① 看清楚再填。'
	},
	linux: {
		nameLabel: '连接名',
		sample: 'Wired connection 1',
		hint: 'Linux 没有统一命令：② 走 NetworkManager（多数桌面发行版，重启仍在），④ 是 systemd-resolved 的临时改法（重启或换网就丢）。②③ 用上面的连接名，④ 的 wlan0 要换成接口名——都先跑 ① 看清楚。'
	}
};

/**
 * 命令里实际用的那个名字：输入框留空（或只有空白）就回落到该平台的样本值。
 *
 * 为什么不留空：留空会拼出 `-InterfaceAlias ""`，粘进终端只会报「找不到适配器」；
 * 回落样本值则保证任何一条命令随时可复制即用（与命令速查工具的 `resolveVars` 同一口径）。
 */
export function resolveInterfaceName(platform: CommandPlatform, raw: string): string {
	const value = raw.trim();
	return value === '' ? PLATFORM_META[platform].sample : value;
}

/**
 * 生成某平台把 DNS 设成某一家、以及还原的命令。
 * 这家没有 IPv4（当前清单里不存在，但数据可能变）时返回空数组，界面据此不给命令而不是拼出半条。
 *
 * `rawName` 是用户在输入框里填的接口 / 服务 / 连接名，留空回落到样本值（见 `resolveInterfaceName`）。
 */
export function buildCommands(platform: CommandPlatform, provider: DnsProvider, rawName = ''): CommandLine[] {
	const ips = provider.ipv4;
	if (ips.length === 0) return [];
	// Windows 的 -ServerAddresses 收逗号分隔；*nix 的命令都收空格分隔
	const list = ips.join(platform === 'windows' ? ',' : ' ');
	// 名字按原样写进命令（带空格的值靠外面的引号包住），不转义 —— 用户填的就是终端里的那个名字
	const name = resolveInterfaceName(platform, rawName);

	if (platform === 'windows') {
		return [
			{ label: '① 查网卡名', command: 'Get-NetAdapter' },
			{
				label: '② 设置（管理员）',
				command: `Set-DnsClientServerAddress -InterfaceAlias "${name}" -ServerAddresses ${list}`
			},
			{
				label: '③ 还原为自动获取',
				command: `Set-DnsClientServerAddress -InterfaceAlias "${name}" -ResetServerAddresses`
			}
		];
	}

	if (platform === 'macos') {
		return [
			{ label: '① 查网络服务名', command: 'networksetup -listallnetworkservices' },
			// 服务名要带引号：常见值 `USB 10/100/1000 LAN` 本身有空格，不带引号就散成好几个参数
			{ label: '② 设置', command: `sudo networksetup -setdnsservers "${name}" ${list}` },
			{ label: '③ 还原为自动', command: `sudo networksetup -setdnsservers "${name}" Empty` }
		];
	}

	return [
		{ label: '① 查连接名与类型', command: 'nmcli -t -f NAME,TYPE con show --active' },
		{
			label: '② 设置（NetworkManager，重启仍在）',
			command: `nmcli con mod "${name}" ipv4.dns "${list}" && nmcli con up "${name}"`
		},
		{
			label: '③ 还原为自动（NetworkManager）',
			command: `nmcli con mod "${name}" ipv4.dns "" && nmcli con up "${name}"`
		},
		{ label: '④ 或者 systemd-resolved（立即生效，重启或换网就丢）', command: `sudo resolvectl dns wlan0 ${list}` }
	];
}
