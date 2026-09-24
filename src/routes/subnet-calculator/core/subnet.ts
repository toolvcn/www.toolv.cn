// IPv4 子网计算：CIDR 解析、网段信息、子网划分。全是纯函数，不碰 DOM，node 环境可直接单测。
//
// 两个容易写错的地方，实现里一直盯着：
//   1. JS 的位运算跑在 int32 上，`(a << 24) | …` 的结果可能变成负数 —— 每一处都补 `>>> 0` 收成无符号；
//   2. /31 与 /32 是特例：前者是两个地址都能用的点对点网段（RFC 3021），后者是单个主机地址，
//      都不能套「总数 − 2」的公式。
import { fail, ok, type Result } from '$lib/utils/result';

/** 32 位无符号整数表示的 IPv4 地址 */
export type Ipv4 = number;

/**
 * 一次最多列多少个子网。
 * 再往上（/8 切 /14 之类）列表就没意义了 —— 一是前端渲染不动，二是没人会去读 1024 行表格。
 * 上限之外让用户把目标前缀调小，而不是把页面卡死。
 */
export const MAX_SUBNETS = 64;

export interface CidrInput {
	ip: Ipv4;
	prefix: number;
	/** 输入里没写掩码、按默认前缀算的（界面提示用，不影响计算） */
	assumed: boolean;
}

/** 输入里没给掩码时用的默认前缀：家庭与办公网段最常见的一档 */
export const DEFAULT_PREFIX = 24;

/** 各 IP 类别的首字节区间（老的分级编址，判断「这是不是公网大网段」时还用得上） */
const CLASS_RANGES: ReadonlyArray<{ label: string; from: number; to: number }> = [
	{ label: 'A 类', from: 0, to: 127 },
	{ label: 'B 类', from: 128, to: 191 },
	{ label: 'C 类', from: 192, to: 223 },
	{ label: 'D 类（组播）', from: 224, to: 239 },
	{ label: 'E 类（保留）', from: 240, to: 255 }
];

/** 特殊地址段：按「更具体（前缀更长）的先排」—— `.find` 命中第一个，顺序就是优先级 */
const SCOPES: ReadonlyArray<{ label: string; network: Ipv4; prefix: number }> = [
	{ label: '本网络（0.0.0.0/8）', network: 0x00000000, prefix: 8 },
	{ label: '私有地址（RFC 1918 10/8）', network: 0x0a000000, prefix: 8 },
	{ label: '运营商级 NAT（100.64/10）', network: 0x64400000, prefix: 10 },
	{ label: '回环地址（127/8）', network: 0x7f000000, prefix: 8 },
	{ label: '链路本地（169.254/16）', network: 0xa9fe0000, prefix: 16 },
	{ label: '私有地址（RFC 1918 172.16/12）', network: 0xac100000, prefix: 12 },
	{ label: '私有地址（RFC 1918 192.168/16）', network: 0xc0a80000, prefix: 16 },
	{ label: '组播地址（224/4）', network: 0xe0000000, prefix: 4 },
	{ label: '受限广播（255.255.255.255）', network: 0xffffffff, prefix: 32 },
	{ label: '保留地址（240/4）', network: 0xf0000000, prefix: 4 }
];

export const DEFAULT_INPUT = '192.168.1.10/24';

/** 示例：每条演示一件不同的事（点分掩码、/31 特例、大网段、公网小段） */
export const CIDR_EXAMPLES: ReadonlyArray<{ id: string; label: string; description: string; value: string }> = [
	{ id: 'home', label: '家庭网段', description: '192.168.1.10/24 · 256 个地址', value: '192.168.1.10/24' },
	{ id: 'office', label: '办公网 /20', description: '10.10.32.7/20 · 4096 个地址', value: '10.10.32.7/20' },
	{ id: 'p2p', label: '点对点 /31', description: '10.0.0.0/31 · 两个地址都可用', value: '10.0.0.0/31' },
	{ id: 'public', label: '公网小段 /27', description: '203.0.113.18/27 · 30 台可用', value: '203.0.113.18/27' },
	{ id: 'dotted', label: '点分掩码写法', description: '172.16.5.9 255.255.248.0', value: '172.16.5.9 255.255.248.0' }
];

// ---------------------------------------------------------------- 格式化与解析

export function formatIpv4(value: Ipv4): string {
	const n = value >>> 0;
	return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

/** 二进制写法：每 8 位一组、点分，便于看网络位与主机位的分界 */
export function toBinaryText(value: Ipv4): string {
	const n = value >>> 0;
	return [24, 16, 8, 0].map((shift) => ((n >>> shift) & 0xff).toString(2).padStart(8, '0')).join('.');
}

export function maskOf(prefix: number): Ipv4 {
	if (prefix <= 0) return 0;
	return (0xffffffff << (32 - prefix)) >>> 0;
}

/** 点分掩码 → 前缀长度；不连续的掩码（如 255.0.255.0）不算合法掩码 */
export function prefixOfMask(mask: Ipv4): Result<number> {
	const n = mask >>> 0;
	// 取反加一后是 2 的幂（或是 0），掩码才是连续的
	const inverted = ~n >>> 0;
	if (inverted !== 0 && (inverted & (inverted + 1)) !== 0) {
		return fail(`${formatIpv4(n)} 不是合法掩码：二进制里的 1 必须连续（如 255.255.255.0）`);
	}
	let count = 0;
	for (let i = 31; i >= 0; i -= 1) if (((n >>> i) & 1) === 1) count += 1;
	return ok(count);
}

export function parseIpv4(text: string): Result<Ipv4> {
	const parts = text.trim().split('.');
	if (parts.length !== 4) return fail(`「${text.trim()}」不是 IPv4：需要四段，用点分隔（如 192.168.1.1）`);

	let value = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return fail(`「${part}」不是 0-255 的数字`);
		const octet = Number(part);
		if (octet > 255) return fail(`「${part}」超出范围：每段只能是 0-255`);
		value = ((value << 8) | octet) >>> 0;
	}
	return ok(value);
}

/**
 * 解析用户输入的地址：三种写法都收
 *   - `192.168.1.10/24`
 *   - `192.168.1.10/255.255.255.0`（前缀位置写点分掩码）
 *   - `192.168.1.10 255.255.255.0`（空格分隔）
 * 完全不给掩码时按 `/24` 算，并把 `assumed` 标出来让界面提示一句。
 */
export function parseCidr(text: string): Result<CidrInput> {
	const trimmed = text.trim();
	if (trimmed === '') return fail('还没有输入地址');

	// 先按空格切一次：`地址 掩码` 这种写法
	const spaced = trimmed.split(/\s+/);
	let addressPart = spaced[0] ?? '';
	let maskPart = spaced[1] ?? '';
	if (spaced.length > 2) return fail('输入里有多个空格分隔的片段，只支持「地址 掩码」两段');

	// 再按 `/` 切：`地址/前缀`
	const slashed = addressPart.split('/');
	if (slashed.length === 2) {
		if (maskPart !== '') return fail('同时写了「/前缀」和空格掩码，留一个就行');
		addressPart = slashed[0] ?? '';
		maskPart = slashed[1] ?? '';
		if (maskPart === '') return fail('斜杠后面没写前缀，例如 192.168.1.10/24');
	} else if (slashed.length > 2) {
		return fail('斜杠出现了多次，只支持「地址/前缀」');
	}

	const ip = parseIpv4(addressPart);
	if (!ip.ok) return fail(ip.error);

	if (maskPart === '') return ok({ ip: ip.value, prefix: DEFAULT_PREFIX, assumed: true });

	if (/^\d{1,2}$/.test(maskPart)) {
		const prefix = Number(maskPart);
		if (prefix > 32) return fail(`前缀长度 ${prefix} 超出范围：最多 /32`);
		return ok({ ip: ip.value, prefix, assumed: false });
	}

	const mask = parseIpv4(maskPart);
	if (!mask.ok) return fail(`掩码读不出来：${mask.error}`);
	const prefix = prefixOfMask(mask.value);
	if (!prefix.ok) return fail(prefix.error);
	return ok({ ip: ip.value, prefix: prefix.value, assumed: false });
}

// ---------------------------------------------------------------- 网段信息

export interface SubnetInfo {
	ip: Ipv4;
	prefix: number;
	mask: Ipv4;
	wildcard: Ipv4;
	network: Ipv4;
	broadcast: Ipv4;
	firstHost: Ipv4;
	lastHost: Ipv4;
	/** 地址总数（含网络地址与广播地址） */
	total: number;
	/** 可用主机数 */
	usable: number;
	/** 输入地址是不是网络地址本身 */
	isNetworkAddress: boolean;
	ipClass: string;
	scope: string;
	/** /31 与 /32 的特例说明，其余为空串 */
	note: string;
}

export function describeSubnet(ip: Ipv4, prefix: number): SubnetInfo {
	const mask = maskOf(prefix);
	const network = (ip & mask) >>> 0;
	const wildcard = ~mask >>> 0;
	const broadcast = (network | wildcard) >>> 0;
	const total = 2 ** (32 - prefix);
	// /31 两个地址都能用（RFC 3021 的点对点），/32 就是单个主机 —— 都不能套「总数 − 2」
	const usable = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
	const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
	const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
	const note =
		prefix === 32
			? '/32 是单个主机地址，只有一个可用地址'
			: prefix === 31
				? '/31 是两个地址的点对点网段（RFC 3021），两个都可用，不扣网络号与广播号'
				: '';

	return {
		ip,
		prefix,
		mask,
		wildcard,
		network,
		broadcast,
		firstHost,
		lastHost,
		total,
		usable,
		isNetworkAddress: ip === network,
		ipClass: CLASS_RANGES.find((range) => ((ip >>> 24) & 0xff) >= range.from && ((ip >>> 24) & 0xff) <= range.to)!
			.label,
		scope: scopeOf(ip),
		note
	};
}

function scopeOf(ip: Ipv4): string {
	const hit = SCOPES.find((scope) => (ip & maskOf(scope.prefix)) >>> 0 === scope.network);
	return hit ? hit.label : '公网地址';
}

// ---------------------------------------------------------------- 子网划分

export interface SubnetRow {
	network: Ipv4;
	broadcast: Ipv4;
	firstHost: Ipv4;
	lastHost: Ipv4;
	usable: number;
}

/** 可切分的目标前缀档位：最多往后 6 位（2^6 = 64 段，正好是 MAX_SUBNETS） */
export function splitTargets(prefix: number): ReadonlyArray<{ value: string; label: string; description: string }> {
	const options = [];
	for (let target = prefix + 1; target <= Math.min(32, prefix + 6); target += 1) {
		const count = 2 ** (target - prefix);
		const usable = target === 32 ? 1 : target === 31 ? 2 : 2 ** (32 - target) - 2;
		options.push({
			value: String(target),
			label: `/${target}`,
			description: `${count} 个子网 · 每段 ${usable} 台可用`
		});
	}
	return options;
}

export function splitSubnets(ip: Ipv4, prefix: number, target: number): Result<SubnetRow[]> {
	if (target <= prefix) return fail(`目标前缀 /${target} 不比原来的 /${prefix} 长，切不出子网`);
	if (target > 32) return fail(`目标前缀 /${target} 超出范围：最多 /32`);

	const count = 2 ** (target - prefix);
	if (count > MAX_SUBNETS) {
		return fail(`这样会切出 ${count} 个子网，一次最多列 ${MAX_SUBNETS} 个；把目标前缀调小一点`);
	}

	const base = (ip & maskOf(prefix)) >>> 0;
	const step = 2 ** (32 - target);
	const usable = target === 32 ? 1 : target === 31 ? 2 : step - 2;
	const rows: SubnetRow[] = [];
	for (let i = 0; i < count; i += 1) {
		const network = (base + i * step) >>> 0;
		const broadcast = (network + step - 1) >>> 0;
		rows.push({
			network,
			broadcast,
			firstHost: target >= 31 ? network : (network + 1) >>> 0,
			lastHost: target >= 31 ? broadcast : (broadcast - 1) >>> 0,
			usable
		});
	}
	return ok(rows);
}
