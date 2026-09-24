// HTML 实体编解码纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeHtml, encodeHtml } from './entities.ts';
import { entityStore } from './store.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	entityStore.direction = 'encode';
	entityStore.input = '';
	entityStore.scope = 'symbols';
	entityStore.style = 'named';
	entityStore.outputMirror = '';
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('编码', () => {
	it('required 只转五个必需字符', () => {
		expect(encodeHtml('a&b<c>"d\'e', 'required', 'named')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e');
	});

	it('required 不动符号与中文', () => {
		expect(encodeHtml('微工具 © 2026…', 'required', 'named')).toBe('微工具 © 2026…');
	});

	it('symbols 把表内符号转成命名实体', () => {
		expect(encodeHtml('a © b', 'symbols', 'named')).toBe('a &copy; b');
		expect(encodeHtml('…', 'symbols', 'named')).toBe('&hellip;');
	});

	it('nonAscii 把所有非 ASCII 一并转掉，中文走数字实体', () => {
		expect(encodeHtml('你a&', 'nonAscii', 'named')).toBe('&#20320;a&amp;');
	});

	it('numeric 一律十进制数字实体', () => {
		expect(encodeHtml('<&©', 'symbols', 'numeric')).toBe('&#60;&#38;&#169;');
	});

	it('增补平面字符（emoji）按真实码点转成单个数字实体', () => {
		expect(encodeHtml('😀', 'nonAscii', 'numeric')).toBe('&#128512;');
	});

	it('空串编码结果为空', () => {
		expect(encodeHtml('', 'required', 'named')).toBe('');
	});
});

describe('解码', () => {
	it('命名实体正常还原', () => {
		expect(decodeHtml('&amp;&lt;&gt;&quot;&apos;&copy;')).toBe('&<>"\'©');
	});

	it('十进制与十六进制数字实体都认，x 大小写不限', () => {
		expect(decodeHtml('&#20320;&#x4f60;')).toBe('你你');
		expect(decodeHtml('&#X41;')).toBe('A');
	});

	it('增补平面数字实体一次还原成一个字符', () => {
		expect(decodeHtml('&#128512;')).toBe('😀');
	});

	it('未知命名实体原样保留', () => {
		expect(decodeHtml('a &nope; b')).toBe('a &nope; b');
	});

	it('缺分号不算实体，原样保留', () => {
		expect(decodeHtml('a &amp b &#65')).toBe('a &amp b &#65');
	});

	it('非法数字实体原样保留：超界、代理区、非数字', () => {
		expect(decodeHtml('&#12345678;')).toBe('&#12345678;');
		expect(decodeHtml('&#xD800;')).toBe('&#xD800;');
		expect(decodeHtml('&#abc;')).toBe('&#abc;');
	});

	it('坏实体不拖垮整段，前后的好实体照常转换', () => {
		expect(decodeHtml('&amp;&nope;&copy;')).toBe('&&nope;©');
	});

	it('纯文本原样通过', () => {
		expect(decodeHtml('没有任何实体的普通文本')).toBe('没有任何实体的普通文本');
	});

	it('空串解码结果为空', () => {
		expect(decodeHtml('')).toBe('');
	});
});

describe('往返闭环', () => {
	it('编码 → 解码还原原文（三种范围 × 两种形式）', () => {
		const samples = ['<a href="/s?q=微工具" title="搜索"结果">© 2026…</a>', '你好 😀 &<>"\' © ‰ — λ', 'plain text 123'];
		for (const scope of ['required', 'symbols', 'nonAscii'] as const) {
			for (const style of ['named', 'numeric'] as const) {
				for (const text of samples) {
					expect(decodeHtml(encodeHtml(text, scope, style))).toBe(text);
				}
			}
		}
	});
});

describe('store', () => {
	it('输入变化后输出实时跟着变', () => {
		entityStore.input = 'a&b';
		expect(entityStore.output).toBe('a&amp;b');
	});

	it('换方向会把当前输出搬回输入', () => {
		entityStore.input = 'a&b';
		entityStore.swapDirection();
		expect(entityStore.direction).toBe('decode');
		expect(entityStore.input).toBe('a&amp;b');
		expect(entityStore.output).toBe('a&b');
	});

	it('解码方向点编码选项会切回编码', () => {
		entityStore.input = 'a&amp;b';
		entityStore.direction = 'decode';
		entityStore.applyScope('nonAscii');
		expect(entityStore.direction).toBe('encode');
		expect(entityStore.scope).toBe('nonAscii');
	});

	it('解码方向点实体形式也会切回编码', () => {
		entityStore.direction = 'decode';
		entityStore.applyStyle('numeric');
		expect(entityStore.direction).toBe('encode');
		expect(entityStore.style).toBe('numeric');
	});

	it('示例填充并切回编码方向', () => {
		entityStore.direction = 'decode';
		entityStore.loadExample();
		expect(entityStore.direction).toBe('encode');
		expect(entityStore.input).not.toBe('');
	});

	it('计数跟着输入输出走', () => {
		entityStore.input = 'ab©';
		expect(entityStore.inputCount).toBe(3);
		expect(entityStore.outputCount).toBe(entityStore.output.length);
	});

	it('空输出复制给提示', async () => {
		entityStore.outputMirror = '';
		await entityStore.copyOutput();
		expect(toast.message).toBe('输出为空，没有可复制的内容');
	});

	it('复制成功时写当前输出', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		entityStore.input = 'a&b';
		entityStore.outputMirror = entityStore.output;
		await entityStore.copyOutput();
		expect(writeText).toHaveBeenCalledWith('a&amp;b');
	});

	it('复制失败弹红色提示', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		entityStore.outputMirror = 'x';
		await entityStore.copyOutput();
		expect(toast.tone).toBe('error');
	});

	it('清空输入框', () => {
		entityStore.input = 'abc';
		entityStore.clearInput();
		expect(entityStore.input).toBe('');
	});
});
