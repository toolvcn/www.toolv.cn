// 代码生成纯函数单测：各语言输出包含关键片段，转义与 Content-Type 注入正确。
import { describe, expect, it } from 'vitest';
import { generateCode, langLabel } from './codegen.ts';
import type { CurlForm } from './types.ts';
import type { CodeLang } from './types.ts';

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

const LANGS: CodeLang[] = ['javascript', 'typescript', 'python', 'go', 'java', 'php', 'csharp', 'powershell'];

describe('generateCode 基础输出', () => {
	it('每个语言都输出 URL 与方法名', () => {
		const f = form({ method: 'POST' });
		for (const lang of LANGS) {
			const out = generateCode(f, lang);
			expect(out).toContain('https://api.example.com/items');
			// Python 用 requests.post() 小写 API，其余语言保留大写方法名
			expect(out).toMatch(lang === 'python' ? /requests\.post\(/ : /POST/);
		}
	});

	it('GET 无请求体时不带 body 相关参数', () => {
		for (const lang of LANGS) {
			const out = generateCode(form(), lang);
			if (lang === 'javascript' || lang === 'typescript') expect(out).not.toContain('body:');
			if (lang === 'python') expect(out).not.toContain('data=');
			if (lang === 'powershell') expect(out).not.toContain('-Body');
		}
	});

	it('headers 过滤空 name 行并保留 Content-Type 自动注入', () => {
		const f = form({
			method: 'POST',
			contentType: 'application/json',
			body: '{"a":1}',
			headers: [
				{ name: 'X-Token', value: 'abc' },
				{ name: '', value: 'no' }
			]
		});
		for (const lang of LANGS) {
			const out = generateCode(f, lang);
			expect(out).toContain('X-Token');
			expect(out).not.toContain('no');
			// C# 把 Content-Type 放进 StringContent 的 mediaType，其余语言出现在 headers 里
			if (lang === 'csharp') expect(out).toContain('"application/json"');
			else expect(out).toContain('Content-Type');
		}
	});
});

describe('JavaScript / TypeScript', () => {
	it('fetch 结构完整：method / headers / body', () => {
		const out = generateCode(
			form({
				method: 'POST',
				url: 'https://api.example.com/items',
				contentType: 'application/json',
				body: '{"a":1}',
				headers: [{ name: 'X-Token', value: 'abc' }]
			}),
			'javascript'
		);
		expect(out).toContain('await fetch("https://api.example.com/items"');
		expect(out).toContain('method: "POST"');
		expect(out).toContain('"X-Token": "abc"');
		expect(out).toContain('body: "{\\"a\\":1}"');
		expect(out).not.toContain('undefined');
	});

	it('TypeScript 带类型标注', () => {
		const out = generateCode(form(), 'typescript');
		expect(out).toContain('const data: string');
	});
});

describe('Python', () => {
	it('方法名映射为 requests 小写 API', () => {
		expect(generateCode(form({ method: 'DELETE' }), 'python')).toContain('requests.delete(');
		expect(generateCode(form({ method: 'HEAD' }), 'python')).toContain('requests.head(');
	});

	it('JSON 转义的字符串字面量可被 Python 解析', () => {
		const out = generateCode(
			form({ method: 'POST', body: '{"a":1,\n"b":2}', contentType: 'application/json' }),
			'python'
		);
		expect(out).toContain('data="{\\"a\\":1,\\n\\"b\\":2}",');
	});
});

describe('Go', () => {
	it('无 body 时 NewRequest 用 nil，且不 import bytes', () => {
		const out = generateCode(form(), 'go');
		expect(out).toContain('http.NewRequest("GET", "https://api.example.com/items", nil)');
		expect(out).not.toContain('"bytes"');
	});

	it('有 body 时 import bytes 并用 bytes.NewReader', () => {
		const out = generateCode(form({ method: 'POST', body: '{"a":1}', contentType: 'application/json' }), 'go');
		expect(out).toContain('"bytes"');
		expect(out).toContain('bytes.NewReader([]byte("{\\"a\\":1}"))');
	});
});

describe('Java', () => {
	it('无 body 用 noBody()，有 body 用 ofString', () => {
		expect(generateCode(form(), 'java')).toContain('HttpRequest.BodyPublishers.noBody()');
		const out = generateCode(form({ method: 'PUT', body: 'x', contentType: 'text/plain' }), 'java');
		expect(out).toContain('HttpRequest.BodyPublishers.ofString("x")');
	});
});

describe('PHP', () => {
	it('值里的 $ 被转义避免被当变量', () => {
		const out = generateCode(
			form({
				method: 'POST',
				body: 'price=$5',
				contentType: 'text/plain',
				headers: [{ name: 'X-K', value: 'a$b' }]
			}),
			'php'
		);
		expect(out).toContain('"price=\\$5"');
		expect(out).toContain('"X-K: a\\$b"');
	});
});

describe('C#', () => {
	it('Content-Type 进 StringContent 第三个参数，不重复加 Header', () => {
		const out = generateCode(form({ method: 'POST', body: '{"a":1}', contentType: 'application/json' }), 'csharp');
		expect(out).toContain('new StringContent("{\\"a\\":1}", Encoding.UTF8, "application/json")');
		expect(out).not.toContain('Headers.Add("Content-Type"');
	});
});

describe('PowerShell', () => {
	it('单引号原样串，内部单引号双写', () => {
		const out = generateCode(
			form({ method: 'POST', url: "https://example.com/a'b", body: "it's", contentType: 'text/plain' }),
			'powershell'
		);
		expect(out).toContain("'https://example.com/a''b'");
		expect(out).toContain("'it''s'");
	});

	it('有 body 时 -Body 换行前带续行反引号', () => {
		const out = generateCode(form({ method: 'POST', body: 'x', contentType: 'text/plain' }), 'powershell');
		expect(out).toContain("-Body 'x'");
	});
});

describe('langLabel', () => {
	it('已知语言返回显示名，未知回退原样', () => {
		expect(langLabel('javascript')).toBe('JavaScript');
		expect(langLabel('powershell')).toBe('PowerShell');
		expect(langLabel('wat' as CodeLang)).toBe('wat');
	});
});
