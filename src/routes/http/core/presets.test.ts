// 参数预设序列化 / 校验的纯函数单测。
import { describe, expect, it } from 'vitest';
import { parsePresets, serializePresets } from './presets.ts';
import type { HttpPreset } from './types.ts';

function preset(overrides: Partial<HttpPreset> = {}): HttpPreset {
	return {
		id: 0,
		name: 'A',
		method: 'GET',
		url: 'https://a.example',
		headersText: '',
		body: '',
		contentType: 'none',
		timeoutMs: 10_000,
		...overrides
	};
}

describe('parsePresets', () => {
	it('非 JSON / 非数组直接失败', () => {
		expect(parsePresets('不是 JSON').ok).toBe(false);
		expect(parsePresets('{"a":1}').ok).toBe(false);
	});

	it('任一条字段不合法则整体失败', () => {
		const text = JSON.stringify([preset(), { name: '缺 URL' }]);
		expect(parsePresets(text).ok).toBe(false);
	});

	it('方法 / Content-Type 不在枚举里时失败', () => {
		expect(parsePresets(JSON.stringify([preset({ method: 'FETCH' as never })])).ok).toBe(false);
		expect(parsePresets(JSON.stringify([preset({ contentType: 'text/html' as never })])).ok).toBe(false);
	});

	it('合法数组解析成功，名称与 URL 修剪空白', () => {
		const text = JSON.stringify([preset({ name: '  接口 A  ', url: '  https://a.example/x  ', timeoutMs: 0 })]);
		const parsed = parsePresets(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]).toMatchObject({ name: '接口 A', url: 'https://a.example/x', timeoutMs: 10_000 });
	});

	it('serializePresets 导出可被 parsePresets 还原', () => {
		const presets = [
			preset({ name: '往返', method: 'POST', headersText: 'X: 1', body: '{}', contentType: 'application/json' })
		];
		const parsed = parsePresets(serializePresets(presets));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets).toEqual([
			preset({ name: '往返', method: 'POST', headersText: 'X: 1', body: '{}', contentType: 'application/json' })
		]);
	});

	it('旧文件没有参数行与认证也能读进来，且不会凭空多出这两个键', () => {
		const parsed = parsePresets(JSON.stringify([preset()]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]).not.toHaveProperty('params');
		expect(parsed.presets[0]).not.toHaveProperty('auth');
	});

	it('参数行与认证随预设一起往返', () => {
		const withExtras = preset({
			params: [{ id: 0, enabled: true, name: 'page', value: '1' }],
			auth: { type: 'bearer', token: 't', username: '', password: '', keyName: '', keyValue: '', keyIn: 'header' }
		});
		const parsed = parsePresets(serializePresets([withExtras]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].params).toEqual([{ id: 0, enabled: true, name: 'page', value: '1' }]);
		expect(parsed.presets[0].auth?.type).toBe('bearer');
		expect(parsed.presets[0].auth?.token).toBe('t');
	});

	it('凭证模式随预设一起往返；旧文件没有这一项就不带这个键', () => {
		const parsed = parsePresets(serializePresets([preset({ credentials: 'include' })]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].credentials).toBe('include');
		// 老预设没有这一项：按 same-origin 兜底（store 的默认值），不往导出文件里塞 null
		expect(parsed.presets[0]).not.toBeUndefined();
		const old = parsePresets(JSON.stringify([preset()]));
		expect(old.ok).toBe(true);
		if (!old.ok) return;
		expect(old.presets[0]).not.toHaveProperty('credentials');
	});

	it('凭证模式只认三个值，写错了就当没给', () => {
		const parsed = parsePresets(JSON.stringify([{ ...preset(), credentials: 'always' }]));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0]).not.toHaveProperty('credentials');
	});

	it('认证类型不认识时落到「无认证」，不因此整份失败', () => {
		const text = JSON.stringify([{ ...preset(), auth: { type: 'oauth2', token: 'x' } }]);
		const parsed = parsePresets(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets[0].auth?.type).toBe('none');
	});
});
