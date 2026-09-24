// HTTP 请求调试器的编排层：模块级单例管住表单 / 标签 / 请求运行态，组件只负责渲染。
// 发送逻辑走注入的 fetchImpl，单测可换成 fake fetch。
import { buildCurl, formatHeadersText, parseHeadersText, resolveHeaders } from './curl.ts';
import { generateCode, langLabel } from './codegen.ts';
import { byteLength } from './bytes.ts';
import { contentTypeOf, responseFileName } from './download.ts';
import { parsePresets, serializePresets } from './presets.ts';
import { statusBrief } from './status-codes.ts';
import { authHeaders, authQuery, emptyAuth } from './auth.ts';
import { applyParams, parseParams } from './params.ts';
import { formatLocalHeaders, readBrowserHeaders } from './local-headers.ts';
import { buildRequestText, formatLabel, parseRequestText } from './request-text.ts';
import type { RequestTextFormat } from './request-text.ts';
import { decodeBase64Utf8, formatSpeed, PROXY_ENDPOINT, ProxyServerError } from './proxy.ts';
import type { ProxyRequestPayload, ProxyResponse } from './proxy.ts';
import type {
	AuthConfig,
	CodeLang,
	ContentType,
	CredentialsMode,
	CurlForm,
	FormSnapshot,
	HttpMethod,
	HttpPreset,
	KeyValueRow,
	PaneLayout,
	Phase,
	RequestError,
	RequestPanelTab,
	ResponseHeader,
	ResponsePanelTab,
	ResponseState,
	ResponseView,
	WorkspaceTab
} from './types.ts';
// 默认超时、代发上限与请求示例都在根层的 config.ts：调行为先去那里
import { DEFAULT_TIMEOUT_MS, MAX_PROXY_TIMEOUT_MS, REQUEST_EXAMPLES } from '../config.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';
import { downloadText, readText } from '$lib/utils/browser';

/** 字节数人性化显示 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 把表单行拼成 `a=1&b=2`：只取启用且键名非空的行（值为空的写成 `a=`，与参数表同口径） */
function serializeFormRows(rows: readonly KeyValueRow[]): string {
	return rows
		.filter((row) => row.enabled && row.name.trim() !== '')
		.map((row) => `${encodeURIComponent(row.name.trim())}=${encodeURIComponent(row.value)}`)
		.join('&');
}

/** `a=1&b=2` 这样的表单正文 → 键值行。借 `parseParams` 实现：给它一个假前缀凑出查询串的样子 */
function formRowsToRows(body: string): { name: string; value: string }[] {
	return body === '' ? [] : parseParams(`x?${body}`);
}

/**
 * 补全协议并校验 URL 可解析：无协议默认补 https://，解析失败返回 null。
 * 只补协议、不改写其余部分，尽量贴近用户输入。
 */
export function normalizeUrl(url: string): string | null {
	const trimmed = url.trim();
	if (trimmed === '') return null;
	const withProto = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
	return URL.canParse(withProto) ? withProto : null;
}

class HttpStore {
	// ---------------------------------------------------------------- 请求表单

	method = $state<HttpMethod>('GET');
	url = $state('');
	/** 请求头原文：每行一条「名称: 值」，发送时按行解析（core/curl.ts 的 parseHeadersText） */
	headersText = $state('');
	body = $state('');
	contentType = $state<ContentType>('none');
	/**
	 * 超时毫秒数；Dropdown 的 value 是字符串，setTimeoutMs 负责转 number。
	 * 存的是**用户选的档位**：代发的 10 秒上限在 `effectiveTimeoutMs` 里夹，不改写这个值 ——
	 * 改写了就回不来（用户选了 60 秒、开关一拨变成 10 秒，关掉代发也只剩 10 秒）。
	 */
	timeoutMs = $state<number>(DEFAULT_TIMEOUT_MS);
	/** 服务器代发开关：开启后请求经 /http/proxy 转发（绕开 CORS，返回测速指标）；默认浏览器直发 */
	serverMode = $state(false);

	// ---------------------------------------------------------------- 参数预设

	/** 左侧面板保存的调试参数列表；本地持久化由 +page.svelte 的 $effect 负责 */
	presets = $state<HttpPreset[]>([]);
	/** 面板里的「名称」输入框；保存成功后清空 */
	presetName = $state('');
	#presetSeq = 0;

	// ---------------------------------------------------------------- 页面标签

	tab = $state<WorkspaceTab>('request');
	/** 导入区的粘贴文本：任意受支持的请求文本（Copy as cURL / fetch / PowerShell…） */
	importText = $state('');
	/** 「导入 / 导出」标签里选中的导出格式 */
	exportFormat = $state<RequestTextFormat>('curl-bash');
	/** 最近一次响应对应的状态码；切到「状态码速查」标签时据此自动滚动定位并高亮 */
	focusedStatus = $state<number | null>(null);
	/** 响应体显示方式：格式化 / 原始 / 预览（非 JSON 响应自动回退原文） */
	responseView = $state<ResponseView>('formatted');
	/**
	 * 「仍要全部显示」：响应体超出渲染上限时，用户点过一次才解除限制。
	 *
	 * 每次发新请求都回到 false（见 `send`）—— 上一份响应点过「全部显示」不等于
	 * 下一份 10 MB 的响应也该硬铺；真要卡，卡在用户自己点过的那一次。
	 */
	bodyUncapped = $state(false);
	/** 代码生成标签的当前语言 */
	codeLang = $state<CodeLang>('javascript');

	// ---------------------------------------------------------------- 查询参数 / 表单字段 / 认证

	/**
	 * 查询参数行。**与 `url` 互为镜像**：`setUrl` 从 URL 解析出行，行改动再用 `applyParams`
	 * 写回 URL —— 只有一条真源，不存在两处各存一份、对不上的情况。
	 */
	params = $state<KeyValueRow[]>([]);
	#paramSeq = 0;

	/** 表单字段（`Content-Type: application/x-www-form-urlencoded` 时用），发送时拼成 `a=1&b=2` */
	formRows = $state<KeyValueRow[]>([]);
	#formSeq = 0;

	/** 认证配置；字段先给全，来回切类型不丢已填的值 */
	auth = $state<AuthConfig>(emptyAuth());

	/**
	 * 跨域是否带凭证（Cookie / 认证头）：默认 `same-origin`，与浏览器原生行为一致。
	 * 改成 `include` 之前要知道服务端必须同时允许（CORS 头带 `Allow-Credentials`），
	 * 否则请求会被浏览器直接拦掉 —— 这一点写在下拉的说明里，不让人盲目试。
	 */
	credentials = $state<CredentialsMode>('same-origin');

	// ---------------------------------------------------------------- 面板标签与排列

	/** 请求构造面板的当前标签，默认停在「参数」（与 Hoppscotch 一致） */
	requestTab = $state<RequestPanelTab>('params');
	/** 响应面板的当前标签 */
	responseTab = $state<ResponsePanelTab>('body');
	/** 请求与响应的排列：上下（默认）/ 左右。只对 lg 起生效，移动端恒为上下 */
	layout = $state<PaneLayout>('stack');

	/**
	 * 请求构造面板是否收起。收起后只剩标题行（那排标签还在，点一下就展开），
	 * 高度让给响应 —— 「只想看响应」时最省地方。
	 */
	requestCollapsed = $state(false);

	/**
	 * 响应面板是否收起。收起后只剩标题行 —— 而结果（状态码 / 耗时 / 大小）就在标题行里，
	 * 所以收起不等于看不见结果，只是不看正文。请求体很长时正好把高度让给请求构造。
	 */
	responseCollapsed = $state(false);

	toggleRequestCollapsed(): void {
		this.requestCollapsed = !this.requestCollapsed;
	}

	toggleResponseCollapsed(): void {
		this.responseCollapsed = !this.responseCollapsed;
	}

	// ---------------------------------------------------------------- 请求运行态

	phase = $state<Phase>('idle');
	response = $state<ResponseState | null>(null);
	error = $state<RequestError | null>(null);
	#abort: AbortController | null = null;
	#userCancelled = false;

	/** 测试注入点：默认真实 fetch，单测换成 fake */
	fetchImpl: typeof fetch = globalThis.fetch;

	// ---------------------------------------------------------------- 派生值

	/** 手写的请求头（从多行文本按行解析），面板上的计数与注入去重都用它 */
	get effectiveHeaders(): { name: string; value: string }[] {
		return parseHeadersText(this.headersText);
	}

	/**
	 * 实际发送的 URL：把「API Key 放查询参数」的那一条补进去。
	 * 手写的同名参数优先（已经有了就不再补），与请求头同一条规则。
	 */
	get effectiveUrl(): string {
		const extra = authQuery(this.auth);
		if (extra.length === 0) return this.url.trim();
		const rows = parseParams(this.url);
		const existing = new Set(rows.map((row) => row.name));
		const add = extra.filter((row) => !existing.has(row.name));
		if (add.length === 0) return this.url.trim();
		return applyParams(this.url, [...rows, ...add]);
	}

	/**
	 * 实际随请求发送的头：**手写的在前、认证注入的补在其后**，同名以手写的为准。
	 * 顺序也是 cURL 与生成代码里头出现的顺序，所以这里就是唯一口径。
	 */
	get requestHeaders(): { name: string; value: string }[] {
		const manual = parseHeadersText(this.headersText);
		const taken = new Set(manual.map((header) => header.name.trim().toLowerCase()));
		const injected = authHeaders(this.auth).filter((header) => !taken.has(header.name.toLowerCase()));
		return [...manual, ...injected];
	}

	/**
	 * 实际发送的请求体：表单类型由键值表拼出来，JSON / 纯文本用原文；GET / HEAD 一律为空。
	 * cURL 与代码生成也读它 —— 于是参数表、表单表、认证都不用被 curl.ts / codegen.ts 感知。
	 */
	get effectiveBody(): string {
		if (!this.isBodyAllowed) return '';
		if (this.contentType === 'application/x-www-form-urlencoded') return serializeFormRows(this.formRows);
		return this.body;
	}

	get canSend(): boolean {
		return this.url.trim() !== '' && this.phase !== 'sending';
	}

	get isBodyAllowed(): boolean {
		return this.method !== 'GET' && this.method !== 'HEAD';
	}

	/**
	 * 实际生效的超时：服务器代发有 10 秒上限（config.ts 的 MAX_PROXY_TIMEOUT_MS），超过就夹回去。
	 *
	 * 「实际会怎么发生」的那三处都读它 —— 中断计时器、发给代发的 payload、超时文案。下拉里显示的仍是
	 * 用户选的档位（`timeoutMs`），两者不一致时由请求条的发送方式说明写出来（「服务器代发 · 超时按 10 秒算」）：
	 * 既不静默改写用户的值，也不静默把请求夹短。
	 */
	get effectiveTimeoutMs(): number {
		return this.serverMode ? Math.min(this.timeoutMs, MAX_PROXY_TIMEOUT_MS) : this.timeoutMs;
	}

	/**
	 * 当前表单的 cURL 快照。**cURL 生成、代码生成、实际发送三条路都读它**，
	 * 所以「生效后的」URL / 请求头 / 请求体在这一处算好（查询参数与认证的注入都在上面完成）。
	 * 好处是 curl.ts 与 codegen.ts 完全不必知道参数表与认证的存在，它们的单测也就不会被这次改动波及。
	 */
	toCurlForm(): CurlForm {
		return {
			method: this.method,
			url: this.effectiveUrl,
			headers: this.requestHeaders,
			body: this.effectiveBody,
			contentType: this.contentType
		};
	}

	/** 多行 cURL 命令，供复制与 cURL 标签预览 */
	get curlText(): string {
		return buildCurl(this.toCurlForm(), { multiline: true });
	}

	/** 当前语言下的请求代码，随表单实时重算 */
	get code(): string {
		return generateCode(this.toCurlForm(), this.codeLang);
	}

	/**
	 * 运行态 / 结果文案：界面显示与读屏播报共用这一份，也是**唯一**一处汇总结果的地方
	 * （状态码 / 耗时 / 大小，代发时再补 TTFB 与下载速度）—— 界面别在别处再重复一遍，
	 * 同一次响应让人扫三个位置看是这一版要收掉的问题。
	 */
	get statusText(): string {
		if (this.phase === 'sending') return '请求中…';
		if (this.error) return this.error.message;
		const res = this.response;
		if (res) {
			// 状态码后面紧跟简略说明（`404 未找到`）：本地状态码表的中文名，表里没有才用服务端 reason phrase。
			// 不直接用服务端那句是因为 HTTP/2 下 `res.statusText` 是空串 —— 那样就只剩一个光秃秃的 200
			const head = `${res.status} ${statusBrief(res.status, res.statusText)}`;
			const m = res.serverMetrics;
			const base = m
				? `${head} · ${m.totalMs}ms · ${formatBytes(m.bytes)}`
				: `${head} · ${res.durationMs}ms · ${formatBytes(res.bodyBytes)}`;
			if (!m) return base;
			// 代发读到的响应体超过上限会被截断，必须说出来 —— 否则用户以为拿到的是完整响应
			const cut = m.truncated ? ' · 响应体过大已截断' : '';
			return `${base} · TTFB ${m.ttfbMs}ms · ${formatSpeed(m.speedBps)}${cut}`;
		}
		return '等待发送';
	}

	// ---------------------------------------------------------------- 表单与参数表操作

	/** URL 输入框的回调：改 URL 的同时把查询参数重新解析成行 */
	setUrl(url: string): void {
		this.url = url;
		this.params = parseParams(url).map((row) => ({ id: ++this.#paramSeq, enabled: true, ...row }));
	}

	addParam(): void {
		this.params = [...this.params, { id: ++this.#paramSeq, enabled: true, name: '', value: '' }];
	}

	/** 改一行参数（键 / 值 / 是否启用），改完把整张表写回 URL */
	updateParam(id: number, patch: Partial<Omit<KeyValueRow, 'id'>>): void {
		this.params = this.params.map((row) => (row.id === id ? { ...row, ...patch } : row));
		this.url = applyParams(this.url, this.params);
	}

	removeParam(id: number): void {
		this.params = this.params.filter((row) => row.id !== id);
		this.url = applyParams(this.url, this.params);
	}

	addFormRow(): void {
		this.formRows = [...this.formRows, { id: ++this.#formSeq, enabled: true, name: '', value: '' }];
	}

	/** 表单行不参与 URL，改完就完事 */
	updateFormRow(id: number, patch: Partial<Omit<KeyValueRow, 'id'>>): void {
		this.formRows = this.formRows.map((row) => (row.id === id ? { ...row, ...patch } : row));
	}

	removeFormRow(id: number): void {
		this.formRows = this.formRows.filter((row) => row.id !== id);
	}

	setAuth(patch: Partial<AuthConfig>): void {
		this.auth = { ...this.auth, ...patch };
	}

	setMethod(method: HttpMethod): void {
		if (this.method === method) return;
		this.method = method;
		// 切到 GET/HEAD 后 body 不再发送，顺手清掉避免误解
		if (!this.isBodyAllowed && this.body !== '') this.body = '';
	}

	setTimeoutMs(value: string): void {
		this.timeoutMs = Number(value);
	}

	/** 跨域凭证：下拉的 value 是字符串，这里收窄成联合类型 */
	setCredentials(value: string): void {
		if (value === 'omit' || value === 'same-origin' || value === 'include') this.credentials = value;
	}

	/**
	 * 把一份「填好的表单」写进请求表单。**预设回填与示例填入共用这一段** —— 两者结构相同
	 * （见 `core/types.ts` 的 `FormSnapshot`），只差身份字段与「缺省怎么办」。
	 *
	 * 可选字段的语义是「没给就不动」：`timeoutMs` / `auth` 缺省时保留当前值（示例里没写认证的那几条
	 * 不该顺手清掉用户的 token），`params` 缺省时回落到从 URL 解析。
	 * `resetAuth` 是给预设的：预设存的就是整条请求，没带认证即「无认证」。
	 */
	#applySnapshot(snapshot: FormSnapshot, { resetAuth = false }: { resetAuth?: boolean } = {}): void {
		this.method = snapshot.method;
		this.url = snapshot.url;
		this.headersText = snapshot.headersText;
		this.body = snapshot.body;
		this.contentType = snapshot.contentType;
		if (snapshot.timeoutMs !== undefined) this.timeoutMs = snapshot.timeoutMs;
		// 凭证模式：示例不带这一项（不该顺手改掉用户的跨域设置），预设存的是整条请求所以总带着
		if (snapshot.credentials !== undefined) this.credentials = snapshot.credentials;
		// 参数行与 URL 互为镜像：快照带着行就用它（旧预设没有这一项），否则从 URL 解析
		this.params = (snapshot.params ?? parseParams(snapshot.url)).map((row) => ({
			id: ++this.#paramSeq,
			// 快照带来的行可能有 `enabled`（旧预设没有这一项），`parseParams` 出来的行没有这个字段 ——
			// 两种都按「启用」兜底。用 `in` 收窄：直接在联合类型上读 `row.enabled` 是类型错误
			enabled: 'enabled' in row ? row.enabled !== false : true,
			name: row.name,
			value: row.value
		}));
		// 表单类型的正文拆进键值表：否则看到的是一串 `a=1&b=2` 而表单表是空的（与导入同一口径）
		this.formRows = formRowsToRows(
			snapshot.contentType === 'application/x-www-form-urlencoded' ? snapshot.body : ''
		).map((row) => ({ id: ++this.#formSeq, enabled: true, ...row }));
		if (snapshot.auth !== undefined) this.auth = { ...emptyAuth(), ...snapshot.auth };
		else if (resetAuth) this.auth = emptyAuth();
		this.response = null;
		this.error = null;
		this.tab = 'request';
	}

	/**
	 * 填入一条请求示例（请求条的「示例」菜单）。数据在根层 `config.ts` 的 `REQUEST_EXAMPLES`。
	 *
	 * 示例带了 `panelTab` 就把请求构造面板翻到那一页并展开 —— 示例的用处就是演示某一项能力，
	 * 填完却把它藏在收起的面板里，等于没演示。
	 */
	applyExample(id: string): void {
		const example = REQUEST_EXAMPLES.find((item) => item.id === id);
		if (example === undefined) return;
		this.#applySnapshot(example);
		if (example.panelTab !== undefined) {
			this.requestTab = example.panelTab;
			this.requestCollapsed = false;
		}
		toast.show(`已填入示例：${example.label}`);
	}

	/**
	 * 清空请求表单。**认证刻意不清** —— token / 密码是「身份」，不是这次请求的内容，
	 * 清空表单却顺手把登录态清掉更烦人；要清就去「授权」标签里改。文案里说一声免得用户以为没清干净。
	 */
	clearForm(): void {
		if (this.url === '' && this.body === '' && this.headersText === '') return;
		this.setUrl('');
		this.body = '';
		this.headersText = '';
		this.contentType = 'none';
		this.formRows = [];
		this.response = null;
		this.error = null;
		toast.show('已清空（认证信息保留）');
	}

	// ---------------------------------------------------------------- 请求头

	/**
	 * 用本机浏览器的请求头**覆盖**输入框全部内容（请求头标签右上角的「本机」按钮）。
	 *
	 * 覆盖前的确认弹窗留在 ui 那一层 —— 这边只管换文本，于是它能在 node 里直接单测。
	 * 拼出来的那份是「本机浏览器会带上的头」的底稿，不是抓包结果（理由见 core/local-headers.ts 文件头）。
	 */
	fillLocalHeaders(): void {
		this.headersText = formatLocalHeaders(readBrowserHeaders());
		toast.show('已填入本机请求头');
	}

	/** 清空请求头输入框（「清空」按钮）：清空后占位提示回来，发送时一个手写头都不带 */
	clearHeaders(): void {
		this.headersText = '';
		toast.show('已清空请求头');
	}

	// ---------------------------------------------------------------- 导入 / 导出

	/** 当前导出格式下的请求文本（cURL / PowerShell / fetch），随表单实时重算 */
	get exportText(): string {
		return buildRequestText(this.toCurlForm(), this.exportFormat);
	}

	/**
	 * 解析出来的表单写回请求表单并切到调试标签。
	 *
	 * **认证不覆盖**：粘贴进来的文本里带了 Authorization 头就照放进请求头（手写的优先于注入），
	 * 但不去动用户在「授权」标签里配的东西 —— 那是身份，不该被一次粘贴冲掉。
	 */
	applyParsedForm(form: CurlForm): void {
		this.method = form.method;
		this.setUrl(form.url);
		this.headersText = formatHeadersText(form.headers);
		this.body = form.body;
		this.contentType = form.contentType;
		// 表单类型的正文拆进键值表：否则用户看到的是一串 `a=1&b=2`，而表单表是空的
		this.formRows = formRowsToRows(form.contentType === 'application/x-www-form-urlencoded' ? form.body : '').map(
			(row) => ({ id: ++this.#formSeq, enabled: true, ...row })
		);
		this.response = null;
		this.error = null;
		this.tab = 'request';
	}

	/**
	 * 从剪贴板一键导入（请求条上 URL 框右端那个图标按钮）。
	 *
	 * 顺序是「先当请求文本认，认不出再当裸 URL」：
	 *   ① cURL / PowerShell / fetch → `applyParsedForm` 填整套表单并切回调试标签；
	 *   ② 认不出格式时，如果它就是一条裸链接，只填 URL —— 剪贴板里最常见的就是一条链接，
	 *      为它弹「认不出格式」没道理（URL 框本来就允许省略协议，宽容口径一致）；方法 / 请求头 / 请求体
	 *      一律不动，那是当前表单里别的东西，不该被一条链接冲掉；
	 *   ③ 两条都不成立才报错，文案直接用解析器给的那句（它已经写清了支持什么）。
	 *
	 * 读剪贴板失败单独一条提示：那不是「剪贴板是空的」，用户需要知道可以手动粘。
	 */
	async pasteFromClipboard(): Promise<void> {
		const text = await readText();
		if (text === null) {
			toast.show('读不到剪贴板：浏览器可能未授权或当前不是安全上下文，可手动按 Ctrl / Cmd + V 粘贴', true);
			return;
		}
		const trimmed = text.trim();
		if (trimmed === '') {
			toast.show('剪贴板里没有文本', true);
			return;
		}

		const parsed = parseRequestText(trimmed);
		if (parsed.ok) {
			this.applyParsedForm(parsed.form);
			toast.show(`已从剪贴板粘贴 ${formatLabel(parsed.format)} 并填入请求表单`);
			return;
		}

		// 裸 URL 的判据：一行、无空白、全是可打印 ASCII，且能被 URL 解析。
		// 前两条不能省 —— `URL.canParse` 连中文域名都收，只靠它会把一整段中文说明文字
		// 套上 `https://` 塞进 URL 框。
		if (/^[\x21-\x7e]+$/.test(trimmed) && normalizeUrl(trimmed) !== null) {
			this.setUrl(trimmed);
			toast.show('已从剪贴板填入 URL');
			return;
		}

		toast.show(`粘贴失败：${parsed.error}`, true);
	}

	// ---------------------------------------------------------------- 参数预设

	/** 把当前表单存成一条预设；名称与 URL 缺一不可 */
	savePreset(): void {
		const name = this.presetName.trim();
		if (name === '') {
			toast.show('请先填写预设名称', true);
			return;
		}
		if (this.url.trim() === '') {
			toast.show('URL 为空，没有可保存的参数', true);
			return;
		}
		this.presets = [
			...this.presets,
			{
				id: ++this.#presetSeq,
				name,
				method: this.method,
				url: this.url.trim(),
				headersText: this.headersText,
				body: this.body,
				contentType: this.contentType,
				timeoutMs: this.timeoutMs,
				// 参数行与认证一起存：不存的话预设回填出来是「另一条请求」
				params: this.params.map((row) => ({ ...row })),
				auth: { ...this.auth },
				credentials: this.credentials
			}
		];
		this.presetName = '';
		toast.show(`已保存参数预设「${name}」`);
	}

	deletePreset(id: number): void {
		this.presets = this.presets.filter((p) => p.id !== id);
		toast.show('已删除预设');
	}

	/** 把预设回填进表单并切到调试标签 */
	applyPreset(id: number): void {
		const preset = this.presets.find((p) => p.id === id);
		if (!preset) return;
		// 与示例回填共用同一段；差别只在语义：预设没带认证就按「无认证」处理
		this.#applySnapshot(preset, { resetAuth: true });
		toast.show(`已应用预设「${preset.name}」`);
	}

	/** 预设导出文本（JSON），供下载 */
	get presetsText(): string {
		return serializePresets(this.presets);
	}

	/** 导入预设文本：校验通过则合并进列表，失败用 toast 告知原因 */
	importPresetsText(text: string): void {
		const parsed = parsePresets(text);
		if (!parsed.ok) {
			toast.show(`导入失败：${parsed.error}`, true);
			return;
		}
		this.presets = [...this.presets, ...parsed.presets.map((p) => ({ ...p, id: ++this.#presetSeq }))];
		toast.show(`已导入 ${parsed.presets.length} 条预设`);
	}

	/** 从 localStorage 恢复预设（+page.svelte 在挂载时调用）；id 重新分配 */
	restorePresets(presets: HttpPreset[]): void {
		this.presets = presets.map((p) => ({ ...p, id: ++this.#presetSeq }));
	}

	// ---------------------------------------------------------------- 发送 / 取消

	async send(): Promise<void> {
		if (!this.canSend) return;
		const target = normalizeUrl(this.effectiveUrl);
		if (target === null) {
			this.error = { kind: 'invalid-url', message: 'URL 无法解析，请检查格式（可省略 https://）' };
			this.phase = 'done';
			return;
		}

		const controller = new AbortController();
		this.#abort = controller;
		this.#userCancelled = false;
		// 中断计时器与发给代发的 payload 用同一个「实际生效」的值，否则两侧断在不同时刻
		const timeoutMs = this.effectiveTimeoutMs;
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const started = performance.now();

		this.phase = 'sending';
		this.response = null;
		this.error = null;
		this.focusedStatus = null;
		this.bodyUncapped = false;
		try {
			if (this.serverMode) {
				await this.#sendViaServer(target, started, controller.signal);
			} else {
				await this.#sendDirect(target, started, controller.signal);
			}
		} catch (cause) {
			if (cause instanceof ProxyServerError) {
				// 代理返回的业务失败（拦截 / 超时 / 目标不可达），message 直接展示
				this.error = { kind: 'network', message: cause.message };
			} else {
				const name = cause instanceof Error ? cause.name : '';
				if (name === 'AbortError') {
					// 代发把所选档位夹短了就说清原因 —— 否则「我设了 60 秒，怎么 10 秒就断了」
					const capped =
						this.serverMode && timeoutMs < this.timeoutMs ? `（服务器代发上限 ${timeoutMs / 1000} 秒）` : '';
					this.error = {
						kind: this.#userCancelled ? 'abort' : 'timeout',
						message: this.#userCancelled ? '已取消请求' : `请求超过 ${timeoutMs / 1000} 秒未响应，已自动中断${capped}`
					};
				} else {
					this.error = {
						kind: 'network',
						message: this.serverMode
							? '服务器代发失败（网络异常），请检查网络后重试，或改用浏览器直发。'
							: '目标不可达或未开启 CORS：浏览器拦截了跨域响应。这不代表请求没发出去 —— 不需要预检的请求（如 text/plain 的 POST）仍会在服务端执行，写操作请自行确认。把执行搬出浏览器就能读到响应，见下方两条路。'
					};
				}
			}
		} finally {
			clearTimeout(timer);
			this.#abort = null;
			this.#userCancelled = false;
			this.phase = 'done';
		}
	}

	/** 浏览器直发：fetch 目标 URL，受 CORS 限制 */
	async #sendDirect(target: string, started: number, signal: AbortSignal): Promise<void> {
		const headerRecord: Record<string, string> = {};
		for (const header of resolveHeaders(this.toCurlForm())) headerRecord[header.name] = header.value;
		const res = await this.fetchImpl(target, {
			method: this.method,
			headers: headerRecord,
			body: this.isBodyAllowed && this.effectiveBody !== '' ? this.effectiveBody : undefined,
			credentials: this.credentials,
			signal
		});
		const text = await res.text();
		const headers: ResponseHeader[] = [];
		res.headers.forEach((value, name) => headers.push({ name, value }));
		this.response = {
			status: res.status,
			statusText: res.statusText,
			ok: res.ok,
			headers,
			body: text,
			bodyBytes: byteLength(text),
			durationMs: Math.round(performance.now() - started),
			serverMetrics: null
		};
		this.focusedStatus = res.status;
	}

	/** 服务器代发：POST /http/proxy，解析信封（响应 + 测速指标）；业务失败抛 ProxyServerError */
	async #sendViaServer(target: string, started: number, signal: AbortSignal): Promise<void> {
		const payload: ProxyRequestPayload = {
			url: target,
			method: this.method,
			headers: resolveHeaders(this.toCurlForm()),
			body: this.isBodyAllowed ? this.effectiveBody : '',
			// 夹过的值：服务端还会再夹一次，但前端不该主动发一个自己明知会被改小的数字
			timeoutMs: this.effectiveTimeoutMs
		};
		const res = await this.fetchImpl(PROXY_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
			signal
		});
		const envelope = (await res.json()) as ProxyResponse;
		if (!envelope.ok) throw new ProxyServerError(envelope.message);
		this.response = {
			status: envelope.status,
			statusText: envelope.statusText,
			ok: envelope.status >= 200 && envelope.status < 300,
			headers: envelope.headers,
			body: decodeBase64Utf8(envelope.bodyBase64),
			bodyBytes: envelope.metrics.bytes,
			durationMs: Math.round(performance.now() - started),
			serverMetrics: envelope.metrics
		};
		this.focusedStatus = envelope.status;
	}

	cancel(): void {
		if (this.phase !== 'sending') return;
		this.#userCancelled = true;
		this.#abort?.abort();
	}

	// ---------------------------------------------------------------- 复制

	async copyCurl(): Promise<void> {
		if (this.url.trim() === '') {
			toast.show('请先填写 URL', true);
			return;
		}
		await copyToClipboard(this.curlText, { ok: '已复制 cURL 命令', fail: '复制失败，请手动选中 cURL 文本复制' });
	}

	/** 复制当前导出格式的请求文本（「导入 / 导出」标签里的复制按钮） */
	async copyExportText(): Promise<void> {
		if (this.url.trim() === '') {
			toast.show('请先填写 URL', true);
			return;
		}
		await copyToClipboard(this.exportText, {
			ok: `已复制 ${formatLabel(this.exportFormat)}`,
			fail: '复制失败，请手动选中文本复制'
		});
	}

	/**
	 * 按指定格式复制当前请求 —— 响应面板的「复制为」菜单用它，
	 * **不动**「导入 / 导出」标签里选中的那个导出格式（那是那边的视图状态，不该被这里改掉）。
	 */
	async copyRequestAs(format: RequestTextFormat): Promise<void> {
		if (this.url.trim() === '') {
			toast.show('请先填写 URL', true);
			return;
		}
		await copyToClipboard(buildRequestText(this.toCurlForm(), format), {
			ok: `已复制 ${formatLabel(format)}`,
			fail: '复制失败，请手动选中文本复制'
		});
	}

	/** 复制响应头，每行一条「名称: 值」（格式与请求头输入框一致，可直接粘过去） */
	async copyResponseHeaders(): Promise<void> {
		const headers = this.response?.headers ?? [];
		if (headers.length === 0) {
			toast.show('还没有响应头可复制', true);
			return;
		}
		await copyToClipboard(formatHeadersText(headers), {
			ok: `已复制 ${headers.length} 条响应头`,
			fail: '复制失败，请手动选中响应头复制'
		});
	}

	async copyResponse(): Promise<void> {
		const body = this.response?.body ?? '';
		if (body === '') {
			toast.show('响应体为空，没有可复制的内容', true);
			return;
		}
		await copyToClipboard(body, { ok: '已复制响应体', fail: '复制失败，请手动选中响应内容复制' });
	}

	/**
	 * 把响应体存成文件。**存的是完整响应体**，与屏幕上截到哪儿无关 ——
	 * 渲染上限只管显示，不该顺手把数据也削一刀。
	 */
	saveResponse(): void {
		const res = this.response;
		if (res === null || res.body === '') {
			toast.show('响应体为空，没有可保存的内容', true);
			return;
		}
		const name = responseFileName(contentTypeOf(res.headers), res.status);
		downloadText(name, res.body, `${contentTypeOf(res.headers) || 'text/plain'};charset=utf-8`);
		toast.show(`已保存为 ${name}`);
	}

	async copyCode(): Promise<void> {
		if (this.url.trim() === '') {
			toast.show('请先填写 URL 再生成代码', true);
			return;
		}
		await copyToClipboard(this.code, {
			ok: `已复制 ${langLabel(this.codeLang)} 请求代码`,
			fail: '复制失败，请手动选中代码文本复制'
		});
	}
}

export const httpStore = new HttpStore();
