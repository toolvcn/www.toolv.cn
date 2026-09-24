// 本机请求头的单测：拼出来的文本直接进请求头输入框，所以「每条都有值、拿不到就整条不写」要钉住。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatLocalHeaders, readBrowserHeaders, type BrowserHeaders } from './local-headers.ts';

function info(over: Partial<BrowserHeaders> = {}): BrowserHeaders {
	return { userAgent: 'Mozilla/5.0 (Test)', languages: ['zh-CN'], brands: [], mobile: null, platform: '', ...over };
}

/** 文本 → 名称/值对，按行断言比整串比较更好读 */
function parse(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split('\n')) {
		const at = line.indexOf(':');
		if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
	}
	return out;
}

describe('formatLocalHeaders', () => {
	it('基础的四项都在，每行都是「名称: 值」', () => {
		const headers = parse(formatLocalHeaders(info()));
		expect(headers['User-Agent']).toBe('Mozilla/5.0 (Test)');
		expect(headers['Accept']).toContain('text/html');
		expect(headers['Accept-Language']).toBe('zh-CN');
		expect(headers['Accept-Encoding']).toBe('gzip, deflate, br');
		expect(headers['Upgrade-Insecure-Requests']).toBe('1');
	});

	it('语言按优先级给权重，第一项不写 q', () => {
		const headers = parse(formatLocalHeaders(info({ languages: ['zh-CN', 'zh', 'en', 'ja', 'ko'] })));
		expect(headers['Accept-Language']).toBe('zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,ko;q=0.6');
	});

	it('一条语言都没有时给 *', () => {
		expect(parse(formatLocalHeaders(info({ languages: [] })))['Accept-Language']).toBe('*');
	});

	it('有 Client Hints 时补上 Sec-CH-UA 三项', () => {
		const headers = parse(
			formatLocalHeaders(
				info({
					brands: [
						{ brand: 'Chromium', version: '140' },
						{ brand: 'Not_A Brand', version: '24' }
					],
					mobile: false,
					platform: 'Windows'
				})
			)
		);
		expect(headers['Sec-CH-UA']).toBe('"Chromium";v="140", "Not_A Brand";v="24"');
		expect(headers['Sec-CH-UA-Mobile']).toBe('?0');
		expect(headers['Sec-CH-UA-Platform']).toBe('"Windows"');
	});

	it('拿不到的项整条不写，绝不写空值', () => {
		const headers = parse(formatLocalHeaders({ userAgent: '', languages: [], brands: [], mobile: null, platform: '' }));
		expect(headers['User-Agent']).toBeUndefined();
		expect(headers['Sec-CH-UA']).toBeUndefined();
		expect(headers['Sec-CH-UA-Mobile']).toBeUndefined();
		expect(headers['Sec-CH-UA-Platform']).toBeUndefined();
	});

	it('移动端写 ?1', () => {
		expect(parse(formatLocalHeaders(info({ mobile: true })))['Sec-CH-UA-Mobile']).toBe('?1');
	});
});

describe('readBrowserHeaders', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('没有 userAgentData 时 Client Hints 三项全空', () => {
		vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Test)', languages: ['zh-CN', 'en'] });
		expect(readBrowserHeaders()).toEqual({
			userAgent: 'Mozilla/5.0 (Test)',
			languages: ['zh-CN', 'en'],
			brands: [],
			mobile: null,
			platform: ''
		});
	});

	it('有 userAgentData 时把品牌 / 移动端 / 平台一起读出来', () => {
		vi.stubGlobal('navigator', {
			userAgent: 'Mozilla/5.0 (Test)',
			languages: ['zh-CN'],
			userAgentData: { brands: [{ brand: 'Chromium', version: '140' }], mobile: true, platform: 'Android' }
		});
		expect(readBrowserHeaders()).toMatchObject({
			brands: [{ brand: 'Chromium', version: '140' }],
			mobile: true,
			platform: 'Android'
		});
	});

	it('没有 languages 时退回单个 language', () => {
		vi.stubGlobal('navigator', { userAgent: 'UA', language: 'zh-CN' });
		expect(readBrowserHeaders().languages).toEqual(['zh-CN']);
	});
});
