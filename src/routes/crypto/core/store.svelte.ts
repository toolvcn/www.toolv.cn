// 「加解密工具箱」的编排层：模块级单例。
//
// 五个工作区各有一份状态（AES / RSA / HMAC / 凯撒 / 维吉尼亚），根 store 只多一个 tab 开关。
// 子状态写成独立的类再挂成字段 —— 类的 `$state` 字段本身就是响应式边界，
// 不用把三十多个字段摊平在同一个类里（摊平之后「哪个字段归哪个工具」只能靠命名前缀猜）。
//
// 三条交互口径（README 的「实现口径」里也写了一版）：
//   - AES / RSA 点按钮才执行：方向、模式、格式要先定下来，边打边算会一路报「密文不完整」。
//     代价是结果可能过时，所以两者都记一份**参数指纹**，参数变了就把状态条改成琥珀色提醒。
//   - HMAC 实时重算：只有密钥与算法两个旋钮，跟哈希工具一样即打即出。
//   - 凯撒 / 维吉尼亚用 `$derived` 直接派生：不涉及字节与密钥长度，没有可失败的地方。
//
// 五个子状态类都 export：单测直接 `new` 一个干净实例，不用把三十多个字段逐个重置
// （hash-calculator 那份是单类 store，只能在 beforeEach 里逐字段赋回去）。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import {
	DEFAULT_CAESAR_SHIFT,
	DEFAULT_DIRECTION,
	DEFAULT_MODULUS,
	DEFAULT_TAB,
	DEFAULT_VIGENERE_KEY,
	EXAMPLE_AES,
	EXAMPLE_CAESAR,
	EXAMPLE_HMAC,
	EXAMPLE_VIGENERE
} from '../config.ts';
import { randomIvHex, randomKeyHex, runAes, type AesOutcome } from './aes.ts';
import { caesarShift, caesarTable, vigenereKeyFlow, vigenereShift, type CaesarRow } from './classical.ts';
import { readBytes } from './encoding.ts';
import { computeHmac, type HmacOutcome } from './hmac.ts';
import { generateRsaKeyPair, runRsa, type RsaOutcome } from './rsa.ts';
import type {
	AesMode,
	ByteFormat,
	CryptoTab,
	Direction,
	HmacAlgorithm,
	OutFormat,
	RsaModulus,
	RsaOperation
} from './types.ts';

/** 把参与运算的字段拼成一行，用来判断「这份结果还是不是当前参数算出来的」 */
function fingerprint(parts: readonly (string | number)[]): string {
	return parts.join('\u0000');
}

// ---------------------------------------------------------------- AES

export class AesState {
	direction = $state<Direction>('encrypt');
	mode = $state<AesMode>('CBC');
	keyText = $state('');
	keyFormat = $state<ByteFormat>('text');
	ivText = $state('');
	ivFormat = $state<OutFormat>('hex');
	/** 加密方向是输出格式，解密方向是输入格式 */
	dataFormat = $state<OutFormat>('base64');
	input = $state('');
	outcome = $state<AesOutcome | null>(null);
	error = $state('');
	busy = $state(false);
	/** 上次执行时的参数指纹（空串 = 还没执行过） */
	runKey = $state('');

	#seq = 0;

	get output(): string {
		return this.outcome?.output ?? '';
	}

	get stale(): boolean {
		return this.runKey !== '' && this.runKey !== this.#fingerprint();
	}

	get inputBytes(): number {
		return new TextEncoder().encode(this.input).length;
	}

	/**
	 * 当前密钥按所选格式读出来的字节数；读不出来（或还没填）给 null。
	 * 只给标题行做展示用，不在这里报错 —— 报错是 run() 的事，边打字边飘红没人受得了。
	 */
	get keyBytes(): number | null {
		const bytes = readBytes(this.keyText, this.keyFormat);
		return bytes.ok ? bytes.value.length : null;
	}

	get statusTone(): StatusTone {
		if (this.busy) return 'info';
		if (this.error !== '') return 'error';
		if (this.stale) return 'warn';
		if (this.outcome === null) return 'neutral';
		return this.outcome.note === '' ? 'ok' : 'warn';
	}

	get statusText(): string {
		if (this.busy) return `正在${this.direction === 'encrypt' ? '加密' : '解密'}…`;
		if (this.error !== '') return this.error;
		if (this.stale) return '密钥 / IV / 内容已改动，结果可能不是最新的，重新点一次';
		if (this.outcome === null) {
			return `填好密钥与 IV，点「${this.direction === 'encrypt' ? '加密' : '解密'}」出结果`;
		}
		const verb = this.direction === 'encrypt' ? '已加密' : '已解密';
		const head = `${verb} · AES-${this.outcome.bits} · ${this.mode} · ${this.outcome.byteLength} 字节`;
		return this.outcome.note === '' ? head : `${head} · ${this.outcome.note}`;
	}

	#fingerprint(): string {
		return fingerprint([
			this.direction,
			this.mode,
			this.keyFormat,
			this.keyText,
			this.ivFormat,
			this.ivText,
			this.dataFormat,
			this.input
		]);
	}

	async run(): Promise<void> {
		const request = {
			direction: this.direction,
			mode: this.mode,
			keyText: this.keyText,
			keyFormat: this.keyFormat,
			ivText: this.ivText,
			ivFormat: this.ivFormat,
			dataFormat: this.dataFormat,
			input: this.input
		};
		const runKey = this.#fingerprint();
		const seq = ++this.#seq;
		this.busy = true;

		const result = await runAes(request);
		if (seq !== this.#seq) return; // 又点了一次，这次的结论作废
		this.busy = false;
		this.runKey = runKey;
		if (result.ok) {
			this.outcome = result.value;
			this.error = '';
		} else {
			this.outcome = null;
			this.error = result.error;
		}
	}

	setDirection(direction: Direction): void {
		this.direction = direction;
	}

	setMode(mode: AesMode): void {
		this.mode = mode;
	}

	setKeyFormat(keyFormat: ByteFormat): void {
		this.keyFormat = keyFormat;
	}

	setIvFormat(ivFormat: OutFormat): void {
		this.ivFormat = ivFormat;
	}

	setDataFormat(dataFormat: OutFormat): void {
		this.dataFormat = dataFormat;
	}

	/** 随机密钥：顺手把密钥格式切到 Hex，否则刚生成的串按文本读会被当成乱码密钥 */
	randomKey(bytes: number): void {
		this.keyText = randomKeyHex(bytes);
		this.keyFormat = 'hex';
		toast.show(`已生成 ${bytes} 字节随机密钥`);
	}

	randomIv(): void {
		this.ivText = randomIvHex(this.mode);
		this.ivFormat = 'hex';
		toast.show(`已生成 ${this.mode} 用的随机 IV`);
	}

	loadExample(): void {
		this.direction = 'encrypt';
		this.mode = 'CBC';
		this.input = EXAMPLE_AES.input;
		this.keyText = EXAMPLE_AES.key;
		this.keyFormat = 'hex';
		this.ivText = EXAMPLE_AES.iv;
		this.ivFormat = 'hex';
		this.dataFormat = 'base64';
		this.outcome = null;
		this.error = '';
		this.runKey = '';
		toast.show('已填入示例（AES-256 · CBC）');
	}

	clearInput(): void {
		this.input = '';
		this.outcome = null;
		this.error = '';
		this.runKey = '';
	}

	async copyOutput(): Promise<void> {
		await copyToClipboard(this.output, { ok: '已复制结果', fail: '复制失败，请手动选中复制' });
	}
}

// ---------------------------------------------------------------- RSA

export class RsaState {
	operation = $state<RsaOperation>('encrypt');
	modulusLength = $state<RsaModulus>(DEFAULT_MODULUS);
	input = $state('');
	signature = $state('');
	privateKey = $state('');
	publicKey = $state('');
	outcome = $state<RsaOutcome | null>(null);
	error = $state('');
	busy = $state(false);
	/** 正在生成密钥对（4096 位要几秒，得让按钮转起来） */
	generating = $state(false);
	runKey = $state('');

	#seq = 0;

	get output(): string {
		return this.outcome?.output ?? '';
	}

	get stale(): boolean {
		return this.runKey !== '' && this.runKey !== this.#fingerprint();
	}

	get statusTone(): StatusTone {
		if (this.busy) return 'info';
		if (this.error !== '') return 'error';
		if (this.stale) return 'warn';
		if (this.outcome === null) return 'neutral';
		if (this.outcome.valid !== undefined) return this.outcome.valid ? 'ok' : 'error';
		return this.outcome.note === '' ? 'ok' : 'warn';
	}

	get statusText(): string {
		if (this.busy) return '正在计算…';
		if (this.error !== '') return this.error;
		if (this.stale) return '内容或密钥已改动，结果可能不是最新的，重新点一次';
		if (this.outcome === null) return '填好内容与密钥后点右边的按钮出结果';
		return this.outcome.note === '' ? this.outcome.output : `${this.outcome.output} · ${this.outcome.note}`;
	}

	#fingerprint(): string {
		return fingerprint([this.operation, this.privateKey, this.publicKey, this.signature, this.input]);
	}

	async generate(): Promise<void> {
		this.generating = true;
		const result = await generateRsaKeyPair(this.modulusLength);
		this.generating = false;
		if (!result.ok) {
			this.error = result.error;
			return;
		}
		this.privateKey = result.value.privateKey;
		this.publicKey = result.value.publicKey;
		// 换了密钥，之前那份结果就不属于这套密钥了
		this.outcome = null;
		this.error = '';
		this.runKey = '';
		toast.show(`已生成 ${result.value.modulusLength} 位密钥对`);
	}

	async run(): Promise<void> {
		const request = {
			operation: this.operation,
			input: this.input,
			signature: this.signature,
			privateKey: this.privateKey,
			publicKey: this.publicKey
		};
		const runKey = this.#fingerprint();
		const seq = ++this.#seq;
		this.busy = true;

		const result = await runRsa(request);
		if (seq !== this.#seq) return;
		this.busy = false;
		this.runKey = runKey;
		if (result.ok) {
			this.outcome = result.value;
			this.error = '';
		} else {
			this.outcome = null;
			this.error = result.error;
		}
	}

	setOperation(operation: RsaOperation): void {
		this.operation = operation;
	}

	setModulus(value: string): void {
		this.modulusLength = Number(value) as RsaModulus;
	}

	loadExample(): void {
		this.input = '微工具 toolv.cn';
		this.signature = '';
		this.outcome = null;
		this.error = '';
		this.runKey = '';
		toast.show('已填入示例内容');
	}

	clearInput(): void {
		this.input = '';
		this.signature = '';
		this.outcome = null;
		this.error = '';
		this.runKey = '';
	}

	async copyKey(kind: 'private' | 'public'): Promise<void> {
		const text = kind === 'private' ? this.privateKey : this.publicKey;
		await copyToClipboard(text, {
			ok: kind === 'private' ? '已复制私钥' : '已复制公钥',
			empty: '还没有密钥，先点「生成密钥对」或粘贴一个',
			fail: '复制失败，请手动选中复制'
		});
	}

	async copyOutput(): Promise<void> {
		await copyToClipboard(this.output, { ok: '已复制结果', fail: '复制失败，请手动选中复制' });
	}
}

// ---------------------------------------------------------------- HMAC

export class HmacState {
	algorithm = $state<HmacAlgorithm>('SHA-256');
	// 显式写成 string：示例值来自 `as const` 对象，不标注的话字段会被收窄成那个字面量
	keyText = $state<string>(EXAMPLE_HMAC.key);
	keyFormat = $state<ByteFormat>('text');
	message = $state<string>(EXAMPLE_HMAC.message);
	outputFormat = $state<OutFormat>('hex');
	outcome = $state<HmacOutcome | null>(null);
	error = $state('');
	/** 正在算（输入一变就重算，连续输入时靠它表达） */
	busy = $state(false);

	#seq = 0;

	get output(): string {
		return this.outcome?.output ?? '';
	}

	get statusTone(): StatusTone {
		if (this.busy) return 'info';
		if (this.error !== '') return 'error';
		return this.outcome === null ? 'neutral' : 'ok';
	}

	get statusText(): string {
		if (this.error !== '') return this.error;
		if (this.busy) return '正在计算…';
		if (this.outcome === null) return '填入密钥与消息后自动计算';
		return `HMAC-${this.algorithm} · ${this.outcome.byteLength} 字节 · ${this.outputFormat === 'hex' ? '十六进制' : 'Base64'}`;
	}

	/** 由页面用一个 $effect 在输入变化时调用 */
	async refresh(): Promise<void> {
		const request = {
			algorithm: this.algorithm,
			message: this.message,
			keyText: this.keyText,
			keyFormat: this.keyFormat,
			outputFormat: this.outputFormat
		};
		const seq = ++this.#seq;
		if (this.message === '' || this.keyText.trim() === '') {
			this.outcome = null;
			this.error = '';
			this.busy = false;
			return;
		}
		this.busy = true;
		const result = await computeHmac(request);
		if (seq !== this.#seq) return;
		this.busy = false;
		if (result.ok) {
			this.outcome = result.value;
			this.error = '';
		} else {
			this.outcome = null;
			this.error = result.error;
		}
	}

	setAlgorithm(algorithm: HmacAlgorithm): void {
		this.algorithm = algorithm;
	}

	setKeyFormat(keyFormat: ByteFormat): void {
		this.keyFormat = keyFormat;
	}

	setOutputFormat(outputFormat: OutFormat): void {
		this.outputFormat = outputFormat;
	}

	randomKey(): void {
		this.keyText = randomKeyHex(32);
		this.keyFormat = 'hex';
		toast.show('已生成 32 字节随机密钥');
	}

	loadExample(): void {
		this.keyText = EXAMPLE_HMAC.key;
		this.keyFormat = 'text';
		this.message = EXAMPLE_HMAC.message;
		toast.show('已填入示例');
	}

	clearMessage(): void {
		this.message = '';
	}

	async copyOutput(): Promise<void> {
		await copyToClipboard(this.output, { ok: '已复制 HMAC 结果', fail: '复制失败，请手动选中复制' });
	}
}

// ---------------------------------------------------------------- 凯撒

export class CaesarState {
	direction = $state<Direction>(DEFAULT_DIRECTION);
	shift = $state(DEFAULT_CAESAR_SHIFT);
	input = $state(EXAMPLE_CAESAR);

	readonly output = $derived(caesarShift(this.input, this.shift, this.direction));
	readonly table = $derived<CaesarRow[]>(caesarTable(this.shift, this.direction));

	get statusTone(): StatusTone {
		return this.input === '' ? 'neutral' : 'ok';
	}

	get statusText(): string {
		if (this.input === '') return '等待输入';
		const verb = this.direction === 'encrypt' ? '加密' : '解密';
		return `已${verb} · 位移 ${this.shift} · ${this.input.length} 字符`;
	}

	setDirection(direction: Direction): void {
		this.direction = direction;
	}

	setShift(shift: number): void {
		this.shift = Number.isFinite(shift) ? shift : 0;
	}

	loadExample(): void {
		this.direction = 'encrypt';
		this.shift = DEFAULT_CAESAR_SHIFT;
		this.input = EXAMPLE_CAESAR;
		toast.show('已填入示例');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		await copyToClipboard(this.output, { ok: '已复制结果', fail: '复制失败，请手动选中复制' });
	}
}

// ---------------------------------------------------------------- 维吉尼亚

export class VigenereState {
	direction = $state<Direction>(DEFAULT_DIRECTION);
	key = $state(DEFAULT_VIGENERE_KEY);
	input = $state(EXAMPLE_VIGENERE);

	readonly result = $derived(vigenereShift(this.input, this.key, this.direction));
	readonly flow = $derived(vigenereKeyFlow(this.input, this.key));

	get output(): string {
		return this.result.ok ? this.result.value : '';
	}

	get error(): string {
		return this.result.ok ? '' : this.result.error;
	}

	get statusTone(): StatusTone {
		if (this.input === '') return 'neutral';
		return this.error === '' ? 'ok' : 'error';
	}

	get statusText(): string {
		if (this.input === '') return '等待输入';
		if (this.error !== '') return this.error;
		const verb = this.direction === 'encrypt' ? '加密' : '解密';
		return `已${verb} · 密钥 ${this.key.trim() === '' ? '（空）' : this.key} · ${this.input.length} 字符`;
	}

	setDirection(direction: Direction): void {
		this.direction = direction;
	}

	loadExample(): void {
		this.direction = 'encrypt';
		this.key = DEFAULT_VIGENERE_KEY;
		this.input = EXAMPLE_VIGENERE;
		toast.show('已填入示例');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		await copyToClipboard(this.output, { ok: '已复制结果', fail: '复制失败，请手动选中复制' });
	}
}

// ---------------------------------------------------------------- 根 store

class CryptoStore {
	tab = $state<CryptoTab>(DEFAULT_TAB);
	readonly aes = new AesState();
	readonly rsa = new RsaState();
	readonly hmac = new HmacState();
	readonly caesar = new CaesarState();
	readonly vigenere = new VigenereState();

	setTab(tab: CryptoTab): void {
		this.tab = tab;
	}
}

export const cryptoStore = new CryptoStore();
