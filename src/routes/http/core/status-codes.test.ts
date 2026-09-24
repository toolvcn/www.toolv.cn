// 状态码数据与搜索的单测。
import { describe, expect, it } from 'vitest';
import { categoryOf, searchStatusCodes, statusBrief, STATUS_CODES } from './status-codes.ts';

describe('STATUS_CODES 数据完整性', () => {
	it('code 全局唯一且升序排列', () => {
		const codes = STATUS_CODES.map((item) => item.code);
		expect(codes.length).toBe(new Set(codes).size);
		const sorted = [...codes].sort((a, b) => a - b);
		expect(codes).toEqual(sorted);
	});

	it('五个分类均有条目，总数不少于 50', () => {
		expect(STATUS_CODES.length).toBeGreaterThanOrEqual(50);
		for (const category of ['1xx', '2xx', '3xx', '4xx', '5xx'] as const) {
			expect(STATUS_CODES.filter((item) => categoryOf(item.code) === category).length).toBeGreaterThan(0);
		}
	});

	it('每条都带非空的 name / zhName / meaning / scenario', () => {
		for (const item of STATUS_CODES) {
			expect(item.name.trim()).not.toBe('');
			expect(item.zhName.trim()).not.toBe('');
			expect(item.meaning.trim()).not.toBe('');
			expect(item.scenario.trim()).not.toBe('');
		}
	});
});

describe('statusBrief', () => {
	it('本地表命中时取中文名（结果行里紧随状态码那句）', () => {
		expect(statusBrief(200)).toBe('成功');
		expect(statusBrief(404)).toBe('未找到');
		expect(statusBrief(500)).toBe('服务器内部错误');
	});

	it('表里没有的码：先用服务端 reason phrase，再退到分类名', () => {
		expect(statusBrief(520, 'Web Server Returned an Unknown Error')).toBe('Web Server Returned an Unknown Error');
		expect(statusBrief(520)).toBe('5xx 服务器错误');
		expect(statusBrief(299, '   ')).toBe('2xx 成功');
	});

	it('表里有这个码时，服务端那句不参与（HTTP/2 下它常是空串）', () => {
		expect(statusBrief(404, 'Not Found')).toBe('未找到');
	});
});

describe('searchStatusCodes', () => {
	it('空查询返回全量', () => {
		expect(searchStatusCodes('')).toHaveLength(STATUS_CODES.length);
		expect(searchStatusCodes('   ')).toHaveLength(STATUS_CODES.length);
	});

	it('按 code、英文名、中文名、场景词命中', () => {
		expect(searchStatusCodes('404').map((i) => i.code)).toContain(404);
		expect(searchStatusCodes('not found').map((i) => i.code)).toContain(404);
		expect(searchStatusCodes('未找到').map((i) => i.code)).toContain(404);
		expect(searchStatusCodes('限流').map((i) => i.code)).toContain(429);
	});

	it('大小写不敏感', () => {
		expect(searchStatusCodes('NOT FOUND').map((i) => i.code)).toContain(404);
	});

	it('无命中返回空数组', () => {
		expect(searchStatusCodes('不存在的内容zzz')).toEqual([]);
	});
});
