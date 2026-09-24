// HTTP 状态码静态数据与搜索。纯数据 + 纯函数，可单测。

export type StatusCategory = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface StatusCodeInfo {
	code: number;
	/** 官方英文名，如 'Not Found' */
	name: string;
	/** 中文名，如 '未找到' */
	zhName: string;
	/** 一句话含义 */
	meaning: string;
	/** 常见触发场景 / 调试提示 */
	scenario: string;
}

/** 按 code 升序排列；类别齐全、够覆盖日常调试 */
export const STATUS_CODES: StatusCodeInfo[] = [
	// ------------------------------------------------------------- 1xx
	{
		code: 100,
		name: 'Continue',
		zhName: '继续',
		meaning: '服务器已收到请求头，客户端应继续发送请求体',
		scenario: '一般不会在浏览器里看到；大请求体分段发送前的握手'
	},
	{
		code: 101,
		name: 'Switching Protocols',
		zhName: '切换协议',
		meaning: '服务器同意按请求切换协议（如升级到 WebSocket）',
		scenario: 'WebSocket 握手的正常响应'
	},
	{
		code: 102,
		name: 'Processing',
		zhName: '处理中',
		meaning: '服务器还在处理，防止客户端超时（WebDAV）',
		scenario: '处理耗时较长时由中间件临时返回'
	},
	{
		code: 103,
		name: 'Early Hints',
		zhName: '早期提示',
		meaning: '在最终响应前提前推送资源链接，让浏览器预加载',
		scenario: '配合 Link 头预加载 CSS / 字体等关键资源'
	},
	// ------------------------------------------------------------- 2xx
	{
		code: 200,
		name: 'OK',
		zhName: '成功',
		meaning: '请求成功，响应体携带所请求的内容',
		scenario: '最常见的成功响应，GET / POST 都可能是 200'
	},
	{
		code: 201,
		name: 'Created',
		zhName: '已创建',
		meaning: '请求成功且已在服务器上创建新资源',
		scenario: 'POST 建资源成功；响应应带 Location 头指向新资源'
	},
	{
		code: 202,
		name: 'Accepted',
		zhName: '已接受',
		meaning: '请求已受理，但处理尚未完成',
		scenario: '异步任务入队成功；用状态接口轮询进度'
	},
	{
		code: 203,
		name: 'Non-Authoritative Information',
		zhName: '非权威信息',
		meaning: '响应用的是代理转述而非源服务器内容',
		scenario: '中间代理改写响应时返回'
	},
	{
		code: 204,
		name: 'No Content',
		zhName: '无内容',
		meaning: '请求成功，但没有响应体可返回',
		scenario: '删除成功、更新成功且不返回数据时常用'
	},
	{
		code: 205,
		name: 'Reset Content',
		zhName: '重置内容',
		meaning: '请求成功，指示客户端清空当前文档（如表单）',
		scenario: '提交表单成功后让页面回到初始态'
	},
	{
		code: 206,
		name: 'Partial Content',
		zhName: '部分内容',
		meaning: '只返回了请求的范围（Range）内的内容',
		scenario: '视频拖拽、断点续传的响应'
	},
	{
		code: 207,
		name: 'Multi-Status',
		zhName: '多状态',
		meaning: '一次返回多个子操作的不同状态（WebDAV）',
		scenario: '批量操作接口，body 里逐条给出状态'
	},
	{
		code: 208,
		name: 'Already Reported',
		zhName: '已报告',
		meaning: '同一资源在批量操作里被重复列出（WebDAV）',
		scenario: '配合 207 使用，避免重复枚举'
	},
	{
		code: 226,
		name: 'IM Used',
		zhName: '已使用 IM',
		meaning: '服务器完成了 GET 并使用了实例操控（delta 编码）',
		scenario: '增量同步场景，很罕见'
	},
	// ------------------------------------------------------------- 3xx
	{
		code: 300,
		name: 'Multiple Choices',
		zhName: '多种选择',
		meaning: '同一资源有多个表示，需客户端选择',
		scenario: '内容协商返回多个候选；现在很少用'
	},
	{
		code: 301,
		name: 'Moved Permanently',
		zhName: '永久移动',
		meaning: '资源已永久迁移到 Location 指向的新地址',
		scenario: '域名或路径变更；浏览器会缓存并直接走新地址'
	},
	{
		code: 302,
		name: 'Found',
		zhName: '临时移动',
		meaning: '资源暂时在新地址，后续仍应访问原地址',
		scenario: '临时跳转（登录后回跳、短链）'
	},
	{
		code: 303,
		name: 'See Other',
		zhName: '查看其它',
		meaning: 'GET 到 Location 的地址查看结果',
		scenario: 'POST 提交后 303 跳转到结果页，防止刷新重复提交'
	},
	{
		code: 304,
		name: 'Not Modified',
		zhName: '未修改',
		meaning: '条件请求命中，资源未变化，用本地缓存即可',
		scenario: '带 If-None-Match / If-Modified-Since 的请求命中缓存'
	},
	{
		code: 305,
		name: 'Use Proxy',
		zhName: '使用代理',
		meaning: '必须通过 Location 指定的代理访问',
		scenario: '已被弃用，出于安全原因浏览器不再实现'
	},
	{
		code: 307,
		name: 'Temporary Redirect',
		zhName: '临时重定向',
		meaning: '与 302 语义相同，但必须保持原请求方法与请求体',
		scenario: '临时迁移但不想丢失 POST 数据时使用'
	},
	{
		code: 308,
		name: 'Permanent Redirect',
		zhName: '永久重定向',
		meaning: '与 301 语义相同，但必须保持原请求方法与请求体',
		scenario: '永久迁移且要保留 POST 语义时使用'
	},
	// ------------------------------------------------------------- 4xx
	{
		code: 400,
		name: 'Bad Request',
		zhName: '请求错误',
		meaning: '请求语法或参数有误，服务器无法理解',
		scenario: 'JSON 解析失败、缺少必填字段、参数格式错误'
	},
	{
		code: 401,
		name: 'Unauthorized',
		zhName: '未认证',
		meaning: '缺少或无效的认证信息，请先登录或带上凭据',
		scenario: 'Token 缺失 / 过期 / 无效；检查 Authorization 头'
	},
	{
		code: 402,
		name: 'Payment Required',
		zhName: '需要付款',
		meaning: '预留用于付费访问，目前没有官方标准用法',
		scenario: '多见于第三方封禁付费墙场景'
	},
	{
		code: 403,
		name: 'Forbidden',
		zhName: '禁止访问',
		meaning: '已认证但没有权限访问该资源',
		scenario: '权限不足、IP 被拒、防盗链；区别于 401（未认证）'
	},
	{
		code: 404,
		name: 'Not Found',
		zhName: '未找到',
		meaning: '资源不存在，或服务端刻意不暴露其存在',
		scenario: '路径写错、资源已删除；也常被用来掩盖权限问题'
	},
	{
		code: 405,
		name: 'Method Not Allowed',
		zhName: '方法不允许',
		meaning: '该资源不支持当前请求方法',
		scenario: '接口只允许 GET 却发了 POST；检查方法是否拼错'
	},
	{
		code: 406,
		name: 'Not Acceptable',
		zhName: '无法接受',
		meaning: '无法按 Accept 头声明的格式返回内容',
		scenario: '客户端要求 XML 而服务端只产出 JSON'
	},
	{
		code: 407,
		name: 'Proxy Authentication Required',
		zhName: '需要代理认证',
		meaning: '需先通过代理的认证',
		scenario: '企业代理环境的鉴权提示'
	},
	{
		code: 408,
		name: 'Request Timeout',
		zhName: '请求超时',
		meaning: '服务器等待请求超时，客户端未及时发送完',
		scenario: '上传大文件时连接中断'
	},
	{
		code: 409,
		name: 'Conflict',
		zhName: '冲突',
		meaning: '请求与资源当前状态冲突，无法执行',
		scenario: '版本号不一致、用户名已被占用、并发编辑冲突'
	},
	{
		code: 410,
		name: 'Gone',
		zhName: '已删除',
		meaning: '资源曾存在但已被永久移除，且不会再恢复',
		scenario: '活动已下线、旧版本接口已废弃'
	},
	{
		code: 411,
		name: 'Length Required',
		zhName: '需要内容长度',
		meaning: '请求需要 Content-Length 头',
		scenario: '少见；分块传输时一般不会触发'
	},
	{
		code: 412,
		name: 'Precondition Failed',
		zhName: '前置条件失败',
		meaning: '请求头的前置条件（If-*）不满足',
		scenario: 'If-Match 与当前 ETag 不符，乐观锁校验失败'
	},
	{
		code: 413,
		name: 'Payload Too Large',
		zhName: '载荷过大',
		meaning: '请求体超过服务器允许的大小',
		scenario: '上传文件超过限制；检查请求体大小'
	},
	{
		code: 414,
		name: 'URI Too Long',
		zhName: 'URI 过长',
		meaning: 'URL 超过服务器允许的长度',
		scenario: 'GET 塞了大量查询参数；改用 POST'
	},
	{
		code: 415,
		name: 'Unsupported Media Type',
		zhName: '不支持的媒体类型',
		meaning: '请求体的 Content-Type 不被服务器支持',
		scenario: '发了 text/plain 但接口只收 application/json'
	},
	{
		code: 416,
		name: 'Range Not Satisfiable',
		zhName: '范围不满足',
		meaning: '请求的 Range 超出资源实际大小',
		scenario: '视频切片请求超出文件长度'
	},
	{
		code: 417,
		name: 'Expectation Failed',
		zhName: '预期失败',
		meaning: 'Expect 头声明的条件无法满足',
		scenario: 'Expect: 100-continue 被服务器拒绝'
	},
	{
		code: 418,
		name: "I'm a Teapot",
		zhName: '我是一个茶壶',
		meaning: '愚人节玩笑，服务器拒绝用咖啡壶身份泡茶',
		scenario: '茶壶协议彩蛋；API 有时用它表示「拒绝执行」'
	},
	{
		code: 421,
		name: 'Misdirected Request',
		zhName: '错误导向的请求',
		meaning: '请求被发给无法响应它的服务器',
		scenario: 'SNI 与证书域名不匹配时出现'
	},
	{
		code: 422,
		name: 'Unprocessable Entity',
		zhName: '无法处理的实体',
		meaning: '语法正确但语义有误（校验失败）',
		scenario: '字段值不符合业务规则，如邮箱格式不对'
	},
	{
		code: 423,
		name: 'Locked',
		zhName: '已锁定',
		meaning: '资源被锁定，当前操作不被允许（WebDAV）',
		scenario: '协同编辑时资源被他人占用'
	},
	{
		code: 424,
		name: 'Failed Dependency',
		zhName: '依赖失败',
		meaning: '当前请求依赖的另一个请求失败（WebDAV）',
		scenario: '批量操作中前置步骤失败导致后续无法执行'
	},
	{
		code: 425,
		name: 'Too Early',
		zhName: '太早',
		meaning: '服务器出于重放攻击防护，拒绝处理过早的请求',
		scenario: 'TLS 1.3 0-RTT 场景'
	},
	{
		code: 426,
		name: 'Upgrade Required',
		zhName: '需要升级',
		meaning: '服务器要求改用升级后的协议',
		scenario: '要求从 HTTP 升级到 TLS'
	},
	{
		code: 428,
		name: 'Precondition Required',
		zhName: '需要前置条件',
		meaning: '服务器要求请求带 If-Match 等前置条件',
		scenario: '强制乐观锁更新时返回'
	},
	{
		code: 429,
		name: 'Too Many Requests',
		zhName: '请求过多',
		meaning: '请求频率超过限流阈值',
		scenario: '被限流；检查 Retry-After 头并退避重试'
	},
	{
		code: 431,
		name: 'Request Header Fields Too Large',
		zhName: '请求头过大',
		meaning: '请求头整体超过服务器限制',
		scenario: 'Cookie 太大或 Authorization 异常膨胀'
	},
	{
		code: 451,
		name: 'Unavailable For Legal Reasons',
		zhName: '法律原因不可用',
		meaning: '因法律 / 政策要求拒绝提供该资源',
		scenario: '内容被依法下架的地区性屏蔽'
	},
	// ------------------------------------------------------------- 5xx
	{
		code: 500,
		name: 'Internal Server Error',
		zhName: '服务器内部错误',
		meaning: '服务器内部异常，无法完成请求',
		scenario: '后端未捕获的异常；找服务端看日志'
	},
	{
		code: 501,
		name: 'Not Implemented',
		zhName: '未实现',
		meaning: '服务器不支持该请求方法',
		scenario: '网关 / 老旧服务不支持 PUT 等'
	},
	{
		code: 502,
		name: 'Bad Gateway',
		zhName: '网关错误',
		meaning: '上游服务器返回了无效响应',
		scenario: '反向代理后端的服务挂了或响应异常'
	},
	{
		code: 503,
		name: 'Service Unavailable',
		zhName: '服务不可用',
		meaning: '服务暂时不可用，通常因为过载或维护',
		scenario: '重启中、过载保护；看 Retry-After 头'
	},
	{
		code: 504,
		name: 'Gateway Timeout',
		zhName: '网关超时',
		meaning: '上游服务器在限期内未响应',
		scenario: '后端接口慢导致代理超时；排查上游耗时'
	},
	{
		code: 505,
		name: 'HTTP Version Not Supported',
		zhName: '不支持的 HTTP 版本',
		meaning: '服务器不支持请求使用的 HTTP 版本',
		scenario: '极罕见，客户端用了过新或过旧的协议版本'
	},
	{
		code: 506,
		name: 'Variant Also Negotiates',
		zhName: '变体协商',
		meaning: '内容协商配置成环，服务器无法决定返回哪个表示',
		scenario: '服务器配置错误导致协商死循环'
	},
	{
		code: 507,
		name: 'Insufficient Storage',
		zhName: '存储不足',
		meaning: '服务器存储空间不足，无法完成请求（WebDAV）',
		scenario: '磁盘写满时的 WebDAV 操作'
	},
	{
		code: 508,
		name: 'Loop Detected',
		zhName: '检测到循环',
		meaning: '请求在服务器间无限循环转发（WebDAV）',
		scenario: '代理或重写规则配置成环'
	},
	{
		code: 510,
		name: 'Not Extended',
		zhName: '未扩展',
		meaning: '请求需要额外的扩展才能被处理',
		scenario: 'HTTP 扩展协商机制，罕见'
	},
	{
		code: 511,
		name: 'Network Authentication Required',
		zhName: '需要网络认证',
		meaning: '需先通过网络接入认证（如登录 WiFi 门户）',
		scenario: '连接公共 WiFi 时浏览器会拦截并跳转认证页'
	}
];

const GROUP_NAME: Record<StatusCategory, string> = {
	'1xx': '1xx 信息响应',
	'2xx': '2xx 成功',
	'3xx': '3xx 重定向',
	'4xx': '4xx 客户端错误',
	'5xx': '5xx 服务器错误'
};

/** 从状态码推分类（数据按 code 升序组织，分类直接派生，避免重复标注） */
export function categoryOf(code: number): StatusCategory {
	if (code >= 100 && code < 200) return '1xx';
	if (code >= 200 && code < 300) return '2xx';
	if (code >= 300 && code < 400) return '3xx';
	if (code >= 400 && code < 500) return '4xx';
	return '5xx';
}

/** 分组标题，UI 渲染用 */
export function statusGroupName(category: StatusCategory): string {
	return GROUP_NAME[category];
}

/**
 * 状态码的**简略信息**：结果行里紧跟在状态码后面（`404 未找到`）。
 * 三级回落：本地表的中文名 → 服务端的 reason phrase → 它所属的分类名（`520` → `5xx 服务器错误`）。
 *
 * 为什么主显示不用服务端的 reason phrase：**HTTP/2 根本不返回它**（`res.statusText` 常是空串），
 * 本地表反而更可靠，而且本来就是中文；服务端那句只在「表里没这个码」时才拿来用。
 */
export function statusBrief(code: number, serverReason = ''): string {
	const known = STATUS_CODES.find((item) => item.code === code);
	if (known !== undefined) return known.zhName;
	const reason = serverReason.trim();
	if (reason !== '') return reason;
	return statusGroupName(categoryOf(code));
}

/** 小写包含匹配 code / name / zhName / meaning / scenario；空查询返回全量 */
export function searchStatusCodes(query: string): StatusCodeInfo[] {
	const q = query.trim().toLowerCase();
	if (q === '') return STATUS_CODES;
	return STATUS_CODES.filter((item) => {
		return (
			String(item.code).includes(q) ||
			item.name.toLowerCase().includes(q) ||
			item.zhName.toLowerCase().includes(q) ||
			item.meaning.toLowerCase().includes(q) ||
			item.scenario.toLowerCase().includes(q)
		);
	});
}
