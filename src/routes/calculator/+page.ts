// 纯前端计算（不联网、不落库），页面可以整页预渲染：默认那条表达式的结果与空态历史都进 HTML。
// 历史从 localStorage 恢复，只在 onMount 里做（+page.svelte），不影响首屏输出。
export const prerender = true;
