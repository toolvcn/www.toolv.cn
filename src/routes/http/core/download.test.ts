import { describe, expect, it } from 'vitest';
import { contentTypeOf, responseFileName } from './download.ts';

describe('响应文件命名', () => {
	it('按 Content-Type 猜扩展名', () => {
		expect(responseFileName('application/json', 200)).toBe('response-200.json');
		expect(responseFileName('text/html; charset=utf-8', 404)).toBe('response-404.html');
		expect(responseFileName('application/xml', 500)).toBe('response-500.xml');
		expect(responseFileName('text/plain', 204)).toBe('response-204.txt');
		expect(responseFileName('application/octet-stream', 200)).toBe('response-200.txt');
		expect(responseFileName('', 200)).toBe('response-200.txt');
	});

	it('状态码不可用时不会拼出怪名字', () => {
		expect(responseFileName('application/json', Number.NaN)).toBe('response-unknown.json');
	});

	it('从响应头里取 Content-Type', () => {
		expect(contentTypeOf([{ name: 'Content-Type', value: 'application/json' }])).toBe('application/json');
		expect(contentTypeOf([{ name: 'content-type', value: 'text/html' }])).toBe('text/html');
		expect(contentTypeOf([{ name: 'server', value: 'nginx' }])).toBe('');
	});
});
