// 编排层单测：注入 fake fetch，验证发送、错误归类、表单操作与参数预设。
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 代发超时上限与请求示例在根层的 config.ts（与 store 同源）
import { MAX_PROXY_TIMEOUT_MS, REQUEST_EXAMPLES } from '../config.ts';
import { emptyAuth } from './auth.ts';
import { CONTENT_TYPE_OPTIONS, HTTP_METHODS } from './types.ts';
import { parsePresets } from './presets.ts';
import { httpStore, normalizeUrl } from './store.svelte.ts';

/** 返回固定 Response 的 fake fetch */
function respond(response: Response): typeof fetch {
	return async () => response;
}

/** 挂起直到 signal abort，abort 时抛 AbortError */
function hangingFetch(): typeof fetch {
	return async (_input, init) =>
		new Promise((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => {
				reject(new DOMException('The operation was aborted.', 'AbortError'));
			});
		});
}

beforeEach(() => {
	httpStore.method = 'GET';
	// 走 setUrl 而不是直接赋值：url 与参数行互为镜像，直接赋值会让两者对不上
	httpStore.setUrl('');
	httpStore.headersText = '';
	httpStore.body = '';
	httpStore.contentType = 'none';
	httpStore.timeoutMs = 10_000;
	httpStore.serverMode = false;
	httpStore.formRows = [];
	httpStore.auth = emptyAuth();
	httpStore.presets = [];
	httpStore.presetName = '';
	httpStore.phase = 'idle';
	httpStore.response = null;
	httpStore.error = null;
	httpStore.tab = 'request';
	httpStore.importText = '';
	httpStore.exportFormat = 'curl-bash';
	httpStore.requestCollapsed = false;
	httpStore.responseCollapsed = false;
	httpStore.focusedStatus = null;
	httpStore.responseView = 'formatted';
	httpStore.fetchImpl = respond(new Response('', { status: 200 }));
});

describe('normalizeUrl', () => {
	it('无协议补 https://，有协议原样保留', () => {
		expect(normalizeUrl('api.example.com/x')).toBe('https://api.example.com/x');
		expect(normalizeUrl('http://api.example.com/x')).toBe('http://api.example.com/x');
	});

	it('空串与非法 URL 返回 null', () => {
		expect(normalizeUrl('')).toBeNull();
		expect(normalizeUrl('   ')).toBeNull();
		expect(normalizeUrl('not a url')).toBeNull();
	});
});

describe('send', () => {
	it('成功请求组装 response 与 statusText', async () => {
		httpStore.url = 'https://api.example.com/get';
		httpStore.fetchImpl = respond(new Response('{"ok":true}', { status: 200, statusText: 'OK' }));
		await httpStore.send();
		expect(httpStore.phase).toBe('done');
		expect(httpStore.response?.status).toBe(200);
		expect(httpStore.response?.body).toBe('{"ok":true}');
		expect(httpStore.response?.bodyBytes).toBe(11);
		expect(httpStore.response?.durationMs).toBeGreaterThanOrEqual(0);
		expect(httpStore.error).toBeNull();
		expect(httpStore.statusText).toContain('200');
	});

	it('只发送按行解析出的头，body 非空时自动注入 Content-Type', async () => {
		httpStore.method = 'POST';
		httpStore.url = 'https://api.example.com/post';
		httpStore.body = '{"a":1}';
		httpStore.contentType = 'application/json';
		httpStore.headersText = 'X-Keep: 1\n# X-Off: 2\n# 注释不发送\n: 空名称不发送';
		let captured: Record<string, string> = {};
		let capturedBody: string | undefined;
		httpStore.fetchImpl = async (_input, init) => {
			captured = (init?.headers as Record<string, string>) ?? {};
			capturedBody = init?.body as string | undefined;
			return new Response('{}', { status: 200 });
		};
		await httpStore.send();
		expect(captured['X-Keep']).toBe('1');
		expect(captured['X-Off']).toBeUndefined();
		expect(captured['Content-Type']).toBe('application/json');
		expect(capturedBody).toBe('{"a":1}');
	});

	it('404 作为正常响应落进 response，不误判为 error', async () => {
		httpStore.url = 'https://api.example.com/missing';
		httpStore.fetchImpl = respond(new Response('nope', { status: 404, statusText: 'Not Found' }));
		await httpStore.send();
		expect(httpStore.response?.status).toBe(404);
		expect(httpStore.response?.ok).toBe(false);
		expect(httpStore.error).toBeNull();
	});

	it('结果文案里状态码后面带简略信息（取自本地状态码表）', async () => {
		httpStore.url = 'https://api.example.com/missing';
		httpStore.fetchImpl = respond(new Response('nope', { status: 404, statusText: 'Not Found' }));
		await httpStore.send();
		// 显示中文简略信息，不是服务端那句英文 reason phrase（HTTP/2 下它还是空串）
		expect(httpStore.statusText).toContain('404 未找到');
	});

	it('响应后 focusedStatus 记录状态码，供速查面板自动定位', async () => {
		httpStore.url = 'https://api.example.com/get';
		httpStore.fetchImpl = respond(new Response('', { status: 201, statusText: 'Created' }));
		await httpStore.send();
		expect(httpStore.focusedStatus).toBe(201);
	});

	it('发送中与失败时不留下过期的 focusedStatus', async () => {
		httpStore.url = 'https://cors-blocked.example/x';
		httpStore.fetchImpl = async () => {
			throw new TypeError('Failed to fetch');
		};
		await httpStore.send();
		expect(httpStore.focusedStatus).toBeNull();
		// 先成功再失败，旧值不应残留
		httpStore.url = 'https://api.example.com/ok';
		httpStore.fetchImpl = respond(new Response('', { status: 202, statusText: 'Accepted' }));
		await httpStore.send();
		expect(httpStore.focusedStatus).toBe(202);
		httpStore.fetchImpl = async () => {
			throw new TypeError('Failed to fetch');
		};
		await httpStore.send();
		expect(httpStore.focusedStatus).toBeNull();
	});

	it('网络失败（CORS / 不可达）归类 network，cURL 兜底可用', async () => {
		httpStore.method = 'POST';
		httpStore.url = 'https://cors-blocked.example/x';
		httpStore.body = '{"a":1}';
		httpStore.contentType = 'application/json';
		httpStore.fetchImpl = async () => {
			throw new TypeError('Failed to fetch');
		};
		await httpStore.send();
		expect(httpStore.error?.kind).toBe('network');
		expect(httpStore.error?.message).toContain('CORS');
		// 提醒「报错不代表请求没发生」：调写接口时这条最关键（文案里的兜底路线由界面上的两个按钮给）
		expect(httpStore.error?.message).toContain('不代表请求没发出去');
		expect(httpStore.curlText).toContain('--request POST');
	});

	it('超时自动中断并归类 timeout', async () => {
		vi.useFakeTimers();
		try {
			httpStore.timeoutMs = 5000;
			httpStore.url = 'https://slow.example/x';
			httpStore.fetchImpl = hangingFetch();
			const pending = httpStore.send();
			await vi.advanceTimersByTimeAsync(5000);
			await pending;
			expect(httpStore.error?.kind).toBe('timeout');
			expect(httpStore.error?.message).toContain('5 秒');
		} finally {
			vi.useRealTimers();
		}
	});

	it('手动取消归类 abort', async () => {
		httpStore.url = 'https://slow.example/x';
		httpStore.fetchImpl = hangingFetch();
		const pending = httpStore.send();
		httpStore.cancel();
		await pending;
		expect(httpStore.error?.kind).toBe('abort');
	});

	it('URL 无法解析时归类 invalid-url 且不发起请求', async () => {
		httpStore.url = 'not a url';
		const spy = vi.fn();
		httpStore.fetchImpl = async () => {
			spy();
			return new Response('', { status: 200 });
		};
		await httpStore.send();
		expect(httpStore.error?.kind).toBe('invalid-url');
		expect(spy).not.toHaveBeenCalled();
	});

	it('空 URL 不发送', async () => {
		const spy = vi.fn();
		httpStore.fetchImpl = async () => {
			spy();
			return new Response('', { status: 200 });
		};
		await httpStore.send();
		expect(spy).not.toHaveBeenCalled();
	});

	it('服务器代发：走 /http/proxy 并解析信封与测速指标', async () => {
		httpStore.serverMode = true;
		httpStore.url = 'https://api.example.com/get';
		let capturedPath = '';
		let capturedPayload: Record<string, unknown> = {};
		httpStore.fetchImpl = async (input, init) => {
			capturedPath = String(input);
			capturedPayload = JSON.parse(String(init?.body));
			return new Response(
				JSON.stringify({
					ok: true,
					status: 200,
					statusText: 'OK',
					headers: [{ name: 'x-test', value: '1' }],
					bodyBase64: btoa(String.fromCharCode(...new TextEncoder().encode('{"ok":true}'))),
					metrics: { ttfbMs: 12, totalMs: 34, bytes: 11, speedBps: 5000, truncated: false }
				}),
				{ status: 200 }
			);
		};
		await httpStore.send();
		expect(capturedPath).toBe('/http/proxy');
		expect(capturedPayload.url).toBe('https://api.example.com/get');
		expect(capturedPayload.timeoutMs).toBe(10_000);
		expect(httpStore.phase).toBe('done');
		expect(httpStore.response?.status).toBe(200);
		expect(httpStore.response?.body).toBe('{"ok":true}');
		expect(httpStore.response?.bodyBytes).toBe(11);
		expect(httpStore.response?.serverMetrics?.ttfbMs).toBe(12);
		expect(httpStore.response?.serverMetrics?.speedBps).toBe(5000);
		expect(httpStore.error).toBeNull();
	});

	it('服务器代发：拦截类业务失败归类 error 且不留响应', async () => {
		httpStore.serverMode = true;
		httpStore.url = 'https://api.example.com/get';
		httpStore.fetchImpl = async () =>
			new Response(JSON.stringify({ ok: false, message: '已拦截：目标地址是内网 / 本机地址，代理不允许访问' }), {
				status: 200
			});
		await httpStore.send();
		expect(httpStore.error?.message).toContain('已拦截');
		expect(httpStore.response).toBeNull();
		expect(httpStore.focusedStatus).toBeNull();
	});

	it('服务器代发：代理本身不可达时给出代发专属文案', async () => {
		httpStore.serverMode = true;
		httpStore.url = 'https://api.example.com/get';
		httpStore.fetchImpl = async () => {
			throw new TypeError('Failed to fetch');
		};
		await httpStore.send();
		expect(httpStore.error?.kind).toBe('network');
		expect(httpStore.error?.message).toContain('服务器代发失败');
	});
});

describe('超时上限', () => {
	it('浏览器直发用所选档位，不受代发上限约束', () => {
		httpStore.timeoutMs = 60_000;
		expect(httpStore.effectiveTimeoutMs).toBe(60_000);
	});

	it('服务器代发把超过上限的档位夹到上限，没超的保持不变', () => {
		httpStore.serverMode = true;
		httpStore.timeoutMs = 60_000;
		expect(httpStore.effectiveTimeoutMs).toBe(MAX_PROXY_TIMEOUT_MS);
		httpStore.timeoutMs = 30_000;
		expect(httpStore.effectiveTimeoutMs).toBe(MAX_PROXY_TIMEOUT_MS);
		httpStore.timeoutMs = 5_000;
		expect(httpStore.effectiveTimeoutMs).toBe(5_000);
	});

	it('代发 payload 发的是夹过的值，且不改写用户所选档位', async () => {
		httpStore.serverMode = true;
		httpStore.timeoutMs = 30_000;
		httpStore.url = 'https://api.example.com/get';
		let sent: Record<string, unknown> = {};
		httpStore.fetchImpl = async (_input, init) => {
			sent = JSON.parse(String(init?.body));
			return new Response(
				JSON.stringify({
					ok: true,
					status: 200,
					statusText: 'OK',
					headers: [],
					bodyBase64: '',
					metrics: { ttfbMs: 1, totalMs: 2, bytes: 0, speedBps: 0, truncated: false }
				}),
				{ status: 200 }
			);
		};
		await httpStore.send();
		expect(sent.timeoutMs).toBe(MAX_PROXY_TIMEOUT_MS);
		// 关掉代发就回到用户选的 30 秒 —— 夹的是「生效值」，不是表单里的档位
		httpStore.serverMode = false;
		expect(httpStore.effectiveTimeoutMs).toBe(30_000);
	});
});

describe('表单操作', () => {
	it('headersText 按行解析为发送的头，注释与无冒号行被忽略', () => {
		httpStore.headersText = 'Accept: application/json\nX-Token: abc\n\n# 注释\n没有冒号';
		expect(httpStore.effectiveHeaders).toEqual([
			{ name: 'Accept', value: 'application/json' },
			{ name: 'X-Token', value: 'abc' }
		]);
	});

	it('「本机」按钮把请求头整块覆盖成本机会带的那些', () => {
		httpStore.headersText = 'X-Old: 1';
		httpStore.fillLocalHeaders();
		expect(httpStore.headersText).toContain('Accept:');
		expect(httpStore.headersText).not.toContain('X-Old');
	});

	it('「清空」按钮清空后一条生效的请求头都不剩', () => {
		httpStore.headersText = 'X-Token: abc';
		httpStore.clearHeaders();
		expect(httpStore.headersText).toBe('');
		expect(httpStore.effectiveHeaders).toEqual([]);
	});

	it('setMethod 切到 GET 时清空 body', () => {
		httpStore.method = 'POST';
		httpStore.body = '{"a":1}';
		httpStore.setMethod('GET');
		expect(httpStore.body).toBe('');
		expect(httpStore.isBodyAllowed).toBe(false);
	});

	it('applyParsedForm 写回表单（含请求头文本）并切到 request 标签', () => {
		httpStore.tab = 'text';
		httpStore.applyParsedForm({
			method: 'POST',
			url: 'https://x.example/api',
			headers: [
				{ name: 'X-Token', value: 'abc' },
				{ name: 'Accept', value: 'application/json' }
			],
			body: '{"a":1}',
			contentType: 'application/json'
		});
		expect(httpStore.method).toBe('POST');
		expect(httpStore.url).toBe('https://x.example/api');
		expect(httpStore.headersText).toBe('X-Token: abc\nAccept: application/json');
		expect(httpStore.body).toBe('{"a":1}');
		expect(httpStore.contentType).toBe('application/json');
		expect(httpStore.tab).toBe('request');
	});

	it('exportText 跟着导出格式走，且含认证注入后的请求头', () => {
		httpStore.method = 'POST';
		httpStore.setUrl('https://x.example/api');
		httpStore.setAuth({ type: 'bearer', token: 'tok' });

		httpStore.exportFormat = 'curl-cmd';
		expect(httpStore.exportText).toContain('--header "Authorization: Bearer tok"');

		// 带 authorization 头 → 浏览器版 fetch 给 credentials: include（与 DevTools 同口径）
		httpStore.exportFormat = 'fetch';
		expect(httpStore.exportText).toContain('"credentials": "include"');

		httpStore.exportFormat = 'node-fetch';
		expect(httpStore.exportText).not.toContain('"credentials"');
	});
});

describe('面板折叠', () => {
	it('两个面板各自独立收起 / 展开', () => {
		expect(httpStore.requestCollapsed).toBe(false);
		expect(httpStore.responseCollapsed).toBe(false);

		httpStore.toggleRequestCollapsed();
		expect(httpStore.requestCollapsed).toBe(true);
		expect(httpStore.responseCollapsed).toBe(false);

		httpStore.toggleRequestCollapsed();
		httpStore.toggleResponseCollapsed();
		expect(httpStore.requestCollapsed).toBe(false);
		expect(httpStore.responseCollapsed).toBe(true);
	});
});

describe('参数预设', () => {
	it('savePreset 缺名称或 URL 不保存，成功后清空名称输入', () => {
		httpStore.savePreset();
		expect(httpStore.presets).toHaveLength(0);

		httpStore.presetName = '示例';
		httpStore.savePreset(); // URL 仍为空
		expect(httpStore.presets).toHaveLength(0);

		httpStore.url = 'https://x.example';
		httpStore.savePreset();
		expect(httpStore.presets).toHaveLength(1);
		expect(httpStore.presetName).toBe('');
		expect(httpStore.presets[0]).toMatchObject({ name: '示例', url: 'https://x.example' });
	});

	it('applyPreset 回填表单并切到 request 标签', () => {
		httpStore.method = 'POST';
		httpStore.url = 'https://x.example/api';
		httpStore.headersText = 'X-Token: abc';
		httpStore.body = '{"a":1}';
		httpStore.contentType = 'application/json';
		httpStore.presetName = '接口 A';
		httpStore.savePreset();

		httpStore.tab = 'text';
		httpStore.clearForm();
		httpStore.applyPreset(httpStore.presets[0].id);
		expect(httpStore.tab).toBe('request');
		expect(httpStore.method).toBe('POST');
		expect(httpStore.url).toBe('https://x.example/api');
		expect(httpStore.headersText).toBe('X-Token: abc');
		expect(httpStore.body).toBe('{"a":1}');
		expect(httpStore.contentType).toBe('application/json');
	});

	it('deletePreset 删除对应条目', () => {
		httpStore.url = 'https://x.example';
		httpStore.presetName = 'A';
		httpStore.savePreset();
		httpStore.presetName = 'B';
		httpStore.savePreset();
		const id = httpStore.presets[0].id;
		httpStore.deletePreset(id);
		expect(httpStore.presets).toHaveLength(1);
		expect(httpStore.presets[0].name).toBe('B');
	});

	it('importPresetsText 校验失败不导入，成功合并进列表', () => {
		httpStore.importPresetsText('不是 JSON');
		expect(httpStore.presets).toHaveLength(0);

		httpStore.importPresetsText(JSON.stringify([{ name: '坏预设' }]));
		expect(httpStore.presets).toHaveLength(0);

		const good = JSON.stringify([
			{
				name: '导入 A',
				method: 'POST',
				url: 'https://a.example',
				headersText: 'X: 1',
				body: '{}',
				contentType: 'application/json',
				timeoutMs: 5000
			}
		]);
		httpStore.importPresetsText(good);
		expect(httpStore.presets).toHaveLength(1);
		expect(httpStore.presets[0]).toMatchObject({ name: '导入 A', method: 'POST', timeoutMs: 5000 });
	});

	it('presetsText 导出的文本可再次解析还原', () => {
		httpStore.url = 'https://x.example';
		httpStore.presetName = '往返';
		httpStore.savePreset();
		const text = httpStore.presetsText;
		const parsed = parsePresets(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.presets).toHaveLength(1);
		expect(parsed.presets[0]).toMatchObject({ name: '往返', url: 'https://x.example' });
	});

	it('restorePresets 重新分配 id，避免与新增冲突', () => {
		httpStore.restorePresets([
			{
				id: 1,
				name: '旧',
				method: 'GET',
				url: 'https://old.example',
				headersText: '',
				body: '',
				contentType: 'none',
				timeoutMs: 10_000
			}
		]);
		httpStore.url = 'https://new.example';
		httpStore.presetName = '新';
		httpStore.savePreset();
		const ids = httpStore.presets.map((p) => p.id);
		expect(new Set(ids).size).toBe(2);
	});
});

describe('查询参数表', () => {
	it('setUrl 解析出参数行，改行写回 URL，停用的行不写回', () => {
		httpStore.setUrl('https://x.example/api?page=1&size=20');
		expect(httpStore.params.map((row) => [row.name, row.value])).toEqual([
			['page', '1'],
			['size', '20']
		]);

		httpStore.updateParam(httpStore.params[1].id, { enabled: false });
		expect(httpStore.url).toBe('https://x.example/api?page=1');

		httpStore.updateParam(httpStore.params[0].id, { value: '3' });
		expect(httpStore.url).toBe('https://x.example/api?page=3');
	});

	it('删除行与直接改 URL 都能收敛到同一份数据', () => {
		httpStore.setUrl('https://x.example/api?a=1&b=2');
		httpStore.removeParam(httpStore.params[0].id);
		expect(httpStore.url).toBe('https://x.example/api?b=2');

		httpStore.setUrl('https://x.example/api?c=3');
		expect(httpStore.params.map((row) => row.name)).toEqual(['c']);
	});
});

describe('认证注入', () => {
	it('Bearer 注入 Authorization，手写的同名头优先', () => {
		httpStore.setAuth({ type: 'bearer', token: 't' });
		expect(httpStore.requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer t' }]);

		httpStore.headersText = 'Authorization: 手写的';
		expect(httpStore.requestHeaders.length).toBe(1);
		expect(httpStore.requestHeaders[0].value).toBe('手写的');
	});

	it('API Key 放查询参数时补进生效 URL，手写的同名参数优先；URL 本身不变', () => {
		httpStore.setUrl('https://x.example/api');
		httpStore.setAuth({ type: 'apikey', keyName: 'k', keyValue: 'v', keyIn: 'query' });
		expect(httpStore.effectiveUrl).toBe('https://x.example/api?k=v');
		expect(httpStore.url).toBe('https://x.example/api');

		httpStore.setUrl('https://x.example/api?k=mine');
		expect(httpStore.effectiveUrl).toBe('https://x.example/api?k=mine');
	});
});

describe('表单类型的请求体', () => {
	it('由键值表拼出正文，停用与空键名的行不参与', () => {
		httpStore.method = 'POST';
		httpStore.contentType = 'application/x-www-form-urlencoded';
		httpStore.formRows = [
			{ id: 1, enabled: true, name: 'a', value: '1' },
			{ id: 2, enabled: true, name: 'b', value: 'x y' },
			{ id: 3, enabled: false, name: 'c', value: '3' },
			{ id: 4, enabled: true, name: '', value: '4' }
		];
		expect(httpStore.effectiveBody).toBe('a=1&b=x%20y');
	});

	it('GET 时不发送请求体', () => {
		httpStore.contentType = 'application/x-www-form-urlencoded';
		httpStore.formRows = [{ id: 1, enabled: true, name: 'a', value: '1' }];
		expect(httpStore.effectiveBody).toBe('');
	});
});

describe('从剪贴板粘贴', () => {
	/** 换掉 navigator.clipboard.readText（与其它工具的单测同一套 stubGlobal 写法） */
	function stubReadText(impl: () => Promise<string>): void {
		vi.stubGlobal('navigator', { clipboard: { readText: impl } });
	}

	it('cURL 文本解析成表单并切回 request 标签', async () => {
		stubReadText(async () => "curl 'https://x.example/api' -X POST -H 'X-Token: abc' -d '{\"a\":1}'");
		httpStore.tab = 'text';
		await httpStore.pasteFromClipboard();
		expect(httpStore.tab).toBe('request');
		expect(httpStore.method).toBe('POST');
		expect(httpStore.url).toBe('https://x.example/api');
		expect(httpStore.headersText).toBe('X-Token: abc');
		expect(httpStore.body).toBe('{"a":1}');
	});

	it('裸 URL 只填 URL，不动方法 / 请求头 / 请求体，参数表跟着同步', async () => {
		httpStore.method = 'POST';
		httpStore.headersText = 'X-Keep: 1';
		httpStore.body = '{"keep":true}';
		stubReadText(async () => '  api.example.com/v1/items?a=1  ');
		await httpStore.pasteFromClipboard();
		expect(httpStore.url).toBe('api.example.com/v1/items?a=1');
		expect(httpStore.params.map((row) => [row.name, row.value])).toEqual([['a', '1']]);
		expect(httpStore.method).toBe('POST');
		expect(httpStore.headersText).toBe('X-Keep: 1');
		expect(httpStore.body).toBe('{"keep":true}');
	});

	it('中文说明文字与多行日志都不当成 URL', async () => {
		httpStore.setUrl('https://x.example/keep');
		stubReadText(async () => '这是一段从别处复制的说明文字，不是请求');
		await httpStore.pasteFromClipboard();
		expect(httpStore.url).toBe('https://x.example/keep');

		stubReadText(async () => 'some log line\nanother line');
		await httpStore.pasteFromClipboard();
		expect(httpStore.url).toBe('https://x.example/keep');
	});

	it('空剪贴板与读不到剪贴板都不动表单', async () => {
		httpStore.setUrl('https://x.example/keep');
		stubReadText(async () => '   ');
		await httpStore.pasteFromClipboard();
		expect(httpStore.url).toBe('https://x.example/keep');

		stubReadText(async () => {
			throw new Error('denied');
		});
		await httpStore.pasteFromClipboard();
		expect(httpStore.url).toBe('https://x.example/keep');
	});
});

describe('请求示例', () => {
	it('每条示例的数据本身合法，id 不重复', () => {
		expect(REQUEST_EXAMPLES.length).toBeGreaterThan(1);
		const ids = REQUEST_EXAMPLES.map((example) => example.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const example of REQUEST_EXAMPLES) {
			expect(normalizeUrl(example.url)).not.toBeNull();
			expect(HTTP_METHODS).toContain(example.method);
			expect(CONTENT_TYPE_OPTIONS.some((option) => option.value === example.contentType)).toBe(true);
		}
	});

	it('applyExample 按 id 填表单并切回 request 标签', () => {
		httpStore.tab = 'text';
		httpStore.applyExample('post-json');
		expect(httpStore.tab).toBe('request');
		expect(httpStore.method).toBe('POST');
		expect(httpStore.url).toBe('https://httpbin.org/post');
		expect(httpStore.contentType).toBe('application/json');
		expect(httpStore.body).toContain('"name": "toolv"');
	});

	it('示例的查询参数进参数表，表单类型的正文拆进键值表', () => {
		httpStore.applyExample('query-params');
		expect(httpStore.params.map((row) => [row.name, row.value])).toEqual([
			['page', '1'],
			['size', '20']
		]);

		httpStore.applyExample('post-form');
		expect(httpStore.formRows.map((row) => [row.name, row.value])).toEqual([
			['name', 'toolv'],
			['from', 'example']
		]);
		// 正文由键值表拼回来，与示例里写的那串一致
		expect(httpStore.effectiveBody).toBe('name=toolv&from=example');
	});

	it('示例带了 panelTab 就把请求构造翻到那一页并展开', () => {
		httpStore.requestTab = 'headers';
		httpStore.requestCollapsed = true;
		httpStore.applyExample('bearer-auth');
		expect(httpStore.requestTab).toBe('auth');
		expect(httpStore.requestCollapsed).toBe(false);
		expect(httpStore.auth.type).toBe('bearer');
		expect(httpStore.auth.token).toBe('demo-token');
		// 注入出的请求头读得到（授权标签页的预览与实际发送同源）
		expect(httpStore.requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer demo-token' }]);
	});

	it('没写认证与超时的示例，不动用户当前的值', () => {
		httpStore.setAuth({ type: 'bearer', token: '我的 token' });
		httpStore.timeoutMs = 30_000;
		httpStore.applyExample('plain-get');
		expect(httpStore.auth.token).toBe('我的 token');
		expect(httpStore.timeoutMs).toBe(30_000);
		// 表单其余部分照常填上
		expect(httpStore.url).toBe('https://httpbin.org/get');
		expect(httpStore.headersText).toBe('Accept: application/json');
	});

	it('未知 id 不动表单', () => {
		httpStore.setUrl('https://x.example/keep');
		httpStore.applyExample('not-an-example');
		expect(httpStore.url).toBe('https://x.example/keep');
	});
});
