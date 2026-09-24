// 工具页是纯静态内容（码表与空态骨架都不依赖任何请求），预渲染成 HTML 输出，
// 首屏即可读、利于 SEO；交互部分在 hydration 后接管。
export const prerender = true;
