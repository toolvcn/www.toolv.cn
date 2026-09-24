// 服务端守卫：拦截内网 / 回环 / 链路本地 / 云元数据地址，防止代理被当作 SSRF 跳板。
// 纯函数、不依赖运行环境，可单测（guard.test.ts）。

/** 私有 / 保留 IPv4 区间（含起始、结束，闭区间） */
const PRIVATE_IPV4_RANGES: [number, number][] = [
	[0x00000000, 0x00ffffff], // 0.0.0.0/8 保留
	[0x0a000000, 0x0affffff], // 10.0.0.0/8 私有
	[0x64400000, 0x647fffff], // 100.64.0.0/10 运营商级 NAT
	[0x7f000000, 0x7fffffff], // 127.0.0.0/8 回环
	[0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 链路本地（含云元数据 169.254.169.254）
	[0xac100000, 0xac1fffff], // 172.16.0.0/12 私有
	[0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 私有
	[0xe0000000, 0xffffffff] // 224.0.0.0/4 组播 + 240.0.0.0/4 保留
];

/** IPv4 字符串 → 整数；不是合法点分四段返回 null */
function ipv4ToInt(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let value = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const n = Number(part);
		if (n > 255) return null;
		value = value * 256 + n;
	}
	return value;
}

function isPrivateIpv4(ip: string): boolean {
	const value = ipv4ToInt(ip);
	if (value === null) return false;
	return PRIVATE_IPV4_RANGES.some(([lo, hi]) => value >= lo && value <= hi);
}

/** IPv6 回环 / 内嵌 IPv4 / ULA / 链路本地 */
function isPrivateIpv6(ip: string): boolean {
	const lower = ip.toLowerCase();
	if (lower === '::' || lower === '::1') return true;
	// 内嵌 IPv4（标准映射形式）：::ffff:xxxx:xxxx，末 32 位即 IPv4。
	// 点分写法（::ffff:127.0.0.1）会被 URL 解析器规范化成十六进制，这里只认规范形。
	const mapped = lower.match(/^::ffff:([0-9a-f]{1,4})(?::([0-9a-f]{1,4}))?$/);
	if (mapped) {
		const hi = parseInt(mapped[1], 16);
		const lo = parseInt(mapped[2] ?? '0', 16);
		const v = hi * 0x10000 + lo;
		const v4 = `${(v >>> 24) & 0xff}.${(v >>> 16) & 0xff}.${(v >>> 8) & 0xff}.${v & 0xff}`;
		return isPrivateIpv4(v4);
	}
	// fc00::/7 唯一本地地址
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
	// fe80::/10 链路本地（fe8-feb）
	if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
		return true;
	}
	return false;
}

/** 显然指向本机 / 内网的保留主机名（DNS 反查不到，靠名字先拦一道） */
function isPrivateHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	return (
		lower === 'localhost' ||
		lower === 'localhost.localdomain' ||
		lower.endsWith('.localhost') ||
		lower.endsWith('.local') ||
		lower.endsWith('.internal') ||
		lower.endsWith('.lan') ||
		lower.endsWith('.localdomain') ||
		lower === 'metadata.google.internal' ||
		lower.endsWith('.metadata.google.internal')
	);
}

/**
 * 校验目标 URL。合法返回 null；不合法返回可直接展示给用户的拦截原因。
 * 防的是把代理当跳板访问内网 / 元数据：协议白名单 + 字面 IP 段 + 保留主机名三关。
 */
export function validateTargetUrl(rawUrl: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return 'URL 无法解析，请检查格式';
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return '仅支持 http:// 与 https:// 目标地址';
	}
	const hostname = parsed.hostname;
	if (hostname === '') return 'URL 缺少主机名';

	if (isPrivateHostname(hostname)) {
		return '已拦截：目标地址是内网 / 本机地址，代理不允许访问';
	}

	// 数字形式 IP（如 2130706433 会被某些解析器当作 127.0.0.1），直接拒绝
	if (/^\d+$/.test(hostname)) {
		return '已拦截：不支持的地址形式';
	}

	// 去掉 IPv6 字面量的方括号再判定
	const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
	const isIp = ipv4ToInt(bare) !== null || bare.includes(':');
	if (isIp && (isPrivateIpv4(bare) || isPrivateIpv6(bare))) {
		return '已拦截：目标地址是内网 / 回环地址，代理不允许访问';
	}

	return null;
}
