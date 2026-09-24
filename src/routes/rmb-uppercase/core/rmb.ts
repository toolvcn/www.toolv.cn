// 人民币大写金额的纯函数：字符串逐位解析，全程不经浮点数，node 环境可直接单测。
// 规则参照《正确填写票据和结算凭证的基本规定》的常见实现：
// 「10」写作壹拾（不是拾）；中间的连续 0 只写一个零；万 / 亿这类大单位在零位也不丢；
// 角位是 0 而分位不是 0 时补「零X分」；角分都为 0 加「整」。

/** 修正后的结果：成功时 output 是大写金额，失败时 error 是给用户看的中文原因 */
export interface RmbResult {
	output: string;
	error: string;
}

const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];

/** 整数部分支持的最大位数（16 位 = 千万亿），超出提示不支持 */
export const MAX_INTEGER_DIGITS = 16;

/** 输入格式：可选负号 + 数字（允许千分位逗号）+ 可选小数。位数上限由 MAX_INTEGER_DIGITS 单独提示 */
const INPUT_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * 把用户输入规范化成 [-]整数(.角分)。第三位小数四舍五入进分，
 * 进位连锁滚过两位小数时（0.999 → 1.00）整数部分用 BigInt 加一。
 */
function normalize(raw: string): string | null {
	const compact = raw.replace(/[,\s]/g, '');
	if (!INPUT_PATTERN.test(compact)) return null;
	const negative = compact.startsWith('-');
	const body = negative ? compact.slice(1) : compact;
	const [rawInt, decimalPart = ''] = body.split('.');
	let intPart = rawInt;
	const threeDigits = decimalPart.padEnd(3, '0').slice(0, 3);
	let cents = threeDigits.slice(0, 2);
	if (threeDigits[2] >= '5') {
		const rounded = roundUpTwo(cents);
		if (rounded === null) {
			// 两位小数全是 9 还要进位：整数部分加一，小数归零
			intPart = (BigInt(intPart) + 1n).toString();
			cents = '00';
		} else {
			cents = rounded;
		}
	}
	const intNormalized = intPart.replace(/^0+(?=\d)/, ''); // 去前导零，保留单个 "0"
	const centsTrimmed = cents.replace(/0$/, ''); // 分位为 0 时只留角位
	return `${negative ? '-' : ''}${intNormalized}${centsTrimmed === '' ? '' : `.${centsTrimmed}`}`;
}

/** 两位小数进一："19" → "20"；全 9 进位溢出（"99" → 整数进一）时返回 null */
function roundUpTwo(cents: string): string | null {
	const arr = cents.split('');
	let carry = 1;
	for (let i = 1; i >= 0 && carry > 0; i--) {
		const next = Number(arr[i]) + carry;
		arr[i] = String(next % 10);
		carry = next > 9 ? 1 : 0;
	}
	return carry > 0 ? null : arr.join('');
}

/** 分组单位：每 4 位一组，从低位到高位为 个 / 万 / 亿 / 万亿（支持到 10^15） */
const GROUP_UNITS = ['', '万', '亿', '万亿'];

/** 组内位单位：个拾佰仟 */
const SECTION_UNITS = ['', '拾', '佰', '仟'];

/** 低位分组是否还有非零数字：决定全零节之后要不要补零衔接 */
function hasNonZeroGroupBelow(groups: string[], index: number): boolean {
	return groups.slice(0, index).some((group) => /[1-9]/.test(group));
}

/**
 * 4 位以内的一节转中文大写（可含前导零）。前导零不在这里输出 —— 要不要补「零」
 * 由外层按「本节有效位不足 4 位」统一决定；节内中间零只写一个。
 */
function sectionToChinese(section: string): string {
	let out = '';
	let lastWasZero = false;
	for (let i = 0; i < section.length; i++) {
		const digit = Number(section[i]);
		const unit = SECTION_UNITS[section.length - 1 - i];
		if (digit !== 0) {
			if (lastWasZero && out !== '') out += '零';
			out += DIGITS[digit] + unit;
		}
		lastWasZero = digit === 0;
	}
	return out;
}

/**
 * 整数部分转中文大写（不含「圆」）。按 4 位一组从高到低逐节拼：
 * 「10000000」的「万」挂在高位节上（壹仟万），全零节用「零」衔接低位节（壹亿零壹）。
 * 返回空串表示整数部分为零。
 */
function integerToChinese(intStr: string): string {
	if (!/[1-9]/.test(intStr)) return '';
	const groups: string[] = []; // 低位在前
	for (let end = intStr.length; end > 0; end -= 4) {
		groups.push(intStr.slice(Math.max(0, end - 4), end));
	}
	let out = '';
	let pendingZero = false; // 中间隔着全零节时，下一节输出前补「零」
	for (let g = groups.length - 1; g >= 0; g--) {
		const section = groups[g];
		const sectionChinese = sectionToChinese(section);
		if (sectionChinese === '') {
			if (out !== '' && hasNonZeroGroupBelow(groups, g)) pendingZero = true;
			continue;
		}
		const hasLeadingZero = /^0/.test(section) && /[1-9]/.test(section);
		if (out !== '' && (pendingZero || hasLeadingZero)) out += '零';
		pendingZero = false;
		out += sectionChinese + GROUP_UNITS[g];
	}
	return out;
}

/** 拼上「负」前缀 */
function withSign(negative: boolean, text: string): string {
	return negative ? `负${text}` : text;
}

/** 数字金额 → 中文大写金额。输入任意非法内容都会得到人类可读的错误，不抛异常 */
export function toRmbUppercase(input: string): RmbResult {
	const normalized = normalize(input);
	if (normalized === null) {
		return { output: '', error: '请输入有效金额，如 1234.56（支持千分位逗号，最多两位小数）' };
	}
	const negative = normalized.startsWith('-');
	const body = negative ? normalized.slice(1) : normalized;
	const [intStr, decimalStr = ''] = body.split('.');
	if (intStr.length > MAX_INTEGER_DIGITS) {
		return { output: '', error: `整数部分最多 ${MAX_INTEGER_DIGITS} 位（千万亿以内）` };
	}

	const jiao = decimalStr[0] ?? '0';
	const fen = decimalStr[1] ?? '0';
	const integerZero = Number(intStr) === 0;
	const integerChinese = integerToChinese(intStr);

	// 整数部分为零时从角直接开始；非零时必须带「圆」
	let output = '';
	if (!integerZero) output += `${integerChinese}圆`;

	if (jiao !== '0') {
		output += `${DIGITS[Number(jiao)]}角`;
		output += fen === '0' ? '整' : `${DIGITS[Number(fen)]}分`;
	} else if (fen !== '0') {
		// 整数非零时规范要求补「零X分」；整数为零时直接从分开始，前面没有可接的「圆」
		output += integerZero ? `${DIGITS[Number(fen)]}分` : `零${DIGITS[Number(fen)]}分`;
	} else {
		output += integerZero ? '零圆整' : '整';
	}

	return { output: withSign(negative, output), error: '' };
}
