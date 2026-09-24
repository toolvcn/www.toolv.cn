// 认证配置 → 要注入的请求头 / 查询参数。纯函数，不依赖 DOM，可单测。
//
// 注入规则只有一条：**手写的优先**。同名请求头由 store 的 requestHeaders 去重，
// 用户在「请求头」里显式写了 Authorization 就以他写的为准 —— 否则会出现
// 「我明明改了那条头，怎么还是旧的」这种解释不清的现象。
//
// 字段没填全就当作没开认证（不注入半条空头），这样切类型时不会把请求搞坏。

import { base64EncodeUtf8 } from './curl.ts';
import type { AuthConfig } from './types.ts';

/** 「无认证」的初值。切换类型时其余字段原样留着，所以初值要给全 */
export function emptyAuth(): AuthConfig {
	return { type: 'none', token: '', username: '', password: '', keyName: '', keyValue: '', keyIn: 'header' };
}

/** 认证要注入的请求头 */
export function authHeaders(auth: AuthConfig): { name: string; value: string }[] {
	if (auth.type === 'bearer') {
		const token = auth.token.trim();
		return token === '' ? [] : [{ name: 'Authorization', value: `Bearer ${token}` }];
	}
	if (auth.type === 'basic') {
		if (auth.username === '' && auth.password === '') return [];
		return [{ name: 'Authorization', value: `Basic ${base64EncodeUtf8(`${auth.username}:${auth.password}`)}` }];
	}
	if (auth.type === 'apikey' && auth.keyIn === 'header') {
		const name = auth.keyName.trim();
		return name === '' ? [] : [{ name, value: auth.keyValue }];
	}
	return [];
}

/** 认证要注入的查询参数：只有「API Key + 放查询参数」这一种情况 */
export function authQuery(auth: AuthConfig): { name: string; value: string }[] {
	if (auth.type !== 'apikey' || auth.keyIn !== 'query') return [];
	const name = auth.keyName.trim();
	return name === '' ? [] : [{ name, value: auth.keyValue }];
}

/**
 * 认证**会产生什么**的形状描述（面板上常驻一条，省得用户去猜到底附上了没有）。
 * **不回显密钥明文** —— 把 token 原样印在屏幕上没有意义，只是多一处泄露面。
 */
export function authPreview(auth: AuthConfig): string[] {
	if (auth.type === 'bearer') {
		return auth.token.trim() === '' ? [] : ['请求头 Authorization: Bearer <token>'];
	}
	if (auth.type === 'basic') {
		return auth.username === '' && auth.password === '' ? [] : ['请求头 Authorization: Basic <Base64(用户名:密码)>'];
	}
	if (auth.type === 'apikey') {
		const name = auth.keyName.trim();
		if (name === '') return [];
		return auth.keyIn === 'query' ? [`查询参数 ?${name}=<值>`] : [`请求头 ${name}: <值>`];
	}
	return [];
}

/** 认证方式下拉的选项（结构兼容 $lib/ui/Dropdown 的 DropdownOption） */
export const AUTH_TYPE_OPTIONS = [
	{ value: 'none', label: '无认证', description: '不自动附加认证信息；需要就在「请求头」里手写' },
	{ value: 'bearer', label: 'Bearer Token', description: '附加 Authorization: Bearer <token>' },
	{ value: 'basic', label: 'Basic Auth', description: '用户名与密码按 Base64 拼进 Authorization 头' },
	{ value: 'apikey', label: 'API Key', description: '键值对放进请求头或查询参数' }
] as const;
