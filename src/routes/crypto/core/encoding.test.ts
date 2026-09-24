// 字节 ↔ 字符串互转的单测，跑在 vitest 的 server project（node 环境）。
// btoa / atob / TextEncoder 在 node 里都是全局的，与浏览器同一套实现。
import { describe, expect, it } from 'vitest';
import {
	bytesToBase64,
	bytesToHex,
	bytesToText,
	decodableAsText,
	hexToBytes,
	base64ToBytes,
	randomBytes,
	readBytes,
	textToBytes,
	writeBytes
} from './encoding.ts';

describe('hex', () => {
	it('编码补零到两位，解码回到同一串字节', () => {
		expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
		const bytes = hexToBytes('000fFf');
		expect(bytes.ok).toBe(true);
		if (bytes.ok) expect([...bytes.value]).toEqual([0, 15, 255]);
	});

	it('空白（空格 / 换行 / 制表）照收，hex dump 直接粘得进来', () => {
		const bytes = hexToBytes('00 0f\nff\t10');
		expect(bytes.ok).toBe(true);
		if (bytes.ok) expect(bytes.value.length).toBe(4);
	});

	it('奇数位、非十六进制字符、空串各自报错', () => {
		const odd = hexToBytes('abc');
		expect(odd.ok).toBe(false);
		if (!odd.ok) expect(odd.error).toContain('奇数位');

		const bad = hexToBytes('zz');
		expect(bad.ok).toBe(false);
		if (!bad.ok) expect(bad.error).toContain('非十六进制');

		expect(hexToBytes('  ').ok).toBe(false);
	});
});

describe('Base64', () => {
	it('往返一致，二进制字节也不丢', () => {
		const bytes = new Uint8Array([0, 1, 127, 128, 200, 255]);
		const text = bytesToBase64(bytes);
		expect(text).toBe('AAF/gMj/');
		const back = base64ToBytes(text);
		expect(back.ok).toBe(true);
		if (back.ok) expect([...back.value]).toEqual([...bytes]);
	});

	it('base64url 的 - _ 与缺省填充都收', () => {
		const url = base64ToBytes('-_8');
		expect(url.ok).toBe(true);
		if (url.ok) expect([...url.value]).toEqual([251, 255]);

		const unpadded = base64ToBytes('QQ');
		expect(unpadded.ok).toBe(true);
		if (unpadded.ok) expect(bytesToText(unpadded.value)).toBe('A');
	});

	it('非法字符与长度不合法各自报错', () => {
		const bad = base64ToBytes('ab@c');
		expect(bad.ok).toBe(false);
		if (!bad.ok) expect(bad.error).toContain('非 Base64');

		const short = base64ToBytes('abcde');
		expect(short.ok).toBe(false);
		if (!short.ok) expect(short.error).toContain('长度不合法');
	});

	it('超过 32KB 的内容不会栈溢出（分块拼接）', () => {
		const bytes = new Uint8Array(100_000).fill(65);
		const text = bytesToBase64(bytes);
		expect(text.length).toBe(Math.ceil(100_000 / 3) * 4);
		const back = base64ToBytes(text);
		expect(back.ok && back.value.length).toBe(100_000);
	});
});

describe('UTF-8 文本', () => {
	it('中文与 emoji 按 UTF-8 编码后再回来', () => {
		expect(textToBytes('你')).toEqual(new Uint8Array([0xe4, 0xbd, 0xa0]));
		expect(bytesToText(textToBytes('微工具 😀'))).toBe('微工具 😀');
	});

	it('非法 UTF-8 不抛错，但 decodableAsText 能判出来', () => {
		const broken = new Uint8Array([0xff, 0xfe, 0x41]);
		expect(decodableAsText(broken)).toBe(false);
		expect(bytesToText(broken).endsWith('A')).toBe(true);
	});
});

describe('readBytes / writeBytes / randomBytes', () => {
	it('按格式读：text / hex / base64 三种口径', () => {
		const asText = readBytes('A', 'text');
		expect(asText.ok && asText.value.length).toBe(1);
		const asHex = readBytes('41', 'hex');
		expect(asHex.ok && asHex.value.length).toBe(1);
		const asBase64 = readBytes('QQ==', 'base64');
		expect(asBase64.ok && asBase64.value.length).toBe(1);
	});

	it('按格式写：同一串字节输出两种写法', () => {
		const bytes = new Uint8Array([0x41, 0x42]);
		expect(writeBytes(bytes, 'hex')).toBe('4142');
		expect(writeBytes(bytes, 'base64')).toBe('QUI=');
	});

	it('随机字节长度正确且不是全零', () => {
		const bytes = randomBytes(32);
		expect(bytes.length).toBe(32);
		expect(bytes.some((byte) => byte !== 0)).toBe(true);
	});
});
