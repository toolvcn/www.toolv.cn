// 进制转换工具编排层：模块级单例。输入文本 + 输入进制，派生每种进制的输出。
import { formatRadix, parseRadix } from './radix.ts';
import { BASE_LABEL, OUTPUT_BASES, RADIX_DIGITS, type SourceBase } from './types.ts';

/** 是否让十六进制等含字母的进制用大写输出 */
const UPPER_RE = /[a-z]/;

class RadixStore {
	text = $state('255');
	sourceBase = $state<SourceBase>(10);
	upperHex = $state(true);

	get value(): bigint | null {
		return parseRadix(this.text, this.sourceBase);
	}

	get error(): string {
		if (this.text.trim() === '') return '';
		if (this.value === null) {
			const max = RADIX_DIGITS[this.sourceBase - 1];
			return `无法解析：${this.sourceBase} 进制只允许 0-${max} 与可选的正负号`;
		}
		return '';
	}

	/** 每个目标进制的输出文本；输入非法时全是 '—' */
	outputOf(base: SourceBase): string {
		const value = this.value;
		if (value === null) return '—';
		const raw = formatRadix(value, base);
		const shouldUpper = this.upperHex && UPPER_RE.test(raw);
		return shouldUpper ? raw.toUpperCase() : raw;
	}

	get copyableEntries(): Array<{ base: SourceBase; label: string; text: string }> {
		return OUTPUT_BASES.map((base) => ({ base, label: BASE_LABEL[base], text: this.outputOf(base) }));
	}

	setSourceBase(base: SourceBase): void {
		this.sourceBase = base;
	}

	toggleUpper(): void {
		this.upperHex = !this.upperHex;
	}

	/** 常用示例 */
	loadSample(): void {
		this.text = '255';
		this.sourceBase = 10;
	}
}

export const radixStore = new RadixStore();
