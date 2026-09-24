// Base64 编解码工具的类型与常量。
// 只放类型与常量：纯函数在 base64.ts，状态编排在 store.svelte.ts。

/** 转换方向：encode = 原文 → Base64，decode = Base64 → 原文 */
export type Mode = 'encode' | 'decode';

/** 转换选项。目前只有 URL-safe 一项，留成对象是为了以后加选项不改函数签名 */
export interface Options {
	/** 开启后把 + / 换成 - _ 并去掉末尾的 = */
	urlSafe: boolean;
}

/** 一次转换的结果：成功给 output，失败给 error，两者不会同时有值 */
export interface ConvertResult {
	output: string;
	/** 空串表示没有错误 */
	error: string;
}

/** 上传图片的预览信息 */
export interface FilePreview {
	name: string;
	/** 原始字节数，只用于展示 */
	size: number;
	/** FileReader 读出来的 data:URL，同时会填进输入框 */
	dataUrl: string;
}

/** 两种模式的中文名，按钮的 aria-label 用它补全方向说明 */
export const MODE_LABEL: Record<Mode, string> = { encode: '编码', decode: '解码' };

/** 解码失败的统一文案（界面与单测共用一份，避免两边文案漂移） */
export const DECODE_ERROR = '解码失败：输入不是合法的 Base64 字符串';

/** 上传图片的体积上限（字节）：再大 Data URL 会把输入框拖卡 */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
