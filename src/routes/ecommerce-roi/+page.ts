// 工具页是纯静态内容（公式与口径说明都是写死的长文，不依赖任何请求），预渲染成 HTML 输出，
// 首屏即可读、利于 SEO；交互部分在 hydration 后接管。
export const prerender = true;
