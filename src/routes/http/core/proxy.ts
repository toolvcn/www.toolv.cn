// 服务器代发（测速）两端共用的协议类型与浏览器侧纯函数。
// 服务端实现见 src/routes/http/proxy/+server.ts；这里只放两端都要引用的
// 类型、base64 解码与速度格式化（不依赖 DOM，可单测）。

import type { HttpMethod, SpeedMetrics } from './types.ts';

/** 代理端点路径（全站无 base path，直接写死；客户端 fetch 用） */
export const PROXY_ENDPOINT = '/http/proxy';

/** 客户端发给代理端点的请求体 */
export interface ProxyRequestPayload {
	url: string;
	method: HttpMethod;
	/** 已解析、要实际发送的请求头（含自动注入的 Content-Type） */
	headers: { name: string; value: string }[];
	body: string;
	timeoutMs: number;
}

/** 代理成功转发的结果；响应体用 base64 承载，防二进制 / 乱码 */
export interface ProxySuccess {
	ok: true;
	status: number;
	statusText: string;
	headers: { name: string; value: string }[];
	bodyBase64: string;
	metrics: SpeedMetrics;
}

/** 代理业务失败（拦截 / 超时 / 目标不可达），message 直接展示给用户 */
export interface ProxyFailure {
	ok: false;
	message: string;
}

export type ProxyResponse = ProxySuccess | ProxyFailure;

/** 代理返回业务失败时抛给编排层，让 send() 归类为明确的服务端消息 */
export class ProxyServerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProxyServerError';
	}
}

/** base64 → UTF-8 文本（服务端对响应体做了 base64，客户端这里解回来） */
export function decodeBase64Utf8(base64: string): string {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

/** 速度人性化显示：B/s / KB/s / MB/s */
export function formatSpeed(speedBps: number): string {
	if (speedBps < 1024) return `${Math.round(speedBps)} B/s`;
	if (speedBps < 1024 * 1024) return `${(speedBps / 1024).toFixed(1)} KB/s`;
	return `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`;
}
