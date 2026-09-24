// 请求文本格式层（识别 / 解析 / 生成）的单测。
// 样例尽量照 DevTools 复制出来的真实样子写（cmd 的 `^`、PowerShell 的 `@{}`、fetch 的双引号键）。
import { describe, expect, it } from 'vitest';
import { buildRequestText, detectFormat, parseRequestText } from './request-text.ts';
import type { CurlForm } from './types.ts';

function form(overrides: Partial<CurlForm> = {}): CurlForm {
	return {
		method: 'GET',
		url: 'https://api.example.com/items',
		headers: [],
		body: '',
		contentType: 'none',
		...overrides
	};
}

describe('detectFormat', () => {
	it('认出五种形态', () => {
		expect(detectFormat("curl 'https://x.example'")).toBe('curl-bash');
		expect(detectFormat('curl "https://x.example" ^\n  -H "accept: application/json"')).toBe('curl-cmd');
		expect(detectFormat('Invoke-WebRequest -Uri "https://x.example"')).toBe('powershell');
		expect(detectFormat('fetch("https://x.example", {\n  "mode": "cors"\n});')).toBe('fetch');
		expect(detectFormat('fetch("https://x.example", {\n  "method": "POST"\n});')).toBe('node-fetch');
	});

	it('认不出来就返回 null，不瞎猜', () => {
		expect(detectFormat('')).toBeNull();
		expect(detectFormat('随便一段文字')).toBeNull();
		expect(detectFormat('{"json":"而已"}')).toBeNull();
	});
});

describe('parseRequestText', () => {
	it('cURL（bash）与 cURL（cmd）走同一条解析路', () => {
		const cmd = [
			'curl "https://api.example.com/items" ^',
			'  -H "accept: application/json" ^',
			'  --data-raw "{\\"a\\":1}"'
		].join('\n');
		const parsed = parseRequestText(cmd);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.format).toBe('curl-cmd');
		// 带 -d 但没写方法 → 按 curl 约定提升为 POST
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.body).toBe('{"a":1}');
		expect(parsed.form.headers).toEqual([{ name: 'accept', value: 'application/json' }]);
	});

	it('Invoke-WebRequest → 表单（哈希表请求头、-ContentType、-Method）', () => {
		const text = `Invoke-WebRequest -Uri 'https://x.example/items' -Method 'POST' -Headers @{'X-Token'='abc'} -ContentType 'application/json' -Body '{"a":1}'`;
		const parsed = parseRequestText(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.format).toBe('powershell');
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.url).toBe('https://x.example/items');
		expect(parsed.form.headers).toEqual([{ name: 'X-Token', value: 'abc' }]);
		expect(parsed.form.contentType).toBe('application/json');
		expect(parsed.form.body).toBe('{"a":1}');
	});

	it('哈希表里带 `;` 与 `=` 的值不会被切坏（cookie 常见）', () => {
		const text = `Invoke-WebRequest -Uri 'https://x.example' -Headers @{'Cookie'='a=1; b=2'}`;
		const parsed = parseRequestText(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.headers).toEqual([{ name: 'Cookie', value: 'a=1; b=2' }]);
	});

	it('fetch（浏览器）→ 表单：请求头、正文、方法都还原', () => {
		const text = `fetch("https://x.example/items", {
  "headers": {
    "accept": "application/json",
    "content-type": "application/json"
  },
  "body": "{\\"a\\":1}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});`;
		const parsed = parseRequestText(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.format).toBe('fetch');
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.headers).toEqual([{ name: 'accept', value: 'application/json' }]);
		expect(parsed.form.contentType).toBe('application/json');
		expect(parsed.form.body).toBe('{"a":1}');
	});

	it('fetch 只有 URL（没有第二个参数）时按 GET 处理', () => {
		const parsed = parseRequestText('fetch("https://x.example/items");');
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('GET');
		expect(parsed.form.body).toBe('');
	});

	it('fetch 用了变量（Postman 那种导出）时给出可操作的报错', () => {
		const parsed = parseRequestText('fetch("https://x.example", requestOptions);');
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('requestOptions');
	});

	it('认不出的格式给出「支持哪些」的提示', () => {
		const parsed = parseRequestText('{}');
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('认不出');
	});
});

describe('buildRequestText', () => {
	const source = form({
		method: 'POST',
		headers: [{ name: 'X-Token', value: 'abc' }],
		body: '{"a":1}',
		contentType: 'application/json'
	});

	it('两种 cURL 用各自的引号与续行符', () => {
		expect(buildRequestText(source, 'curl-bash')).toContain("--header 'X-Token: abc' \\");
		expect(buildRequestText(source, 'curl-cmd')).toContain('--header "X-Token: abc" ^');
	});

	it('PowerShell 用 Invoke-WebRequest + 单引号值；GET 不写 -Method', () => {
		const ps = buildRequestText(source, 'powershell');
		expect(ps.split('\n')[0]).toBe("Invoke-WebRequest -Uri 'https://api.example.com/items' `");
		expect(ps).toContain("-Method 'POST'");
		expect(ps).toContain("-Headers @{'X-Token'='abc'; 'Content-Type'='application/json'}");
		expect(ps).toContain(`-Body '{"a":1}'`);
		expect(buildRequestText(form(), 'powershell')).not.toContain('-Method');
	});

	it('浏览器版与 Node 版 fetch 只差 mode / credentials', () => {
		const browser = buildRequestText(source, 'fetch');
		const node = buildRequestText(source, 'node-fetch');
		expect(browser.startsWith('fetch("https://api.example.com/items", {')).toBe(true);
		expect(browser).toContain('"mode": "cors"');
		expect(browser).toContain('"credentials": "omit"');
		expect(node).not.toContain('"mode"');
		expect(node).not.toContain('"credentials"');
		expect(node).toContain('"method": "POST"');
	});

	it('往返：每种格式生成出来的文本都能被自己的解析器读回去', () => {
		const formats = ['curl-bash', 'curl-cmd', 'powershell', 'fetch', 'node-fetch'] as const;
		for (const format of formats) {
			const text = buildRequestText(source, format);
			const parsed = parseRequestText(text);
			expect(parsed.ok, `${format} 解析失败：${parsed.ok ? '' : parsed.error}`).toBe(true);
			if (!parsed.ok) continue;
			expect(parsed.form.method, format).toBe('POST');
			expect(parsed.form.url, format).toBe(source.url);
			expect(parsed.form.body, format).toBe(source.body);
			expect(parsed.form.contentType, format).toBe('application/json');
			expect(parsed.form.headers, format).toEqual([{ name: 'X-Token', value: 'abc' }]);
		}
	});
});
