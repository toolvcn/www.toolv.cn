// 数字格式化：金额（分 → 元）与百分数。纯函数，不依赖 DOM。
//
// **一律不加千分位、不引 Intl**（沿用 /ecommerce-roi 的口径）：这一页的数要跟输入框里敲的那串对得上，
// 同一组数在两处写法不同会让人怀疑是两个值；Intl 按 locale 输出，SSR 与浏览器不一致时水合会闪一下。

/** 金额：入参是「分」，输出两位小数的元 */
export function formatMoney(cents: number): string {
	if (!Number.isFinite(cents)) return '—';
	const yuan = cents / 100;
	return (yuan < 0 ? '-' : '') + Math.abs(yuan).toFixed(2);
}

/** 百分数：入参是 0~1 的小数，输出两位小数 */
export function formatPercent(rate: number): string {
	if (!Number.isFinite(rate)) return '—';
	return `${(rate * 100).toFixed(2)}%`;
}
