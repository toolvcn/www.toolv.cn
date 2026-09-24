// URL 编解码工具纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeFragmentParams,
	composeQuery,
	encodeText,
	firstBadPercent,
	parseQueryString,
	splitQueryInput,
	tokenizeUrl,
	transformUrl
} from './url.ts';
import { urlStore } from './store.svelte.ts';
import { EXAMPLE_ENCODE_TEXT, EXAMPLE_QUERY_TEXT } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	urlStore.inputView = 'text';
	urlStore.encInput = '';
	urlStore.encDirection = 'encode';
	urlStore.strategy = 'component';
	urlStore.encOutput = '';
	urlStore.prefix = '';
	urlStore.queryRows = [];
	urlStore.fragmentRows = [];
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('编码', () => {
	it('组件编码连 :/?# 都转义', () => {
		expect(encodeText('a/b?c=d#e', 'component')).toBe('a%2Fb%3Fc%3Dd%23e');
	});

	it('整链编码保留 URL 结构字符', () => {
		expect(encodeText('https://www.toolv.cn/s?q=微 工具', 'full')).toBe(
			'https://www.toolv.cn/s?q=%E5%BE%AE%20%E5%B7%A5%E5%85%B7'
		);
	});

	it('中文与 emoji 按 UTF-8 编码', () => {
		expect(encodeText('你好', 'component')).toBe('%E4%BD%A0%E5%A5%BD');
		expect(encodeText('😀', 'component')).toBe('%F0%9F%98%80');
	});

	it('空串编码结果为空', () => {
		expect(transformUrl('', 'encode', 'component')).toEqual({ output: '', error: '' });
	});
});

describe('解码', () => {
	it('组件策略编出来的串能解回原文', () => {
		for (const text of ['a/b?c=d#e', '你好 😀', 'https://www.toolv.cn/s?q=微 工具']) {
			const encoded = transformUrl(text, 'encode', 'component').output;
			expect(transformUrl(encoded, 'decode', 'component')).toEqual({ output: text, error: '' });
		}
	});

	it('整链编出来的串用 decodeURIComponent 也能完整解回', () => {
		const encoded = transformUrl('https://a.cn/x?q=1 2', 'encode', 'full').output;
		expect(transformUrl(encoded, 'decode', 'full').output).toBe('https://a.cn/x?q=1 2');
	});

	it('非法百分号编码给出行列错误，不抛异常', () => {
		const result = transformUrl('a=1&b=%zz', 'decode', 'component');
		expect(result.output).toBe('');
		expect(result.error).toContain('解码失败');
		expect(result.error).toContain('第 1 行第 7 列');
	});

	it('裸 % 在结尾也算非法', () => {
		expect(transformUrl('abc%', 'decode', 'component').error).toContain('解码失败');
	});

	it('%FF 是合法十六进制但字节非法，提示无法解码', () => {
		const result = transformUrl('%FF', 'decode', 'component');
		expect(result.error).toContain('解码失败');
	});
});

describe('firstBadPercent', () => {
	it('只认合法 %XX 才算好', () => {
		expect(firstBadPercent('a%20b')).toBeNull();
		expect(firstBadPercent('a%zz')).toBe(1);
		expect(firstBadPercent('abc%')).toBe(3);
		expect(firstBadPercent('%2')).toBe(0);
		expect(firstBadPercent('no-percent')).toBeNull();
	});
});

describe('查询串解析', () => {
	it('普通键值对按 & 拆开并解码', () => {
		expect(parseQueryString('a=1&b=hello%20world')).toEqual([
			{ key: 'a', value: '1' },
			{ key: 'b', value: 'hello world' }
		]);
	});

	it('开头 ?、空段、缺 = 的裸键都处理', () => {
		expect(parseQueryString('?a=1&&featured&b=2')).toEqual([
			{ key: 'a', value: '1' },
			{ key: 'featured', value: '' },
			{ key: 'b', value: '2' }
		]);
	});

	it('裸查询串里的 # 按字面保留', () => {
		expect(parseQueryString('a=1#x')).toEqual([{ key: 'a', value: '1#x' }]);
	});

	it('坏的一段保持原样，不拖垮其它行', () => {
		expect(parseQueryString('ok=1&bad=%zz&ok2=2')).toEqual([
			{ key: 'ok', value: '1' },
			{ key: 'bad', value: '%zz' },
			{ key: 'ok2', value: '2' }
		]);
	});

	it('值里的 + 按字面保留', () => {
		expect(parseQueryString('a=1+2')).toEqual([{ key: 'a', value: '1+2' }]);
	});

	it('空串解析为空表', () => {
		expect(parseQueryString('')).toEqual([]);
	});
});

describe('拆查询段与 URL', () => {
	it('完整 URL 拆出前缀 / 查询段 / # 片段', () => {
		expect(splitQueryInput('https://a.cn/s?q=1&x=2#frag')).toEqual({
			prefix: 'https://a.cn/s?',
			query: 'q=1&x=2',
			suffix: '#frag'
		});
	});

	it('URL 没有 # 片段时后缀为空', () => {
		expect(splitQueryInput('https://a.cn/s?a=1')).toEqual({ prefix: 'https://a.cn/s?', query: 'a=1', suffix: '' });
	});

	it('没有 ? 时整串都是查询段，# 只是字面字符', () => {
		expect(splitQueryInput('a=1#x')).toEqual({ prefix: '', query: 'a=1#x', suffix: '' });
	});

	it('拆出的查询段喂给 parseQueryString 就是参数行', () => {
		const { query } = splitQueryInput('https://www.toolv.cn/search?q=在线 微工具&lang=zh#结果');
		expect(parseQueryString(query)).toEqual([
			{ key: 'q', value: '在线 微工具' },
			{ key: 'lang', value: 'zh' }
		]);
	});
});

describe('片段行（键值、与参数段同编码）', () => {
	it('& 连接、空行剔除、键值各自编码', () => {
		expect(
			composeFragmentParams([
				{ key: '结果', value: '' },
				{ key: 'a b', value: 'c/d' },
				{ key: '', value: '' }
			])
		).toBe('%E7%BB%93%E6%9E%9C&a%20b=c%2Fd');
		expect(composeFragmentParams([])).toBe('');
	});

	it('值为空只输出键，不补 =', () => {
		expect(composeFragmentParams([{ key: '结果', value: '' }])).toBe('%E7%BB%93%E6%9E%9C');
		expect(composeFragmentParams([{ key: 'a', value: '1' }])).toBe('a=1');
	});

	it('片段串与查询串同一套解析（解析 → 合成是闭环）', () => {
		const rows = parseQueryString('%E7%BB%93%E6%9E%9C&a%20b=c%2Fd');
		expect(rows).toEqual([
			{ key: '结果', value: '' },
			{ key: 'a b', value: 'c/d' }
		]);
		expect(composeFragmentParams(rows)).toBe('%E7%BB%93%E6%9E%9C&a%20b=c%2Fd');
	});
});

describe('输出分词（上色用）', () => {
	/** 压成 `kind:text` 串，便于一眼对照 */
	const lex = (text: string): string =>
		tokenizeUrl(text)
			.map((token) => `${token.kind}:${token.text}`)
			.join(' ');

	it('内容上色、分隔符中性：域名 / 路径段 / 查询键值 / 片段', () => {
		expect(lex('https://www.toolv.cn/search?q=1&lang=zh#结果')).toBe(
			'scheme:https:// host:www.toolv.cn delim:/ path:search delim:? query:q delim:= query:1 delim:& query:lang delim:= query:zh delim:# fragment:结果'
		);
	});

	it('路径多段：每段上色、斜杠中性', () => {
		expect(lex('https://a.cn/x/y')).toBe('scheme:https:// host:a.cn delim:/ path:x delim:/ path:y');
	});

	it('端口算进域名，缺路径 / 查询 / 片段也不出错', () => {
		expect(lex('https://a.cn:8080')).toBe('scheme:https:// host:a.cn:8080');
	});

	it('协议相对地址的 // 也算 scheme', () => {
		expect(lex('//a.cn/x')).toBe('scheme:// host:a.cn delim:/ path:x');
	});

	it('只有查询段时前面不硬造路径；裸键与空值也不出错', () => {
		expect(lex('?q=1')).toBe('delim:? query:q delim:= query:1');
		expect(lex('?featured&a=')).toBe('delim:? query:featured delim:& query:a delim:=');
	});

	it('文本视图：整串被组件编码过的 URL 也认得出结构', () => {
		expect(lex('https%3A%2F%2Fwww.toolv.cn%2Fsearch%3Fq%3D1%26lang%3Dzh')).toBe(
			'scheme:https%3A%2F%2F host:www.toolv.cn delim:%2F path:search delim:%3F query:q delim:%3D query:1 delim:%26 query:lang delim:%3D query:zh'
		);
	});

	it('映回原串时不重编码：十六进制大小写保持原样', () => {
		expect(lex('https%3a%2f%2fa.cn')).toBe('scheme:https%3a%2f%2f host:a.cn');
	});

	it('编码文本解不开或解不出结构时仍按 plain', () => {
		expect(lex('%E4%BD%A0%E5%A5%BD')).toBe('plain:%E4%BD%A0%E5%A5%BD');
		expect(lex('a%3D1%26b%3D2')).toBe('plain:a%3D1%26b%3D2');
		expect(lex('a%zz')).toBe('plain:a%zz');
	});

	it('认不出 URL 结构时整段 plain，不臆测', () => {
		expect(lex('https%3A%2F%2Fa.cn%2Fx')).toBe('scheme:https%3A%2F%2F host:a.cn delim:%2F path:x');
		expect(lex('a=1&b=2')).toBe('plain:a=1&b=2');
		expect(tokenizeUrl('')).toEqual([]);
	});
});

describe('合成查询串', () => {
	it('键值都按组件规则编码，空行剔除', () => {
		expect(
			composeQuery([
				{ key: 'name', value: '微工具' },
				{ key: 'x', value: 'a b/c' },
				{ key: '', value: '' },
				{ key: 'featured', value: '' }
			])
		).toBe('name=%E5%BE%AE%E5%B7%A5%E5%85%B7&x=a%20b%2Fc&featured=');
	});

	it('解析 → 合成是一个闭环', () => {
		const source = 'a=1&b=hello%20world&c=%E4%BD%A0';
		const rows = parseQueryString(source);
		const recomposed = composeQuery(rows);
		expect(parseQueryString(recomposed)).toEqual([
			{ key: 'a', value: '1' },
			{ key: 'b', value: 'hello world' },
			{ key: 'c', value: '你' }
		]);
	});
});

describe('store：URL 侧', () => {
	it('输入变化后输出实时跟着变', () => {
		urlStore.encInput = 'a/b';
		expect(urlStore.encValue).toBe('a%2Fb');
		expect(urlStore.encError).toBe('');
	});

	it('切到解码会把当前输出搬到输入', () => {
		urlStore.encInput = 'a/b';
		urlStore.setEncDirection('decode');
		expect(urlStore.encDirection).toBe('decode');
		expect(urlStore.encInput).toBe('a%2Fb');
		expect(urlStore.encValue).toBe('a/b');
	});

	it('解码失败时输出清空并给错误', () => {
		urlStore.encDirection = 'decode';
		urlStore.encInput = '%zz';
		expect(urlStore.encValue).toBe('');
		expect(urlStore.encError).not.toBe('');
	});

	it('点策略会切回编码方向', () => {
		urlStore.encDirection = 'decode';
		urlStore.applyStrategy('full');
		expect(urlStore.strategy).toBe('full');
		expect(urlStore.encDirection).toBe('encode');
	});

	it('整链策略下输出保留结构字符', () => {
		urlStore.strategy = 'full';
		urlStore.encInput = 'https://a.cn/x?q=1 2';
		expect(urlStore.encValue).toBe('https://a.cn/x?q=1%202');
	});
});

describe('store：参数表三段', () => {
	it('进参数表按当前输入串拆三段', () => {
		urlStore.encInput = 'https://a.cn/s?q=1&lang=zh#top&other';
		urlStore.setInputView('params');
		expect(urlStore.prefix).toBe('https://a.cn/s?');
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['q', 'lang']);
		expect(urlStore.fragmentRows.map((row) => row.key)).toEqual(['top', 'other']);
	});

	it('默认示例 URL 拆三段，输出仍带域名与 # 片段', () => {
		urlStore.encInput = EXAMPLE_ENCODE_TEXT;
		urlStore.setInputView('params');
		expect(urlStore.hasUrlPrefix).toBe(true);
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['q', 'lang']);
		expect(urlStore.queryRows[0].value).toBe('在线 微工具');
		expect(urlStore.fragmentRows.map((row) => row.key)).toEqual(['结果']);
		expect(urlStore.outputText).toBe(
			'https://www.toolv.cn/search?q=%E5%9C%A8%E7%BA%BF%20%E5%BE%AE%E5%B7%A5%E5%85%B7&lang=zh#%E7%BB%93%E6%9E%9C'
		);
	});

	it('参数段改行实时合成，只换查询段', () => {
		urlStore.encInput = 'https://a.cn/s?q=1#top';
		urlStore.setInputView('params');
		urlStore.updateQueryRow(urlStore.queryRows[0].id, 'q', '中文');
		expect(urlStore.encInput).toBe('https://a.cn/s?q=%E4%B8%AD%E6%96%87#top');
		expect(urlStore.outputText).toBe('https://a.cn/s?q=%E4%B8%AD%E6%96%87#top');
	});

	it('地址段可编辑，清空就不带前缀', () => {
		urlStore.encInput = 'https://a.cn/s?q=1#top';
		urlStore.setInputView('params');
		urlStore.setPrefix('https://b.cn/x?');
		expect(urlStore.encInput).toBe('https://b.cn/x?q=1#top');
		urlStore.setPrefix('');
		expect(urlStore.encInput).toBe('q=1#top');
	});

	it('# 片段段与参数段同编码，值为空只留键', () => {
		urlStore.encInput = 'https://a.cn/s?q=1#结果';
		urlStore.setInputView('params');
		expect(urlStore.fragmentRows).toHaveLength(1);
		expect(urlStore.fragmentRows[0]).toMatchObject({ key: '结果', value: '' });
		urlStore.addRow('fragment');
		urlStore.updateFragmentRow(urlStore.fragmentRows[1].id, 'k', 'v v');
		expect(urlStore.encInput).toBe('https://a.cn/s?q=1#%E7%BB%93%E6%9E%9C&k=v%20v');
	});

	it('拖拽与键盘都能改行序，合成结果跟着变', () => {
		urlStore.encInput = '?a=1&b=2&c=3';
		urlStore.setInputView('params');
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['a', 'b', 'c']);
		urlStore.moveRow('query', urlStore.queryRows[0].id, urlStore.queryRows[2].id);
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['b', 'c', 'a']);
		expect(urlStore.encInput).toBe('?b=2&c=3&a=1');
		urlStore.nudgeRow('query', urlStore.queryRows[2].id, -1);
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['b', 'a', 'c']);
		expect(urlStore.encInput).toBe('?b=2&a=1&c=3');
	});

	it('只切视图不编辑时不改动输入串', () => {
		urlStore.encInput = 'a=1+b&x=%zz';
		urlStore.setInputView('params');
		urlStore.setInputView('text');
		expect(urlStore.encInput).toBe('a=1+b&x=%zz');
	});

	it('参数表视图不消费方向与策略', () => {
		urlStore.encInput = 'a=1';
		urlStore.setInputView('params');
		urlStore.setEncDirection('decode');
		urlStore.applyStrategy('full');
		expect(urlStore.encDirection).toBe('encode');
		expect(urlStore.strategy).toBe('component');
		expect(urlStore.encInput).toBe('a=1');
	});

	it('参数表视图没有解码错误态，输出是合成结果', () => {
		urlStore.encInput = 'a=%zz';
		urlStore.setInputView('params');
		expect(urlStore.outputError).toBe('');
		expect(urlStore.outputText).toBe('a=%25zz');
	});

	it('裸查询串的 # 不进片段段', () => {
		urlStore.encInput = 'a=1#x';
		urlStore.setInputView('params');
		expect(urlStore.queryRows.map((row) => row.key)).toEqual(['a']);
		expect(urlStore.queryRows[0].value).toBe('1#x');
		expect(urlStore.fragmentRows).toHaveLength(0);
	});

	it('删除与新增行', () => {
		urlStore.encInput = 'a=1&b=2';
		urlStore.setInputView('params');
		const keep = urlStore.queryRows.find((row) => row.key === 'b')!.id;
		urlStore.removeRow('query', urlStore.queryRows.find((row) => row.key === 'a')!.id);
		expect(urlStore.queryRows).toHaveLength(1);
		urlStore.addRow('query');
		expect(urlStore.queryRows).toHaveLength(2);
		expect(urlStore.queryRows[1].key).toBe('');
		expect(urlStore.queryRows[1].id).toBeGreaterThan(keep);
	});
});

describe('store：复制与示例', () => {
	it('空输出复制给提示', async () => {
		await urlStore.copyOutput();
		expect(toast.message).toBe('输出为空，没有可复制的内容');
	});

	it('文本视图复制的是编解码结果', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		urlStore.encInput = 'a/b';
		urlStore.encOutput = urlStore.outputText;
		await urlStore.copyOutput();
		expect(writeText).toHaveBeenCalledWith('a%2Fb');
	});

	it('参数表视图复制的是合成结果', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		urlStore.encInput = 'a=微工具';
		urlStore.setInputView('params');
		urlStore.encOutput = urlStore.outputText;
		await urlStore.copyOutput();
		expect(writeText).toHaveBeenCalledWith('a=%E5%BE%AE%E5%B7%A5%E5%85%B7');
	});

	it('复制失败弹红色提示', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		urlStore.encOutput = 'a%2Fb';
		await urlStore.copyOutput();
		expect(toast.tone).toBe('error');
	});

	it('文本视图的示例填充并切回编码方向', () => {
		urlStore.encDirection = 'decode';
		urlStore.loadExample();
		expect(urlStore.encDirection).toBe('encode');
		expect(urlStore.encInput).not.toBe('');
	});

	it('参数表视图的示例给查询串并解析成三行', () => {
		urlStore.setInputView('params');
		urlStore.loadExample();
		expect(urlStore.encInput).toBe(EXAMPLE_QUERY_TEXT);
		expect(urlStore.queryRows).toHaveLength(3);
		expect(urlStore.fragmentRows).toHaveLength(0);
	});
});
