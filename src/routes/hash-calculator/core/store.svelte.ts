// 哈希工具的编排层：模块级单例管住输入与结果，组件只负责渲染。
// 摘要计算是异步的（subtle.digest），同一时间可能有多个在途请求，
// 用自增序号只认最后一次发起的（旧的晚回来就丢弃），保证结果跟得上输入。
import { byteLength, EXAMPLE_TEXT, formatHex, hexDigest } from './hash.ts';
import { ALGORITHMS, emptyDigests, type HashAlgorithm, type HexCase } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class HashStore {
	input = $state('');
	hexCase = $state<HexCase>('lower');
	/** 算法 → 小写十六进制摘要；空输入为空串 */
	digests = $state<Record<HashAlgorithm, string>>(emptyDigests());
	/** 当前环境不支持 WebCrypto（少见）时为 true */
	unsupported = $state(false);

	#seq = 0;
	get charCount(): number {
		return this.input.length;
	}

	get byteCount(): number {
		return byteLength(this.input);
	}

	/** 给某行渲染与复制用的摘要文本，带当前大小写 */
	digestText(algorithm: HashAlgorithm): string {
		return formatHex(this.digests[algorithm] ?? '', this.hexCase);
	}

	/** 有几个算法已经算出结果（空输入不算），给状态播报用 */
	get computedCount(): number {
		return ALGORITHMS.filter((algorithm) => this.digests[algorithm] !== '').length;
	}

	/**
	 * 按当前输入重算全部摘要。页面用一个 $effect 在 input 变化时调用。
	 * 每次都整表替换 digests，UI 按行渲染，逐算法出结果。
	 */
	async refresh(): Promise<void> {
		const text = this.input;
		const seq = ++this.#seq;
		this.unsupported = false;
		if (text === '') {
			this.digests = emptyDigests();
			return;
		}
		try {
			for (const algorithm of ALGORITHMS) {
				const hex = await hexDigest(algorithm, text);
				if (seq !== this.#seq) return; // 输入又变了，这批结果作废
				this.digests = { ...this.digests, [algorithm]: hex };
			}
		} catch {
			if (seq === this.#seq) this.unsupported = true;
		}
	}

	setHexCase(hexCase: HexCase): void {
		if (this.hexCase === hexCase) return;
		this.hexCase = hexCase;
	}

	loadExample(): void {
		this.input = EXAMPLE_TEXT;
		toast.show('已填入示例文本');
	}

	clearInput(): void {
		if (this.input === '') return;
		this.input = '';
		toast.show('已清空');
	}

	async copyDigest(algorithm: HashAlgorithm): Promise<void> {
		const text = this.digestText(algorithm);
		if (text === '') {
			toast.show('还没有可复制的结果，先输入内容');
			return;
		}
		await copyToClipboard(text, { ok: `已复制 ${algorithm} 结果`, fail: '复制失败，请手动选中复制' });
	}
}

export const hashStore = new HashStore();
