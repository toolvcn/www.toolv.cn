// HTTP 请求调试：页面本身纯前端 + fetch，无运行时数据，静态预渲染即可。
// 可选的「服务器代发」端点走 src/routes/http/proxy/+server.ts（POST 运行时路由，不参与预渲染）。
export const prerender = true;
