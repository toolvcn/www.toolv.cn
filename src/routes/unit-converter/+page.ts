// 工具页是纯静态内容（默认输入的空态骨架不依赖任何请求），预渲染成 HTML 输出，
// 首屏即可读、利于 SEO；换算结果在 hydration 后接管。
// 默认输入是固定值而非随机，保证构建产物稳定。
export const prerender = true;
