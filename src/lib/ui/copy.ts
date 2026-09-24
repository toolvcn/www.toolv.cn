// 复制到剪贴板的统一入口：把「空内容拦截 + 成功/失败提示」这一套收成一处。
//
// 起因：20 个工具里有 17 个在自己的 store 里各写一份 try/catch +
// navigator.clipboard.writeText。除了重复，还有两个实际缺陷：
//   ① 丢掉了 execCommand 回退，非安全上下文（http:// 或剪贴板权限被拒）直接失败；
//   ② 把「没报错」当成了「复制成功」，失败时也弹「已复制」。
// 这里统一走 $lib/utils/browser 的 copyText，用真实结果决定弹哪条提示。
//
// 为什么放 $lib/ui 而不是 $lib/utils/browser：提示语是界面行为，而 browser.ts 只负责
// 浏览器能力、不反向依赖 UI 状态（那边的注释也写明了「core/ 不碰 DOM」）。
import { copyText } from '$lib/utils/browser';
import { toast } from '$lib/ui/toast.svelte';

export type CopyOptions = {
	/** 成功提示，默认「已复制」 */
	ok?: string;
	/** 内容被判为空时的提示，默认「没有可复制的内容」 */
	empty?: string;
	/** 复制失败时的提示，默认「复制失败，请手动选中复制」 */
	fail?: string;
	/**
	 * 空内容的判定，默认 trim 后为空串。
	 * 结果里用「—」当占位符的工具（进制 / 时间戳）需自己放宽。
	 */
	isEmpty?: (text: string) => boolean;
};

const isBlank = (text: string): boolean => text.trim() === '';

/**
 * 复制文本并弹提示，返回是否真的写进了剪贴板。
 * 内容为空时不碰剪贴板，直接弹 empty（错误色）。
 */
export async function copyToClipboard(text: string, options: CopyOptions = {}): Promise<boolean> {
	const { ok = '已复制', empty = '没有可复制的内容', fail = '复制失败，请手动选中复制', isEmpty = isBlank } = options;

	if (isEmpty(text)) {
		toast.show(empty, true);
		return false;
	}

	const copied = await copyText(text);
	toast.show(copied ? ok : fail, !copied);
	return copied;
}
