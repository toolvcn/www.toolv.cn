// SSRF 守卫单测：只放行公网 http/https，拦截内网 / 回环 / 链路本地 / 元数据 / 保留主机名。
import { describe, expect, it } from 'vitest';
import { validateTargetUrl } from './guard.ts';

describe('validateTargetUrl', () => {
	it('放行公网 http / https', () => {
		expect(validateTargetUrl('https://example.com')).toBeNull();
		expect(validateTargetUrl('http://api.example.com/x?q=1')).toBeNull();
		expect(validateTargetUrl('https://example.com:8443/path')).toBeNull();
	});

	it('拦截非 http 协议', () => {
		expect(validateTargetUrl('file:///etc/passwd')).toContain('仅支持');
		expect(validateTargetUrl('ws://example.com/socket')).toContain('仅支持');
		expect(validateTargetUrl('ftp://example.com')).toContain('仅支持');
	});

	it('拦截回环与私有 IPv4', () => {
		expect(validateTargetUrl('http://127.0.0.1/x')).toContain('已拦截');
		expect(validateTargetUrl('http://10.0.0.5')).toContain('已拦截');
		expect(validateTargetUrl('http://172.16.3.4:8080')).toContain('已拦截');
		expect(validateTargetUrl('http://192.168.1.1')).toContain('已拦截');
	});

	it('拦截链路本地与云元数据地址', () => {
		expect(validateTargetUrl('http://169.254.169.254/latest/meta-data/')).toContain('已拦截');
		expect(validateTargetUrl('http://169.254.1.1/')).toContain('已拦截');
	});

	it('拦截 IPv6 回环 / 链路本地 / 内嵌 IPv4', () => {
		expect(validateTargetUrl('http://[::1]/')).toContain('已拦截');
		expect(validateTargetUrl('http://[fe80::1]/')).toContain('已拦截');
		expect(validateTargetUrl('http://[::ffff:127.0.0.1]/')).toContain('已拦截');
	});

	it('拦截内网保留主机名', () => {
		expect(validateTargetUrl('http://localhost:3000')).toContain('已拦截');
		expect(validateTargetUrl('http://router.internal')).toContain('已拦截');
		expect(validateTargetUrl('http://printer.lan')).toContain('已拦截');
		expect(validateTargetUrl('http://metadata.google.internal/')).toContain('已拦截');
	});

	it('拦截数字形式与异常地址', () => {
		expect(validateTargetUrl('http://2130706433/')).toContain('已拦截');
	});

	it('URL 无法解析时报错', () => {
		expect(validateTargetUrl('not a url')).toContain('无法解析');
		expect(validateTargetUrl('')).toContain('无法解析');
	});
});
