// ASCII 码表（0-127）静态数据与搜索。纯数据 + 纯函数，可单测。
//
// 可打印字符（32-126）由码位直接生成，控制字符（0-31 与 127）手写 ——
// 后者没有可见字形，要给出缩写名、转义写法与用途，才是「速查」有意义的部分。

export interface AsciiEntry {
	/** 码位 0-127 */
	code: number;
	/** 可打印字符；控制字符为 null */
	char: string | null;
	/** 控制字符缩写（NUL / LF / DEL）；可打印字符为 null */
	abbr: string | null;
	/** 常见转义写法（`\n` / `\t` / `\\`），没有约定写法的为 null */
	escape: string | null;
	/** 一句话说明 */
	note: string;
}

export type AsciiGroup = 'printable' | 'control';

/** 分组顺序即渲染顺序：可打印字符更常用，放前面 */
export const ASCII_GROUPS: { id: AsciiGroup; name: string }[] = [
	{ id: 'printable', name: '可打印字符（32-126）' },
	{ id: 'control', name: '控制字符（0-31 / 127）' }
];

/** 控制字符：缩写 + 转义 + 说明（可打印段由码位生成） */
const CONTROL: { code: number; abbr: string; escape: string | null; note: string }[] = [
	{ code: 0, abbr: 'NUL', escape: '\\0', note: '空字符，C 系语言用它标记字符串结尾' },
	{ code: 1, abbr: 'SOH', escape: null, note: '标题开始，老式串行通信的帧头' },
	{ code: 2, abbr: 'STX', escape: null, note: '正文开始，帧头之后紧接数据' },
	{ code: 3, abbr: 'ETX', escape: null, note: '正文结束；终端里 Ctrl+C 发出它' },
	{ code: 4, abbr: 'EOT', escape: null, note: '传输结束；Unix 终端里 Ctrl+D 表示输入结束' },
	{ code: 5, abbr: 'ENQ', escape: null, note: '询问，请求对方应答' },
	{ code: 6, abbr: 'ACK', escape: null, note: '确认应答' },
	{ code: 7, abbr: 'BEL', escape: '\\a', note: '响铃，终端收到会“叮”一声' },
	{ code: 8, abbr: 'BS', escape: '\\b', note: '退格，光标左移一格' },
	{ code: 9, abbr: 'HT', escape: '\\t', note: '水平制表符，Tab 键' },
	{ code: 10, abbr: 'LF', escape: '\\n', note: '换行，Linux / macOS 的行尾' },
	{ code: 11, abbr: 'VT', escape: '\\v', note: '垂直制表符' },
	{ code: 12, abbr: 'FF', escape: '\\f', note: '换页，打印机走纸到下一页' },
	{ code: 13, abbr: 'CR', escape: '\\r', note: '回车；Windows 的行尾是 \\r\\n' },
	{ code: 14, abbr: 'SO', escape: null, note: '移出，切换字符集' },
	{ code: 15, abbr: 'SI', escape: null, note: '移入，切回默认字符集' },
	{ code: 16, abbr: 'DLE', escape: null, note: '数据链路转义' },
	{ code: 17, abbr: 'DC1', escape: null, note: '设备控制 1，软件流控 XON' },
	{ code: 18, abbr: 'DC2', escape: null, note: '设备控制 2' },
	{ code: 19, abbr: 'DC3', escape: null, note: '设备控制 3，软件流控 XOFF' },
	{ code: 20, abbr: 'DC4', escape: null, note: '设备控制 4' },
	{ code: 21, abbr: 'NAK', escape: null, note: '否认应答' },
	{ code: 22, abbr: 'SYN', escape: null, note: '同步空闲' },
	{ code: 23, abbr: 'ETB', escape: null, note: '传输块结束' },
	{ code: 24, abbr: 'CAN', escape: null, note: '取消当前传输' },
	{ code: 25, abbr: 'EM', escape: null, note: '介质结束' },
	{ code: 26, abbr: 'SUB', escape: null, note: '替换；Windows 文本 EOF 曾用 Ctrl+Z' },
	{ code: 27, abbr: 'ESC', escape: '\\x1B', note: '转义，终端控制序列（ANSI 颜色）以它开头' },
	{ code: 28, abbr: 'FS', escape: null, note: '文件分隔符' },
	{ code: 29, abbr: 'GS', escape: null, note: '组分隔符' },
	{ code: 30, abbr: 'RS', escape: null, note: '记录分隔符' },
	{ code: 31, abbr: 'US', escape: null, note: '单元分隔符' }
];

/** 删除符：码位 127，排在最末（不参与 0-31 那段） */
const DEL: { code: number; abbr: string; escape: string | null; note: string } = {
	code: 127,
	abbr: 'DEL',
	escape: null,
	note: '删除，终端里按 Delete 发出'
};

/** 可打印字符里需要转义的两个（其余原样写进代码 / 字符串都不会有歧义） */
function escapeOfChar(char: string): string | null {
	if (char === '"') return '\\"';
	if (char === '\\') return '\\\\';
	return null;
}

function noteOfPrintable(code: number): string {
	if (code === 32) return '空格';
	if (code >= 48 && code <= 57) return '数字 0-9';
	if (code >= 65 && code <= 90) return '大写字母 A-Z';
	if (code >= 97 && code <= 122) return '小写字母 a-z';
	return '标点符号';
}

function buildPrintable(): AsciiEntry[] {
	const out: AsciiEntry[] = [];
	for (let code = 32; code <= 126; code += 1) {
		const char = String.fromCharCode(code);
		out.push({ code, char, abbr: null, escape: escapeOfChar(char), note: noteOfPrintable(code) });
	}
	return out;
}

/** 全表按 code 升序：控制字符 → 可打印字符 → DEL */
export const ASCII_ENTRIES: AsciiEntry[] = [
	...CONTROL.map((item) => ({ ...item, char: null })),
	...buildPrintable(),
	{ ...DEL, char: null }
];

export function asciiGroupOf(code: number): AsciiGroup {
	return code === 127 || code < 32 ? 'control' : 'printable';
}

/** 两位大写十六进制，带 0x 前缀（65 → 0x41） */
export function hexOf(code: number): string {
	return `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** 复制的内容：可打印字符复制字符本身，控制字符复制转义写法（没有约定的退回 \\xHH） */
export function asciiCopyText(entry: AsciiEntry): string {
	if (entry.char !== null) return entry.char;
	if (entry.escape !== null) return entry.escape;
	return `\\x${entry.code.toString(16).toUpperCase().padStart(2, '0')}`;
}

function haystack(entry: AsciiEntry): string {
	const hex = entry.code.toString(16).padStart(2, '0');
	return [String(entry.code), hex, `0x${hex}`, entry.char ?? '', entry.abbr ?? '', entry.escape ?? '', entry.note]
		.join(' ')
		.toLowerCase();
}

/** 小写包含匹配：十进制、十六进制、字符、缩写、转义、说明都能查；空查询返回全量 */
export function searchAsciiEntries(query: string): AsciiEntry[] {
	const q = query.trim().toLowerCase().replace(/^0x/, '');
	if (q === '') return ASCII_ENTRIES;
	return ASCII_ENTRIES.filter((entry) => haystack(entry).includes(q));
}

/** 按分组顺序切成若干段，空段不返回 */
export function groupAsciiEntries(items: AsciiEntry[]): { group: AsciiGroup; name: string; items: AsciiEntry[] }[] {
	return ASCII_GROUPS.map((group) => ({
		group: group.id,
		name: group.name,
		items: items.filter((item) => asciiGroupOf(item.code) === group.id)
	})).filter((section) => section.items.length > 0);
}
