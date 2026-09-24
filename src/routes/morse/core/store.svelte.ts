// 摩斯密码工具的编排层：模块级单例。
//
// 编解码与速查同屏（左编解码、右速查表，在 ui/Workspace.svelte 里并排），
// 编解码侧有一个方向开关与四个可自定义的符号。
// 结果实时派生，「复制」从这里出（唯一出口，跟 html-entity 同一个口径）。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import {
	decodeMorse,
	encodeMorse,
	formatMorseCode,
	insertMorseEntry,
	searchMorseEntries,
	type MorseEntry
} from './morse.ts';
import { DEFAULT_SYMBOLS, EXAMPLE_TEXT, type MorseDirection, type MorseSymbols } from './types.ts';

/** 两个方向统一成一份结果形状，页面只读它，不用按方向各拼一套状态 */
interface MorseOutcome {
	text: string;
	/** 成功转换的字符数（不含空白） */
	count: number;
	/** 编码方向是「没有摩斯码的字符」，解码方向是「解不出的片段」 */
	failed: string[];
	/** 失败处的数量：编码方向数出现次数，解码方向数片段个数 */
	failedCount: number;
}

class MorseStore {
	direction = $state<MorseDirection>('encode');
	input = $state(EXAMPLE_TEXT);
	/** 点 / 划 / 字母分隔 / 词分隔：四个都能改，默认与国际惯例一致 */
	dot = $state(DEFAULT_SYMBOLS.dot);
	dash = $state(DEFAULT_SYMBOLS.dash);
	letterSep = $state(DEFAULT_SYMBOLS.letterSep);
	wordSep = $state(DEFAULT_SYMBOLS.wordSep);
	/** 速查表的搜索词 */
	query = $state('');

	get symbols(): MorseSymbols {
		return { dot: this.dot, dash: this.dash, letterSep: this.letterSep, wordSep: this.wordSep };
	}

	/**
	 * 点划填得不合法时给一句错误说明。
	 * 点与划相同会让解码失去意义（同一串既可是点也可是划），空串则等于没定义 —— 两种都拦下来。
	 */
	get symbolError(): string {
		if (this.dot === '') return '「点」不能为空';
		if (this.dash === '') return '「划」不能为空';
		if (this.dot === this.dash) return '「点」与「划」不能是同一个字符';
		return '';
	}

	readonly outcome = $derived.by((): MorseOutcome => {
		if (this.symbolError !== '') return { text: '', count: 0, failed: [], failedCount: 0 };
		if (this.direction === 'encode') {
			const result = encodeMorse(this.input, this.symbols);
			return {
				text: result.text,
				count: result.encoded,
				failed: result.skipped,
				failedCount: result.skippedCount
			};
		}
		const result = decodeMorse(this.input, this.symbols);
		return { text: result.text, count: result.decoded, failed: result.unknown, failedCount: result.unknown.length };
	});

	get output(): string {
		return this.outcome.text;
	}

	get inputCount(): number {
		return this.input.length;
	}

	get outputCount(): number {
		return this.outcome.text.length;
	}

	get statusTone(): StatusTone {
		if (this.symbolError !== '') return 'error';
		if (this.input.trim() === '') return 'neutral';
		return this.outcome.failedCount > 0 ? 'warn' : 'ok';
	}

	get statusText(): string {
		if (this.symbolError !== '') return this.symbolError;
		if (this.input.trim() === '') return '等待输入';
		const verb = this.direction === 'encode' ? '编码' : '解码';
		const head = `已${verb} ${this.outcome.count} 个字符`;
		if (this.outcome.failedCount === 0) return head;

		// 失败处可能很多，只报前三个（底栏 StatusPill 是定高行，报全了会被截断）
		const sample = this.outcome.failed.slice(0, 3).join(' ');
		const more = this.outcome.failed.length > 3 ? ' …' : '';
		const reason =
			this.direction === 'encode'
				? `${this.outcome.failedCount} 个字符没有摩斯码`
				: `${this.outcome.failedCount} 段解不出`;
		return `${head} · ${reason}：${sample}${more}`;
	}

	// ---------------------------------------------------------------- 速查表

	readonly tableResults = $derived(searchMorseEntries(this.query));

	clearQuery(): void {
		this.query = '';
	}

	/** 速查表条目在当前方向下会插进输入框的内容：编码插字符、解码插摩斯码（按当前自定义点划） */
	entryInsertText(entry: MorseEntry): string {
		return this.direction === 'encode' ? entry.char : formatMorseCode(entry.code, this.symbols);
	}

	/**
	 * 把速查表条目插到输入框的 `[start, end)` 处，返回插入后的光标位置；没插成返回 `null`。
	 * 光标从 DOM 读、插完再写回去由组件层做 —— 这里不碰 DOM，插法才能跟着纯函数一起单测。
	 *
	 * 解码方向点划设置非法时直接不插：码表里的码要按自定义点划输出，
	 * 点划为空或点划相同都会插进一串残缺的点划，不如让用户先改回来。
	 */
	insertEntry(entry: MorseEntry, start: number, end: number): number | null {
		if (this.direction === 'decode' && this.symbolError !== '') {
			toast.show(this.symbolError);
			return null;
		}
		const result = insertMorseEntry(this.input, entry, this.direction, this.symbols, start, end);
		this.input = result.value;
		return result.caret;
	}

	// ---------------------------------------------------------------- 操作

	/** 换方向时把当前输出搬回输入框：编码出来的摩斯再解回去，来回验证不用手动复制 */
	swapDirection(): void {
		if (this.symbolError !== '' || this.outcome.text === '') {
			toast.show('当前没有可搬回的结果');
			return;
		}
		this.input = this.outcome.text;
		this.direction = this.direction === 'encode' ? 'decode' : 'encode';
	}

	loadExample(): void {
		this.input = EXAMPLE_TEXT;
		this.direction = 'encode';
		toast.show('已填入示例文本');
	}

	clearInput(): void {
		this.input = '';
	}

	async copyOutput(): Promise<void> {
		const text = this.outcome.text;
		if (text === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(text, { ok: '已复制转换结果', fail: '复制失败，请手动选中复制' });
	}
}

export const morseStore = new MorseStore();
