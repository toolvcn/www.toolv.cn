// HTTP 请求调试器的类型与常量。纯类型/数据，不依赖 DOM 与 UI。
//
// 可配置的业务参数（超时档位与默认值、代发上限、预设存储键）在**根层的 `config.ts`**，
// 不在这里；下拉选项（方法 / Content-Type）跟着类型留在本文件。

/** 支持的方法；GET/HEAD 不消费请求体 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** 请求体 Content-Type；'none' 表示不自动注入该头 */
export type ContentType = 'none' | 'application/json' | 'application/x-www-form-urlencoded' | 'text/plain';

/** 请求运行阶段：idle 待发送 / sending 请求中 / done 已有结果 */
export type Phase = 'idle' | 'sending' | 'done';

/** 页面级标签：请求调试 / 导入导出（DevTools 复制格式互转）/ 代码生成 */
export type WorkspaceTab = 'request' | 'text' | 'codegen';

/** 请求构造面板里的四个标签：参数 / 授权 / 请求头 / 请求体 */
export type RequestPanelTab = 'params' | 'auth' | 'headers' | 'body';

/** 响应面板里的三个标签：响应体 / 响应头 / 状态码 */
export type ResponsePanelTab = 'body' | 'headers' | 'status';

/** 请求与响应的排列方式。移动端恒为上下（宽度不够并排），切换只对 lg 起生效 */
export type PaneLayout = 'stack' | 'side';

/** 键值表的一行：查询参数与表单字段共用（`enabled` 为 false 的行留在表里但不发送） */
export interface KeyValueRow {
	/** 自增 id，只用于列表 key 与定位，不参与导出 */
	id: number;
	enabled: boolean;
	name: string;
	value: string;
}

/**
 * 认证方式。**刻意不含 OAuth 2.0**：授权码流程要一个回调端点、客户端密钥也没有地方托管，
 * 纯前端做不了完整流程，不如不做（README 的隐私说明里写明了）。
 */
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

/** API Key 放请求头还是查询参数 */
export type ApiKeyIn = 'header' | 'query';

/** 认证配置：只读当前 type 用得上的字段，切类型时其余字段原样留着，来回切不丢 */
export interface AuthConfig {
	type: AuthType;
	/** Bearer Token */
	token: string;
	/** Basic 用户名 / 密码 */
	username: string;
	password: string;
	/** API Key：键名、值、放哪 */
	keyName: string;
	keyValue: string;
	keyIn: ApiKeyIn;
}

/** 响应体显示方式：格式化（JSON 美化+高亮）/ 原始（原文）/ 预览（HTML 沙箱渲染） */
export type ResponseView = 'formatted' | 'raw' | 'preview';

/** 代码生成的目标语言 */
export type CodeLang = 'javascript' | 'typescript' | 'python' | 'go' | 'java' | 'php' | 'csharp' | 'powershell';

/** 请求失败归类：浏览器无法细分 CORS 拦截与网络失败，统一归 network */
export type RequestErrorKind = 'network' | 'timeout' | 'abort' | 'invalid-url';

/**
 * 跨域请求要不要带凭证（fetch 的 `credentials`）。
 * 默认 `same-origin` —— 与浏览器原生行为一致：跨域默认不带 Cookie，
 * 要带就得服务端同时允许（CORS 头带 `Allow-Credentials` 且 `Allow-Origin` 不能是 `*`）。
 */
export type CredentialsMode = 'omit' | 'same-origin' | 'include';

/** 左侧参数预设面板里保存的一条调试参数（请求表单快照） */
export interface HttpPreset {
	/** 自增 id，仅用于列表渲染 key，不参与导出 */
	id: number;
	name: string;
	method: HttpMethod;
	url: string;
	/** 请求头原文：每行一条「名称: 值」 */
	headersText: string;
	body: string;
	contentType: ContentType;
	timeoutMs: number;
	/** 查询参数行（可选：旧预设没有这一项，恢复时回落到从 url 解析） */
	params?: KeyValueRow[];
	/** 认证配置（可选：旧预设没有这一项，恢复时按「无认证」处理） */
	auth?: AuthConfig;
	/** 凭证模式（可选：旧预设没有这一项，恢复时回落到 same-origin） */
	credentials?: CredentialsMode;
}

export interface RequestError {
	kind: RequestErrorKind;
	message: string;
}

/**
 * 请求示例：一条「填好的表单」，与预设（`HttpPreset`）同形状，只多 label / description、少 id / name。
 * 正因如此，两者的回填逻辑也是同一段（`store` 的 `#applySnapshot`）。
 *
 * **与预设相反的一处取舍**：`auth` 与 `timeoutMs` 省略表示「**不动当前值**」——
 * 示例不该顺手清掉用户填好的身份与超时档位（预设存的是整条请求，缺什么就是什么）。
 */
export interface RequestExample {
	/** 下拉选项的 value（也是 applyExample 的参数） */
	id: string;
	/** 下拉里显示的名称（短） */
	label: string;
	/** 下拉里的说明：这条示例演示什么 */
	description: string;
	method: HttpMethod;
	url: string;
	/** 请求头原文：每行一条「名称: 值」 */
	headersText: string;
	body: string;
	contentType: ContentType;
	/** 查询参数行；省略则回落到从 url 解析（与预设同一口径） */
	params?: { name: string; value: string }[];
	/** 认证配置；省略表示不动用户当前的认证 */
	auth?: Partial<AuthConfig>;
	/** 超时（毫秒）；省略表示不动当前档位 */
	timeoutMs?: number;
	/**
	 * 填入后把「请求构造」面板翻到哪个标签（省略则不动当前标签）。
	 * 示例的用处就是演示某一项能力 —— 填完却把它藏在收起的面板里，等于没演示。
	 */
	panelTab?: RequestPanelTab;
}

/**
 * `#applySnapshot` 的入参：预设与示例都直接传得进来。
 * 比 `HttpPreset` 宽松（三处可选）正是为了表达「这一项别动」。
 */
export interface FormSnapshot {
	method: HttpMethod;
	url: string;
	headersText: string;
	body: string;
	contentType: ContentType;
	timeoutMs?: number;
	params?: readonly { name: string; value: string; enabled?: boolean }[];
	auth?: Partial<AuthConfig>;
	credentials?: CredentialsMode;
}

export interface ResponseHeader {
	name: string;
	value: string;
}

/** 服务器代发模式的测速指标（core/proxy.ts 复用） */
export interface SpeedMetrics {
	/** 从发起请求到收到响应头的毫秒数 */
	ttfbMs: number;
	/** 从发起请求到读完响应体的毫秒数 */
	totalMs: number;
	/** 实际读到的响应体字节数（截断时指已读部分） */
	bytes: number;
	/** 下载速度（B/s）：按下载耗时计算，下载耗时过短时退化为总耗时 */
	speedBps: number;
	/** 响应体超过代理读取上限被截断 */
	truncated: boolean;
}

/** 一次成功（或非 2xx 也算收到响应）的结果快照 */
export interface ResponseState {
	status: number;
	statusText: string;
	ok: boolean;
	headers: ResponseHeader[];
	body: string;
	/** body 的 UTF-8 字节数 */
	bodyBytes: number;
	/** 从发出到读完响应体的毫秒数 */
	durationMs: number;
	/** 服务器代发模式的测速指标；浏览器直发时为 null */
	serverMetrics: SpeedMetrics | null;
}

/** buildCurl 的入参：store 表单的纯数据快照（跟 store 解耦，可单测） */
export interface CurlForm {
	method: HttpMethod;
	url: string;
	headers: { name: string; value: string }[];
	body: string;
	contentType: ContentType;
}

/** parseCurl 的成功结果 */
export interface ParsedCurl {
	method: HttpMethod;
	url: string;
	headers: { name: string; value: string }[];
	body: string;
	contentType: ContentType;
}

/** 方法下拉选项（结构兼容 $lib/ui/Dropdown 的 DropdownOption） */
export const METHOD_OPTIONS = [
	{ value: 'GET', label: 'GET', description: '获取资源，不携带请求体' },
	{ value: 'POST', label: 'POST', description: '提交数据创建资源' },
	{ value: 'PUT', label: 'PUT', description: '整体替换资源' },
	{ value: 'PATCH', label: 'PATCH', description: '局部更新资源' },
	{ value: 'DELETE', label: 'DELETE', description: '删除资源' },
	{ value: 'HEAD', label: 'HEAD', description: '只取响应头，不带响应体' },
	{ value: 'OPTIONS', label: 'OPTIONS', description: '询问接口支持的请求方式' }
] as const;

/** Content-Type 下拉选项 */
export const CONTENT_TYPE_OPTIONS = [
	{ value: 'none', label: '不设置', description: '不自动注入 Content-Type 头' },
	{ value: 'application/json', label: 'JSON', description: 'application/json' },
	{ value: 'application/x-www-form-urlencoded', label: '表单', description: 'application/x-www-form-urlencoded' },
	{ value: 'text/plain', label: '纯文本', description: 'text/plain' }
] as const;

/**
 * 全部合法方法，从上面的下拉选项派生 —— 要「这一串方法全不全」的地方都读它
 * （`curl.ts` 认 `-X`、`presets.ts` 校验导入文件、`request-text.ts` 认 fetch 的 method）。
 * 别再各写一份数组：这份曾经散成三处，加方法时必漏。只有一个值不在这里：主列表的 `GET`。
 */
export const HTTP_METHODS: HttpMethod[] = METHOD_OPTIONS.map((option) => option.value);
