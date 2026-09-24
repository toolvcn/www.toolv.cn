// 随机生成器的编排层：四个标签（UUID / 密码 / 随机数 / 假文）各自独立状态，
// 结果一律点「生成」才出 —— SSR 预渲染保持稳定，避免 hydration 前后随机值不一致。模块级单例。
import {
	generateLorem,
	generateNumbers,
	generatePassword,
	generateUuids,
	passwordEntropy,
	strengthLabel
} from './random.ts';
import type { LoremLang, LoremMode } from './types.ts';
import { copyToClipboard } from '$lib/ui/copy';
import { confirm } from '$lib/ui/confirm.svelte';
// 默认值与上下限都在根层的 config.ts：调这一页的行为先去那里
import {
	COUNT_MIN,
	COUNT_WARN,
	DECIMALS_MAX,
	DECIMALS_MIN,
	DEFAULT_LOREM_COUNT,
	DEFAULT_NUM_COUNT,
	DEFAULT_NUM_DECIMALS,
	DEFAULT_NUM_MAX,
	DEFAULT_NUM_MIN,
	DEFAULT_PASS_COUNT,
	DEFAULT_PASS_LENGTH,
	DEFAULT_UUID_COUNT,
	MAX_LOREM_COUNT,
	MAX_NUM_COUNT,
	MAX_PASS_COUNT,
	MAX_UUID_COUNT,
	NUM_VALUE_MAX,
	NUM_VALUE_MIN,
	PASS_LENGTH_MAX,
	PASS_LENGTH_MIN
} from '../config.ts';

/** 「生成」型输入的通用解析：正整数且落在 [COUNT_MIN, max]，非法返回 null */
function parseBoundedInt(text: string, max: number): number | null {
	const value = Number(text.trim());
	if (!Number.isInteger(value) || value < COUNT_MIN || value > max) return null;
	return value;
}

/** 长度类输入（允许下限不是 1）：整数且落在 [min, max]，非法返回 null */
function parseLength(text: string, min: number, max: number): number | null {
	const value = Number(text.trim());
	if (!Number.isInteger(value) || value < min || value > max) return null;
	return value;
}

/** 去重字符集（保留原始出现顺序，过滤空） */
function dedupeCharset(raw: string): string {
	const seen: string[] = [];
	const out: string[] = [];
	for (const ch of raw) {
		if (ch !== '' && !seen.includes(ch)) {
			seen.push(ch);
			out.push(ch);
		}
	}
	return out.join('');
}

/**
 * 超过 COUNT_WARN 时弹一次二次确认；用户取消返回 false。
 *
 * 用的是全站那一个确认框（`$lib/ui/Confirm`，`+layout.svelte` 挂着唯一实例），
 * 不再是原生 `window.confirm` —— 原生框的按钮文案由浏览器给（英文界面下是 OK / Cancel），
 * 也不跟随深色主题。因此这个方法与外层四个 `generate*` 一起变成 **async**，
 * 调用端（四个面板的「生成」按钮）要 `void` 掉返回值。
 *
 * SSR / node 下直接放行：预渲染时既没有 `window`（`window.confirm` 那版就是靠它判断的），
 * 也没有挂载确认框组件 —— 真要问就成了永远悬着的 promise。
 */
async function warnIfLargeCount(count: number): Promise<boolean> {
	if (count <= COUNT_WARN) return true;
	if (typeof window === 'undefined') return true; // SSR 环境跳过
	return confirm.ask(`生成 ${count} 条可能耗时稍久，继续？`);
}

export type Tab = 'uuid' | 'password' | 'number' | 'lorem';

class GeneratorStore {
	tab = $state<Tab>('uuid');

	// ---------------------------------------------------------------- UUID
	uuidCountText = $state(DEFAULT_UUID_COUNT);
	uuidUpper = $state(false);
	uuidNoDashes = $state(false);
	uuidLines = $state<string[]>([]);
	readonly uuidCount = $derived(parseBoundedInt(this.uuidCountText, MAX_UUID_COUNT));
	readonly uuidCountInvalid = $derived(this.uuidCount === null);

	// ---------------------------------------------------------------- 密码
	passLengthText = $state(DEFAULT_PASS_LENGTH);
	passLower = $state(true);
	passUpper = $state(true);
	passDigits = $state(true);
	passSymbols = $state(false);
	passAvoid = $state(false);
	passCustomCharsetText = $state('');
	passCountText = $state(DEFAULT_PASS_COUNT);
	passLines = $state<string[]>([]);
	readonly passLength = $derived(parseLength(this.passLengthText, PASS_LENGTH_MIN, PASS_LENGTH_MAX));
	readonly passLengthInvalid = $derived(this.passLength === null);
	readonly passCount = $derived(parseBoundedInt(this.passCountText, MAX_PASS_COUNT));
	readonly passCountInvalid = $derived(this.passCount === null);
	/** 去重后的自定义字符集（追加到预设池） */
	readonly passCustomCharset = $derived(dedupeCharset(this.passCustomCharsetText.trim()));
	/** 池子数：预设勾选项 + 非空自定义字符集（自定义算一档，保底出一个字符） */
	readonly passClassCount = $derived(
		[this.passLower, this.passUpper, this.passDigits, this.passSymbols].filter(Boolean).length +
			(this.passCustomCharset !== '' ? 1 : 0)
	);
	/** 强度按单条密码的熵展示；勾了符号等大池时轻松上「极强」 */
	readonly passStrength = $derived.by(() => {
		if (!this.passValid) return { label: '—', bits: 0 };
		const bits = passwordEntropy({
			length: this.passLength!,
			lower: this.passLower,
			upper: this.passUpper,
			digits: this.passDigits,
			symbols: this.passSymbols,
			customCharset: this.passCustomCharset,
			avoidAmbiguous: this.passAvoid
		});
		return { label: strengthLabel(bits), bits };
	});
	/** 密码输入是否可生成：长度、数量合法且池子非空且长度能覆盖保底抽样 */
	readonly passValid = $derived(
		this.passLength !== null &&
			this.passCount !== null &&
			this.passClassCount > 0 &&
			this.passLength >= this.passClassCount
	);

	// ---------------------------------------------------------------- 随机数
	numMinText = $state(DEFAULT_NUM_MIN);
	numMaxText = $state(DEFAULT_NUM_MAX);
	numCountText = $state(DEFAULT_NUM_COUNT);
	numDecimalsText = $state(DEFAULT_NUM_DECIMALS);
	numUnique = $state(false);
	numSorted = $state(false);
	numLines = $state<string[]>([]);
	numError = $state('');
	readonly numMin = $derived(parseLength(this.numMinText, NUM_VALUE_MIN, NUM_VALUE_MAX));
	readonly numMax = $derived(parseLength(this.numMaxText, NUM_VALUE_MIN, NUM_VALUE_MAX));
	readonly numCount = $derived(parseBoundedInt(this.numCountText, MAX_NUM_COUNT));
	readonly numDecimals = $derived(parseLength(this.numDecimalsText, DECIMALS_MIN, DECIMALS_MAX));
	readonly numMinInvalid = $derived(this.numMin === null);
	readonly numMaxInvalid = $derived(this.numMax === null);
	readonly numCountInvalid = $derived(this.numCount === null);
	readonly numDecimalsInvalid = $derived(this.numDecimals === null);
	/** 小数模式下「去重」没有意义，锁定并说明 */
	readonly numUniqueDisabled = $derived((this.numDecimals ?? 0) > 0);

	// ---------------------------------------------------------------- 假文
	loremLang = $state<LoremLang>('latin');
	loremMode = $state<LoremMode>('paragraphs');
	loremCountText = $state(DEFAULT_LOREM_COUNT);
	loremOutput = $state('');
	readonly loremCount = $derived(parseBoundedInt(this.loremCountText, MAX_LOREM_COUNT));
	readonly loremCountInvalid = $derived(this.loremCount === null);

	// ---------------------------------------------------------------- 操作

	setTab(tab: Tab): void {
		this.tab = tab;
	}

	/** 快捷数量：一键填入常用档 */
	setUuidCount(n: number): void {
		this.uuidCountText = String(n);
	}
	setPassCount(n: number): void {
		this.passCountText = String(n);
	}
	setNumCount(n: number): void {
		this.numCountText = String(n);
	}
	setLoremCount(n: number): void {
		this.loremCountText = String(n);
	}

	async generateUuids(): Promise<void> {
		if (this.uuidCount === null) return;
		if (!(await warnIfLargeCount(this.uuidCount))) return;
		this.uuidLines = generateUuids(this.uuidCount, {
			upper: this.uuidUpper,
			dashes: !this.uuidNoDashes
		});
	}

	async generatePasswords(): Promise<void> {
		this.passLines = [];
		// 派生值先落成局部常量：类型收窄不跨回调，直接在 Array.from 的箭头函数里读 this 会变回 null
		if (!this.passValid || this.passLength === null || this.passCount === null) return;
		if (!(await warnIfLargeCount(this.passCount))) return;
		const { passLength: length, passCount: count } = this;
		this.passLines = Array.from({ length: count }, () =>
			generatePassword({
				length,
				lower: this.passLower,
				upper: this.passUpper,
				digits: this.passDigits,
				symbols: this.passSymbols,
				customCharset: this.passCustomCharset,
				avoidAmbiguous: this.passAvoid
			})
		);
	}

	async generateNumbers(): Promise<void> {
		this.numError = '';
		this.numLines = [];
		if (this.numMin === null || this.numMax === null || this.numCount === null || this.numDecimals === null) {
			return;
		}
		if (!(await warnIfLargeCount(this.numCount))) return;
		try {
			this.numLines = generateNumbers({
				min: this.numMin,
				max: this.numMax,
				count: this.numCount,
				decimals: this.numDecimals,
				unique: this.numUnique,
				sorted: this.numSorted
			});
		} catch (error) {
			this.numError = error instanceof Error ? error.message : '生成失败';
		}
	}

	async generateLorem(): Promise<void> {
		if (this.loremCount === null) return;
		if (!(await warnIfLargeCount(this.loremCount))) return;
		this.loremOutput = generateLorem({
			lang: this.loremLang,
			mode: this.loremMode,
			count: this.loremCount
		});
	}

	// ---------------------------------------------------------------- 复制
	// 工具条上的整块复制留在 store（文案是工具级的、带守卫）；逐行复制走 <CopyButton>，
	// 分工见 UI-STYLE §11.3。

	/** 复制全部逐行结果（换行连接） */
	async copyAllLines(lines: string[]): Promise<void> {
		await copyToClipboard(lines.join('\n'), { ok: `已复制全部 ${lines.length} 条` });
	}

	/** 复制占位假文全文 */
	async copyLorem(): Promise<void> {
		await copyToClipboard(this.loremOutput, { ok: '已复制假文' });
	}
}

export const generatorStore = new GeneratorStore();
