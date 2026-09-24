// HTTP 请求调试的**可配置参数**：超时档位与默认值、服务器代发的两个上限、
// 预设的 localStorage 键。要调这一页的行为，改这里就够了 —— 不必去 core/ 与 ui/ 里翻。
//
// 边界（免得这个文件越长越杂，也免得下一个人不知道某样东西该不该放进来）：
//   - 只放**业务数值与开关**。请求 / 响应的类型与下拉选项（方法、Content-Type）在 `core/types.ts`、
//     界面文案在各 `ui/` 组件、样式在 `ui/styles.ts`、速度 / 字节的格式化在 `core/proxy.ts`
//     —— 都不进这里。
//   - 超时档位破例带着中文说明进来：档位与「这一档是什么意思」是一张表，拆开反而要两边改。
//   - 代发那三项被 `proxy/+server.ts`（服务端）读，所以这里**不碰 DOM、不 import 组件与 store**，
//     纯常量 —— node 与 worker 环境都能直接跑。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找；
// 与 STRUCTURE §1「逻辑进 core/」的偏离是有意的，理由是「让人一眼看到去哪改」。

// 只 import type（不从 core/ 取实现），保持「不依赖任何模块」——服务端（proxy/+server.ts）也读这个文件
import type { RequestExample } from './core/types.ts';

// ---------------------------------------------------------------- 默认值与档位

/**
 * 默认超时（毫秒）：10 秒。
 * 表单初值、预设反序列化兜底、代发端点收到非法值时的兜底共用这一个 —— 免得三处各写一个 10000。
 * 它同时等于代发上限，所以默认档在两种发送方式下都合法。
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 超时下拉选项（毫秒）。value 是字符串：Dropdown 的取值口径。
 *
 * 30 / 60 秒两档只对**浏览器直发**有效 —— 服务器代发有 10 秒上限（见下面的 MAX_PROXY_TIMEOUT_MS），
 * 所以这两条的说明里直接写明代发下的上限，免得选了 60 秒却在 10 秒被中断、以为是工具坏了。
 */
export const TIMEOUT_OPTIONS = [
	{ value: '5000', label: '5 秒', description: '请求超过 5 秒自动中断' },
	{ value: '10000', label: '10 秒', description: '请求超过 10 秒自动中断' },
	{ value: '30000', label: '30 秒', description: '请求超过 30 秒自动中断；服务器代发上限 10 秒' },
	{ value: '60000', label: '60 秒', description: '请求超过 60 秒自动中断；服务器代发上限 10 秒' }
] as const;

// ---------------------------------------------------------------- 上限

/** 服务器代发：响应体读取上限（字节），超过即截断并标记 truncated */
export const MAX_PROXY_BODY_BYTES = 1024 * 1024;

/**
 * 服务器代发：超时上限（毫秒），**10 秒**。
 *
 * 代发走的是本站服务器资源，长挂请求既费资源、也容易被当成免费的慢接口代理，所以封在 10 秒。
 * 两头都夹：`proxy/+server.ts` 收到更大的值会夹到这个上限（客户端被改也拦得住），
 * 前端也在代发时先夹一次（`store.effectiveTimeoutMs`）—— 于是界面上写明的秒数与实际中断的时刻一致。
 * **浏览器直发不受这条限制**（5 / 10 / 30 / 60 秒四档都可选）。
 */
export const MAX_PROXY_TIMEOUT_MS = 10_000;

/** 服务器代发：超时下限（毫秒），挡住 0 或负值让请求立刻中断 */
export const MIN_PROXY_TIMEOUT_MS = 1000;

/**
 * 响应体**渲染**上限：原始视图一次最多渲染多少字符。
 *
 * 卡住浏览器的从来不是「读回几 MB 文本」，而是把几万个节点铺进 DOM —— 十几 MB 的 JSON
 * 一渲染就整页无响应，连滚动条都拖不动。所以这里卡的是**显示**，不是数据：
 * 响应体始终完整（复制 / 保存拿到的都是全文），只是默认不一次全铺到屏幕上。
 */
export const MAX_BODY_CHARS = 200_000;

/** 美化视图一次最多渲染多少个 token（一个 token 可能是一个字符串、一个标点或一个键名） */
export const MAX_BODY_TOKENS = 20_000;

// ---------------------------------------------------------------- 请求示例

/**
 * 「示例」菜单里的几条请求。**一条示例演示一件事**：最简请求 / 查询参数表 / JSON 请求体 /
 * 表单字段 / Bearer 认证 / 非 2xx 状态码 / 慢响应。
 *
 * 都打 `httpbin.org` —— 它专为调试而生（有 CORS、不校验数据、能把收到的请求原样回显），
 * 浏览器直发也能跑通，不需要任何后端配合。
 *
 * 说明文案跟数据放在一处（与超时档位同一个理由）：改一条示例总要同时改它的说明，拆开就得两边改。
 * 字段含义见 `core/types.ts` 的 `RequestExample`；`auth` / `timeoutMs` 省略 = **不动用户当前的值**。
 */
export const REQUEST_EXAMPLES: readonly RequestExample[] = [
	{
		id: 'plain-get',
		label: '最简：GET + 请求头',
		description: '一条 URL 加一条请求头，先看看响应面板怎么排版',
		method: 'GET',
		url: 'https://httpbin.org/get',
		headersText: 'Accept: application/json',
		body: '',
		contentType: 'none',
		panelTab: 'headers'
	},
	{
		id: 'query-params',
		label: 'GET + 查询参数',
		description: '参数表与 URL 双向同步：改一端，另一端跟着变',
		method: 'GET',
		url: 'https://httpbin.org/get?page=1&size=20',
		headersText: '',
		body: '',
		contentType: 'none',
		panelTab: 'params'
	},
	{
		id: 'post-json',
		label: 'POST + JSON 请求体',
		description: 'JSON 类型自动带上 Content-Type，内容脏了可点「格式化」',
		method: 'POST',
		url: 'https://httpbin.org/post',
		headersText: '',
		body: '{\n  "name": "toolv",\n  "tags": ["http", "debug"]\n}',
		contentType: 'application/json',
		panelTab: 'body'
	},
	{
		id: 'post-form',
		label: 'POST + 表单字段',
		description: '表单类型的正文由键值表拼出来，勾掉的行不发送',
		method: 'POST',
		url: 'https://httpbin.org/post',
		headersText: '',
		body: 'name=toolv&from=example',
		contentType: 'application/x-www-form-urlencoded',
		panelTab: 'body'
	},
	{
		id: 'bearer-auth',
		label: '带 Bearer 认证',
		description: '授权标签页填了 token，请求头自动注入；httpbin 会把收到的 token 回显出来',
		method: 'GET',
		url: 'https://httpbin.org/bearer',
		headersText: '',
		body: '',
		contentType: 'none',
		auth: { type: 'bearer', token: 'demo-token' },
		panelTab: 'auth'
	},
	{
		id: 'status-404',
		label: '非 2xx：404',
		description: '响应面板的「状态码」标签会自动定位到 404 并短暂高亮',
		method: 'GET',
		url: 'https://httpbin.org/status/404',
		headersText: '',
		body: '',
		contentType: 'none'
	},
	{
		id: 'slow',
		label: '慢响应：延迟 3 秒',
		description: '看总耗时与下载测速；3 秒的延迟用 5 秒档就够（代发上限 10 秒）',
		method: 'GET',
		url: 'https://httpbin.org/delay/3',
		headersText: '',
		body: '',
		contentType: 'none'
	}
];

// ---------------------------------------------------------------- 本地存储

/** 参数预设的 localStorage 键（+page.svelte 读写） */
export const PRESETS_STORAGE_KEY = 'toolv:http-presets';
