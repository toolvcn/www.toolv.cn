// 代码生成：把当前请求表单（方法 / URL / 请求头 / 请求体）转成各语言的请求代码，纯函数、无 DOM。
// 请求头复用 curl.ts 的 resolveHeaders（过滤空名称并自动补 Content-Type），保证与真实发送一致。
// 字符串字面量统一用 JSON 转义（JS/TS/Python/Go/Java/C# 通用），PHP 额外转义 $，PowerShell 用单引号原样串。

import { resolveHeaders } from './curl.ts';
import type { CodeLang, CurlForm, HttpMethod } from './types.ts';

export interface CodeLangOption {
	id: CodeLang;
	label: string;
}

/** 界面展示顺序即数组顺序 */
export const CODE_LANGS: ReadonlyArray<CodeLangOption> = [
	{ id: 'javascript', label: 'JavaScript' },
	{ id: 'typescript', label: 'TypeScript' },
	{ id: 'python', label: 'Python' },
	{ id: 'go', label: 'Go' },
	{ id: 'java', label: 'Java' },
	{ id: 'php', label: 'PHP' },
	{ id: 'csharp', label: 'C#' },
	{ id: 'powershell', label: 'PowerShell' }
];

/** 生成器入参：已解析的请求头（含自动补的 Content-Type）与是否带请求体 */
export interface HttpRequestSpec {
	method: HttpMethod;
	url: string;
	headers: { name: string; value: string }[];
	body: string;
	hasBody: boolean;
}

// ------------------------------------------------------------ 字符串字面量

/** 通用双引号字面量（JSON 转义，多数语言与 JSON 的转义规则一致） */
function quoted(s: string): string {
	return JSON.stringify(s);
}

/** PHP 双引号串：JSON 转义基础上再转义 $（会被当成变量） */
function phpQuoted(s: string): string {
	return quoted(s).replace(/\$/g, '\\$');
}

/** PowerShell 单引号原样串：内部单引号双写 */
function psQuoted(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

// ------------------------------------------------------------ 各语言代码

function jsTsSnippet(spec: HttpRequestSpec, lang: 'javascript' | 'typescript'): string {
	const headerBlock =
		spec.headers.length > 0
			? `  headers: {\n${spec.headers.map((h) => `    ${quoted(h.name)}: ${quoted(h.value)}`).join(',\n')}\n  },\n`
			: '';
	const bodyBlock = spec.hasBody ? `  body: ${quoted(spec.body)},\n` : '';
	const typed = lang === 'typescript' ? ': string' : '';
	return `// 使用浏览器 fetch 发送请求
const response = await fetch(${quoted(spec.url)}, {
  method: ${quoted(spec.method)},
${headerBlock}${bodyBlock}});
const data${typed} = await response.text(); // JSON 响应可换成 await response.json()
console.log(response.status, data);`;
}

const PY_METHODS: Record<HttpMethod, string> = {
	GET: 'get',
	POST: 'post',
	PUT: 'put',
	PATCH: 'patch',
	DELETE: 'delete',
	HEAD: 'head',
	OPTIONS: 'options'
};

function pythonSnippet(spec: HttpRequestSpec): string {
	const headerBlock =
		spec.headers.length > 0
			? `    headers={\n${spec.headers.map((h) => `        ${quoted(h.name)}: ${quoted(h.value)},`).join('\n')}\n    },\n`
			: '';
	const dataBlock = spec.hasBody ? `    data=${quoted(spec.body)},\n` : '';
	return `import requests

# 使用 requests 库发送请求（未安装时先 pip install requests）
response = requests.${PY_METHODS[spec.method]}(
    ${quoted(spec.url)},
${headerBlock}${dataBlock})
print(response.status_code)
print(response.text)`;
}

function goSnippet(spec: HttpRequestSpec): string {
	const importBlock = spec.hasBody ? '\t"bytes"\n\t"fmt"' : '\t"fmt"';
	const bodyReader = spec.hasBody ? `bytes.NewReader([]byte(${quoted(spec.body)}))` : 'nil';
	const headerLines = spec.headers.map((h) => `\treq.Header.Set(${quoted(h.name)}, ${quoted(h.value)})`).join('\n');
	const headerBlock = headerLines === '' ? '' : `${headerLines}\n`;
	return `package main

import (
${importBlock}
	"io"
	"net/http"
	"time"
)

func main() {
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest(${quoted(spec.method)}, ${quoted(spec.url)}, ${bodyReader})
	if err != nil {
		panic(err)
	}
${headerBlock}	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	fmt.Println(resp.StatusCode)
	fmt.Println(string(out))
}`;
}

function javaSnippet(spec: HttpRequestSpec): string {
	const bodyPublisher = spec.hasBody
		? `HttpRequest.BodyPublishers.ofString(${quoted(spec.body)})`
		: 'HttpRequest.BodyPublishers.noBody()';
	const headerLines = spec.headers.map((h) => `            .header(${quoted(h.name)}, ${quoted(h.value)})`).join('\n');
	const headerBlock = headerLines === '' ? '' : `${headerLines}\n`;
	return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Main {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(${quoted(spec.url)}))
            .method(${quoted(spec.method)}, ${bodyPublisher})
${headerBlock}            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.statusCode());
        System.out.println(response.body());
    }
}`;
}

function phpSnippet(spec: HttpRequestSpec): string {
	const headerArray = spec.headers.map((h) => `    ${phpQuoted(`${h.name}: ${h.value}`)},`).join('\n');
	const postFields = spec.hasBody ? `curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpQuoted(spec.body)});\n` : '';
	return `<?php

// 使用 PHP cURL 扩展发送请求
$ch = curl_init(${phpQuoted(spec.url)});
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpQuoted(spec.method)});
curl_setopt($ch, CURLOPT_HTTPHEADER, [
${headerArray}
]);
${postFields}$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo $status . "\\n";
echo $response;`;
}

function csharpSnippet(spec: HttpRequestSpec): string {
	const headerLines = spec.headers
		.filter((h) => h.name.toLowerCase() !== 'content-type')
		.map((h) => `        request.Headers.Add(${quoted(h.name)}, ${quoted(h.value)});`)
		.join('\n');
	const headerBlock = headerLines === '' ? '' : `${headerLines}\n`;
	const ct = spec.headers.find((h) => h.name.toLowerCase() === 'content-type')?.value;
	const contentBlock = spec.hasBody
		? `        var body = new StringContent(${quoted(spec.body)}, Encoding.UTF8${ct ? `, ${quoted(ct)}` : ''});\n        request.Content = body;\n`
		: '';
	return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        using var request = new HttpRequestMessage(${quoted(spec.method)}, ${quoted(spec.url)});
${headerBlock}${contentBlock}        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Console.WriteLine((int)response.StatusCode);
        Console.WriteLine(text);
    }
}`;
}

function powershellSnippet(spec: HttpRequestSpec): string {
	const headerLines = spec.headers.map((h) => `        ${psQuoted(h.name)} = ${psQuoted(h.value)}`).join('\n');
	const headersTail = spec.hasBody ? ' \\`' : '';
	const bodyBlock = spec.hasBody ? `    -Body ${psQuoted(spec.body)} \\\`\n\n` : '\n';
	return `# 使用 PowerShell Invoke-RestMethod 发送请求
$response = Invoke-RestMethod \\\`
    -Method ${psQuoted(spec.method)} \\\`
    -Uri ${psQuoted(spec.url)} \\\`
    -Headers @{
${headerLines}
    }${headersTail}
${bodyBlock}$response | ConvertTo-Json -Depth 10`;
}

const GENERATORS: Record<CodeLang, (spec: HttpRequestSpec) => string> = {
	javascript: (s) => jsTsSnippet(s, 'javascript'),
	typescript: (s) => jsTsSnippet(s, 'typescript'),
	python: pythonSnippet,
	go: goSnippet,
	java: javaSnippet,
	php: phpSnippet,
	csharp: csharpSnippet,
	powershell: powershellSnippet
};

/**
 * 生成某一语言的请求代码。入参直接来自请求表单，URL / 方法 / 请求体不再在此处校验；
 * 请求头由 resolveHeaders 统一过滤（名称非空）并自动补 Content-Type。
 */
export function generateCode(form: CurlForm, lang: CodeLang): string {
	const spec: HttpRequestSpec = {
		method: form.method,
		url: form.url,
		headers: resolveHeaders(form),
		body: form.body,
		hasBody: form.method !== 'GET' && form.method !== 'HEAD' && form.body !== ''
	};
	return GENERATORS[lang](spec);
}

/** 供测试与提示使用：语言 id → 显示名 */
export function langLabel(id: CodeLang): string {
	return CODE_LANGS.find((l) => l.id === id)?.label ?? id;
}
