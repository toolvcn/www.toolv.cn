import { describe, expect, test } from 'vitest';
import {
	decodeMorse,
	encodeMorse,
	groupMorseEntries,
	insertMorseEntry,
	MORSE_TABLE,
	searchMorseEntries,
	type MorseEntry
} from './morse.ts';
import { DEFAULT_SYMBOLS, type MorseSymbols } from './types.ts';

/** 自定义一套符号：点 `·`、划 `—`、字母分隔 `|`、词分隔 `//` */
const CUSTOM: MorseSymbols = { dot: '·', dash: '—', letterSep: '|', wordSep: '//' };

describe('摩斯码表', () => {
	test('26 字母 + 10 数字 + 18 标点，且没有重复的码', () => {
		expect(MORSE_TABLE).toHaveLength(54);
		expect(new Set(MORSE_TABLE.map((entry) => entry.code)).size).toBe(54);
		expect(groupMorseEntries(MORSE_TABLE).map((section) => section.items.length)).toEqual([26, 10, 18]);
	});

	test('几条锚点码与国际标准一致（抄错一位就会被这里拦下）', () => {
		const byChar = new Map(MORSE_TABLE.map((entry) => [entry.char, entry.code]));
		expect(byChar.get('S')).toBe('...');
		expect(byChar.get('O')).toBe('---');
		expect(byChar.get('H')).toBe('....');
		expect(byChar.get('0')).toBe('-----');
		expect(byChar.get('?')).toBe('..--..');
		expect(byChar.get('@')).toBe('.--.-.');
	});
});

describe('encodeMorse', () => {
	test('字母按码表编码：字母间一个空格，词间用 ` / `', () => {
		const result = encodeMorse('SOS TOOLV');
		expect(result.text).toBe('... --- ... / - --- --- .-.. ...-');
		expect(result.encoded).toBe(8);
		expect(result.skipped).toEqual([]);
	});

	test('字母不分大小写', () => {
		expect(encodeMorse('sOs').text).toBe('... --- ...');
	});

	test('数字与标点也在表里', () => {
		expect(encodeMorse('A1.').text).toBe('.- .---- .-.-.-');
	});

	test('换行与制表都算词分隔', () => {
		expect(encodeMorse('A\n\tB').text).toBe('.- / -...');
	});

	test('没有摩斯码的字符被跳过（连 emoji 一起），并统计出现次数', () => {
		const result = encodeMorse('中文 AB 😀');
		expect(result.text).toBe('.- -...');
		expect(result.encoded).toBe(2);
		expect(result.skipped).toEqual(['中', '文', '😀']);
		expect(result.skippedCount).toBe(3);
	});

	test('整词都无码时不留空词（否则输出会多出一串词分隔符）', () => {
		expect(encodeMorse('中文 A 中文').text).toBe('.-');
	});

	test('空输入与纯空白都返回空结果', () => {
		expect(encodeMorse('   ')).toEqual({ text: '', encoded: 0, skipped: [], skippedCount: 0 });
	});

	test('自定义点划与分隔符后按它输出', () => {
		expect(encodeMorse('AB', CUSTOM).text).toBe('·—|—···');
		expect(encodeMorse('A B', CUSTOM).text).toBe('·—//—···');
	});
});

describe('decodeMorse', () => {
	test('空格分字母、` / ` 分词', () => {
		const result = decodeMorse('... --- ... / - --- --- .-.. ...-');
		expect(result.text).toBe('SOS TOOLV');
		expect(result.decoded).toBe(8);
		expect(result.unknown).toEqual([]);
	});

	test('`/` 与连续两个空格都算词分隔', () => {
		expect(decodeMorse('.../---').text).toBe('S O');
		expect(decodeMorse('...  ---').text).toBe('S O');
	});

	test('宽容接受点划的 Unicode 变体（·、—、_ 等）', () => {
		expect(decodeMorse('··· ——— ···').text).toBe('SOS');
		// 下划线当划用（`_` → `-` → T），没有归一化的话这一格会变成解不出的 `?`
		expect(decodeMorse('.... _ ....').text).toBe('HTH');
	});

	test('缺字母分隔时按字母表贪心最长匹配自动分词', () => {
		expect(decodeMorse('......').text).toBe('HI');
	});

	test('自动分词只认字母码：不会把 `......` 咬成数字 `5`', () => {
		// 完整表贪心会先匹配 5 个点的 `5`（切成 `5E`），字母表里最长只有 4 位
		expect(decodeMorse('......').text).toBe('HI');
		expect(decodeMorse('.-....').text).toBe('LI');
	});

	test('分隔符只丢了一部分时，其余片段照常解', () => {
		expect(decodeMorse('.... . .-.. .-..---').text).toBe('HELLO');
	});

	test('解不出的片段整体标 `?` 并上报（不去猜半个词）', () => {
		const result = decodeMorse('... xx ---');
		// 三个片段同属一个词（单个空格是字母分隔），所以中间不留空格
		expect(result.text).toBe('S?O');
		expect(result.decoded).toBe(2);
		expect(result.unknown).toEqual(['xx']);
	});

	test('自定义点划与分隔符', () => {
		const result = decodeMorse('·—|—···', CUSTOM);
		expect(result.text).toBe('AB');
		expect(result.decoded).toBe(2);
	});

	test('自定义词分隔符', () => {
		expect(decodeMorse('.-//-...', CUSTOM).text).toBe('A B');
	});

	test('字母分隔留空 = 整个词自动分词', () => {
		expect(decodeMorse('......', { ...DEFAULT_SYMBOLS, letterSep: '' }).text).toBe('HI');
	});

	test('空输入与纯空白都返回空结果', () => {
		expect(decodeMorse('  ')).toEqual({ text: '', decoded: 0, unknown: [] });
	});

	test('编解码互为逆运算（字母数字往返一致）', () => {
		const source = 'SOS TOOLV 2026';
		expect(decodeMorse(encodeMorse(source).text).text).toBe(source);
	});
});

describe('searchMorseEntries', () => {
	test('空关键词返回整张表', () => {
		expect(searchMorseEntries('')).toHaveLength(54);
	});

	test('字符不分大小写；解码串也能当关键词', () => {
		expect(searchMorseEntries('A').map((entry) => entry.char)).toEqual(['A']);
		expect(searchMorseEntries('.-')).toContainEqual({ char: 'A', code: '.-', group: 'letter' });
		expect(searchMorseEntries('.-').some((entry) => entry.char === 'E')).toBe(false);
	});
});

describe('insertMorseEntry（速查表点一行 → 插到输入框）', () => {
	const A: MorseEntry = { char: 'A', code: '.-', group: 'letter' };
	const O: MorseEntry = { char: 'O', code: '---', group: 'letter' };
	const S: MorseEntry = { char: 'S', code: '...', group: 'letter' };

	test('编码方向插字符，插在光标处，选区被替换', () => {
		expect(insertMorseEntry('', A, 'encode', DEFAULT_SYMBOLS, 0, 0)).toEqual({ value: 'A', caret: 1, text: 'A' });
		expect(insertMorseEntry('XY', A, 'encode', DEFAULT_SYMBOLS, 1, 2)).toEqual({ value: 'XA', caret: 2, text: 'A' });
	});

	test('解码方向插摩斯码；紧跟在一个码之后时自动补字母分隔符', () => {
		const first = insertMorseEntry('', S, 'decode', DEFAULT_SYMBOLS, 0, 0);
		expect(first).toEqual({ value: '...', caret: 3, text: '...' });
		// 不补的话 `...` 与 `---` 会连成 `...---`，自动分词按贪心最长匹配先咬掉 `...-`（V）而不是 `SO`
		expect(insertMorseEntry(first.value, O, 'decode', DEFAULT_SYMBOLS, first.caret, first.caret)).toEqual({
			value: '... ---',
			caret: 7,
			text: ' ---'
		});
	});

	test('末尾已经是分隔位（空白 / 斜杠）就不再重复补', () => {
		expect(insertMorseEntry('... ', A, 'decode', DEFAULT_SYMBOLS, 4, 4)).toEqual({
			value: '... .-',
			caret: 6,
			text: '.-'
		});
		expect(insertMorseEntry('.../', A, 'decode', DEFAULT_SYMBOLS, 4, 4).text).toBe('.-');
	});

	test('「不分隔」档不补分隔符（连写由用户自己负责）', () => {
		const symbols: MorseSymbols = { ...DEFAULT_SYMBOLS, letterSep: '' };
		expect(insertMorseEntry('---', A, 'decode', symbols, 3, 3).value).toBe('---.-');
	});

	test('自定义点划下插的是自定义写法', () => {
		expect(insertMorseEntry('', A, 'decode', CUSTOM, 0, 0).text).toBe('·—');
		expect(insertMorseEntry('·—', O, 'decode', CUSTOM, 2, 2).text).toBe('|———');
	});
});
