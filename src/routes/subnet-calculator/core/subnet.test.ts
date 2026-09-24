// 子网计算的单测（vitest 的 server project）：解析、掩码、网段信息、子网划分，外加 store 的派生状态。
// 锚点值都是手算过的（如 172.16.5.9/21 → 172.16.0.0 – 172.16.7.255），不是拿实现跑一遍抄回来。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '$lib/ui/toast.svelte';
import {
	CIDR_EXAMPLES,
	DEFAULT_INPUT,
	describeSubnet,
	formatIpv4,
	MAX_SUBNETS,
	maskOf,
	parseCidr,
	parseIpv4,
	prefixOfMask,
	splitSubnets,
	splitTargets,
	toBinaryText
} from './subnet.ts';
import { subnetStore } from './store.svelte.ts';

beforeEach(() => {
	subnetStore.input = DEFAULT_INPUT;
	subnetStore.chosenTarget = null;
	toast.message = '';
	toast.visible = false;
	vi.unstubAllGlobals();
});

describe('地址解析与格式化', () => {
	it('四段十进制往返一致', () => {
		const ip = parseIpv4('192.168.1.10');
		expect(ip.ok).toBe(true);
		if (ip.ok) {
			expect(ip.value).toBe(3232235786);
			expect(formatIpv4(ip.value)).toBe('192.168.1.10');
		}
	});

	it('边界地址：0.0.0.0 与 255.255.255.255 都收，且是无符号整数', () => {
		const zero = parseIpv4('0.0.0.0');
		const full = parseIpv4('255.255.255.255');
		expect(zero.ok && zero.value).toBe(0);
		if (full.ok) {
			expect(full.value).toBe(0xffffffff);
			expect(full.value).toBeGreaterThan(0); // 位运算没漏 >>> 0 时这里会是 -1
		}
	});

	it('段数不对、非数字、超 255 各自报错', () => {
		const short = parseIpv4('192.168.1');
		expect(short.ok).toBe(false);
		if (!short.ok) expect(short.error).toContain('需要四段');

		const text = parseIpv4('192.168.1.a');
		expect(text.ok).toBe(false);
		if (!text.ok) expect(text.error).toContain('0-255');

		const big = parseIpv4('192.168.1.256');
		expect(big.ok).toBe(false);
		if (!big.ok) expect(big.error).toContain('超出范围');
	});

	it('二进制写法按 8 位一组点分', () => {
		const ip = parseIpv4('192.168.1.10');
		expect(ip.ok && toBinaryText(ip.value)).toBe('11000000.10101000.00000001.00001010');
	});
});

describe('CIDR 解析的三种写法', () => {
	it('192.168.1.10/24', () => {
		const parsed = parseCidr('192.168.1.10/24');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.prefix).toBe(24);
			expect(parsed.value.assumed).toBe(false);
		}
	});

	it('前缀位置写点分掩码：192.168.1.10/255.255.255.0', () => {
		const parsed = parseCidr('192.168.1.10/255.255.255.0');
		expect(parsed.ok && parsed.value.prefix).toBe(24);
	});

	it('空格分隔：172.16.5.9 255.255.248.0 → /21', () => {
		const parsed = parseCidr('172.16.5.9 255.255.248.0');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.prefix).toBe(21);
			expect(parsed.value.assumed).toBe(false);
		}
	});

	it('不给掩码时按 /24 算，并把 assumed 标出来', () => {
		const parsed = parseCidr('10.1.2.3');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.prefix).toBe(24);
			expect(parsed.value.assumed).toBe(true);
		}
	});

	it('空输入、斜杠后没前缀、多个斜杠、多段空格都给出可读的中文错误', () => {
		const empty = parseCidr('   ');
		expect(empty.ok).toBe(false);
		if (!empty.ok) expect(empty.error).toBe('还没有输入地址');

		const bare = parseCidr('192.168.1.10/');
		expect(bare.ok).toBe(false);
		if (!bare.ok) expect(bare.error).toContain('斜杠后面没写前缀');

		const twice = parseCidr('192.168.1.10/24/8');
		expect(twice.ok).toBe(false);
		if (!twice.ok) expect(twice.error).toContain('斜杠出现了多次');

		const extra = parseCidr('192.168.1.10 255.255.255.0 8');
		expect(extra.ok).toBe(false);
		if (!extra.ok) expect(extra.error).toContain('两段');
	});

	it('前缀超范围与不连续掩码都拦下来', () => {
		const prefix = parseCidr('192.168.1.10/33');
		expect(prefix.ok).toBe(false);
		if (!prefix.ok) expect(prefix.error).toContain('超出范围');

		const broken = parseCidr('192.168.1.10/255.0.255.0');
		expect(broken.ok).toBe(false);
		if (!broken.ok) expect(broken.error).toContain('必须连续');
	});
});

describe('掩码与前缀互转', () => {
	it('maskOf 的四个档位', () => {
		expect(formatIpv4(maskOf(0))).toBe('0.0.0.0');
		expect(formatIpv4(maskOf(8))).toBe('255.0.0.0');
		expect(formatIpv4(maskOf(24))).toBe('255.255.255.0');
		expect(formatIpv4(maskOf(32))).toBe('255.255.255.255');
	});

	it('prefixOfMask 是 maskOf 的逆运算', () => {
		for (const prefix of [0, 1, 8, 16, 20, 24, 30, 31, 32]) {
			const back = prefixOfMask(maskOf(prefix));
			expect(back.ok && back.value).toBe(prefix);
		}
	});

	it('不连续掩码被拒，并说明为什么', () => {
		const broken = prefixOfMask(parseIpv4('255.0.255.0').ok ? 0xff00ff00 : 0);
		expect(broken.ok).toBe(false);
		if (!broken.ok) expect(broken.error).toContain('必须连续');
	});
});

describe('网段信息（手算锚点）', () => {
	it('192.168.1.10/24：网络 .0、广播 .255、可用 254、私有 C 类', () => {
		const ip = parseIpv4('192.168.1.10');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const info = describeSubnet(ip.value, 24);

		expect(formatIpv4(info.network)).toBe('192.168.1.0');
		expect(formatIpv4(info.broadcast)).toBe('192.168.1.255');
		expect(formatIpv4(info.mask)).toBe('255.255.255.0');
		expect(formatIpv4(info.wildcard)).toBe('0.0.0.255');
		expect(formatIpv4(info.firstHost)).toBe('192.168.1.1');
		expect(formatIpv4(info.lastHost)).toBe('192.168.1.254');
		expect(info.total).toBe(256);
		expect(info.usable).toBe(254);
		expect(info.isNetworkAddress).toBe(false);
		expect(info.ipClass).toBe('C 类');
		expect(info.scope).toContain('192.168/16');
		expect(info.note).toBe('');
	});

	it('10.0.0.0/8：输入就是网络地址，可用 16777214', () => {
		const ip = parseIpv4('10.0.0.0');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const info = describeSubnet(ip.value, 8);

		expect(formatIpv4(info.broadcast)).toBe('10.255.255.255');
		expect(info.total).toBe(16777216);
		expect(info.usable).toBe(16777214);
		expect(info.isNetworkAddress).toBe(true);
		expect(info.ipClass).toBe('A 类');
		expect(info.scope).toContain('10/8');
	});

	it('172.16.5.9/21：网络 172.16.0.0、广播 172.16.7.255、可用 2046', () => {
		const ip = parseIpv4('172.16.5.9');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const info = describeSubnet(ip.value, 21);

		expect(formatIpv4(info.network)).toBe('172.16.0.0');
		expect(formatIpv4(info.broadcast)).toBe('172.16.7.255');
		expect(info.total).toBe(2048);
		expect(info.usable).toBe(2046);
	});

	it('/31 与 /32 是特例：不扣网络号与广播号，且带一句说明', () => {
		const ip = parseIpv4('10.0.0.0');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;

		const p2p = describeSubnet(ip.value, 31);
		expect(p2p.usable).toBe(2);
		expect(formatIpv4(p2p.firstHost)).toBe('10.0.0.0');
		expect(formatIpv4(p2p.lastHost)).toBe('10.0.0.1');
		expect(p2p.note).toContain('RFC 3021');

		const host = describeSubnet(ip.value, 32);
		expect(host.usable).toBe(1);
		expect(formatIpv4(host.network)).toBe('10.0.0.0');
		expect(host.note).toContain('/32');
	});

	it('0.0.0.0/0：整个地址空间，掩码 0、通配 255.255.255.255', () => {
		const ip = parseIpv4('0.0.0.0');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const info = describeSubnet(ip.value, 0);

		expect(formatIpv4(info.mask)).toBe('0.0.0.0');
		expect(formatIpv4(info.wildcard)).toBe('255.255.255.255');
		expect(formatIpv4(info.broadcast)).toBe('255.255.255.255');
		expect(info.total).toBe(4294967296);
		expect(info.usable).toBe(4294967294);
	});

	it('特殊地址段的归属：回环 / 链路本地 / 组播 / 保留 / 受限广播 / 公网', () => {
		const scope = (text: string): string => {
			const ip = parseIpv4(text);
			if (!ip.ok) throw new Error(text);
			return describeSubnet(ip.value, 32).scope;
		};
		expect(scope('127.0.0.1')).toContain('回环');
		expect(scope('169.254.1.1')).toContain('链路本地');
		expect(scope('100.64.0.1')).toContain('运营商级 NAT');
		expect(scope('224.0.0.1')).toContain('组播');
		expect(scope('240.0.0.1')).toContain('保留');
		expect(scope('255.255.255.255')).toContain('受限广播');
		expect(scope('203.0.113.18')).toBe('公网地址');
	});
});

describe('子网划分', () => {
	it('可选的目标前缀最多往后 6 位，描述里带子网数与每段可用数', () => {
		const options = splitTargets(24);
		expect(options.map((option) => option.value)).toEqual(['25', '26', '27', '28', '29', '30']);
		expect(options[1]?.description).toContain('4 个子网');
		expect(options[1]?.description).toContain('62 台可用');
	});

	it('/30 只能切到 /31 与 /32；/32 没有可切的了', () => {
		expect(splitTargets(30).map((option) => option.value)).toEqual(['31', '32']);
		expect(splitTargets(32)).toEqual([]);
	});

	it('192.168.1.10/24 切 /26：四段，步长 64', () => {
		const ip = parseIpv4('192.168.1.10');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const result = splitSubnets(ip.value, 24, 26);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value).toHaveLength(4);
		expect(result.value.map((row) => formatIpv4(row.network))).toEqual([
			'192.168.1.0',
			'192.168.1.64',
			'192.168.1.128',
			'192.168.1.192'
		]);
		expect(result.value[0]?.usable).toBe(62);
		expect(formatIpv4(result.value[0]!.firstHost)).toBe('192.168.1.1');
		expect(formatIpv4(result.value[0]!.lastHost)).toBe('192.168.1.62');
		expect(formatIpv4(result.value[3]!.broadcast)).toBe('192.168.1.255');
	});

	it('/31 切 /32：两段，每段 1 个可用地址', () => {
		const ip = parseIpv4('10.0.0.0');
		expect(ip.ok).toBe(true);
		if (!ip.ok) return;
		const result = splitSubnets(ip.value, 31, 32);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toHaveLength(2);
			expect(result.value[0]?.usable).toBe(1);
			expect(formatIpv4(result.value[1]!.network)).toBe('10.0.0.1');
		}
	});

	it('目标前缀不比原前缀长、超范围、一次性切太多，各自报错', () => {
		const same = splitSubnets(0xc0a8010a, 24, 24);
		expect(same.ok).toBe(false);
		if (!same.ok) expect(same.error).toContain('不比原来的');

		const tooLong = splitSubnets(0xc0a8010a, 24, 33);
		expect(tooLong.ok).toBe(false);
		if (!tooLong.ok) expect(tooLong.error).toContain('最多 /32');

		const many = splitSubnets(0xc0a8010a, 24, 32);
		expect(many.ok).toBe(false);
		if (!many.ok) expect(many.error).toContain(`一次最多列 ${MAX_SUBNETS} 个`);
	});
});

describe('store 的派生状态', () => {
	it('默认示例能直接算出信息与划分结果', () => {
		expect(subnetStore.error).toBe('');
		expect(subnetStore.info?.prefix).toBe(24);
		expect(subnetStore.assumed).toBe(false);
		expect(subnetStore.target).toBe(26);
		expect(subnetStore.split.rows).toHaveLength(4);
		expect(subnetStore.infoText).toContain('可用 254 个地址');
		expect(subnetStore.splitText).toContain('切成 4 个 /26');
	});

	it('输入不合法时两个面板一起回到空态，错误出现在状态条', () => {
		subnetStore.input = '192.168.1.999';
		expect(subnetStore.info).toBeNull();
		expect(subnetStore.split.rows).toEqual([]);
		expect(subnetStore.infoTone).toBe('error');
		expect(subnetStore.splitTone).toBe('error');
		expect(subnetStore.infoText).toContain('超出范围');
	});

	it('没写掩码时按 /24 算，状态条里说明这一句', () => {
		subnetStore.input = '10.1.2.3';
		expect(subnetStore.assumed).toBe(true);
		expect(subnetStore.infoText).toContain('没写掩码，按 /24 算');
	});

	it('选了目标前缀就用它；选了不合法的（比原前缀短）退回默认档', () => {
		subnetStore.setTarget('28');
		expect(subnetStore.target).toBe(28);
		expect(subnetStore.splitText).toContain('切成 16 个 /28');

		subnetStore.setTarget('8');
		expect(subnetStore.target).toBe(26);
	});

	it('/32 时没有可切的档位，划分面板给出说明而不是报错', () => {
		subnetStore.input = '10.0.0.7/32';
		expect(subnetStore.target).toBeNull();
		expect(subnetStore.infoTone).toBe('warn');
		expect(subnetStore.infoText).toContain('/32');
		expect(subnetStore.splitTone).toBe('neutral');
		expect(subnetStore.splitText).toContain('没法再往下切');
	});

	it('示例一条条都解析得开，填入后回到默认档位', () => {
		for (const example of CIDR_EXAMPLES) {
			subnetStore.loadExample(example.id);
			expect(subnetStore.input, example.label).toBe(example.value);
			expect(subnetStore.error, example.label).toBe('');
			expect(subnetStore.info, example.label).not.toBeNull();
		}
		expect(toast.message).toContain('已填入示例');
	});

	it('清空后回到空态', () => {
		subnetStore.clearInput();
		expect(subnetStore.input).toBe('');
		expect(subnetStore.info).toBeNull();
		expect(subnetStore.target).toBeNull();
		expect(subnetStore.infoText).toBe('还没有输入地址');
	});
});
