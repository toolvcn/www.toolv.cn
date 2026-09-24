// 公共 DNS 清单与筛选的单测，跑在 vitest 的 server project（node 环境）。
//
// 数据表最怕的是「抄错一位」和「少写一列」——一个错的 IP 复制出去就是配置事故，
// 所以除了结构校验，这里还按格式逐条检查地址（IPv4 四段数值范围、IPv6 带冒号、
// DoT 是不带协议的纯主机名），并给几个锚点条目写死断言。
import { beforeEach, describe, expect, it } from 'vitest';
import {
	addressEntries,
	DNS_PROVIDERS,
	filterDnsProviders,
	groupAddresses,
	REGION_LABEL,
	siteHost,
	validateDnsProviders,
	type DnsProvider
} from './dns.ts';
import { dnsStore } from './store.svelte.ts';

/** 按 id 取一条，测试里的取件工具 */
function providerOf(id: string): DnsProvider {
	const found = DNS_PROVIDERS.find((item) => item.id === id);
	expect(found, `清单里没有「${id}」`).toBeDefined();
	return found as DnsProvider;
}

beforeEach(() => {
	dnsStore.resetFilter();
});

describe('结构完整性', () => {
	it('全部条目都过 validateDnsProviders（id 重复、缺名称 / 说明、没有地址、DoH 不是 https）', () => {
		expect(validateDnsProviders(DNS_PROVIDERS)).toEqual([]);
	});

	it('规模在下限之上，且国内 / 国外两档都有', () => {
		expect(DNS_PROVIDERS.length).toBeGreaterThanOrEqual(18);
		expect(DNS_PROVIDERS.filter((item) => item.region === 'cn').length).toBeGreaterThanOrEqual(8);
		expect(DNS_PROVIDERS.filter((item) => item.region === 'global').length).toBeGreaterThanOrEqual(8);
	});

	it('地区只有 cn / global 两种，都有中文名', () => {
		for (const provider of DNS_PROVIDERS) {
			expect(Object.keys(REGION_LABEL)).toContain(provider.region);
		}
		expect(REGION_LABEL.cn).toBe('国内');
		expect(REGION_LABEL.global).toBe('国外');
	});

	it('IPv4 都是合法的点分四段，且每段在 0-255', () => {
		const bad: string[] = [];
		for (const provider of DNS_PROVIDERS) {
			for (const ip of provider.ipv4) {
				const parts = ip.split('.');
				const ok = parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
				if (!ok) bad.push(`${provider.id}: ${ip}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('IPv6 都带冒号（不要求做完整校验，只挡「把 IPv4 抄进 IPv6 一栏」这类错）', () => {
		const bad: string[] = [];
		for (const provider of DNS_PROVIDERS) {
			for (const ip of provider.ipv6) {
				if (!ip.includes(':') || ip.startsWith('http')) bad.push(`${provider.id}: ${ip}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('DoH 是完整 https 地址；DoT 是不带协议与路径的纯主机名', () => {
		const bad: string[] = [];
		for (const provider of DNS_PROVIDERS) {
			if (provider.doh !== '' && !/^https:\/\/[^\s/]+\/\S*$/.test(provider.doh))
				bad.push(`DoH ${provider.id}: ${provider.doh}`);
			if (provider.dot !== '' && (provider.dot.includes('/') || provider.dot.includes(':'))) {
				bad.push(`DoT ${provider.id}: ${provider.dot}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('官网：要么留空，要么是能打开的 https 地址；有链接的占多数', () => {
		const bad: string[] = [];
		for (const provider of DNS_PROVIDERS) {
			if (provider.site === '') continue;
			if (!provider.site.startsWith('https://') || !provider.site.includes('.')) {
				bad.push(`${provider.id}: ${provider.site}`);
			}
		}
		expect(bad).toEqual([]);

		// 留空是允许的（查不到官方产品页就不编），但不该是普遍情况
		const withSite = DNS_PROVIDERS.filter((provider) => provider.site !== '');
		expect(withSite.length).toBeGreaterThanOrEqual(15);
	});

	it('地址没有重复（同一家的同一串不该出现两次）', () => {
		const bad: string[] = [];
		for (const provider of DNS_PROVIDERS) {
			const values = addressEntries(provider).map((entry) => entry.value);
			if (new Set(values).size !== values.length) bad.push(provider.id);
		}
		expect(bad).toEqual([]);
	});
});

describe('addressEntries：摊平成可复制的行', () => {
	/** 四类的固定先后 */
	const RANK = { IPv4: 0, IPv6: 1, DoH: 2, DoT: 3 } as const;

	it('顺序固定 IPv4 → IPv6 → DoH → DoT', () => {
		const ranks = addressEntries(providerOf('cloudflare')).map((entry) => RANK[entry.kind]);
		expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
		expect(new Set(ranks)).toEqual(new Set([0, 1, 2, 3]));
	});

	it('一个地址一行（不是一类一行）：主备两条各占一行，才能分别复制', () => {
		const provider = providerOf('cloudflare');
		expect(addressEntries(provider)).toHaveLength(
			provider.ipv4.length + provider.ipv6.length + (provider.doh === '' ? 0 : 1) + (provider.dot === '' ? 0 : 1)
		);
	});

	it('没有的类别不产生空行（114DNS 只有 IPv4）', () => {
		const entries = addressEntries(providerOf('dns114'));
		expect(entries).toHaveLength(2);
		expect(entries.every((entry) => entry.kind === 'IPv4')).toBe(true);
	});

	it('没有 DoT 记录的服务不会凭空多出一行 DoT（OpenDNS）', () => {
		const entries = addressEntries(providerOf('opendns'));
		expect(entries.some((entry) => entry.kind === 'DoT')).toBe(false);
		expect(entries.filter((entry) => entry.kind === 'DoH')).toHaveLength(1);
	});
});

describe('锚点条目（写死断言，防止日后误改）', () => {
	it('阿里云公共 DNS：223.5.5.5 / 223.6.6.6，DoT dns.alidns.com', () => {
		const provider = providerOf('alidns');
		expect(provider.region).toBe('cn');
		expect(provider.ipv4).toEqual(['223.5.5.5', '223.6.6.6']);
		expect(provider.ipv6).toContain('2400:3200::1');
		expect(provider.dot).toBe('dns.alidns.com');
	});

	it('腾讯 DNSPod：119.29.29.29，DoH doh.pub', () => {
		const provider = providerOf('dnspod');
		expect(provider.ipv4[0]).toBe('119.29.29.29');
		expect(provider.doh).toBe('https://doh.pub/dns-query');
	});

	it('Google：8.8.8.8 / 8.8.4.4，DoT dns.google；Cloudflare：1.1.1.1，DoT one.one.one.one', () => {
		expect(providerOf('google').ipv4).toEqual(['8.8.8.8', '8.8.4.4']);
		expect(providerOf('google').dot).toBe('dns.google');
		expect(providerOf('cloudflare').ipv4[0]).toBe('1.1.1.1');
		expect(providerOf('cloudflare').dot).toBe('one.one.one.one');
	});

	it('114DNS 的三个版本各有各的地址段，没有抄成同一组；官网同一个', () => {
		expect(providerOf('dns114').ipv4[0]).toBe('114.114.114.114');
		expect(providerOf('dns114-safe').ipv4[0]).toBe('114.114.114.119');
		expect(providerOf('dns114-family').ipv4[0]).toBe('114.114.114.110');
		expect(providerOf('dns114-safe').site).toBe('https://www.114dns.com/');
	});

	it('配置页链接指向各家的服务地址 / 配置说明页，不是泛泛的厂商首页', () => {
		expect(providerOf('google').site).toBe('https://developers.google.com/speed/public-dns/docs/using');
		expect(providerOf('cloudflare').site).toBe('https://one.one.one.one/');
		expect(providerOf('baidu').site).toBe('https://dudns.baidu.com/');
		expect(providerOf('alidns').site).toBe('https://www.alidns.com/');
		expect(providerOf('tuna').site).toBe('https://tuna.moe/help/dns/');
		expect(providerOf('quad9').site).toContain('service-addresses-and-features');
		expect(providerOf('opendns').site).toBe('https://www.opendns.com/setupguide/');
		expect(providerOf('mullvad').site).toContain('dns-over-https-and-dns-over-tls');
	});

	it('查不到官方产品页的留空（界面上显示「官网未知」），不编一个像官网的地址', () => {
		for (const id of ['cnnic', 'ustc', 'comodo', 'level3']) {
			expect(providerOf(id).site, `${id} 不该有官网链接`).toBe('');
		}
	});

	it('Comodo 与 Level3 是保留的老条目：地址没再确认，但暂时不从清单里删', () => {
		expect(providerOf('comodo').ipv4).toEqual(['8.26.56.26', '8.20.247.20']);
		expect(providerOf('level3').ipv4).toEqual(['4.2.2.1', '4.2.2.2']);
	});

	it('360 安全 DNS 的两组线路地址都在（电信 / 移动 / 铁通 与 联通）', () => {
		expect(providerOf('dns360').ipv4).toEqual(['101.226.4.6', '123.125.81.6']);
		expect(providerOf('dns360').doh).toBe('https://doh.360.cn/dns-query');
	});
});

describe('groupAddresses：紧凑版式的分组', () => {
	it('同类相邻的值并成一组，顺序不变', () => {
		const groups = groupAddresses(addressEntries(providerOf('cloudflare')));
		expect(groups.map((group) => group.kind)).toEqual(['IPv4', 'IPv6', 'DoH', 'DoT']);
		expect(groups[0]?.values).toEqual(['1.1.1.1', '1.0.0.1']);
		expect(groups[1]?.values).toEqual(['2606:4700:4700::1111', '2606:4700:4700::1001']);
		expect(groups[2]?.values).toEqual(['https://cloudflare-dns.com/dns-query']);
	});

	it('只有一类地址（114DNS 只有两条 IPv4）的也给一组，不拆', () => {
		const groups = groupAddresses(addressEntries(providerOf('dns114')));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.kind).toBe('IPv4');
		expect(groups[0]?.values).toHaveLength(2);
	});

	it('空输入给空数组', () => {
		expect(groupAddresses([])).toEqual([]);
	});

	it('每类至多一组（组的 kind 才能直接当 keyed each 的 key）', () => {
		for (const provider of DNS_PROVIDERS) {
			const kinds = groupAddresses(addressEntries(provider)).map((group) => group.kind);
			expect(new Set(kinds).size, `${provider.id} 的同类地址没有并到一起`).toBe(kinds.length);
		}
	});
});

describe('siteHost：官网链接的展示文本', () => {
	it('取主机名，去掉协议、路径与结尾斜杠', () => {
		expect(siteHost('https://www.114dns.com/')).toBe('www.114dns.com');
		expect(siteHost('https://sdns.360.net/dnsPublic.html')).toBe('sdns.360.net');
		expect(siteHost('https://developers.google.com/speed/public-dns')).toBe('developers.google.com');
	});

	it('留空或解析不出来都给空串（调用方据此改渲染「官网未知」）', () => {
		expect(siteHost('')).toBe('');
		expect(siteHost('不是地址')).toBe('');
		expect(siteHost('114dns.com')).toBe('');
	});

	it('数据里所有非空的 site 都能取出非空主机名', () => {
		for (const provider of DNS_PROVIDERS) {
			if (provider.site === '') continue;
			expect(siteHost(provider.site), `${provider.id} 的 site 取不出主机名`).not.toBe('');
		}
	});
});

describe('filterDnsProviders 的筛选口径', () => {
	it('空词 + 全部地区返回整份清单', () => {
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', '')).toHaveLength(DNS_PROVIDERS.length);
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', '   ')).toHaveLength(DNS_PROVIDERS.length);
	});

	it('地区档位只留对应那一档', () => {
		const cn = filterDnsProviders(DNS_PROVIDERS, 'cn', '');
		const global = filterDnsProviders(DNS_PROVIDERS, 'global', '');
		expect(cn.every((item) => item.region === 'cn')).toBe(true);
		expect(global.every((item) => item.region === 'global')).toBe(true);
		expect(cn.length + global.length).toBe(DNS_PROVIDERS.length);
	});

	it('按名称、地址、说明、官网都能搜到（含大小写不敏感）', () => {
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', 'cloudflare')[0]?.id).toBe('cloudflare');
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', 'CloudFlare')[0]?.id).toBe('cloudflare');
		expect(filterDnsProviders(DNS_PROVIDERS, 'cn', '223.5.5.5')[0]?.id).toBe('alidns');
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', '拦截').length).toBeGreaterThanOrEqual(2);
		// 官网也参与搜索，粘一条域名进去能定位到那一家
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', 'adguard-dns.io')[0]?.id).toBe('adguard');
	});

	it('空格分隔的多个词要全部命中（AND）', () => {
		const hit = filterDnsProviders(DNS_PROVIDERS, 'all', 'quad9 9.9.9.9');
		expect(hit).toHaveLength(1);
		expect(hit[0]?.id).toBe('quad9');

		// 只要求每个词都出现：命中行数由数据决定，但换个不可能的组合就该是空的
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', 'quad9 223.5.5.5')).toEqual([]);
	});

	it('地区与关键词是叠加的（AND），不是二选一', () => {
		expect(filterDnsProviders(DNS_PROVIDERS, 'cn', 'google')).toEqual([]);
		expect(filterDnsProviders(DNS_PROVIDERS, 'global', 'google')[0]?.id).toBe('google');
	});

	it('搜不到时给空数组，不是原数据；且不动源数据', () => {
		const before = DNS_PROVIDERS.length;
		expect(filterDnsProviders(DNS_PROVIDERS, 'all', 'zzzz')).toEqual([]);
		expect(DNS_PROVIDERS.length).toBe(before);
	});
});

describe('store：档位、搜索词与计数', () => {
	it('初始为「全部 + 空词」，计数念总数', () => {
		expect(dnsStore.region).toBe('all');
		expect(dnsStore.query).toBe('');
		expect(dnsStore.filtered).toBe(false);
		expect(dnsStore.results).toHaveLength(dnsStore.total);
		expect(dnsStore.countText).toBe(`${dnsStore.total} 家`);
	});

	it('筛过之后计数变成「命中 / 总数」', () => {
		dnsStore.setRegion('global');
		expect(dnsStore.filtered).toBe(true);
		expect(dnsStore.countText).toBe(`${dnsStore.results.length} / ${dnsStore.total} 家`);
	});

	it('搜不到时计数念「无结果」，空态文案与「本来就没有数据」区分开', () => {
		dnsStore.setQuery('zzzz');
		expect(dnsStore.results).toEqual([]);
		expect(dnsStore.countText).toBe('无结果');
	});

	it('resetFilter 同时把地区与搜索词复位', () => {
		dnsStore.setRegion('cn');
		dnsStore.setQuery('阿里');
		dnsStore.resetFilter();
		expect(dnsStore.region).toBe('all');
		expect(dnsStore.query).toBe('');
		expect(dnsStore.filtered).toBe(false);
	});

	it('clearQuery 只清搜索词，不动地区', () => {
		dnsStore.setRegion('cn');
		dnsStore.setQuery('阿里');
		dnsStore.clearQuery();
		expect(dnsStore.query).toBe('');
		expect(dnsStore.region).toBe('cn');
	});
});
