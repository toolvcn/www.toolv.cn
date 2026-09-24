// 换 DNS 命令生成的单测，跑在 vitest 的 server project（node 环境）。
//
// 命令是**给人粘进终端**的，拼错了不会报错、只会让用户在自己的机器上失败 —— 所以这里逐条断言：
// 地址有没有原样带上、Windows 是不是逗号分隔、*nix 是不是空格分隔、每个平台有没有「查名字」与「还原」。
import { describe, expect, it } from 'vitest';
import { buildCommands, PLATFORMS, PLATFORM_META, resolveInterfaceName, type CommandPlatform } from './commands.ts';
import { DNS_PROVIDERS, type DnsProvider } from './dns.ts';

function providerOf(id: string): DnsProvider {
	const found = DNS_PROVIDERS.find((item) => item.id === id);
	expect(found, `清单里没有「${id}」`).toBeDefined();
	return found as DnsProvider;
}

const ALL_PLATFORMS: CommandPlatform[] = ['windows', 'macos', 'linux'];

describe('三个平台都能生成命令', () => {
	for (const { value, label } of PLATFORMS) {
		it(`${label}：有设置、也有还原，且没有空命令`, () => {
			const lines = buildCommands(value, providerOf('alidns'));
			expect(lines.length).toBeGreaterThanOrEqual(3);
			for (const line of lines) {
				expect(line.label, '每行都要有步骤名').not.toBe('');
				expect(line.command.trim(), `${line.label} 的命令是空的`).not.toBe('');
				expect(line.command, '命令里不该出现换行（复制出去会断）').not.toContain('\n');
			}
			// 必须能还原：不给还原命令，用户不敢动全局 DNS
			expect(lines.some((line) => line.label.includes('还原'))).toBe(true);
			// 必须能查「那个名字」：接口/服务/连接名各机器不同
			expect(lines[0]?.label).toContain('①');
		});
	}

	it('PLATFORMS 与 PLATFORM_META 一一对应（漏一个界面就少一档）', () => {
		expect(PLATFORMS.map((item) => item.value)).toEqual(ALL_PLATFORMS);
		for (const { value } of PLATFORMS) {
			expect(PLATFORM_META[value].sample, `${value} 没有回落用的样本名`).not.toBe('');
			expect(PLATFORM_META[value].nameLabel, `${value} 没有名字输入框的标签`).not.toBe('');
			expect(PLATFORM_META[value].hint, `${value} 没有提示`).not.toBe('');
		}
	});
});

describe('接口 / 服务 / 连接名', () => {
	it('输入框留空或只有空白 → 回落到样本值（命令随时可复制即用）', () => {
		for (const platform of ALL_PLATFORMS) {
			expect(resolveInterfaceName(platform, '')).toBe(PLATFORM_META[platform].sample);
			expect(resolveInterfaceName(platform, '   ')).toBe(PLATFORM_META[platform].sample);
		}
	});

	it('Windows 的样本值是本地化后的中文网卡名（写死 Wi-Fi 在中文系统上必然失败）', () => {
		expect(PLATFORM_META.windows.sample).toBe('WLAN');
	});

	it('②③ 用的是同一个名字：没填用样本、填了用填的那个', () => {
		const useName = (lines: ReturnType<typeof buildCommands>) => lines.filter((line) => /^[②③]/.test(line.label));

		for (const platform of ALL_PLATFORMS) {
			const lines = useName(buildCommands(platform, providerOf('alidns')));
			expect(lines.length, `${platform} 缺设置或还原`).toBe(2);
			for (const line of lines) {
				expect(line.command, `${platform} 的「${line.label}」没带名字`).toContain(PLATFORM_META[platform].sample);
			}
		}

		const windows = useName(buildCommands('windows', providerOf('alidns'), '以太网'));
		for (const line of windows) expect(line.command).toContain('以太网');
		for (const line of windows) expect(line.command).not.toContain('WLAN');
	});

	it('名字本身带空格时用引号包住（macOS 的 USB 10/100/1000 LAN 就是这种）', () => {
		for (const platform of ALL_PLATFORMS) {
			const set = buildCommands(platform, providerOf('alidns'), 'USB 10/100/1000 LAN').find((line) =>
				line.label.includes('设置')
			);
			expect(set?.command, `${platform} 没给带空格的名字加引号`).toContain('"USB 10/100/1000 LAN"');
		}
	});
});

describe('地址带进命令里', () => {
	it('主备两条都带上，Windows 用逗号分隔', () => {
		const set = buildCommands('windows', providerOf('alidns')).find((line) => line.label.includes('设置'));
		expect(set?.command).toContain('223.5.5.5,223.6.6.6');
		expect(set?.command).not.toContain('223.5.5.5 223.6.6.6');
	});

	it('macOS / Linux 用空格分隔', () => {
		for (const platform of ['macos', 'linux'] as const) {
			const set = buildCommands(platform, providerOf('alidns')).find((line) => line.label.includes('设置'));
			expect(set?.command, `${platform} 的地址没有空格分隔`).toContain('223.5.5.5 223.6.6.6');
		}
	});

	it('只有一条 IPv4 的服务也正常（百度只有一个地址）', () => {
		const set = buildCommands('windows', providerOf('baidu')).find((line) => line.label.includes('设置'));
		expect(set?.command).toContain('180.76.76.76');
		expect(set?.command).not.toContain(',');
	});

	it('每一家的「设置」命令都带上了主 IPv4（不会漏拼地址）', () => {
		for (const provider of DNS_PROVIDERS) {
			const primary = provider.ipv4[0];
			if (primary === undefined) continue; // 没有 IPv4 的走下面那条用例
			for (const platform of ALL_PLATFORMS) {
				// 只查「设置」那一步：查名字的不需要地址，还原的（-ResetServerAddresses / Empty / 置空）不该有地址
				const setLines = buildCommands(platform, provider).filter((line) => line.label.includes('设置'));
				expect(setLines.length, `${provider.id} / ${platform} 没有设置命令`).toBeGreaterThan(0);
				for (const line of setLines) {
					expect(line.command, `${provider.id} / ${platform} 的「${line.label}」没带地址`).toContain(primary);
				}
			}
		}
	});

	it('「还原」命令不带地址（是清空 / Empty / Reset，不是设成别家）', () => {
		for (const platform of ALL_PLATFORMS) {
			const restore = buildCommands(platform, providerOf('alidns')).filter((line) => line.label.includes('还原'));
			expect(restore.length, `${platform} 没有还原命令`).toBeGreaterThan(0);
			for (const line of restore) expect(line.command).not.toContain('223.5.5.5');
		}
	});

	it('没有 IPv4 的服务不给命令（宁可空着，不拼半条）', () => {
		const noIpv4: DnsProvider = { ...providerOf('alidns'), id: 'x', name: 'X', ipv4: [] };
		for (const platform of ALL_PLATFORMS) expect(buildCommands(platform, noIpv4)).toEqual([]);
	});
});

describe('各平台的坑写进了提示', () => {
	it('Windows 提示管理员与本地化网卡名，macOS 提示 sudo 与服务名不是 en0', () => {
		expect(PLATFORM_META.windows.hint).toContain('管理员');
		expect(PLATFORM_META.windows.hint).toContain('WLAN');
		expect(PLATFORM_META.macos.hint).toContain('sudo');
		expect(PLATFORM_META.macos.hint).toContain('en0');
	});

	it('Linux 提示两条路线各自的效果（持久 / 重启就丢）', () => {
		expect(PLATFORM_META.linux.hint).toContain('NetworkManager');
		expect(PLATFORM_META.linux.hint).toContain('systemd-resolved');
		const labels = buildCommands('linux', providerOf('alidns')).map((line) => line.label);
		expect(labels.some((label) => label.includes('重启仍在'))).toBe(true);
		expect(labels.some((label) => label.includes('就丢'))).toBe(true);
	});
});
