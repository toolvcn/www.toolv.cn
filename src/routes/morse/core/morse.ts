// 摩斯密码的码表与编解码（纯函数，不依赖 DOM，可单测）。
//
// 码表取 ITU-R M.1677-1 的拉丁字母 / 阿拉伯数字 / 标点，共 26 + 10 + 18 条。
// 解码走「宽容解析」三步：① 点划与分隔符先归一化（`·`、`—`、`_` 这类变体照收）；
// ② 按分隔符切分出片段，能直接查表的直接查；③ 查不到的片段按**字母表贪心最长匹配**自动分词。
//
// 为什么自动分词只用字母表：`.` 与 `-` 各自都是合法字母码（E / T），所以任何点划串都能切完，
// 不存在「切不动」的情况；而把数字与标点放进来会先咬掉长的码 —— `......`（H + I）
// 会先匹配 5 个点的数字 `5`，切成 `5E`。这是**启发式**，同一串可能有多种切法，见 README 的「已知取舍」。
import { DEFAULT_SYMBOLS, type MorseDirection, type MorseGroupId, type MorseSymbols } from './types.ts';

export interface MorseEntry {
	/** 字符本体（字母一律大写） */
	char: string;
	/** 摩斯码（`.` 与 `-`） */
	code: string;
	group: MorseGroupId;
}

/** 摩斯码表：数组顺序即速查表的渲染顺序，分组按 字母 → 数字 → 标点 排列 */
export const MORSE_TABLE: MorseEntry[] = [
	// 字母
	{ char: 'A', code: '.-', group: 'letter' },
	{ char: 'B', code: '-...', group: 'letter' },
	{ char: 'C', code: '-.-.', group: 'letter' },
	{ char: 'D', code: '-..', group: 'letter' },
	{ char: 'E', code: '.', group: 'letter' },
	{ char: 'F', code: '..-.', group: 'letter' },
	{ char: 'G', code: '--.', group: 'letter' },
	{ char: 'H', code: '....', group: 'letter' },
	{ char: 'I', code: '..', group: 'letter' },
	{ char: 'J', code: '.---', group: 'letter' },
	{ char: 'K', code: '-.-', group: 'letter' },
	{ char: 'L', code: '.-..', group: 'letter' },
	{ char: 'M', code: '--', group: 'letter' },
	{ char: 'N', code: '-.', group: 'letter' },
	{ char: 'O', code: '---', group: 'letter' },
	{ char: 'P', code: '.--.', group: 'letter' },
	{ char: 'Q', code: '--.-', group: 'letter' },
	{ char: 'R', code: '.-.', group: 'letter' },
	{ char: 'S', code: '...', group: 'letter' },
	{ char: 'T', code: '-', group: 'letter' },
	{ char: 'U', code: '..-', group: 'letter' },
	{ char: 'V', code: '...-', group: 'letter' },
	{ char: 'W', code: '.--', group: 'letter' },
	{ char: 'X', code: '-..-', group: 'letter' },
	{ char: 'Y', code: '-.--', group: 'letter' },
	{ char: 'Z', code: '--..', group: 'letter' },
	// 数字
	{ char: '0', code: '-----', group: 'digit' },
	{ char: '1', code: '.----', group: 'digit' },
	{ char: '2', code: '..---', group: 'digit' },
	{ char: '3', code: '...--', group: 'digit' },
	{ char: '4', code: '....-', group: 'digit' },
	{ char: '5', code: '.....', group: 'digit' },
	{ char: '6', code: '-....', group: 'digit' },
	{ char: '7', code: '--...', group: 'digit' },
	{ char: '8', code: '---..', group: 'digit' },
	{ char: '9', code: '----.', group: 'digit' },
	// 标点（ITU-R M.1677-1）
	{ char: '.', code: '.-.-.-', group: 'punct' },
	{ char: ',', code: '--..--', group: 'punct' },
	{ char: '?', code: '..--..', group: 'punct' },
	{ char: "'", code: '.----.', group: 'punct' },
	{ char: '!', code: '-.-.--', group: 'punct' },
	{ char: '/', code: '-..-.', group: 'punct' },
	{ char: '(', code: '-.--.', group: 'punct' },
	{ char: ')', code: '-.--.-', group: 'punct' },
	{ char: '&', code: '.-...', group: 'punct' },
	{ char: ':', code: '---...', group: 'punct' },
	{ char: ';', code: '-.-.-.', group: 'punct' },
	{ char: '=', code: '-...-', group: 'punct' },
	{ char: '+', code: '.-.-.', group: 'punct' },
	{ char: '-', code: '-....-', group: 'punct' },
	{ char: '_', code: '..--.-', group: 'punct' },
	{ char: '"', code: '.-..-.', group: 'punct' },
	{ char: '$', code: '...-..-', group: 'punct' },
	{ char: '@', code: '.--.-.', group: 'punct' }
];

const GROUP_NAMES: Record<MorseGroupId, string> = { letter: '字母', digit: '数字', punct: '标点' };
const GROUP_ORDER: MorseGroupId[] = ['letter', 'digit', 'punct'];

/** 字符 → 条目（编码用） */
const BY_CHAR = new Map(MORSE_TABLE.map((entry) => [entry.char, entry]));
/** 码 → 条目（解码直查用） */
const BY_CODE = new Map(MORSE_TABLE.map((entry) => [entry.code, entry]));
/** 字母码 → 字符（自动分词用）：`.` 与 `-` 都在里面，所以点划串一定能切完 */
const LETTER_BY_CODE = new Map(
	MORSE_TABLE.filter((entry) => entry.group === 'letter').map((entry) => [entry.code, entry.char])
);
/** 自动分词的窗口上限（字母码最长 4 位） */
const MAX_LETTER_CODE_LEN = MORSE_TABLE.reduce(
	(max, entry) => (entry.group === 'letter' ? Math.max(max, entry.code.length) : max),
	0
);

/** 词分隔哨兵：把一个词里的片段隔开，取值不会出现在摩斯码里 */
const WORD_MARK = '\u0000';

/** 解不出的片段在结果里的占位符（ITU 里 `?` 就是「没听懂」） */
const UNKNOWN_MARK = '?';

/** 点 / 划的常见 Unicode 变体：没自定义点划时照收，手抄或从文档粘来的都能解 */
const DOT_VARIANTS = ['·', '•', '．', '｡'];
const DASH_VARIANTS = ['−', '–', '—', '＿', '_'];

export interface EncodeResult {
	text: string;
	/** 成功编码的字符数（不含空白） */
	encoded: number;
	/** 没有摩斯码的字符（去重、按首次出现顺序） */
	skipped: string[];
	/** 没有摩斯码的字符出现次数 */
	skippedCount: number;
}

export interface DecodeResult {
	text: string;
	/** 成功解出的字符数 */
	decoded: number;
	/** 解不出的片段（去重、按首次出现顺序） */
	unknown: string[];
}

/** 文本 → 摩斯：字母不分大小写，空白（空格 / 换行 / 制表）切词，无码字符跳过并上报 */
export function encodeMorse(input: string, symbols: MorseSymbols = DEFAULT_SYMBOLS): EncodeResult {
	const trimmed = input.trim();
	if (trimmed === '') return { text: '', encoded: 0, skipped: [], skippedCount: 0 };

	const words: string[] = [];
	const skipped: string[] = [];
	let encoded = 0;
	let skippedCount = 0;

	for (const word of trimmed.split(/\s+/)) {
		const codes: string[] = [];
		// Array.from 按码点切分：emoji 这类代理对不会被拆成两半
		for (const char of Array.from(word)) {
			const entry = BY_CHAR.get(char.toUpperCase());
			if (entry === undefined) {
				skippedCount += 1;
				if (!skipped.includes(char)) skipped.push(char);
				continue;
			}
			codes.push(formatMorseCode(entry.code, symbols));
			encoded += 1;
		}
		// 整词都是无码字符时不留空词，否则输出里会多出一串词分隔符
		if (codes.length > 0) words.push(codes.join(symbols.letterSep));
	}

	return { text: words.join(symbols.wordSep), encoded, skipped, skippedCount };
}

/** 摩斯 → 文本：分隔符宽松识别，片段查不到表时按字母表贪心最长匹配自动分词 */
export function decodeMorse(input: string, symbols: MorseSymbols = DEFAULT_SYMBOLS): DecodeResult {
	if (input.trim() === '') return { text: '', decoded: 0, unknown: [] };

	const outWords: string[] = [];
	const unknown: string[] = [];
	let decoded = 0;

	for (const tokens of splitTokens(normalize(input, symbols), symbols)) {
		const parts: string[] = [];
		for (const token of tokens) {
			const direct = BY_CODE.get(token);
			if (direct !== undefined) {
				parts.push(direct.char);
				decoded += 1;
				continue;
			}
			const segment = segmentToken(token);
			if (segment.unknown) {
				// 一个片段要么整体解出、要么整体标 `?`：半个词混进结果比整段标出来更难核对
				if (!unknown.includes(token)) unknown.push(token);
				parts.push(UNKNOWN_MARK);
				continue;
			}
			parts.push(...segment.chars);
			decoded += segment.chars.length;
		}
		if (parts.length > 0) outWords.push(parts.join(''));
	}

	return { text: outWords.join(' '), decoded, unknown };
}

/** 速查表筛选：字符与摩斯码都能当关键词（`s` 与 `...` 命中同一条） */
export function searchMorseEntries(query: string): MorseEntry[] {
	const keyword = query.trim();
	if (keyword === '') return MORSE_TABLE;
	const lower = keyword.toLowerCase();
	return MORSE_TABLE.filter((entry) => entry.char.toLowerCase().includes(lower) || entry.code.includes(keyword));
}

/** 按 字母 / 数字 / 标点 分组，空组不渲染 */
export function groupMorseEntries(entries: MorseEntry[]): { id: MorseGroupId; name: string; items: MorseEntry[] }[] {
	return GROUP_ORDER.map((id) => ({
		id,
		name: GROUP_NAMES[id],
		items: entries.filter((entry) => entry.group === id)
	})).filter((section) => section.items.length > 0);
}

/**
 * 速查表点一行插进输入框的结果。
 * 光标位置一并给出：读 DOM 拿选区、写回选区都是组件层的事，这里只做纯计算（可单测）。
 */
export interface MorseInsertResult {
	/** 插入后的输入框内容 */
	value: string;
	/** 插入后光标该落在哪儿（插入内容之后） */
	caret: number;
	/** 实际插进去的文本（解码方向可能带一个自动补上的字母分隔符） */
	text: string;
}

/**
 * 速查表点一行 → 把它的内容插到输入框的 `[start, end)` 处（`start === end` 即插在光标处）。
 *
 * 插什么由当前方向决定：编码方向插字符，解码方向插摩斯码（按当前自定义点划）。
 * 解码方向还多一步：插入点**紧跟在某个码之后**时自动补一个字母分隔符 —— 不补的话，
 * 两次点击的码会连成一个更长的串，而自动分词是贪心最长匹配：
 * `...` + `---` 连成的 `...---` 会先被咬掉前四位 `...-`（V），而不是读成 `SO`。
 * 插入点**之后**不再补：中间插入是少数路径，补了会让「插完接着打字」落在分隔符前面。
 */
export function insertMorseEntry(
	value: string,
	entry: MorseEntry,
	direction: MorseDirection,
	symbols: MorseSymbols,
	start: number,
	end: number
): MorseInsertResult {
	const raw = direction === 'encode' ? entry.char : formatMorseCode(entry.code, symbols);
	const prefix = direction === 'decode' && needsLetterSeparator(value, start, symbols) ? symbols.letterSep : '';
	const text = prefix + raw;
	return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length, text };
}

/** 插入点前一个字符还是码（不是空白、斜杠、竖线，也不是已设的字母分隔符）时才需要补分隔 */
function needsLetterSeparator(value: string, start: number, symbols: MorseSymbols): boolean {
	if (symbols.letterSep === '') return false; // 「不分隔」档：连写由用户自己负责
	const head = value.slice(0, start);
	if (head === '') return false;
	const last = head.charAt(head.length - 1);
	if (/[\s/|\\]/.test(last)) return false;
	return last !== symbols.letterSep;
}

/** 把码表里的标准码换成当前自定义的点划（`.` `-` 只是码表的内部写法，输出要跟着用户的设置走） */
export function formatMorseCode(code: string, symbols: MorseSymbols): string {
	if (symbols.dot === DEFAULT_SYMBOLS.dot && symbols.dash === DEFAULT_SYMBOLS.dash) return code;
	// 一趟替换到位：分两趟的话，第一趟写进去的字符会被第二趟再咬一次
	return code.replace(/[.-]/g, (char) => (char === '.' ? symbols.dot : symbols.dash));
}

/** 先换自定义符号、再折 Unicode 变体 —— 顺序不能反：用户把「划」设成 `—` 时第一步就该吃掉它 */
function normalize(input: string, symbols: MorseSymbols): string {
	let text = input;
	if (symbols.dot !== DEFAULT_SYMBOLS.dot) text = text.split(symbols.dot).join('.');
	if (symbols.dash !== DEFAULT_SYMBOLS.dash) text = text.split(symbols.dash).join('-');
	for (const variant of DOT_VARIANTS) text = text.split(variant).join('.');
	for (const variant of DASH_VARIANTS) text = text.split(variant).join('-');
	return text;
}

/** 切成「词 → 片段」两层；空片段（首尾或连续分隔符切出来的）一律丢掉 */
function splitTokens(morse: string, symbols: MorseSymbols): string[][] {
	const customSep = symbols.letterSep !== DEFAULT_SYMBOLS.letterSep || symbols.wordSep !== DEFAULT_SYMBOLS.wordSep;

	// 自定义了分隔符就严格按它切：两套口径混在一起，用户没法预期哪条生效
	const words = customSep
		? splitOn(morse, symbols.wordSep)
		: morse
				.replace(/[\n\t/|\\]+/g, WORD_MARK)
				.replace(/ {2,}/g, WORD_MARK)
				.split(WORD_MARK);

	// 自定义字母分隔符为空串 = 不分隔，整个词交给自动分词
	const splitLetters = customSep
		? (word: string) => splitOn(word, symbols.letterSep)
		: (word: string) => word.split(/\s+/);

	return words
		.map(splitLetters)
		.map(trimTokens)
		.filter((tokens) => tokens.length > 0);
}

/** 分隔符为空串表示「不分隔」，整段当作一个片段 */
function splitOn(text: string, separator: string): string[] {
	return separator === '' ? [text] : text.split(separator);
}

/** 去掉每段两侧的空白与切出来的空段 */
function trimTokens(tokens: string[]): string[] {
	return tokens.map((token) => token.trim()).filter((token) => token !== '');
}

/** 自动分词：字母表贪心最长匹配；出现非点划字符时该片段判为解不出 */
function segmentToken(token: string): { chars: string[]; unknown: boolean } {
	const chars: string[] = [];
	let index = 0;

	while (index < token.length) {
		let matched: string | undefined;
		let matchedLength = 0;
		// 从最长的码往下试：贪心最长匹配
		const max = Math.min(MAX_LETTER_CODE_LEN, token.length - index);
		for (let length = max; length >= 1; length -= 1) {
			matched = LETTER_BY_CODE.get(token.slice(index, index + length));
			if (matched !== undefined) {
				matchedLength = length;
				break;
			}
		}
		if (matched === undefined) return { chars, unknown: true };
		chars.push(matched);
		index += matchedLength;
	}

	return { chars, unknown: false };
}
