// 数字格式化：金额 / 倍数 / 百分数 / 整数。纯函数，不依赖 DOM，node 环境可直接单测。
//
// **一律不加千分位**（`11650.00` 而不是 `11,650.00`）：这一页的数一头要对上输入框里敲的那串、
// 一头要贴到群里让人照着复算，同一组数在两处写法不同，会让人怀疑是不是两个值。
// 代价是大额要靠数位才读得出量级（`11650` 是 1 万还是 11 万），权衡后取「写法唯一」。
// 顺带也不引 Intl：它按 locale 输出，SSR 与浏览器不一致时水合会闪一下 —— 不用它就没这个问题。
//
// 非有限值（Infinity / NaN）一律给「—」，由调用方决定配什么说明 —— 不把「—」写成 0 是刻意的：
// 保本线不存在时显示 0 会被读成「投多少都不亏」。

/** 金额：两位小数；负数把减号留在最前 */
export function formatMoney(value: number): string {
	if (!Number.isFinite(value)) return '—';
	return (value < 0 ? '-' : '') + Math.abs(value).toFixed(2);
}

/** 倍数（ROAS / ROI）：两位小数 */
export function formatTimes(value: number): string {
	if (!Number.isFinite(value)) return '—';
	return value.toFixed(2);
}

/** 百分数：一位小数（入参是 0~1 的小数） */
export function formatPercent(ratio: number): string {
	if (!Number.isFinite(ratio)) return '—';
	return `${(ratio * 100).toFixed(1)}%`;
}

/** 整数：订单数、退货订单数这类 */
export function formatCount(value: number): string {
	if (!Number.isFinite(value)) return '—';
	return Math.round(value).toString();
}

/** 两位小数的数字，公式代入行里用（不带货币符号） */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return '—';
	return value.toFixed(2);
}
