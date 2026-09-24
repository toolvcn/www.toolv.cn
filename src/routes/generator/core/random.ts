// 随机生成的纯函数：UUID v4、密码、随机数序列、假文。
// 随机源统一走 crypto.getRandomValues（可注入 RandomSource 供单测）；
// 区间取整一律「拒绝采样」，先消掉 2^32 除以区间的余数再取模，杜绝模偏差。
import {
	AMBIGUOUS_CHARS,
	CHAR_DIGITS,
	CHAR_LOWER,
	CHAR_SYMBOLS,
	CHAR_UPPER,
	LATIN_OPENING,
	LATIN_WORDS,
	ZH_CHARS,
	type LoremOptions,
	type NumberOptions,
	type PasswordOptions,
	type RandomSource
} from './types.ts';
import {
	LATIN_WORDS_PER_SENTENCE,
	SENTENCES_PER_PARAGRAPH,
	STRENGTH_LEVELS,
	ZH_CHARS_PER_SENTENCE
} from '../config.ts';

/** 系统随机源 */
export function systemRandom(wordCount: number): Uint32Array {
	const words = new Uint32Array(wordCount);
	crypto.getRandomValues(words);
	return words;
}

/**
 * [min, max] 闭区间取 count 个无偏随机整数。
 * 超过量化上界（w >= limit）的样本直接丢弃重取，这是拒绝采样的核心。
 */
export function randomInts(count: number, min: number, max: number, source: RandomSource = systemRandom): number[] {
	const range = max - min + 1;
	const limit = Math.floor(0x100000000 / range) * range;
	const out: number[] = [];
	while (out.length < count) {
		// 多取一些，减少命中不了时的重取轮数
		const words = source(count - out.length + 16);
		for (let i = 0; i < words.length && out.length < count; i++) {
			const w = words[i]!;
			if (w < limit) out.push(min + (w % range));
		}
	}
	return out;
}

// ---------------------------------------------------------------- UUID

/** 批量生成 UUID v4，后处理：大写、去连字符（后处理不影响随机性） */
export function generateUuids(
	count: number,
	opts: { upper: boolean; dashes: boolean },
	next: () => string = () => crypto.randomUUID()
): string[] {
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		let id = next();
		if (!opts.dashes) id = id.replaceAll('-', '');
		if (opts.upper) id = id.toUpperCase();
		out.push(id);
	}
	return out;
}

// ---------------------------------------------------------------- 密码

/** 从池里随机挑一个字符 */
function pickFrom(pool: string, source: RandomSource): string {
	return pool[randomInts(1, 0, pool.length - 1, source)[0]!]!;
}

/**
 * 生成一条密码：勾选的每类字符 + 自定义字符池各保底出现一次（长度允许时），
 * 其余随机填满后洗牌。假定调用方已校验：池子非空、length >= 保底类数。
 */
export function generatePassword(opts: PasswordOptions, source: RandomSource = systemRandom): string {
	// 先按「排除易混淆」过滤预设池，保底抽样与整体池用同一口径
	const pools: string[] = [];
	const consider = (chars: string, enabled: boolean): void => {
		if (!enabled) return;
		const filtered = opts.avoidAmbiguous ? [...chars].filter((c) => !AMBIGUOUS_CHARS.includes(c)).join('') : chars;
		if (filtered !== '') pools.push(filtered);
	};
	consider(CHAR_LOWER, opts.lower);
	consider(CHAR_UPPER, opts.upper);
	consider(CHAR_DIGITS, opts.digits);
	consider(CHAR_SYMBOLS, opts.symbols);

	// 自定义字符集：不受 avoidAmbiguous 过滤，原样追加
	if (opts.customCharset && opts.customCharset !== '') {
		pools.push(opts.customCharset);
	}

	const pool = pools.join('');
	const picks: string[] = pools.map((p) => pickFrom(p, source));
	while (picks.length < opts.length) picks.push(pickFrom(pool, source));

	// Fisher-Yates 洗牌：保底字符不能都堆在开头
	for (let i = picks.length - 1; i > 0; i--) {
		const j = randomInts(1, 0, i, source)[0]!;
		[picks[i], picks[j]] = [picks[j]!, picks[i]!];
	}
	return picks.join('');
}

/** 密码池大小：按当前勾选 + 自定义字符集算（供熵估算展示） */
export function passwordPoolSize(opts: Omit<PasswordOptions, 'length'>): number {
	let size = 0;
	const consider = (chars: string, enabled: boolean): void => {
		if (!enabled) return;
		size += opts.avoidAmbiguous ? [...chars].filter((c) => !AMBIGUOUS_CHARS.includes(c)).length : chars.length;
	};
	consider(CHAR_LOWER, opts.lower);
	consider(CHAR_UPPER, opts.upper);
	consider(CHAR_DIGITS, opts.digits);
	consider(CHAR_SYMBOLS, opts.symbols);
	if (opts.customCharset && opts.customCharset !== '') {
		size += opts.customCharset.length;
	}
	return size;
}

/** 熵估算：length × log2(poolSize)，位数为上取整 */
export function passwordEntropy(opts: PasswordOptions): number {
	const pool = passwordPoolSize(opts);
	if (pool <= 1) return 0;
	return Math.ceil(opts.length * Math.log2(pool));
}

/** 熵 → 强度档位文案 */
export function strengthLabel(entropy: number): string {
	let label = STRENGTH_LEVELS[0]!.label;
	for (const level of STRENGTH_LEVELS) if (entropy >= level.min) label = level.label;
	return label;
}

// ---------------------------------------------------------------- 随机数

/**
 * 生成随机数列表。
 * 整数走无偏拒绝采样；小数用 32 位随机字均匀映射到 [min, max) 后按位数取整。
 * unique 仅整数模式生效，范围装不下直接抛错（调用方给出中文提示）。
 */
export function generateNumbers(opts: NumberOptions, source: RandomSource = systemRandom): string[] {
	if (opts.count < 1 || opts.max < opts.min) throw new Error('数量或范围不合法');

	if (opts.decimals > 0) {
		const span = opts.max - opts.min;
		const out: string[] = [];
		for (let i = 0; i < opts.count; i++) {
			const w = source(1)[0]!;
			out.push((opts.min + (w / 0x100000000) * span).toFixed(opts.decimals));
		}
		if (opts.sorted) out.sort((a, b) => Number(a) - Number(b));
		return out;
	}

	const span = opts.max - opts.min + 1;
	if (opts.unique && opts.count > span) {
		throw new Error(`范围只有 ${span} 个整数，装不下 ${opts.count} 个不重复的数`);
	}

	const out: number[] = [];
	if (opts.unique) {
		const seen = new Set<number>();
		while (seen.size < opts.count) {
			for (const value of randomInts(opts.count - seen.size, opts.min, opts.max, source)) {
				seen.add(value);
				if (seen.size === opts.count) break;
			}
		}
		out.push(...seen);
	} else {
		out.push(...randomInts(opts.count, opts.min, opts.max, source));
	}

	if (opts.sorted) out.sort((a, b) => a - b);
	return out.map(String);
}

// ---------------------------------------------------------------- 假文

/** 一句拉丁假文：词数落在档位区间内，首词大写，句号收尾 */
function latinSentence(source: RandomSource): string {
	const wordCount = randomInts(1, LATIN_WORDS_PER_SENTENCE.min, LATIN_WORDS_PER_SENTENCE.max, source)[0]!;
	const words = randomInts(wordCount, 0, LATIN_WORDS.length - 1, source).map((i) => LATIN_WORDS[i]!);
	const [first] = words;
	return `${first![0]!.toUpperCase()}${first!.slice(1)} ${words.slice(1).join(' ')}.`;
}

/** 一句中文假文：字数落在档位区间内，句号收尾 */
function zhSentence(source: RandomSource): string {
	const charCount = randomInts(1, ZH_CHARS_PER_SENTENCE.min, ZH_CHARS_PER_SENTENCE.max, source)[0]!;
	const chars = randomInts(charCount, 0, ZH_CHARS.length - 1, source).map((i) => ZH_CHARS[i]!);
	return `${chars.join('')}。`;
}

/**
 * 生成假文。拉丁文整篇以经典开头「Lorem ipsum dolor sit amet…」起手，一眼即认；
 * 句子模式输出一段；段落模式每段句数取档位区间、段间空行。
 */
export function generateLorem(opts: LoremOptions, source: RandomSource = systemRandom): string {
	if (opts.count < 1) return '';

	const sentence = opts.lang === 'latin' ? latinSentence : zhSentence;
	const opening = opts.lang === 'latin' ? `${LATIN_OPENING}.` : '随机假文只求占个位，字句不求通顺。';

	if (opts.mode === 'sentences') {
		const rest = Array.from({ length: opts.count - 1 }, () => sentence(source));
		return [opening, ...rest].join(opts.lang === 'latin' ? ' ' : '');
	}

	const paragraphs: string[] = [];
	for (let p = 0; p < opts.count; p++) {
		const sentenceCount = randomInts(1, SENTENCES_PER_PARAGRAPH.min, SENTENCES_PER_PARAGRAPH.max, source)[0]!;
		const rest = Array.from({ length: sentenceCount - 1 }, () => sentence(source));
		paragraphs.push([opening, ...rest].join(opts.lang === 'latin' ? ' ' : ''));
	}
	return paragraphs.join('\n\n');
}
