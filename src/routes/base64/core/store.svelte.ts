// Base64 工具的编排层：一个模块级 store 实例管住全部输入态，组件只负责渲染。
// 状态读写全部走这个实例，界面不自己算结果，方便单测直接断言。
import { convert, fileToDataURL, formatFileSize, stripWhitespace } from './base64.ts';
import { MAX_FILE_SIZE, type FilePreview, type Mode } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class Base64Store {
	// ---------------------------------------------------------------- 输入态

	input = $state('');
	/**
	 * 当前结果的镜像。processedOutput 是派生值（只能读），
	 * 而「互换」「复制」要拿到结果文本，所以由页面用一个 $effect 同步进来。
	 */
	output = $state('');
	mode = $state<Mode>('encode');
	urlSafe = $state(false);
	filePreview = $state<FilePreview | null>(null);

	/** 一次算完，输出与错误同源，避免两个派生值各算一遍大文本 */
	readonly result = $derived(convert(this.input, this.mode, { urlSafe: this.urlSafe }));

	// ---------------------------------------------------------------- 派生值

	get processedOutput(): string {
		return this.result.output;
	}

	get error(): string {
		return this.result.error;
	}

	get filePreviewUrl(): string {
		return this.filePreview?.dataUrl ?? '';
	}

	get inputCount(): number {
		return this.input.length;
	}

	get outputCount(): number {
		return this.processedOutput.length;
	}

	/** Base64 串的长度：编码模式看输出，解码模式看输入（不算排版用的空白） */
	get base64Length(): number {
		return this.mode === 'encode' ? this.processedOutput.length : stripWhitespace(this.input).length;
	}

	// ---------------------------------------------------------------- 操作

	/** 切到指定方向；已经是这个方向就不动，免得点当前项把内容清空 */
	setMode(mode: Mode): void {
		if (this.mode === mode) return;
		this.swapMode();
	}

	/**
	 * 切换方向并把当前结果搬到输入区：编码完直接解回来，不用手动复制。
	 * 结果为空时只换方向、不动输入 —— 解码失败的中间态不该把用户敲的内容抹掉。
	 */
	swapMode(): void {
		if (this.output !== '') this.input = this.output;
		this.mode = this.mode === 'encode' ? 'decode' : 'encode';
		this.output = '';
		// 缩略图对应的是旧输入，换向后它跟输入框的内容已经对不上了
		this.filePreview = null;
	}

	toggleUrlSafe(): void {
		this.urlSafe = !this.urlSafe;
	}

	/** 选图 → 读成 data:URL 填进输入框，并把方向拨到编码 */
	async processFile(file: File | null): Promise<void> {
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.show('请选择图片文件', true);
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			toast.show(`图片不能超过 ${formatFileSize(MAX_FILE_SIZE)}`, true);
			return;
		}
		try {
			const dataUrl = await fileToDataURL(file);
			this.input = dataUrl;
			// data:URL 是原文，下一步自然是编码，顺手把方向拨过去
			this.mode = 'encode';
			this.filePreview = { name: file.name, size: file.size, dataUrl };
			toast.show(`已载入图片 ${file.name}`);
		} catch {
			toast.show('图片读取失败，请重试', true);
		}
	}

	/** 清空输入与输出，重置为初始态 */
	clearAll(): void {
		this.input = '';
		this.output = '';
		this.filePreview = null;
		toast.show('已清空');
	}

	async copyOutput(): Promise<void> {
		const text = this.output;
		if (text === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(text, { ok: '已复制输出结果', fail: '复制失败，请手动选中输出内容复制' });
	}
}

export const base64 = new Base64Store();
