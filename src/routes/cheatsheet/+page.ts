// 速查表是静态数据（首屏就能渲染出完整表格），预渲染成 HTML 输出，
// 利于 SEO 与首屏速度；搜索与复制在 hydration 后接管。
export const prerender = true;
