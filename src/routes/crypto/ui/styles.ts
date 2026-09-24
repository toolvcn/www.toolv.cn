// 加解密工具箱里跨面板复用的样式串。
// 门槛同 STRUCTURE §0 硬约束第 2 条：同一串样式出现两处以上才收上来 —— 这里目前三串，
// 各自都有两个调用方（对照表条 / 密钥预览条、HMAC 与 RSA 的结果文本）。

/**
 * 单行参数条：横向滚动的展示条。
 * 凯撒的「位移对照表」与维吉尼亚的「密钥预览」共用 —— 26 个映射项与长密钥都放不下一行固定宽度，
 * 所以横向滚动而不是换行：换行会让面板高度随内容变，也会把下面的双栏挤小。
 * 可滚动区记得配 `tabindex="0" role="region" aria-label`（axe 的 scrollable-region-focusable），
 * 焦点环也要自己给（它跟按钮不同，没有组件兜底）。
 */
export const STRIP =
	'flex h-12 shrink-0 items-center gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white px-3 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/** 参数条里的一格（映射对 / 密钥字母） */
export const STRIP_ITEM = 'shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700';

/** 参数条里的一句说明（跟在格子前面） */
export const STRIP_LABEL = 'shrink-0 text-xs text-gray-600';

/** 结果区里的等宽结果文本（HMAC 摘要 / RSA 签名）：长串允许任意位置断行 */
export const RESULT_TEXT = 'min-w-0 font-mono text-sm leading-6 break-all text-gray-900';
