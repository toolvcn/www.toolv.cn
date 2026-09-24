// 客户端代理协议的纯函数单测：base64 解码回 UTF-8、速度格式化。
import { describe, expect, it } from 'vitest';
import { decodeBase64Utf8, formatSpeed } from './proxy.ts';

/** UTF-8 文本 → base64（TextEncoder 先转字节再 btoa，兼容中文） */
function toBase64(text: string): string {
	return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

describe('decodeBase64Utf8', () => {
	it('解回 UTF-8 文本（含中文与多字节字符）', () => {
		expect(decodeBase64Utf8(toBase64('hello 世界 🌐'))).toBe('hello 世界 🌐');
	});

	it('空串与纯 ASCII', () => {
		expect(decodeBase64Utf8('')).toBe('');
		expect(decodeBase64Utf8(toBase64('{"ok":true}'))).toBe('{"ok":true}');
	});
});

describe('formatSpeed', () => {
	it('按量级显示 B/s / KB/s / MB/s', () => {
		expect(formatSpeed(512)).toBe('512 B/s');
		expect(formatSpeed(2048)).toBe('2.0 KB/s');
		expect(formatSpeed(5 * 1024 * 1024)).toBe('5.0 MB/s');
	});
});
