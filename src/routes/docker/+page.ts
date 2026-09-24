// Docker 命令速查是纯静态数据 + 纯前端交互（变量替换全在浏览器里算），
// 预渲染成 HTML 输出：首屏就能看到命令与分组，利于 SEO 与首屏速度；搜索、复制、变量在 hydration 后接管。
export const prerender = true;
