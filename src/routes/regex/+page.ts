// 工具页是纯静态内容（空态骨架不依赖任何请求），预渲染成 HTML 输出，
// 首屏即可读、利于 SEO；交互部分在 hydration 后接管。
// 默认示例用固定文本而非「今天」这类动态值，保证构建产物稳定。
export const prerender = true;
