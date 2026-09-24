// 颜色转换的编排层：一个输入框驱动全部输出，对比度卡的前景固定为当前颜色，模块级单例。
import {
	blend,
	contrastRatio,
	formatHsl,
	formatRatio,
	formatRgb,
	parseColor,
	relativeLuminance,
	rgbToHex,
	rgbToHsl,
	wcagPass
} from './color.ts';
import type { FormatRow, WcagCheck } from './types.ts';
// 示例色与预设背景在根层的 config.ts：调行为先去那里
import { BLACK, DEFAULT_CUSTOM_BG, EXAMPLE_INPUT, WHITE } from '../config.ts';
import { toast } from '$lib/ui/toast.svelte';

class ColorStore {
	input = $state(EXAMPLE_INPUT);

	/** 非法输入时为 null，界面显示红字提示并收起结果 */
	readonly color = $derived(parseColor(this.input));
	readonly hsl = $derived(this.color === null ? null : rgbToHsl(this.color));

	/** HEX / RGB / HSL 三种格式的输出行 */
	readonly rows = $derived<FormatRow[]>(
		this.color === null
			? []
			: [
					{ label: 'HEX', value: rgbToHex(this.color) },
					{ label: 'RGB', value: formatRgb(this.color) },
					{ label: 'HSL', value: formatHsl(this.hsl!) }
				]
	);

	/** 预览块底色：半透明按白色打底预览（棋盘格成本高，注明即可） */
	readonly previewCss = $derived(this.color === null ? '#ffffff' : rgbToHex(blend(this.color, WHITE)));
	/** 预览块上的文字用深色还是白色：按白色打底后的亮度判 */
	readonly previewTextDark = $derived(relativeLuminance(this.color === null ? WHITE : blend(this.color, WHITE)) > 0.4);
	/** 预览块下方的透明度备注（不透明时为空串） */
	readonly alphaNote = $derived(
		this.color === null || this.color.a >= 1 ? '' : `透明度 ${formatRatio(this.color.a * 100)}%，已按白色打底预览`
	);

	// ---------------------------------------------------------------- WCAG 对比度

	/** 对比背景：白 / 黑 / 自定义（自定义用色板 + 文本两路输入） */
	contrastBg = $state<'white' | 'black' | 'custom'>('white');
	customBgText = $state(DEFAULT_CUSTOM_BG);
	readonly customBg = $derived(parseColor(this.customBgText));
	readonly bgColor = $derived(
		this.contrastBg === 'white' ? WHITE : this.contrastBg === 'black' ? BLACK : this.customBg
	);

	/** 前景透明度先混进背景再算 —— 屏幕上实际呈现的颜色才有对比度可言 */
	readonly ratio = $derived<number | null>(
		this.color === null || this.bgColor === null ? null : contrastRatio(blend(this.color, this.bgColor), this.bgColor)
	);
	readonly wcag = $derived<WcagCheck | null>(this.ratio === null ? null : wcagPass(this.ratio));
	readonly ratioText = $derived(this.ratio === null ? '' : `${formatRatio(this.ratio)} : 1`);

	// ---------------------------------------------------------------- 操作

	/** 原生色板回填：value 一定是 #rrggbb，直接当输入文本 */
	pickFromSwatch(hex: string): void {
		this.input = hex;
	}

	loadExample(): void {
		this.input = EXAMPLE_INPUT;
		toast.show('已填入示例颜色');
	}

	clearInput(): void {
		this.input = '';
	}
}

export const colorStore = new ColorStore();
