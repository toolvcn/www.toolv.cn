// /dns 的编排层：地区档位 + 搜索词 → 筛选结果；命令面板的平台档位 + 针对哪一家。
// 数据是编译期常量（见 `dns.ts`），这里只做筛选、选择与计数，组件只负责渲染。
import { DNS_PROVIDERS, filterDnsProviders, type DnsProvider, type DnsRegionFilter } from './dns.ts';
import type { CommandPlatform } from './commands.ts';

class DnsStore {
	/** 地区档位：全部 / 国内 / 国外 */
	region = $state<DnsRegionFilter>('all');
	/** 搜索词：空格分隔的多个词要全部命中 */
	query = $state('');
	/** 命令面板选中的平台 */
	commandPlatform = $state<CommandPlatform>('windows');
	/** 命令面板针对哪一家（存 id 而不是对象：数据改了也不会指向一份过期副本） */
	commandTargetId = $state<string>(DNS_PROVIDERS[0].id);
	/**
	 * 命令面板里用户填的「接口 / 服务 / 连接名」，**按平台各存一份** ——
	 * 三个平台填的本来就是三个不同的名字（网卡名 / 网络服务名 / 连接名），
	 * 切平台时不该把上一个平台填的值带过去。
	 * 值为空串表示没填，生成命令时回落到该平台的样本值（见 `resolveInterfaceName`）。
	 */
	commandNames = $state<Record<CommandPlatform, string>>({ windows: '', macos: '', linux: '' });

	readonly results = $derived(filterDnsProviders(DNS_PROVIDERS, this.region, this.query));

	/**
	 * 命令面板要生成哪一家的命令。
	 * 与左侧筛选**互不影响**：筛掉了照样能给它生成命令（面板自己选目标，不跟着筛选走）。
	 */
	get commandTarget(): DnsProvider {
		return DNS_PROVIDERS.find((provider) => provider.id === this.commandTargetId) ?? DNS_PROVIDERS[0];
	}

	/** 当前平台填的那个名字；空串 = 没填，命令生成时回落到样本值 */
	get commandName(): string {
		return this.commandNames[this.commandPlatform];
	}

	/** 清单里的服务总数 */
	get total(): number {
		return DNS_PROVIDERS.length;
	}

	/** 当前是否处于「筛过」的状态 —— 决定空态文案与计数怎么念 */
	get filtered(): boolean {
		return this.region !== 'all' || this.query.trim() !== '';
	}

	/** 头部右侧与底栏共用的计数文案 */
	get countText(): string {
		if (this.results.length === 0) return '无结果';
		return this.filtered ? `${this.results.length} / ${this.total} 家` : `${this.total} 家`;
	}

	setRegion(region: DnsRegionFilter): void {
		this.region = region;
	}

	setQuery(value: string): void {
		this.query = value;
	}

	clearQuery(): void {
		this.query = '';
	}

	/** 一键回到未筛选状态（切回「全部」+ 清空搜索） */
	resetFilter(): void {
		this.region = 'all';
		this.query = '';
	}

	setCommandPlatform(platform: CommandPlatform): void {
		this.commandPlatform = platform;
	}

	setCommandTarget(id: string): void {
		this.commandTargetId = id;
	}

	/** 填名字：写进**当前平台**那一份（切平台后各留各的） */
	setCommandName(value: string): void {
		this.commandNames[this.commandPlatform] = value;
	}
}

export const dnsStore = new DnsStore();
