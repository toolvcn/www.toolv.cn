// 渲染窗口：把「要显示的东西」切到上限之内。纯函数，不碰 DOM。
//
// **只截显示、不截数据**：响应体始终完整存在 store 里（复制与保存拿到的都是全文），
// 这里做的是「默认先铺多少到屏幕上」。几 MB 的响应一刀切到 200 KB 之后，
// 页面滚得动、点得动，代价是屏幕上少一截 —— 少多少写清楚，并留一个「仍要全部显示」的口子。
export interface Limited<T> {
	items: readonly T[];
	/** 有没有被截掉（false 表示本来就在上限之内） */
	truncated: boolean;
	/** 截之前的条数 / 字符数 */
	total: number;
}

export function limitItems<T>(items: readonly T[], limit: number): Limited<T> {
	if (items.length <= limit) return { items, truncated: false, total: items.length };
	return { items: items.slice(0, limit), truncated: true, total: items.length };
}

/** 文本版：items 换成 text，别让调用方从 `readonly T[]` 里再去拼字符串 */
export interface LimitedText {
	text: string;
	truncated: boolean;
	total: number;
}

export function limitText(text: string, limit: number): LimitedText {
	if (text.length <= limit) return { text, truncated: false, total: text.length };
	return { text: text.slice(0, limit), truncated: true, total: text.length };
}
