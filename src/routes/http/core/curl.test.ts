// cURL 双向互转的纯函数单测。
import { describe, expect, it } from 'vitest';
import {
	base64EncodeUtf8,
	buildCurl,
	formatHeadersText,
	parseCurl,
	parseHeadersText,
	resolveHeaders,
	splitShellTokens
} from './curl.ts';
import type { ContentType, CurlForm } from './types.ts';

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

describe('buildCurl', () => {
	it('GET 省略 --request，POST 显式带 --request', () => {
		expect(buildCurl(form({ method: 'GET' }))).toBe("curl 'https://api.example.com/items'");
		expect(buildCurl(form({ method: 'POST' }))).toBe("curl --request POST 'https://api.example.com/items'");
	});

	it('值统一单引号包裹，URL 内部单引号转义为 shell 标准写法', () => {
		const url = "https://example.com/a'b";
		expect(buildCurl(form({ url }))).toContain("curl 'https://example.com/a'\"'\"'b'");
	});

	it('multiline 逐行输出并带行尾反斜杠，末行不带', () => {
		const out = buildCurl(
			form({
				method: 'POST',
				body: '{"a":1}',
				contentType: 'application/json',
				headers: [{ name: 'X-Token', value: 'abc' }]
			}),
			{ multiline: true }
		);
		const lines = out.split('\n');
		expect(lines[0]).toBe("curl --request POST 'https://api.example.com/items' \\");
		expect(lines[1]).toBe("  --header 'X-Token: abc' \\");
		expect(lines[2]).toBe("  --header 'Content-Type: application/json' \\");
		expect(lines[3]).toBe('  --data-raw \'{"a":1}\'');
	});

	it('headers 过滤空 name 的行', () => {
		const out = buildCurl(
			form({
				headers: [
					{ name: 'Keep', value: '1' },
					{ name: '', value: '3' }
				]
			})
		);
		expect(out).toBe("curl 'https://api.example.com/items' --header 'Keep: 1'");
	});

	it('body 非空且缺 Content-Type 时按 contentType 自动注入', () => {
		const out = buildCurl(form({ method: 'POST', body: '{"a":1}', contentType: 'application/json' }));
		expect(out).toContain("--header 'Content-Type: application/json'");
		// 已显式写了 Content-Type 就不重复注入
		const explicit = buildCurl(
			form({
				method: 'POST',
				body: '{"a":1}',
				contentType: 'none',
				headers: [{ name: 'Content-Type', value: 'application/xml' }]
			})
		);
		expect(explicit).not.toContain("--header 'Content-Type: application/xml' --header 'Content-Type");
		expect(explicit).toContain("--header 'Content-Type: application/xml'");
	});

	it('GET/HEAD 不带 body，body 用 --data-raw 保真（含换行）', () => {
		expect(buildCurl(form({ method: 'GET', body: 'x' }))).not.toContain('--data-raw');
		const body = '{"a":1,\n"b":2}';
		const out = buildCurl(form({ method: 'POST', body }));
		expect(out).toContain('--data-raw \'{"a":1,\n"b":2}\'');
	});

	it('contentType 为 none 时不注入 Content-Type', () => {
		const out = buildCurl(form({ method: 'POST', body: 'x', contentType: 'none' }));
		expect(out).not.toContain('Content-Type');
	});
});

describe('parseCurl', () => {
	it('基础 curl URL 还原为 GET', () => {
		const parsed = parseCurl("curl 'https://api.example.com/items'");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('GET');
		expect(parsed.form.url).toBe('https://api.example.com/items');
	});

	it('-X POST -H -d 完整还原，Content-Type 反推', () => {
		const parsed = parseCurl(
			`curl -X POST -H 'Content-Type: application/json' -H 'X-Token: abc' -d '{"a":1}' 'https://api.example.com/items'`
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.contentType).toBe('application/json');
		expect(parsed.form.headers).toEqual([{ name: 'X-Token', value: 'abc' }]);
		expect(parsed.form.body).toBe('{"a":1}');
	});

	it('双引号包裹、内部转义与引号内空格', () => {
		const parsed = parseCurl(`curl -H "Authorization: Bearer \\"tok en\\"" 'https://x.example/a'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.headers).toEqual([{ name: 'Authorization', value: 'Bearer "tok en"' }]);
	});

	it('未闭合的引号报错并给出定位', () => {
		const parsed = parseCurl(`curl -H 'Content-Type: application/json' 'https://x.example`);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain('未闭合');
	});

	it('多个 -d 按 curl 语义用 & 连接，且默认方法提升为 POST', () => {
		const parsed = parseCurl(`curl -d 'a=1' -d 'b=2' 'https://x.example/form'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.body).toBe('a=1&b=2');
		expect(parsed.form.contentType).toBe('application/x-www-form-urlencoded');
	});

	it('-u 合成 Basic（中文密码经 UTF-8 编码）、-b 合成 Cookie、-A 合成 User-Agent', () => {
		const parsed = parseCurl(`curl -u 'admin:密码' -b 'sid=1; theme=dark' -A 'Mozilla/5.0' 'https://x.example'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const auth = parsed.form.headers.find((h) => h.name === 'Authorization');
		expect(auth?.value).toBe(`Basic ${base64EncodeUtf8('admin:密码')}`);
		expect(parsed.form.headers).toContainEqual({ name: 'Cookie', value: 'sid=1; theme=dark' });
		expect(parsed.form.headers).toContainEqual({ name: 'User-Agent', value: 'Mozilla/5.0' });
	});

	it('粘连短选项 -XPOST 与忽略展示性 flag', () => {
		const parsed = parseCurl(`curl -s -i --compressed -L -XPOST 'https://x.example'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.headers).toEqual([]);
	});

	it('Content-Type 值不在枚举时保留 header 行、contentType 为 none', () => {
		const parsed = parseCurl(`curl -H 'Content-Type: application/xml' 'https://x.example'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.contentType).toBe('none');
		expect(parsed.form.headers).toEqual([{ name: 'Content-Type', value: 'application/xml' }]);
	});

	it('往返一致性：buildCurl → parseCurl 关键字段还原', () => {
		const source = form({
			method: 'POST',
			url: "https://api.example.com/a'b",
			headers: [{ name: 'X-Token', value: "he's here" }],
			body: '{"a":1,\n"b":2}',
			contentType: 'application/json'
		});
		const cmd = buildCurl(source, { multiline: true });
		const parsed = parseCurl(cmd);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.url).toBe(source.url);
		expect(parsed.form.contentType).toBe('application/json');
		expect(parsed.form.headers).toEqual([{ name: 'X-Token', value: "he's here" }]);
		expect(parsed.form.body).toBe(source.body);
	});
});

describe('resolveHeaders', () => {
	it('只输出名称非空的行', () => {
		const rows = [
			{ name: 'A', value: '1' },
			{ name: '', value: '3' }
		];
		expect(resolveHeaders({ headers: rows, contentType: 'none' as ContentType, body: '', method: 'GET' })).toEqual([
			{ name: 'A', value: '1' }
		]);
	});
});

describe('parseHeadersText / formatHeadersText', () => {
	it('按行解析「名称: 值」，忽略空行、注释行与没有冒号的行', () => {
		const text = [
			'Accept: application/json',
			'',
			'# 这是一条注释',
			'X-Token: abc',
			'没有冒号的行',
			'  : 空名称忽略'
		].join('\n');
		expect(parseHeadersText(text)).toEqual([
			{ name: 'Accept', value: 'application/json' },
			{ name: 'X-Token', value: 'abc' }
		]);
	});

	it('值里含冒号时只在第一个冒号处切分，首尾空白修剪', () => {
		expect(parseHeadersText('Authorization: Bearer a:b:c')).toEqual([{ name: 'Authorization', value: 'Bearer a:b:c' }]);
	});

	it('formatHeadersText 与 parseHeadersText 往返一致', () => {
		const headers = [
			{ name: 'Accept', value: 'application/json' },
			{ name: 'X-Token', value: 'abc' }
		];
		const text = formatHeadersText(headers);
		expect(text).toBe('Accept: application/json\nX-Token: abc');
		expect(parseHeadersText(text)).toEqual(headers);
	});
});

// cmd / PowerShell 的 cURL 输出（DevTools 的 Copy as cURL (cmd)，以及在 PowerShell 里跑的 curl.exe）
describe('cmd 方言、续行与 curl.exe', () => {
	it('cmd 风格：双引号 + 脱字符续行，内层双引号转义为 \\"', () => {
		const out = buildCurl(form({ method: 'POST', body: '{"a":1}', contentType: 'application/json' }), {
			multiline: true,
			style: 'cmd'
		});
		const lines = out.split('\n');
		expect(lines[0]).toBe('curl --request POST "https://api.example.com/items" ^');
		expect(lines.at(-1)).toBe('  --data-raw "{\\"a\\":1}"');
	});

	it('解析 cmd 输出：脱字符续行 + 双引号内 \\" 转义', () => {
		const cmd = [
			'curl "https://api.example.com/items" ^',
			'  -H "accept: application/json" ^',
			'  --data-raw "{\\"a\\":1}"'
		].join('\n');
		const parsed = parseCurl(cmd);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.method).toBe('POST');
		expect(parsed.form.url).toBe('https://api.example.com/items');
		expect(parsed.form.body).toBe('{"a":1}');
		expect(parsed.form.headers).toEqual([{ name: 'accept', value: 'application/json' }]);
	});

	it('curl.exe 前缀与反引号续行（PowerShell 里复制的 cURL）也认', () => {
		const text = ['curl.exe "https://x.example/api" `', "  -H 'X-Token: abc'"].join('\n');
		const parsed = parseCurl(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.url).toBe('https://x.example/api');
		expect(parsed.form.headers).toEqual([{ name: 'X-Token', value: 'abc' }]);
	});

	it('单引号里连着两个单引号算一个字面单引号（PowerShell 的转义写法）', () => {
		const parsed = parseCurl(`curl 'https://x.example' -H 'X-Token: it''s ok'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.headers).toEqual([{ name: 'X-Token', value: "it's ok" }]);
	});

	it('引号内的脱字符与反引号不算续行', () => {
		const parsed = parseCurl(`curl 'https://x.example' -H 'X-A: a^b' -H 'X-B: c\`d'`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.form.headers).toEqual([
			{ name: 'X-A', value: 'a^b' },
			{ name: 'X-B', value: 'c`d' }
		]);
	});
});

describe('splitShellTokens', () => {
	it('单引号内逐字、双引号内识别 \\" 与 \\\\', () => {
		const lex = splitShellTokens(`a 'b c' "d\\"e\\\\f" g`);
		expect(lex.ok).toBe(true);
		if (!lex.ok) return;
		expect(lex.tokens).toEqual(['a', 'b c', 'd"e\\f', 'g']);
	});
});
