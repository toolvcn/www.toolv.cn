// 命名风格转换纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertCase, tokenizeWords } from './case.ts';
import { caseStore } from './store.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	caseStore.input = '';
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('分词', () => {
	it('分隔符（下划线 / 短横线 / 空格 / 标点）全部断词', () => {
		expect(tokenizeWords('http_request')).toEqual(['http', 'request']);
		expect(tokenizeWords('http-request')).toEqual(['http', 'request']);
		expect(tokenizeWords('http request')).toEqual(['http', 'request']);
		expect(tokenizeWords('a.b/c,d')).toEqual(['a', 'b', 'c', 'd']);
	});

	it('小写 → 大写的驼峰边界断词', () => {
		expect(tokenizeWords('myVariableName')).toEqual(['my', 'Variable', 'Name']);
	});

	it('连续大写缩写在「大写 → 大写 + 小写」处断词', () => {
		expect(tokenizeWords('HTTPResponse')).toEqual(['HTTP', 'Response']);
		expect(tokenizeWords('parseHTTPResponse')).toEqual(['parse', 'HTTP', 'Response']);
		expect(tokenizeWords('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request']);
	});

	it('字母与数字交界不断词，v2 与 base64 保持完整', () => {
		expect(tokenizeWords('v2User')).toEqual(['v2', 'User']);
		expect(tokenizeWords('base64Encode')).toEqual(['base64', 'Encode']);
	});

	it('中文整体当一个词', () => {
		expect(tokenizeWords('用户名称')).toEqual(['用户名称']);
		expect(tokenizeWords('user名称')).toEqual(['user名称']);
	});

	it('空串与纯分隔符拆不出词', () => {
		expect(tokenizeWords('')).toEqual([]);
		expect(tokenizeWords('___---   ')).toEqual([]);
	});
});

describe('风格转换', () => {
	const words = 'parse HTTPResponse_2s-delay';

	it('七种目标风格各就各位', () => {
		expect(convertCase(words, 'camel')).toBe('parseHttpResponse2sDelay');
		expect(convertCase(words, 'pascal')).toBe('ParseHttpResponse2sDelay');
		expect(convertCase(words, 'snake')).toBe('parse_http_response_2s_delay');
		expect(convertCase(words, 'kebab')).toBe('parse-http-response-2s-delay');
		expect(convertCase(words, 'constant')).toBe('PARSE_HTTP_RESPONSE_2S_DELAY');
		expect(convertCase(words, 'title')).toBe('Parse Http Response 2s Delay');
		expect(convertCase(words, 'lower')).toBe('parse http response 2s delay');
	});

	it('camel 首词整体小写，缩写也不例外', () => {
		expect(convertCase('XMLHttpRequest', 'camel')).toBe('xmlHttpRequest');
		expect(convertCase('XMLHttpRequest', 'pascal')).toBe('XmlHttpRequest');
	});

	it('中文不变形，只变连接方式', () => {
		expect(convertCase('用户名称 user_name', 'snake')).toBe('用户名称_user_name');
		expect(convertCase('用户名称 user_name', 'kebab')).toBe('用户名称-user-name');
	});

	it('空输入转换结果为空', () => {
		expect(convertCase('', 'camel')).toBe('');
		expect(convertCase('---', 'snake')).toBe('');
	});
});

describe('store', () => {
	it('输入变化后七行结果实时跟着变', () => {
		caseStore.input = 'my-var';
		expect(caseStore.rows).toHaveLength(7);
		expect(caseStore.rows.find((row) => row.style === 'camel')!.output).toBe('myVar');
		expect(caseStore.rows.find((row) => row.style === 'constant')!.output).toBe('MY_VAR');
	});

	it('空输入时各行结果为空但行数不变', () => {
		caseStore.input = '';
		expect(caseStore.rows).toHaveLength(7);
		expect(caseStore.rows.every((row) => row.output === '')).toBe(true);
	});

	it('示例填充与清空', () => {
		caseStore.loadExample();
		expect(caseStore.input).not.toBe('');
		caseStore.clearInput();
		expect(caseStore.input).toBe('');
	});

	it('空行复制给提示', async () => {
		caseStore.input = '';
		await caseStore.copyRow(caseStore.rows[0]);
		expect(toast.message).toBe('结果为空，没有可复制的内容');
	});

	it('复制成功时写该行结果', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		caseStore.input = 'my-var';
		const kebab = caseStore.rows.find((row) => row.style === 'kebab')!;
		await caseStore.copyRow(kebab);
		expect(writeText).toHaveBeenCalledWith('my-var');
		expect(toast.tone).toBe('neutral');
	});

	it('复制失败弹红色提示', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		caseStore.input = 'my-var';
		await caseStore.copyRow(caseStore.rows[0]);
		expect(toast.tone).toBe('error');
	});
});
