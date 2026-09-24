// Result / ok / fail 的单测：形状与窄化行为。
// 这一层只是类型与两个构造函数，用例的重点是「判别式能正确窄化」——
// 调用方全靠 `if (!r.ok) r.error` 这一条，窄化错了类型检查会先发现，这里再兜一层。
import { describe, expect, it } from 'vitest';
import { fail, ok, type Result } from './result.ts';

describe('ok / fail', () => {
	it('ok 带上值，窄化后能读到 value', () => {
		const result = ok(42);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(42);
	});

	it('fail 带上错误文案，窄化后能读到 error', () => {
		const result = fail('掩码不连续');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe('掩码不连续');
	});

	it('泛型只在 ok 一侧约束：fail 可以当成任意 Result<T> 返回', () => {
		function parse(text: string): Result<number> {
			if (text === '') return fail('内容为空');
			return ok(Number(text));
		}
		expect(parse('')).toEqual({ ok: false, error: '内容为空' });
		expect(parse('7')).toEqual({ ok: true, value: 7 });
	});

	it('带泛型的返回值形状可判别，不是靠 truthy 判断', () => {
		const values: Result<string>[] = [ok('a'), fail('b')];
		const text = values.map((r) => (r.ok ? r.value : r.error)).join('|');
		expect(text).toBe('a|b');
	});
});
