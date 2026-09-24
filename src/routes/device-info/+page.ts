// 首屏骨架（分组标题 + 字段名 + 占位符）不依赖任何请求，预渲染成 HTML 输出，利于 SEO 与首屏速度；
// 真正的信息在 hydration 后由 +page.svelte 采集填入。
export const prerender = true;
