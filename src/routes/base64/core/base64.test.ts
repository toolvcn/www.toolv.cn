// Base64 工具的纯逻辑与 store 单测。
// 跑在 vitest 的 server project（node 环境）：core/ 不含 DOM，只有 fileToDataURL 用到了 FileReader，
// 那两个用例用桩替换掉全局即可，其余都是纯函数。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	convert,
	decodeBase64ToUtf8,
	encodeUtf8ToBase64,
	fileToDataURL,
	formatFileSize,
	fromUrlSafe,
	isValidBase64,
	stripWhitespace,
	toUrlSafe
} from './base64.ts';
import { base64 } from './store.svelte.ts';
import { DECODE_ERROR, MAX_FILE_SIZE } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

// store 是模块级单例，每个用例前重置，避免互相污染
beforeEach(() => {
	base64.input = '';
	base64.output = '';
	base64.mode = 'encode';
	base64.urlSafe = false;
	base64.filePreview = null;
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

/** 读取成功的 FileReader 桩 */
class OkFileReader {
	result: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readAsDataURL(file: File): void {
		this.result = `data:${file.type};base64,${file.name}`;
		setTimeout(() => this.onload?.(), 0);
	}
}

/** 读取失败的 FileReader 桩 */
class FailFileReader {
	result: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readAsDataURL(): void {
		setTimeout(() => this.onerror?.(), 0);
	}
}

function pngFile(name = 'a.png', size = 4): File {
	return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

describe('编码', () => {
	it('空串编码结果为空', () => {
		expect(encodeUtf8ToBase64('')).toBe('');
	});

	it('ASCII 与标准 Base64 表一致', () => {
		expect(encodeUtf8ToBase64('Hello')).toBe('SGVsbG8=');
	});

	it('中文按 UTF-8 编码，不是按码点截断', () => {
		expect(encodeUtf8ToBase64('你好')).toBe('5L2g5aW9');
	});

	it('emoji 等多字节字符也能编码', () => {
		expect(encodeUtf8ToBase64('😀')).toBe('8J+YgA==');
	});

	it('大文本分块编码结果与整体一致', () => {
		const long = '微工具'.repeat(20000);
		const expected = encodeUtf8ToBase64('微工具').repeat(20000);
		expect(encodeUtf8ToBase64(long)).toBe(expected);
	});
});

describe('解码', () => {
	it('往返一致：中文、emoji、换行都不丢', () => {
		for (const text of ['Hello', '你好，世界', '😀🚀', 'line1\nline2\tend', '']) {
			expect(decodeBase64ToUtf8(encodeUtf8ToBase64(text))).toBe(text);
		}
	});

	it('忽略换行与空格等排版空白', () => {
		expect(decodeBase64ToUtf8('5L2g\n5aW9')).toBe('你好');
		expect(decodeBase64ToUtf8(' 5L2g5aW9 ')).toBe('你好');
	});

	it('URL-safe 缺 padding 也能解', () => {
		expect(decodeBase64ToUtf8('8J-YgA')).toBe('😀');
	});

	it('非法字符抛错，由调用方兜住', () => {
		expect(() => decodeBase64ToUtf8('****')).toThrow();
	});
});

describe('isValidBase64', () => {
	it('标准串与 URL-safe 串都算合法', () => {
		expect(isValidBase64('SGVsbG8=')).toBe(true);
		expect(isValidBase64('8J-YgA')).toBe(true);
		expect(isValidBase64('QQ==')).toBe(true);
	});

	it('带换行的串按去掉空白后判定', () => {
		expect(isValidBase64('SGVs\nbG8=')).toBe(true);
	});

	it('空串、非法字符、长度 4n+1、padding 超两个都不合法', () => {
		expect(isValidBase64('')).toBe(false);
		expect(isValidBase64('****')).toBe(false);
		expect(isValidBase64('A')).toBe(false);
		expect(isValidBase64('AA===')).toBe(false);
		expect(isValidBase64('你好')).toBe(false);
	});
});

describe('URL-safe 转换', () => {
	it('标准 → URL-safe：换字符并去掉 padding', () => {
		expect(toUrlSafe('8J+YgA==')).toBe('8J-YgA');
		expect(toUrlSafe('SGVsbG8=')).toBe('SGVsbG8');
	});

	it('URL-safe → 标准：换回来并补 padding', () => {
		expect(fromUrlSafe('8J-YgA')).toBe('8J+YgA==');
		expect(fromUrlSafe('SGVsbG8')).toBe('SGVsbG8=');
	});

	it('来回转换后仍能解出原文（padding 丢了也能补回来）', () => {
		const urlSafe = toUrlSafe('8J+YgA==');
		expect(decodeBase64ToUtf8(fromUrlSafe(urlSafe))).toBe('😀');
	});

	it('长度 4n+1 补不出合法结果，原样返回等校验报错', () => {
		expect(fromUrlSafe('A')).toBe('A');
		expect(isValidBase64(fromUrlSafe('A'))).toBe(false);
	});
});

describe('convert', () => {
	it('空输入两种模式都没有输出也没有错误', () => {
		expect(convert('', 'encode', { urlSafe: false })).toEqual({ output: '', error: '' });
		expect(convert('', 'decode', { urlSafe: false })).toEqual({ output: '', error: '' });
	});

	it('编码保留原文的空白，首尾空格也要算进结果', () => {
		expect(convert(' a ', 'encode', { urlSafe: false }).output).toBe('IGEg');
		expect(decodeBase64ToUtf8('IGEg')).toBe(' a ');
	});

	it('编码开启 URL-safe 后去掉 padding', () => {
		expect(convert('Hello', 'encode', { urlSafe: true }).output).toBe('SGVsbG8');
	});

	it('解码成功时给出原文', () => {
		expect(convert('5L2g5aW9', 'decode', { urlSafe: false })).toEqual({ output: '你好', error: '' });
	});

	it('解码失败只给错误文案，不抛异常', () => {
		expect(convert('!!!', 'decode', { urlSafe: false })).toEqual({ output: '', error: DECODE_ERROR });
	});

	it('只有空白的解码输入不算失败', () => {
		expect(convert('   \n ', 'decode', { urlSafe: false })).toEqual({ output: '', error: '' });
	});

	it('stripWhitespace 去掉全部空白字符', () => {
		expect(stripWhitespace(' a\tb\nc ')).toBe('abc');
	});
});

describe('formatFileSize', () => {
	it('按 B / KB / MB 分档', () => {
		expect(formatFileSize(0)).toBe('0 B');
		expect(formatFileSize(512)).toBe('512 B');
		expect(formatFileSize(2048)).toBe('2.0 KB');
		expect(formatFileSize(1024 * 1024 * 3)).toBe('3.0 MB');
	});
});

describe('fileToDataURL', () => {
	it('读成功时返回 data:URL', async () => {
		vi.stubGlobal('FileReader', OkFileReader);
		await expect(fileToDataURL(pngFile('logo.png'))).resolves.toBe('data:image/png;base64,logo.png');
	});

	it('读失败时 reject', async () => {
		vi.stubGlobal('FileReader', FailFileReader);
		await expect(fileToDataURL(pngFile())).rejects.toThrow('文件读取失败');
	});
});

describe('store：转换状态', () => {
	it('默认处于编码模式且输出为空', () => {
		expect(base64.mode).toBe('encode');
		expect(base64.processedOutput).toBe('');
		expect(base64.error).toBe('');
	});

	it('输入变化后输出实时跟着变', () => {
		base64.input = '你好';
		expect(base64.processedOutput).toBe('5L2g5aW9');
		expect(base64.outputCount).toBe(8);
		expect(base64.inputCount).toBe(2);
	});

	it('URL-safe 开关立刻影响输出与长度', () => {
		base64.input = '😀';
		expect(base64.processedOutput).toBe('8J+YgA==');
		base64.toggleUrlSafe();
		expect(base64.urlSafe).toBe(true);
		expect(base64.processedOutput).toBe('8J-YgA');
		expect(base64.base64Length).toBe(6);
		base64.toggleUrlSafe();
		expect(base64.urlSafe).toBe(false);
	});

	it('编码模式下 Base64 长度取输出，解码模式取输入', () => {
		base64.input = '5L2g5aW9';
		base64.mode = 'decode';
		expect(base64.base64Length).toBe(8);
		expect(base64.processedOutput).toBe('你好');
	});

	it('解码失败时输出清空并给出错误文案', () => {
		base64.mode = 'decode';
		base64.input = '***';
		expect(base64.processedOutput).toBe('');
		expect(base64.error).toBe(DECODE_ERROR);
	});
});

describe('store：切换方向', () => {
	it('切到另一个方向会互换内容与模式', () => {
		base64.input = '你好';
		base64.output = base64.processedOutput;
		base64.setMode('decode');
		expect(base64.mode).toBe('decode');
		expect(base64.input).toBe('5L2g5aW9');
		expect(base64.processedOutput).toBe('你好');
	});

	it('点当前方向不做任何事', () => {
		base64.input = '你好';
		base64.setMode('encode');
		expect(base64.mode).toBe('encode');
		expect(base64.input).toBe('你好');
	});

	it('结果为空时只换方向，不抹掉用户输入', () => {
		base64.mode = 'decode';
		base64.input = '***';
		base64.swapMode();
		expect(base64.mode).toBe('encode');
		expect(base64.input).toBe('***');
	});

	it('切换方向会清掉已经对不上的缩略图', () => {
		base64.filePreview = { name: 'a.png', size: 1, dataUrl: 'data:image/png;base64,a' };
		base64.input = '你好';
		base64.output = base64.processedOutput;
		base64.swapMode();
		expect(base64.filePreview).toBeNull();
		expect(base64.filePreviewUrl).toBe('');
	});
});

describe('store：图片转换', () => {
	it('非图片文件被拒绝并弹错误提示', async () => {
		const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
		await base64.processFile(txt);
		expect(toast.message).toBe('请选择图片文件');
		expect(toast.tone).toBe('error');
		expect(base64.input).toBe('');
	});

	it('超过体积上限的图片被拒绝', async () => {
		await base64.processFile(pngFile('big.png', MAX_FILE_SIZE + 1));
		expect(toast.message).toBe('图片不能超过 2.0 MB');
		expect(toast.tone).toBe('error');
	});

	it('正常图片会填进输入框、切到编码并记录缩略图', async () => {
		vi.stubGlobal('FileReader', OkFileReader);
		base64.mode = 'decode';
		await base64.processFile(pngFile('logo.png'));
		expect(base64.input).toBe('data:image/png;base64,logo.png');
		expect(base64.mode).toBe('encode');
		expect(base64.filePreview).toEqual({
			name: 'logo.png',
			size: 4,
			dataUrl: 'data:image/png;base64,logo.png'
		});
		expect(toast.message).toBe('已载入图片 logo.png');
		expect(toast.tone).toBe('neutral');
	});

	it('读取失败时提示重试', async () => {
		vi.stubGlobal('FileReader', FailFileReader);
		await base64.processFile(pngFile());
		expect(toast.message).toBe('图片读取失败，请重试');
		expect(toast.tone).toBe('error');
	});

	it('没选文件时什么都不做', async () => {
		await base64.processFile(null);
		expect(toast.visible).toBe(false);
	});
});

describe('store：复制与提示', () => {
	it('输出为空时提示没有可复制的内容', async () => {
		await base64.copyOutput();
		expect(toast.message).toBe('输出为空，没有可复制的内容');
	});

	it('复制成功时把输出写进剪贴板', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		base64.input = '你好';
		base64.output = base64.processedOutput;
		await base64.copyOutput();
		expect(writeText).toHaveBeenCalledWith('5L2g5aW9');
		expect(toast.message).toBe('已复制输出结果');
		expect(toast.tone).toBe('neutral');
	});

	it('剪贴板不可用时提示手动复制', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		base64.output = '5L2g5aW9';
		await base64.copyOutput();
		expect(toast.message).toBe('复制失败，请手动选中输出内容复制');
		expect(toast.tone).toBe('error');
	});

	it('toast 默认不是错误样式', () => {
		toast.show('已复制');
		expect(toast.visible).toBe(true);
		expect(toast.tone).toBe('neutral');
	});
});

describe('store：清空', () => {
	it('清空输入、输出与缩略图并提示', () => {
		base64.input = '你好';
		base64.output = '5L2g5aW9';
		base64.filePreview = { name: 'a.png', size: 1, dataUrl: 'data:image/png;base64,a' };
		base64.clearAll();
		expect(base64.input).toBe('');
		expect(base64.output).toBe('');
		expect(base64.filePreview).toBeNull();
		expect(toast.message).toBe('已清空');
		expect(toast.tone).toBe('neutral');
	});
});
