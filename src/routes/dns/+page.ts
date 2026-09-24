// 公共 DNS 清单是编译期常量（首屏就能渲染出完整列表），预渲染成 HTML 输出，
// 利于 SEO 与首屏速度；筛选与复制在 hydration 后接管。
export const prerender = true;
