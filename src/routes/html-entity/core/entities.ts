// HTML 实体编解码的纯函数，不依赖 DOM，node 环境可直接单测。
// 设计取舍见各函数注释：解码走「宽容策略」，未知实体原样保留，不报错、不抛异常。
import type { EncodeScope, EncodeStyle } from './types.ts';

/** 希腊小写字母的实体名，按码位顺序排列（0x3B1 α 起，ς 即 sigmaf 在 σ 前面，码位连续） */
const GREEK_LOWER_NAMES = [
	'alpha',
	'beta',
	'gamma',
	'delta',
	'epsilon',
	'zeta',
	'eta',
	'theta',
	'iota',
	'kappa',
	'lambda',
	'mu',
	'nu',
	'xi',
	'omicron',
	'pi',
	'rho',
	'sigmaf',
	'sigma',
	'tau',
	'upsilon',
	'phi',
	'chi',
	'psi',
	'omega'
] as const;

/** 希腊大写字母的实体名。Unicode 里 0x3A2 没有字符（ς 无大写），Σ 从 0x3A3 起 */
const GREEK_UPPER_NAMES = [
	'Alpha',
	'Beta',
	'Gamma',
	'Delta',
	'Epsilon',
	'Zeta',
	'Eta',
	'Theta',
	'Iota',
	'Kappa',
	'Lambda',
	'Mu',
	'Nu',
	'Xi',
	'Omicron',
	'Pi',
	'Rho',
	'Sigma',
	'Tau',
	'Upsilon',
	'Phi',
	'Chi',
	'Psi',
	'Omega'
] as const;

/** 常用拉丁扩展字母：[实体名, 码位]，大写同名首字母大写 */
const LATIN_ENTRIES: ReadonlyArray<readonly [string, number]> = [
	['agrave', 0xe0],
	['aacute', 0xe1],
	['acirc', 0xe2],
	['atilde', 0xe3],
	['auml', 0xe4],
	['aring', 0xe5],
	['ae', 0xe6],
	['ccedil', 0xe7],
	['egrave', 0xe8],
	['eacute', 0xe9],
	['ecirc', 0xea],
	['euml', 0xeb],
	['igrave', 0xec],
	['iacute', 0xed],
	['icirc', 0xee],
	['iuml', 0xef],
	['eth', 0xf0],
	['ntilde', 0xf1],
	['ograve', 0xf2],
	['oacute', 0xf3],
	['ocirc', 0xf4],
	['otilde', 0xf5],
	['ouml', 0xf6],
	['oslash', 0xf8],
	['ugrave', 0xf9],
	['uacute', 0xfa],
	['ucirc', 0xfb],
	['uuml', 0xfc],
	['yacute', 0xfd],
	['thorn', 0xfe],
	['szlig', 0xdf],
	['yuml', 0xff],
	['Agrave', 0xc0],
	['Aacute', 0xc1],
	['Acirc', 0xc2],
	['Atilde', 0xc3],
	['Auml', 0xc4],
	['Aring', 0xc5],
	['AElig', 0xc6],
	['Ccedil', 0xc7],
	['Egrave', 0xc8],
	['Eacute', 0xc9],
	['Ecirc', 0xca],
	['Euml', 0xcb],
	['Igrave', 0xcc],
	['Iacute', 0xcd],
	['Icirc', 0xce],
	['Iuml', 0xcf],
	['ETH', 0xd0],
	['Ntilde', 0xd1],
	['Ograve', 0xd2],
	['Oacute', 0xd3],
	['Ocirc', 0xd4],
	['Otilde', 0xd5],
	['Ouml', 0xd6],
	['Oslash', 0xd8],
	['Ugrave', 0xd9],
	['Uacute', 0xda],
	['Ucirc', 0xdb],
	['Uuml', 0xdc],
	['Yacute', 0xdd],
	['THORN', 0xde]
];

/**
 * 常用命名实体表（HTML4 与 HTML5 里高频的部分），name → char。
 * 只收录「一个字符对应一个固定名字」的实体；数字实体是兜底，任何字符都能转，
 * 所以表不需要穷尽。批量登记希腊与拉丁字母，剩下的高频符号逐条手写。
 */
const NAME_TO_CHAR: Map<string, string> = (() => {
	const map = new Map<string, string>();
	// HTML 必需的五个（标签与属性里的保留字符）
	for (const [name, char] of Object.entries({
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'"
	})) {
		map.set(name, char);
	}
	// 空白与排版。特殊空格在源码里肉眼难辨，一律用码位写字符，防止把普通空格误映射成 &nbsp;
	for (const [name, code] of [
		['nbsp', 0xa0],
		['ensp', 0x2002],
		['emsp', 0x2003],
		['thinsp', 0x2009],
		['shy', 0xad],
		['macr', 0xaf],
		['acute', 0xb4],
		['cedil', 0xb8]
	] as const) {
		map.set(name, String.fromCodePoint(code));
	}
	// 货币
	for (const [name, char] of Object.entries({
		curren: '¤',
		cent: '¢',
		pound: '£',
		yen: '¥',
		euro: '€'
	})) {
		map.set(name, char);
	}
	// 常见符号
	for (const [name, char] of Object.entries({
		copy: '©',
		reg: '®',
		trade: '™',
		deg: '°',
		plusmn: '±',
		micro: 'µ',
		para: '¶',
		sect: '§',
		middot: '·',
		iexcl: '¡',
		iquest: '¿',
		bull: '•',
		dagger: '†',
		Dagger: '‡',
		permil: '‰',
		prime: '′',
		Prime: '″',
		hellip: '…',
		ndash: '–',
		mdash: '—',
		lsquo: '‘',
		rsquo: '’',
		sbquo: '‚',
		ldquo: '“',
		rdquo: '”',
		bdquo: '„',
		laquo: '«',
		raquo: '»',
		frac14: '¼',
		frac12: '½',
		frac34: '¾'
	})) {
		map.set(name, char);
	}
	// 箭头与数学
	for (const [name, char] of Object.entries({
		larr: '←',
		uarr: '↑',
		rarr: '→',
		darr: '↓',
		harr: '↔',
		minus: '−',
		times: '×',
		divide: '÷',
		lowast: '∗',
		radic: '√',
		infin: '∞',
		ang: '∠',
		perp: '⊥',
		sdot: '⋅',
		lceil: '⌈',
		rceil: '⌉',
		lfloor: '⌊',
		rfloor: '⌋',
		and: '∧',
		or: '∨',
		not: '¬',
		cap: '∩',
		cup: '∪',
		int: '∫',
		there4: '∴',
		sim: '∼',
		asymp: '≈',
		cong: '≅',
		equiv: '≡',
		ne: '≠',
		le: '≤',
		ge: '≥',
		sub: '⊂',
		sup: '⊃',
		nsub: '⊄',
		sube: '⊆',
		supe: '⊇',
		isin: '∈',
		notin: '∉',
		ni: '∋',
		prod: '∏',
		sum: '∑',
		oplus: '⊕',
		otimes: '⊗',
		empty: '∅',
		forall: '∀',
		exist: '∃',
		nabla: '∇',
		spades: '♠',
		clubs: '♣',
		hearts: '♥',
		diams: '♦',
		loz: '◊',
		oline: '‾',
		frasl: '⁄',
		weierp: '℘',
		image: 'ℑ',
		real: 'ℜ',
		alefsym: 'ℵ'
	})) {
		map.set(name, char);
	}
	// 希腊字母：小写 25 个码位连续（0x3B1..0x3C9）；大写跳过空位 0x3A2
	GREEK_LOWER_NAMES.forEach((name, i) => map.set(name, String.fromCodePoint(0x3b1 + i)));
	GREEK_UPPER_NAMES.forEach((name, i) => map.set(name, String.fromCodePoint(i <= 16 ? 0x391 + i : 0x390 + i + 1)));
	// 拉丁扩展
	for (const [name, code] of LATIN_ENTRIES) map.set(name, String.fromCodePoint(code));
	return map;
})();

/** char → name 的反向表：编码「命名形式」时查它。同一字符被多个名字指到时，只保留最先登记的 */
const CHAR_TO_NAME: Map<string, string> = (() => {
	const map = new Map<string, string>();
	for (const [name, char] of NAME_TO_CHAR) {
		if (!map.has(char)) map.set(char, name);
	}
	return map;
})();

/** HTML 文档里必须转义否则会破坏结构的字符 */
const REQUIRED_CHARS = new Set(['&', '<', '>', '"', "'"]);

/**
 * 编码：文本 → HTML 实体。
 * @param scope  转义范围：required 只转必需字符；symbols 额外转表内符号；nonAscii 把所有非 ASCII 也转掉
 * @param style  实体形式：named 命名优先（没名字的用数字）；numeric 一律十进制数字实体
 */
export function encodeHtml(text: string, scope: EncodeScope, style: EncodeStyle): string {
	let out = '';
	for (const ch of text) {
		const mustEscape = REQUIRED_CHARS.has(ch);
		const named = CHAR_TO_NAME.get(ch);
		let escaped: boolean;
		switch (scope) {
			case 'required':
				escaped = mustEscape;
				break;
			case 'symbols':
				escaped = mustEscape || named !== undefined;
				break;
			case 'nonAscii':
				escaped = mustEscape || ch.codePointAt(0)! > 0x7f || named !== undefined;
				break;
		}
		if (!escaped) {
			out += ch;
			continue;
		}
		if (style === 'named' && named !== undefined) out += `&${named};`;
		else out += numericEntity(ch);
	}
	return out;
}

/** 一个字符的十进制数字实体：普通字符按码点转，代理对合成的增补平面字符也能一次转对 */
function numericEntity(ch: string): string {
	return `&#${ch.codePointAt(0)};`;
}

/** 解码时匹配「完整实体」的正则：十六进制、十进制、命名三种，都要求以分号结尾（x 大小写不限） */
const ENTITY_PATTERN = /&(?:#[xX]([0-9a-fA-F]+)|#([0-9a-zA-Z]+)|([a-zA-Z][a-zA-Z0-9]*));/g;

/**
 * 解码：HTML 实体 → 文本（宽容策略）。
 * 认得的实体正常转换；未知命名、非法数字（NaN、超出 Unicode 范围、代理区）一律原样保留，
 * 不报错也不抛异常 —— 与浏览器「实体解不出来就当普通文本」的行为一致，坏实体不拖垮整段。
 */
export function decodeHtml(text: string): string {
	let out = '';
	let last = 0;
	ENTITY_PATTERN.lastIndex = 0;
	for (let match = ENTITY_PATTERN.exec(text); match !== null; match = ENTITY_PATTERN.exec(text)) {
		out += text.slice(last, match.index);
		last = match.index + match[0].length;
		const decoded = resolveEntity(match[1], match[2], match[3]);
		out += decoded ?? match[0];
	}
	out += text.slice(last);
	return out;
}

/** 把一次匹配还原成字符；解不出来返回 undefined，由调用方原样保留 */
function resolveEntity(hex?: string, decimal?: string, named?: string): string | undefined {
	if (hex !== undefined) return fromCodePoint(parseInt(hex, 16));
	if (decimal !== undefined) return fromCodePoint(parseInt(decimal, 10));
	if (named !== undefined) return NAME_TO_CHAR.get(named);
	return undefined;
}

/** 码点 → 字符，只接受合法标量值：NaN、超界、代理区都视为非法 */
function fromCodePoint(code: number): string | undefined {
	if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
		return undefined;
	}
	return String.fromCodePoint(code);
}
