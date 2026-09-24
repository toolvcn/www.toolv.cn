// JSON 格式化工具的纯函数与 store 单测，跑在 vitest 的 server project（node 环境）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findFirstJsonError, locateJsonError, positionToLineColumn, SAMPLE_JSON, transformJson } from './json.ts';
import { jsonStore } from './store.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

// store 是模块级单例，每个用例前重置
beforeEach(() => {
	jsonStore.input = '';
	jsonStore.output = '';
	jsonStore.mode = 'format';
	jsonStore.indent = '2';
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('格式化', () => {
	it('空输入与纯空白都算空，不给输出也不报错', () => {
		expect(transformJson('', 'format', '2')).toEqual({ output: '', error: null, tokens: [] });
		expect(transformJson('  \n ', 'format', '2').error).toBeNull();
	});

	it('两空格缩进：紧凑 JSON 变成多行结构', () => {
		const result = transformJson('{"a":1,"b":[1,2]}', 'format', '2');
		expect(result.output).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
		expect(result.error).toBeNull();
	});

	it('四空格与 Tab 缩进各自生效', () => {
		expect(transformJson('{"a":1}', 'format', '4').output).toBe('{\n    "a": 1\n}');
		expect(transformJson('{"a":1}', 'format', 'tab').output).toBe('{\n\t"a": 1\n}');
	});

	it('中文与转义内容原样保留', () => {
		const result = transformJson('{"msg":"你好，微工具 😀","esc":"a\\"b"}', 'format', '2');
		expect(result.error).toBeNull();
		expect(transformJson(result.output, 'minify', '2').output).toBe('{"msg":"你好，微工具 😀","esc":"a\\"b"}');
	});

	it('格式化结果再压缩能回到一行', () => {
		const pretty = transformJson(SAMPLE_JSON, 'format', '2').output;
		const minified = transformJson(pretty, 'minify', '2');
		expect(minified.error).toBeNull();
		expect(minified.output).not.toContain('\n');
		expect(minified.output).toContain('"tools"');
	});
});

describe('非法输入', () => {
	it('非法 JSON 只给错误、不给输出', () => {
		const result = transformJson('{"a": }', 'format', '2');
		expect(result.output).toBe('');
		expect(result.error).not.toBeNull();
	});

	it('错误信息里带位置时给出行列', () => {
		const message = "Expected ',' or '}' after property value in JSON at position 5 (line 1 column 6)";
		const error = locateJsonError(message, '{"a":1,}');
		expect(error.line).toBe(1);
		expect(error.column).toBe(6);
		// 位置尾巴要清掉，留下能读的原因
		expect(error.message).not.toMatch(/at position|line \d+ column \d+/);
	});

	it('老版 V8 只给 position 时自行换算行列', () => {
		const input = '{\n  "a": 1,\n  }';
		// 第 15 个字符（0 基下标 14）是第三行那个 }，行 3 列 3
		const error = locateJsonError('Unexpected token } in JSON at position 14', input);
		expect(error.line).toBe(3);
		expect(error.column).toBe(3);
		expect(error.message).toBe('Unexpected token } in JSON');
	});

	it('新版 V8 只给上下文摘录时，用自己的语法扫描器定位', () => {
		const error = locateJsonError(
			'Unexpected token \'}\', ..."1, "b": } }" is not valid JSON',
			'{\n  "a": 1,\n  "b": }\n}'
		);
		expect(error.line).toBe(3);
		expect(error.column).toBe(8);
		// 摘录尾巴要砍掉，留下能读的原因
		expect(error.message).toBe("Unexpected token '}'");
	});

	it('位置信息完全缺失时行列留空', () => {
		const error = locateJsonError('Something exploded', '{"a":1}');
		expect(error.line).toBeNull();
		expect(error.column).toBeNull();
	});
});

describe('findFirstJsonError（定位兜底扫描器）', () => {
	it('合法 JSON（含全部类型与嵌套）返回 null', () => {
		expect(findFirstJsonError(SAMPLE_JSON)).toBeNull();
		expect(findFirstJsonError('  [1,2e3,-0.5,"x",true,false,null]  ')).toBeNull();
		expect(findFirstJsonError('{}')).toBeNull();
	});

	it('对象里成员键必须是字符串', () => {
		// 第 19 个字符是 {"a": 1, 后面那个多余的 }
		expect(findFirstJsonError('{\n  "a": 1,\n  "b": }\n}')).toBe(19);
	});

	it('数字语法：前导零与残缺小数都算错', () => {
		expect(findFirstJsonError('{"a":01}')).toBe(6);
		expect(findFirstJsonError('{"a":1.}')).not.toBeNull();
	});

	it('数组不能以逗号收尾', () => {
		expect(findFirstJsonError('[1,]')).not.toBeNull();
	});

	it('字面量后面紧跟字符算错（truex 不是 true）', () => {
		expect(findFirstJsonError('[truex]')).toBe(5);
	});

	it('顶层多余内容算错', () => {
		expect(findFirstJsonError('{"a":1}x')).toBe(7);
	});

	it('未闭合的字符串报在结尾', () => {
		expect(findFirstJsonError('{"a":"x')).toBe(7);
	});

	it('嵌套太深时兜底报错，不爆栈', () => {
		const deep = '['.repeat(600) + ']'.repeat(600);
		expect(findFirstJsonError(deep)).not.toBeNull();
	});

	it('单个字面量值合法', () => {
		expect(findFirstJsonError('  true  ')).toBeNull();
		expect(findFirstJsonError('truex')).not.toBeNull();
	});
});

describe('positionToLineColumn', () => {
	it('跨越多行时按换行计数，列为 1 基', () => {
		expect(positionToLineColumn('ab\ncd\nef', 0)).toEqual({ line: 1, column: 1 });
		expect(positionToLineColumn('ab\ncd\nef', 3)).toEqual({ line: 2, column: 1 });
		expect(positionToLineColumn('ab\ncd\nef', 5)).toEqual({ line: 2, column: 3 });
	});

	it('下标越界时按末尾算', () => {
		expect(positionToLineColumn('ab\ncd', 99)).toEqual({ line: 2, column: 3 });
		expect(positionToLineColumn('ab\ncd', -5)).toEqual({ line: 1, column: 1 });
	});
});

// 分词不再由本工具实现，统一测在 src/lib/utils/json.test.ts。

describe('store：转换状态', () => {
	it('初始为空，状态文案是等待输入', () => {
		expect(jsonStore.isEmpty).toBe(true);
		expect(jsonStore.statusText).toBe('等待输入');
		expect(jsonStore.value).toBe('');
	});

	it('输入合法 JSON 后实时格式化', () => {
		jsonStore.input = '{"a":1}';
		expect(jsonStore.isValid).toBe(true);
		expect(jsonStore.statusText).toBe('JSON 合法');
		expect(jsonStore.value).toBe('{\n  "a": 1\n}');
		expect(jsonStore.lineCount).toBe(3);
	});

	it('切换到压缩模式去掉换行', () => {
		jsonStore.input = '{"a":1}';
		jsonStore.setMode('minify');
		expect(jsonStore.mode).toBe('minify');
		expect(jsonStore.value).toBe('{"a":1}');
	});

	it('非法输入时状态文案带行列', () => {
		jsonStore.mode = 'format';
		jsonStore.input = '{"a": 1,}';
		expect(jsonStore.isValid).toBe(false);
		expect(jsonStore.statusText).toMatch(/第 \d+ 行第 \d+ 列/);
		expect(jsonStore.statusText).not.toBe('JSON 合法');
		expect(jsonStore.value).toBe('');
	});

	it('缩进选项在压缩模式下点击会切回格式化', () => {
		jsonStore.setMode('minify');
		jsonStore.setIndent('4');
		expect(jsonStore.indent).toBe('4');
		expect(jsonStore.mode).toBe('format');
	});

	it('载入示例后进入合法状态', () => {
		jsonStore.loadSample();
		expect(jsonStore.isEmpty).toBe(false);
		expect(jsonStore.isValid).toBe(true);
	});

	it('清空输入回到空态', () => {
		jsonStore.input = '{"a":1}';
		jsonStore.clearInput();
		expect(jsonStore.isEmpty).toBe(true);
	});
});

describe('store：复制与提示', () => {
	it('输出为空时提示没有可复制的内容', async () => {
		await jsonStore.copyOutput();
		expect(toast.message).toBe('输出为空，没有可复制的内容');
	});

	it('复制成功把完整输出写进剪贴板', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		jsonStore.input = '{"a":1}';
		jsonStore.output = jsonStore.value;
		await jsonStore.copyOutput();
		expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}');
		expect(toast.message).toBe('已复制输出结果');
		expect(toast.tone).toBe('neutral');
	});

	it('剪贴板不可用时提示手动复制', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		jsonStore.output = '{"a":1}';
		await jsonStore.copyOutput();
		expect(toast.message).toBe('复制失败，请手动选中输出内容复制');
		expect(toast.tone).toBe('error');
	});
});
