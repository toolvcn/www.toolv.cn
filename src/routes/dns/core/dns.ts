// 公共 DNS 服务的静态清单与纯筛选函数。
//
// 这一页**只做查阅与复制，不做查询也不做测速** —— 延迟测速与 DoH 解析都要跨域发请求
// （需要服务端代发），与首页「数据本地处理」的承诺冲突，见 README 的红线第 2 条。
// 所以数据是编译期就定下来的常量，筛选只影响渲染。
//
// 数据取舍：
//   * 只收**厂商自建**的公共递归服务，不收各省运营商自动下发的 DNS（那是按省份分配的，
//     本机自动获取的通常更快，列出来只会误导）。
//   * 地址来自各厂商公开文档与公开汇总；这类数据会变，**配置前建议再核对一次官网**。
//   * 拿不准的字段留空（不猜）—— 界面上渲染成「—」，比写一个错地址好。

/** 国内 / 国外两档；分档只为筛选方便，不代表线路质量 */
export type DnsRegion = 'cn' | 'global';

/** 筛选用的地区档位：全部 / 国内 / 国外 */
export type DnsRegionFilter = 'all' | DnsRegion;

/** 一条可复制的地址属于哪一类 */
export type DnsAddressKind = 'IPv4' | 'IPv6' | 'DoH' | 'DoT';

/** 一个公共 DNS 服务 */
export interface DnsProvider {
	/** 稳定 id（keyed each 与单测取件都用它） */
	id: string;
	/** 展示名 */
	name: string;
	/**
	 * 官方**服务说明 / 配置页**——优先指到「列出了服务地址与怎么配」的那一页，而不是厂商首页；
	 * 只有确实找不到专门页时才退回产品首页（如 DNSPod）。
	 *
	 * **查不到官方产品页的留空串**（如 CNNIC SDNS、中科大，以及两个资料太旧的商用解析），
	 * 界面上就显示「官网未知」——不编一个像官网的地址。
	 */
	site: string;
	region: DnsRegion;
	/** 运营方与特点，一句话 */
	note: string;
	/** 主 / 备 IPv4 地址，没有给空数组 */
	ipv4: readonly string[];
	/** IPv6 地址，没有给空数组 */
	ipv6: readonly string[];
	/** DoH 端点（完整 URL），没有给空串 */
	doh: string;
	/** DoT 主机名，没有给空串 */
	dot: string;
}

/** 渲染出来的一行可复制地址 */
export interface DnsAddress {
	kind: DnsAddressKind;
	value: string;
}

/** 地区的中文名，界面与搜索都用它 */
export const REGION_LABEL: Record<DnsRegion, string> = {
	cn: '国内',
	global: '国外'
};

export const DNS_PROVIDERS: readonly DnsProvider[] = [
	{
		id: 'alidns',
		name: '阿里云公共 DNS',
		site: 'https://www.alidns.com/',
		region: 'cn',
		note: '阿里云提供，国内连通性好；免费版对单个 IP 限速（约 20 QPS）',
		ipv4: ['223.5.5.5', '223.6.6.6'],
		ipv6: ['2400:3200::1', '2400:3200:baba::1'],
		doh: 'https://dns.alidns.com/dns-query',
		dot: 'dns.alidns.com'
	},
	{
		id: 'dnspod',
		name: '腾讯 DNSPod',
		site: 'https://www.dnspod.cn/',
		region: 'cn',
		note: '腾讯 DNSPod 提供，BGP Anycast 加 ECS 精准调度，海外也能用',
		ipv4: ['119.29.29.29', '119.28.28.28'],
		ipv6: ['2402:4e00::'],
		doh: 'https://doh.pub/dns-query',
		dot: 'dot.pub'
	},
	{
		id: 'dns114',
		name: '114DNS',
		site: 'https://www.114dns.com/',
		region: 'cn',
		note: '南京信风提供的老牌公共 DNS，只有 IPv4',
		ipv4: ['114.114.114.114', '114.114.115.115'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'dns114-safe',
		name: '114DNS 安全版',
		site: 'https://www.114dns.com/',
		region: 'cn',
		note: '在上面那组的基础上拦截钓鱼 / 木马 / 恶意网站',
		ipv4: ['114.114.114.119', '114.114.115.119'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'dns114-family',
		name: '114DNS 家庭版',
		site: 'https://www.114dns.com/',
		region: 'cn',
		note: '在安全版基础上再拦成人内容，给家长控制用',
		ipv4: ['114.114.114.110', '114.114.115.110'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'baidu',
		name: '百度 DNS',
		site: 'https://dudns.baidu.com/',
		region: 'cn',
		note: '百度提供，只有一组 IPv4；IPv6 一组已停用',
		ipv4: ['180.76.76.76'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'dns360',
		name: '360 安全 DNS',
		site: 'https://sdns.360.net/dnsPublic.html',
		region: 'cn',
		note: '按线路分：电信 / 移动 / 铁通用第一组，联通用第二组',
		ipv4: ['101.226.4.6', '123.125.81.6'],
		ipv6: [],
		doh: 'https://doh.360.cn/dns-query',
		dot: 'dot.360.cn'
	},
	{
		id: 'cnnic',
		name: 'CNNIC SDNS',
		site: '',
		region: 'cn',
		note: '中国互联网信息中心提供；IPv6 一组已停用',
		ipv4: ['1.2.4.8', '210.2.4.8'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'tuna',
		name: '清华大学 TUNA',
		site: 'https://tuna.moe/help/dns/',
		region: 'cn',
		note: '教育网出口，校内与教育网内访问最快',
		ipv4: ['101.6.6.6'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'ustc',
		name: '中国科学技术大学',
		site: '',
		region: 'cn',
		note: '按线路分三组：电信 / 移动 / 教育网，选自己宽带对应的那条',
		ipv4: ['202.141.162.123', '202.141.176.93', '202.38.93.153'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'google',
		name: 'Google Public DNS',
		site: 'https://developers.google.com/speed/public-dns/docs/using',
		region: 'global',
		note: 'Google 提供，全球覆盖最广；国内访问常被干扰',
		ipv4: ['8.8.8.8', '8.8.4.4'],
		ipv6: ['2001:4860:4860::8888', '2001:4860:4860::8844'],
		doh: 'https://dns.google/dns-query',
		dot: 'dns.google'
	},
	{
		id: 'cloudflare',
		name: 'Cloudflare 1.1.1.1',
		site: 'https://one.one.one.one/',
		region: 'global',
		note: 'Cloudflare 提供，主打隐私：承诺不记录查询日志并接受第三方审计',
		ipv4: ['1.1.1.1', '1.0.0.1'],
		ipv6: ['2606:4700:4700::1111', '2606:4700:4700::1001'],
		doh: 'https://cloudflare-dns.com/dns-query',
		dot: 'one.one.one.one'
	},
	{
		id: 'quad9',
		name: 'Quad9',
		site: 'https://quad9.net/service/service-addresses-and-features/',
		region: 'global',
		note: '默认拦截已知恶意域名，主打安全过滤',
		ipv4: ['9.9.9.9', '149.112.112.112'],
		ipv6: ['2620:fe::fe', '2620:fe::9'],
		doh: 'https://dns.quad9.net/dns-query',
		dot: 'dns.quad9.net'
	},
	{
		id: 'opendns',
		name: 'OpenDNS',
		site: 'https://www.opendns.com/setupguide/',
		region: 'global',
		note: 'Cisco 提供，另有家庭保护版与可自定义的过滤档',
		ipv4: ['208.67.222.222', '208.67.220.220'],
		ipv6: ['2620:119:35::35', '2620:119:53::53'],
		doh: 'https://doh.opendns.com/dns-query',
		dot: ''
	},
	{
		id: 'adguard',
		name: 'AdGuard DNS',
		site: 'https://adguard-dns.io/',
		region: 'global',
		note: '默认拦截广告与跟踪器；另有家庭保护版与无过滤版',
		ipv4: ['94.140.14.14', '94.140.15.15'],
		ipv6: ['2a10:50c0::ad1:ff', '2a10:50c0::ad2:ff'],
		doh: 'https://dns.adguard-dns.com/dns-query',
		dot: 'dns.adguard-dns.com'
	},
	{
		id: 'dnssb',
		name: 'DNS.SB',
		site: 'https://dns.sb/',
		region: 'global',
		note: '不做日志、不做过滤',
		ipv4: ['185.222.222.222', '45.11.45.11'],
		ipv6: [],
		doh: 'https://doh.sb/dns-query',
		dot: 'dot.sb'
	},
	{
		id: 'dnswatch',
		name: 'DNS.WATCH',
		site: 'https://dns.watch/',
		region: 'global',
		note: '德国，不做过滤、不记录查询日志',
		ipv4: ['84.200.69.80', '84.200.70.40'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'yandex',
		name: 'Yandex DNS',
		site: 'https://dns.yandex.com/',
		region: 'global',
		note: '俄罗斯 Yandex 提供，另有安全版与家庭版（地址末位不同）',
		ipv4: ['77.88.8.8', '77.88.8.1'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'comodo',
		name: 'Comodo Secure DNS',
		site: '',
		region: 'global',
		note: '现属 Xcitium，附带恶意站点过滤',
		ipv4: ['8.26.56.26', '8.20.247.20'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'level3',
		name: 'Level3 / Lumen',
		site: '',
		region: 'global',
		note: '老牌公共 DNS，不做过滤；现已并入 Lumen',
		ipv4: ['4.2.2.1', '4.2.2.2'],
		ipv6: [],
		doh: '',
		dot: ''
	},
	{
		id: 'mullvad',
		name: 'Mullvad DNS',
		site: 'https://mullvad.net/en/help/dns-over-https-and-dns-over-tls',
		region: 'global',
		note: '瑞典 Mullvad 提供，不记录日志；另有广告拦截与家庭保护档',
		ipv4: ['194.242.2.2'],
		ipv6: [],
		doh: 'https://dns.mullvad.net/dns-query',
		dot: 'dns.mullvad.net'
	}
];

/**
 * 把一个服务的四类地址摊平成可渲染的行，**只保留有的**。
 * 排序固定为 IPv4 → IPv6 → DoH → DoT：看的人先找 IP，再找加密端点。
 */
export function addressEntries(provider: DnsProvider): DnsAddress[] {
	const entries: DnsAddress[] = [];
	for (const value of provider.ipv4) entries.push({ kind: 'IPv4', value });
	for (const value of provider.ipv6) entries.push({ kind: 'IPv6', value });
	if (provider.doh !== '') entries.push({ kind: 'DoH', value: provider.doh });
	if (provider.dot !== '') entries.push({ kind: 'DoT', value: provider.dot });
	return entries;
}

/** 一行参与搜索的文本：名称 + 地区 + 说明 + 官网 + 全部地址，用小写比较 */
function searchText(provider: DnsProvider): string {
	return [
		provider.name,
		REGION_LABEL[provider.region],
		provider.note,
		provider.site,
		...addressEntries(provider).map((entry) => entry.value)
	]
		.join(' ')
		.toLowerCase();
}

/** 一类地址 + 它的若干值（主 / 备并排），给紧凑版式用 */
export interface DnsAddressGroup {
	kind: DnsAddressKind;
	values: string[];
}

/**
 * 把摊平后的地址行按类型并回几组，**同类相邻的合成一组**（`addressEntries` 已经保证同类连排，
 * 所以顺序不变、不必用 Map）。界面据此让主备并排一行 —— 一个值一行的话，21 家要多滚近一半。
 * 每类只出现一组，所以组的 `kind` 可以直接当 keyed each 的 key。
 */
export function groupAddresses(entries: readonly DnsAddress[]): DnsAddressGroup[] {
	const groups: DnsAddressGroup[] = [];
	for (const entry of entries) {
		const last = groups[groups.length - 1];
		if (last !== undefined && last.kind === entry.kind) last.values.push(entry.value);
		else groups.push({ kind: entry.kind, values: [entry.value] });
	}
	return groups;
}

/**
 * 官网链接的**展示文本**：只取主机名（`https://www.114dns.com/` → `www.114dns.com`）。
 *
 * 链接目标仍是完整地址（含路径，如 360 的 `/dnsPublic.html`），但标签只显示域名 ——
 * 一行里放得下，也一眼看出这个链接指向谁。留空或解析不出主机名都返回空串，调用方据此改渲染「官网未知」。
 */
export function siteHost(site: string): string {
	if (site === '') return '';
	try {
		return new URL(site).host;
	} catch {
		return '';
	}
}

/**
 * 按地区与关键词筛服务：地区是并列的三档，关键词是空格分隔的多词**全部命中**（AND）。
 * 只影响渲染，不动源数据 —— 与速查表同一口径。
 */
export function filterDnsProviders(
	providers: readonly DnsProvider[],
	region: DnsRegionFilter,
	query: string
): DnsProvider[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return providers.filter((provider) => {
		if (region !== 'all' && provider.region !== region) return false;
		if (terms.length === 0) return true;
		const text = searchText(provider);
		return terms.every((term) => text.includes(term));
	});
}

/** 结构校验：给单测用的最小检查，返回问题列表（空数组 = 没问题） */ export function validateDnsProviders(
	providers: readonly DnsProvider[]
): string[] {
	const problems: string[] = [];
	if (providers.length === 0) problems.push('清单是空的');

	const duplicated = providers.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
	if (duplicated.length > 0) problems.push(`id 有重复：${[...new Set(duplicated)].join('、')}`);

	for (const provider of providers) {
		if (provider.name === '') problems.push(`${provider.id} 没有名称`);
		if (provider.note === '') problems.push(`${provider.id} 没有说明`);
		// 一条地址都没有就等于查不到东西，说明这行是半成品
		if (addressEntries(provider).length === 0) problems.push(`${provider.id} 一条地址都没有`);
		// DoH 必须是完整 URL，否则复制出去不能用
		if (provider.doh !== '' && !provider.doh.startsWith('https://')) {
			problems.push(`${provider.id} 的 DoH 端点不是 https 地址：${provider.doh}`);
		}
		// 官网同理：要么不写，写了就得是个能打开的 https 地址（这两处都别写「像地址的占位」）
		if (provider.site !== '' && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(provider.site)) {
			problems.push(`${provider.id} 的官网不是合法的 https 地址：${provider.site}`);
		}
	}

	return problems;
}
