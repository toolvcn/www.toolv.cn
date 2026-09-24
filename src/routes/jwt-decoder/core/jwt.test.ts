// JWT 解码纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { base64UrlDecode, claimRows, decodeJwt, formatUnixSeconds } from './jwt.ts';
import { jwtStore } from './store.svelte.ts';
import { EXAMPLE_TOKEN } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	jwtStore.token = '';
	jwtStore.now = 0;
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('base64UrlDecode', () => {
	it('标准与 URL-safe 字符都能解', () => {
		expect(new TextDecoder().decode(base64UrlDecode('YWJj')!)).toBe('abc');
		expect(new TextDecoder().decode(base64UrlDecode('-_8')!)).toHaveLength(2); // 0xFB 0xFF
	});

	it('缺省的 = 填充可接受，段内出现 = 不合法', () => {
		expect(new TextDecoder().decode(base64UrlDecode('YQ')!)).toBe('a');
		expect(base64UrlDecode('YQ=a')).toBeNull();
	});

	it('长度对 4 取模为 1、含非法字符都拒绝', () => {
		expect(base64UrlDecode('abcde')).toBeNull();
		expect(base64UrlDecode('a*b')).toBeNull();
		expect(base64UrlDecode('')).toEqual(new Uint8Array(0));
	});
});

describe('decodeJwt', () => {
	it('三段齐全的 token 解出 header / payload / signature', () => {
		const result = decodeJwt(EXAMPLE_TOKEN);
		expect(result.error).toBe('');
		expect(result.header?.data).toEqual({ alg: 'HS256', typ: 'JWT' });
		expect(result.payload?.data.sub).toBe('1234567890');
		expect(result.payload?.data.name).toBe('无情');
		expect(result.signature).toBe('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
		expect(result.header?.json).toContain('  '); // 美化输出的缩进
		expect(result.header?.tokens.length).toBeGreaterThan(0);
	});

	it('空输入是空态不是错误', () => {
		const result = decodeJwt('   ');
		expect(result.error).toBe('');
		expect(result.header).toBeNull();
	});

	it('段数不对给中文错误', () => {
		expect(decodeJwt('a.b').error).toContain('当前是 2 段');
		expect(decodeJwt('a.b.c.d').error).toContain('当前是 4 段');
	});

	it('各段内部空白不合法', () => {
		const parts = EXAMPLE_TOKEN.split('.');
		expect(decodeJwt(`${parts[0]}. ${parts[1]}.${parts[2]}`).error).toContain('空白字符');
	});

	it('header / payload 各自的坏法都点到名', () => {
		const payload = EXAMPLE_TOKEN.split('.')[1];
		expect(decodeJwt('***.***.***').error).toContain('Header不是有效的 Base64URL');
		expect(decodeJwt('YWJj.***.sig').error).toContain('Header不是有效的 JSON');
		expect(decodeJwt('e30.***.sig').error).toContain('Payload不是有效的 Base64URL');
		expect(decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${payload}.sig`).error).toBe('');
		expect(decodeJwt('e30.YWJj.sig').error).toContain('Payload不是有效的 JSON');
		expect(decodeJwt('e30.WzFd.sig').error).toContain('Payload应该是 JSON 对象');
	});

	it('alg=none 的不安全 JWT（第三段为空）也能解', () => {
		const result = decodeJwt('e30.e30.');
		expect(result.error).toBe('');
		expect(result.signature).toBe('');
	});

	it('签名段不是 base64url 时报错但保留已解出内容', () => {
		const result = decodeJwt('e30.e30.@@@');
		expect(result.error).toContain('Signature');
		expect(result.header?.data).toEqual({});
	});
});

describe('claimRows', () => {
	it('挑出注册声明并转本地时间', () => {
		const data = { sub: 'u1', iat: 1757000000, exp: 1793000000 };
		const rows = claimRows(data, 1_757_000_100_000);
		expect(rows.map((r) => r.key)).toEqual(['sub', 'exp', 'iat']);
		const iatRow = rows.find((r) => r.key === 'iat')!;
		expect(iatRow.value).toBe(formatUnixSeconds(1757000000));
		const expRow = rows.find((r) => r.key === 'exp')!;
		expect(expRow.expired).toBe(false);
	});

	it('exp 过期状态以传入的 now 为准', () => {
		const data = { exp: 1000 };
		expect(claimRows(data, 999_999).at(0)?.expired).toBe(false);
		expect(claimRows(data, 1_000_000).at(0)?.expired).toBe(true);
	});

	it('aud 数组用顿号连接；非数字的时间戳给出提示', () => {
		const rows = claimRows({ aud: ['a', 'b'], exp: 'soon' }, 0);
		const aud = rows.find((r) => r.key === 'aud')!;
		expect(aud.value).toBe('a、b');
		expect(aud.expired).toBeNull();
		const exp = rows.find((r) => r.key === 'exp')!;
		expect(exp.value).toContain('不是 Unix 秒时间戳');
	});

	it('payload 里没有的声明不进表', () => {
		expect(claimRows({ foo: 1 }, 0)).toEqual([]);
	});
});

describe('formatUnixSeconds', () => {
	it('固定格式 YYYY-MM-DD HH:mm:ss（本地时区）', () => {
		const d = new Date(1757000000 * 1000);
		const pad = (n: number) => String(n).padStart(2, '0');
		const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
			d.getMinutes()
		)}:${pad(d.getSeconds())}`;
		expect(formatUnixSeconds(1757000000)).toBe(expected);
	});

	it('非法时间戳给占位文案', () => {
		expect(formatUnixSeconds(Number.NaN)).toBe('无效时间');
	});
});

// 分词不再由本工具实现，统一测在 src/lib/utils/json.test.ts。

describe('store', () => {
	it('输入变化解码结果实时跟着变', () => {
		jwtStore.token = EXAMPLE_TOKEN;
		expect(jwtStore.error).toBe('');
		expect(jwtStore.algorithm).toBe('HS256');
		jwtStore.token = 'bad';
		expect(jwtStore.error).not.toBe('');
	});

	it('now 为 0（SSR）时声明表为空，写入时间后出现 exp 行', () => {
		jwtStore.token = EXAMPLE_TOKEN;
		expect(jwtStore.claims).toEqual([]);
		jwtStore.now = 1_757_000_000_000;
		expect(jwtStore.claims.map((r) => r.key)).toContain('exp');
		const exp = jwtStore.claims.find((r) => r.key === 'exp')!;
		expect(exp.expired).toBe(false);
	});

	it('示例填充与清空', () => {
		jwtStore.loadExample();
		expect(jwtStore.token).toBe(EXAMPLE_TOKEN);
		jwtStore.clearInput();
		expect(jwtStore.token).toBe('');
	});

	it('复制 Header JSON 写入剪贴板', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		jwtStore.token = EXAMPLE_TOKEN;
		await jwtStore.copyJson('header');
		expect(writeText).toHaveBeenCalledWith('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
	});

	it('无结果复制给提示；失败弹红色提示', async () => {
		jwtStore.token = '';
		await jwtStore.copyJson('payload');
		expect(toast.message).toContain('没有可复制');

		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		jwtStore.token = EXAMPLE_TOKEN;
		await jwtStore.copyJson('payload');
		expect(toast.tone).toBe('error');
	});

	it('复制原文', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		jwtStore.token = `  ${EXAMPLE_TOKEN}  `;
		await jwtStore.copyToken();
		expect(writeText).toHaveBeenCalledWith(EXAMPLE_TOKEN);
	});
});
