// 认证 → 请求头 / 查询参数 的单测。
import { describe, expect, it } from 'vitest';
import { authHeaders, authPreview, authQuery, emptyAuth } from './auth.ts';
import { base64EncodeUtf8 } from './curl.ts';

describe('authHeaders', () => {
	it('无认证不注入任何头', () => {
		expect(authHeaders(emptyAuth())).toEqual([]);
	});

	it('Bearer 去掉首尾空白后注入', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'bearer', token: ' abc ' })).toEqual([
			{ name: 'Authorization', value: 'Bearer abc' }
		]);
	});

	it('Bearer 没填 token 时不注入（不给半条空头）', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'bearer', token: '  ' })).toEqual([]);
	});

	it('Basic 按 UTF-8 拼 Base64，中文用户名不抛异常', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'basic', username: '无情', password: 'p' })).toEqual([
			{ name: 'Authorization', value: `Basic ${base64EncodeUtf8('无情:p')}` }
		]);
	});

	it('Basic 用户名与密码都空时不注入', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'basic' })).toEqual([]);
	});

	it('API Key 放请求头时用自定义键名；键名为空不注入', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'apikey', keyName: 'X-Key', keyValue: 'v' })).toEqual([
			{ name: 'X-Key', value: 'v' }
		]);
		expect(authHeaders({ ...emptyAuth(), type: 'apikey', keyName: ' ', keyValue: 'v' })).toEqual([]);
	});

	it('API Key 选了放查询参数时不出请求头', () => {
		expect(authHeaders({ ...emptyAuth(), type: 'apikey', keyName: 'X-Key', keyValue: 'v', keyIn: 'query' })).toEqual(
			[]
		);
	});
});

describe('authQuery', () => {
	it('只有「API Key + 放查询参数」才有', () => {
		expect(authQuery({ ...emptyAuth(), type: 'apikey', keyName: 'k', keyValue: 'v', keyIn: 'query' })).toEqual([
			{ name: 'k', value: 'v' }
		]);
		expect(authQuery({ ...emptyAuth(), type: 'bearer', token: 't' })).toEqual([]);
		expect(authQuery({ ...emptyAuth(), type: 'apikey', keyName: 'k', keyValue: 'v' })).toEqual([]);
	});
});

describe('authPreview', () => {
	it('无认证时没有可展示的预览', () => {
		expect(authPreview(emptyAuth())).toEqual([]);
	});

	it('不回显密钥明文', () => {
		const lines = authPreview({ ...emptyAuth(), type: 'bearer', token: 'secret-token' });
		expect(lines).toEqual(['请求头 Authorization: Bearer <token>']);
		expect(lines.join(' ')).not.toContain('secret-token');
	});

	it('说明 API Key 放在哪儿', () => {
		expect(authPreview({ ...emptyAuth(), type: 'apikey', keyName: 'X-Key', keyValue: 'v' })).toEqual([
			'请求头 X-Key: <值>'
		]);
		expect(authPreview({ ...emptyAuth(), type: 'apikey', keyName: 'X-Key', keyValue: 'v', keyIn: 'query' })).toEqual([
			'查询参数 ?X-Key=<值>'
		]);
	});
});
