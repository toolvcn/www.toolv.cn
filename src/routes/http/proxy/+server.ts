// 服务器代发端点（POST /http/proxy）：绕开浏览器 CORS 限制，转发完整 HTTP 请求并返回测速指标。
// 只在用户开启「服务器代发」开关后由客户端调用；入口做 SSRF 拦截（guard.ts）。
// 返回统一 JSON 信封（core/proxy.ts 的 ProxyResponse）：ok=true 带响应与指标，ok=false 带原因。

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ProxyRequestPayload, ProxyResponse } from '../core/proxy.ts';
import type { HttpMethod, SpeedMetrics } from '../core/types.ts';
import { validateTargetUrl } from './guard.ts';
// 响应体上限、超时上下限与兜底值都在根层的 config.ts（纯常量，服务端也能直接读）
import { DEFAULT_TIMEOUT_MS, MAX_PROXY_BODY_BYTES, MAX_PROXY_TIMEOUT_MS, MIN_PROXY_TIMEOUT_MS } from '../config.ts';

/** 转发时不允许由客户端指定的请求头：由代理 / 目标服务器掌控，强行指定会破坏转发 */
const FORBIDDEN_HEADERS = new Set([
	'host',
	'connection',
	'content-length',
	'transfer-encoding',
	'accept-encoding',
	'keep-alive',
	'proxy-connection',
	'te',
	'trailer',
	'upgrade'
]);

/** GET / HEAD 不消费请求体 */
function isBodyMethod(method: HttpMethod): boolean {
	return method !== 'GET' && method !== 'HEAD';
}

/** 请求体里的 method 必须是已知方法之一，避免把任意字符串喂给 fetch */
const KNOWN_METHODS: readonly string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** 宽松校验客户端 payload；非法返回 null */
function parsePayload(input: unknown): ProxyRequestPayload | null {
	if (typeof input !== 'object' || input === null) return null;
	const p = input as Record<string, unknown>;
	if (typeof p.url !== 'string' || typeof p.method !== 'string') return null;
	if (!KNOWN_METHODS.includes(p.method)) return null;
	const headers = Array.isArray(p.headers)
		? p.headers.filter(
				(h): h is { name: string; value: string } =>
					typeof h === 'object' &&
					h !== null &&
					typeof (h as Record<string, unknown>).name === 'string' &&
					typeof (h as Record<string, unknown>).value === 'string'
			)
		: [];
	const timeoutMs = typeof p.timeoutMs === 'number' && Number.isFinite(p.timeoutMs) ? p.timeoutMs : DEFAULT_TIMEOUT_MS;
	return {
		url: p.url,
		method: p.method as HttpMethod,
		headers,
		body: typeof p.body === 'string' ? p.body : '',
		timeoutMs
	};
}

/** Uint8Array → base64（分段防超长栈溢出） */
function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const step = 0x8000;
	for (let i = 0; i < bytes.length; i += step) {
		binary += String.fromCharCode(...bytes.subarray(i, i + step));
	}
	return btoa(binary);
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: ProxyRequestPayload | null;
	try {
		payload = parsePayload(await request.json());
	} catch {
		payload = null;
	}
	if (payload === null) {
		return json({ ok: false, message: '请求参数不合法' } satisfies ProxyResponse);
	}

	const blocked = validateTargetUrl(payload.url);
	if (blocked !== null) {
		return json({ ok: false, message: blocked } satisfies ProxyResponse);
	}

	const timeoutMs = Math.min(Math.max(payload.timeoutMs, MIN_PROXY_TIMEOUT_MS), MAX_PROXY_TIMEOUT_MS);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const started = performance.now();

	try {
		const headers = new Headers();
		for (const h of payload.headers) {
			const name = h.name.trim();
			if (name === '' || FORBIDDEN_HEADERS.has(name.toLowerCase())) continue;
			try {
				headers.set(name, h.value);
			} catch {
				/* 非法头名直接跳过，不让单条坏头拖垮整个请求 */
			}
		}
		const res = await fetch(payload.url, {
			method: payload.method,
			headers,
			body: isBodyMethod(payload.method) && payload.body !== '' ? payload.body : undefined,
			signal: controller.signal
		});
		const ttfbMs = performance.now() - started;

		// 读响应体并封顶：前 MAX_PROXY_BODY_BYTES 字节照收，超出即截断，速度仍按已读部分算
		let bytesRead = 0;
		let truncated = false;
		const chunks: Uint8Array[] = [];
		if (res.body !== null) {
			const reader = res.body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value === undefined || value.byteLength === 0) continue;
				const remaining = MAX_PROXY_BODY_BYTES - bytesRead;
				if (remaining <= 0) {
					truncated = true;
					await reader.cancel();
					break;
				}
				if (value.byteLength > remaining) {
					chunks.push(value.subarray(0, remaining));
					bytesRead += remaining;
					truncated = true;
					await reader.cancel();
					break;
				}
				chunks.push(value);
				bytesRead += value.byteLength;
			}
		}
		const totalMs = performance.now() - started;

		const body = new Uint8Array(bytesRead);
		let offset = 0;
		for (const chunk of chunks) {
			body.set(chunk, offset);
			offset += chunk.byteLength;
		}

		// 下载速度：优先按下载耗时（读完 body 的时长），过短时退化为总耗时
		const downloadMs = totalMs - ttfbMs;
		const speedBps = (bytesRead / Math.max(downloadMs > 1 ? downloadMs : totalMs, 0.001)) * 1000;

		const headerList: { name: string; value: string }[] = [];
		res.headers.forEach((value, name) => headerList.push({ name, value }));

		const metrics: SpeedMetrics = {
			ttfbMs: Math.round(ttfbMs),
			totalMs: Math.round(totalMs),
			bytes: bytesRead,
			speedBps: Math.round(speedBps),
			truncated
		};

		return json({
			ok: true,
			status: res.status,
			statusText: res.statusText,
			headers: headerList,
			bodyBase64: toBase64(body),
			metrics
		} satisfies ProxyResponse);
	} catch (cause) {
		const name = cause instanceof Error ? cause.name : '';
		if (name === 'AbortError') {
			return json({
				ok: false,
				message: `目标 ${timeoutMs / 1000} 秒内未响应，已超时中断`
			} satisfies ProxyResponse);
		}
		return json({ ok: false, message: '目标不可达或请求被拒绝，请检查 URL 与网络后重试' } satisfies ProxyResponse);
	} finally {
		clearTimeout(timer);
	}
};
