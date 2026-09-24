// nginx → .htaccess 的语义映射（纯函数，不依赖 DOM）。模块名里的 `-nginx` 指**输入格式**。
//
// 口径与正向的 convert-htaccess.ts 完全一致：逐条对应、不静默丢东西、拿不准就降级成「需人工确认」。
// 但反向有两处**结构性**的不对称，都会写进输出顶部，也写进工具 README：
//   ① nginx 的 rewrite 模式匹配「完整 URI」（带前导斜杠），.htaccess 的模式匹配「当前目录的相对路径」——
//      所以这里会去掉前导斜杠，并假设结果放在**文档根目录**（否则要自己补 RewriteBase）；
//   ② nginx 的 location / map / try_files / proxy_pass 在 .htaccess 里根本没有对应写法，
//      统一降级成「⚠️ 需人工确认 / 未支持」+ 就地注释，绝不硬拼一条「看着对、其实改了语义」的配置。
import { parseNginx } from './parse-nginx.ts';
import {
	DEFAULT_INDENT,
	INDENT_UNIT,
	type ConversionResult,
	type ConversionWarning,
	type IndentStyle,
	type NginxDirective,
	type WarningLevel
} from './types.ts';

/** 顶部那段说明的前缀（单测用它把正文摘出来，正文里的注释不会以这些开头） */
export const NGINX_HEADER_PREFIXES = ['# 由 nginx 配置转换而来', '# 请把结果放进', '# 本次共 ', '# 注意：'];

/**
 * nginx 变量 → Apache 变量（正向 VAR_MAP 的反查表）；HTTP_* 走下面的通用规则，不必逐个列。
 * **导出**是给参数速查表用的：速查表的变量组从这张表派生，与 `VAR_MAP` 同理（见 `core/cheatsheet.ts` 口径③）。
 */
export const REVERSE_VARS: Record<string, string> = {
	host: '%{HTTP_HOST}',
	server_name: '%{SERVER_NAME}',
	server_port: '%{SERVER_PORT}',
	server_protocol: '%{SERVER_PROTOCOL}',
	request_method: '%{REQUEST_METHOD}',
	request_uri: '%{REQUEST_URI}',
	request_filename: '%{REQUEST_FILENAME}',
	query_string: '%{QUERY_STRING}',
	args: '%{QUERY_STRING}',
	remote_addr: '%{REMOTE_ADDR}',
	remote_port: '%{REMOTE_PORT}',
	document_root: '%{DOCUMENT_ROOT}',
	https: '%{HTTPS}',
	scheme: '%{REQUEST_SCHEME}',
	request: '%{THE_REQUEST}'
};

/** Apache 的 RewriteCond 支持的文件 / 目录测试（`-e` 不在其中，只能降级） */
const APACHE_FILE_TESTS = ['-f', '-d', '-x', '-s', '-l'];

/** 一条 `if` 块：条件已转成的 RewriteCond 行；null = 这条 if 表达不出来 */
interface IfFrame {
	conds: string[] | null;
}

interface Ctx {
	lines: string[];
	warnings: ConversionWarning[];
	/** 缩进单元 */
	indent: string;
	/** 当前块层级（只有 <FilesMatch> 这类产出了标签的块才加深度） */
	depth: number;
	/** 每层容器开标签的闭合标签；null = 平铺展开的块（server / location / if…），不带标签 */
	blocks: Array<'if' | '</FilesMatch>' | null>;
	/** 当前所在的 if 块（Apache 侧不支持嵌套，深度 > 1 时降级） */
	ifStack: IfFrame[];
	/** 处在 <FilesMatch> 里：RewriteRule 不允许写在这个上下文 */
	inFilesMatch: number;
	/** add_header → Header set 的语义差只提一次 */
	notedHeader: boolean;
	/** Deny / Allow 的 Order 语义差只提一次 */
	notedOrder: boolean;
	/** gzip_types 只提一次「记得开 mod_deflate」 */
	notedGzip: boolean;
	/** 「结果要放在文档根目录」只提一次 */
	notedRoot: boolean;
	/** 「RewriteRule 需要 mod_rewrite」只提一次 */
	notedModule: boolean;
	/** 指令落在 if 里、条件又搬不出来时置上：产出的行全部先注释掉 */
	muted: boolean;
	converted: number;
}

/** 入口：吃 nginx 配置原文，吐 .htaccess + 提示 */
export function convertNginx(source: string, indent: IndentStyle = DEFAULT_INDENT): ConversionResult {
	const ctx: Ctx = {
		lines: [],
		warnings: [],
		indent: INDENT_UNIT[indent],
		depth: 0,
		blocks: [],
		ifStack: [],
		inFilesMatch: 0,
		notedHeader: false,
		notedOrder: false,
		notedGzip: false,
		notedRoot: false,
		notedModule: false,
		muted: false,
		converted: 0
	};

	for (const directive of parseNginx(source)) {
		if (directive.kind === 'comment') {
			push(ctx, `# ${directive.text}`);
			continue;
		}
		if (directive.kind === 'open') {
			openContainer(ctx, directive);
			continue;
		}
		if (directive.kind === 'close') {
			closeContainer(ctx);
			continue;
		}
		convertDirective(ctx, directive);
	}

	return { text: assemble(ctx), converted: ctx.converted, warnings: ctx.warnings };
}

// ------------------------------------------------------------------ 输出骨架

function pad(ctx: Ctx): string {
	return ctx.indent.repeat(ctx.depth);
}

function push(ctx: Ctx, text: string): void {
	// muted：整条指令搬不出来时压成注释（本身已经是注释的行不再叠一层 `#`）
	ctx.lines.push(pad(ctx) + (ctx.muted && !text.startsWith('#') ? `# ${text}` : text));
}

/** 记一条警告，并把「哪一行、为什么、怎么办」就地写成注释（顺序与源文件一致，便于逐行核对） */
function report(ctx: Ctx, directive: NginxDirective, level: WarningLevel, reason: string, extra: string[] = []): void {
	ctx.warnings.push({ line: directive.line, source: directive.text, level, reason });
	push(ctx, `# ⚠️ ${level === 'unsupported' ? '未支持' : '需人工确认'}：${directive.text}`);
	push(ctx, `#    ${reason}`);
	for (const line of extra) push(ctx, line);
}

function assemble(ctx: Ctx): string {
	if (ctx.lines.length === 0) return '';

	const manual = ctx.warnings.filter((warning) => warning.level === 'manual').length;
	const unsupported = ctx.warnings.length - manual;
	const header = [
		'# 由 nginx 配置转换而来 · www.toolv.cn/htaccess-to-nginx',
		'# 请把结果放进 .htaccess；标 ⚠️ 的位置需要人工确认'
	];

	if (ctx.warnings.length > 0) {
		header.push(`# 本次共 ${ctx.warnings.length} 处提示：需人工确认 ${manual} 处、未支持 ${unsupported} 处`);
	}
	if (ctx.notedRoot) {
		header.push(
			'# 注意：nginx 的 rewrite 模式匹配完整 URI（带前导斜杠），.htaccess 的模式匹配「当前目录的相对路径」——这里已去掉前导斜杠，请把本文件放在文档根目录，或自己补一条 RewriteBase'
		);
	}
	if (ctx.notedModule) {
		header.push('# 注意：RewriteRule 属于 mod_rewrite，建议外面包一层 <IfModule mod_rewrite.c> 再贴进 .htaccess');
	}

	return `${[...header, ...ctx.lines].join('\n')}\n`;
}

// ------------------------------------------------------------------ 容器

function openContainer(ctx: Ctx, directive: NginxDirective): void {
	const name = directive.name.toLowerCase();

	switch (name) {
		case 'server':
		case 'http': {
			// 外壳：server / http 里的指令本来就是给这个站点用的，展开即可
			push(ctx, `# ↓ ${name} { } 是 nginx 的外壳，.htaccess 里没有对应写法，内容已展开`);
			ctx.blocks.push(null);
			return;
		}
		case 'location': {
			const line = locationOpenLine(ctx, directive);
			if (line === null) {
				ctx.blocks.push(null);
				return;
			}
			push(ctx, line);
			ctx.depth += 1;
			ctx.blocks.push('</FilesMatch>');
			ctx.inFilesMatch += 1;
			return;
		}
		case 'if': {
			pushIfFrame(ctx, directive);
			ctx.blocks.push('if');
			return;
		}
		case 'map':
			report(
				ctx,
				directive,
				'manual',
				'nginx 的 map 要换成 Apache 的 RewriteMap，而 RewriteMap 不能写在 .htaccess 里 —— 请提到 httpd.conf / VirtualHost，或把映射摊成多条 RewriteRule'
			);
			ctx.blocks.push(null);
			return;
		default:
			report(
				ctx,
				directive,
				'unsupported',
				`nginx 的 ${name} 块在 .htaccess 里没有对应写法，里面的内容已平铺展开，请自行归位`
			);
			ctx.blocks.push(null);
			return;
	}
}

/** `<FilesMatch>` 开标签；返回 null 表示这个 location 只能平铺展开（提示已就地给出） */
function locationOpenLine(ctx: Ctx, directive: NginxDirective): string | null {
	const [first = '', ...rest] = directive.args;
	const value = rest.join(' ').trim();

	if ((first === '~' || first === '~*') && value !== '') {
		if (!value.includes('/')) {
			// 只按「文件名」匹配的写法能落到 <FilesMatch>（Apache 的 <FilesMatch> 只匹配文件名）
			return `<FilesMatch ${alwaysQuote(first === '~*' ? `(?i)${value}` : value)}>`;
		}
		report(
			ctx,
			directive,
			'manual',
			'nginx 的 location 正则匹配的是完整 URI（含路径），Apache 的 <FilesMatch> 只匹配文件名 —— 两者对不上，里面的指令已平铺到顶层，请自行归位'
		);
		return null;
	}

	if (first === '/' || first === '') {
		push(ctx, '# ↓ location / 是 nginx 的兜底块，.htaccess 本来就作用在目录根上，内容已展开');
		return null;
	}

	if (first.startsWith('@')) {
		report(
			ctx,
			directive,
			'manual',
			'nginx 的具名 location（@名字）用于内部跳转，Apache 里没有对应写法，里面的指令已平铺到顶层'
		);
		return null;
	}

	if (first === '=') {
		report(
			ctx,
			directive,
			'manual',
			`nginx 的 location = ${value} 是「精确匹配这一个 URI」，.htaccess 里没有等价容器（<Directory> / <Location> 不允许写在 .htaccess），请改用 <Files> 或按路径改写`
		);
		return null;
	}

	report(
		ctx,
		directive,
		'manual',
		`nginx 的前缀 location ${[first, ...rest].join(' ')} 在 .htaccess 里没有对应容器（<Directory> / <Location> 不允许写在 .htaccess），里面的指令已平铺到顶层，作用范围会比原来大，请自行核对`
	);
	return null;
}

/** 解析 if 条件 → 记下这一帧（条件表达不出来时进 null 帧，里面的规则会被整条注释掉） */
function pushIfFrame(ctx: Ctx, directive: NginxDirective): void {
	const frame: IfFrame = { conds: null };

	if (ctx.ifStack.length > 0) {
		report(
			ctx,
			directive,
			'manual',
			'nginx 的 if 可以嵌套，Apache 的 RewriteCond 不能 —— 这一层条件无法带上，里面的规则已按「无条件」处理，请自行核对'
		);
		ctx.ifStack.push(frame);
		return;
	}
	if (ctx.inFilesMatch > 0) {
		report(ctx, directive, 'manual', 'RewriteCond 不能写在 <FilesMatch> 里，这条 if 的条件已被丢掉');
		ctx.ifStack.push(frame);
		return;
	}

	const condition = stripParens(directive.condition ?? '');
	if (condition === '') {
		report(ctx, directive, 'manual', '没看出 if 的条件，请核对写法（if (条件) { … }）');
		ctx.ifStack.push(frame);
		return;
	}

	const parsed = toRewriteConds(condition);
	if (!parsed.ok) {
		report(ctx, directive, 'manual', parsed.reason);
		ctx.ifStack.push(frame);
		return;
	}
	for (const note of parsed.notes) report(ctx, directive, 'manual', note);
	frame.conds = parsed.lines;
	ctx.ifStack.push(frame);
}

function closeContainer(ctx: Ctx): void {
	const block = ctx.blocks.pop();
	if (block === 'if') {
		ctx.ifStack.pop();
		return;
	}
	if (block === '</FilesMatch>') {
		ctx.inFilesMatch = Math.max(0, ctx.inFilesMatch - 1);
		ctx.depth = Math.max(0, ctx.depth - 1);
		push(ctx, '</FilesMatch>');
	}
	// null：平铺展开的容器，没有闭合标签
}

// ------------------------------------------------------------------ 指令分发

/**
 * 会把所在 if 的条件转成 RewriteCond 的指令（见 emitRule）。
 * 其余指令落在 if 里时条件无处可放，只能整条注释保留 —— 无条件搬出来会悄悄放大作用范围。
 * `try_files` 不在此列：它给的是一段模板、不走 emitRule，带上条件反而更误导。
 */
const CONDITION_AWARE = ['rewrite', 'return'];

function convertDirective(ctx: Ctx, directive: NginxDirective): void {
	const name = directive.name.toLowerCase();

	if (ctx.ifStack.length > 0 && !CONDITION_AWARE.includes(name)) {
		report(
			ctx,
			directive,
			'manual',
			`这条 ${name} 写在 nginx 的 if 块里：Apache 侧的条件只能加在 RewriteRule 上，无条件搬出来会放大作用范围，已整体注释保留`
		);
		// 注释掉的指令不算「转过去了」；「只提一次」的标记也回滚，留给真正生效的那一条
		const before = {
			converted: ctx.converted,
			notedHeader: ctx.notedHeader,
			notedOrder: ctx.notedOrder,
			notedGzip: ctx.notedGzip
		};
		ctx.muted = true;
		runDirective(ctx, directive);
		ctx.muted = false;
		ctx.converted = before.converted;
		ctx.notedHeader = before.notedHeader;
		ctx.notedOrder = before.notedOrder;
		ctx.notedGzip = before.notedGzip;
		return;
	}

	runDirective(ctx, directive);
}

/** 真正的派发；if 上下文那层拦截在 `convertDirective` 里 */
function runDirective(ctx: Ctx, directive: NginxDirective): void {
	switch (directive.name.toLowerCase()) {
		case 'rewrite':
			return convertRewrite(ctx, directive);
		case 'return':
			return convertReturn(ctx, directive);
		case 'try_files':
			return convertTryFiles(ctx, directive);
		case 'add_header':
			return convertAddHeader(ctx, directive);
		case 'error_page':
			return convertErrorPage(ctx, directive);
		case 'autoindex':
			return convertAutoindex(ctx, directive);
		case 'index':
			return convertSimple(ctx, directive, (args) => [`DirectoryIndex ${args.join(' ')}`]);
		case 'charset':
			return convertCharset(ctx, directive);
		case 'server_tokens':
			return convertServerTokens(ctx, directive);
		case 'etag':
			return convertEtag(ctx, directive);
		case 'gzip_types':
			return convertGzipTypes(ctx, directive);
		case 'gzip':
			return convertGzip(ctx, directive);
		case 'set':
			return convertSet(ctx, directive);
		case 'deny':
		case 'allow':
			return convertAccess(ctx, directive);
		case 'auth_basic':
			return convertAuthBasic(ctx, directive);
		case 'auth_basic_user_file':
			return convertSimple(ctx, directive, (args) => [`AuthUserFile ${args[0] ?? ''}`]);
		case 'satisfy':
			return report(
				ctx,
				directive,
				'manual',
				'Apache 里对应 Satisfy any / Satisfy all，但它只在「访问控制 + 认证」同时存在时才有意义，请手工确认'
			);
		case 'expires':
			return report(
				ctx,
				directive,
				'manual',
				'Apache 用 mod_expires：ExpiresActive On 加 ExpiresByType / ExpiresDefault，要按类型分别写，请手工对应'
			);
		case 'root':
		case 'alias':
			return report(
				ctx,
				directive,
				'manual',
				`Apache 的 ${directive.name.toLowerCase() === 'root' ? 'DocumentRoot' : 'Alias'} 只能写在服务器配置里，.htaccess 改不了`
			);
		case 'listen':
		case 'server_name':
			return report(
				ctx,
				directive,
				'manual',
				`nginx 的 ${directive.name.toLowerCase()} 属于服务器层面，Apache 侧对应 <VirtualHost> / ServerName，.htaccess 里够不着`
			);
		case 'proxy_pass':
		case 'proxy_set_header':
		case 'proxy_redirect':
			return report(
				ctx,
				directive,
				'unsupported',
				'Apache 侧要开 mod_proxy 并在服务器配置里写 ProxyPass / ProxyPassReverse，.htaccess 里做不到'
			);
		case 'client_max_body_size':
			return report(
				ctx,
				directive,
				'manual',
				'Apache 侧用 LimitRequestBody（默认无上限）；上传大小多半还在 php.ini 的 upload_max_filesize / post_max_size 里'
			);
		case 'internal':
			return report(ctx, directive, 'manual', 'nginx 的 internal 是「只允许内部跳转」，Apache 里没有对应指令');
		default:
			return report(ctx, directive, 'unsupported', '这条指令未收录（或 .htaccess 里没有对应写法），请手工实现');
	}
}

/** 一条指令 ↔ 一行 .htaccess，参数原样拼进去的通用形态 */
function convertSimple(ctx: Ctx, directive: NginxDirective, build: (args: string[]) => string[]): void {
	for (const line of build(directive.args)) push(ctx, line);
	ctx.converted += 1;
}

// ------------------------------------------------------------------ Rewrite 家族

/** RewriteRule 与 RewriteCond 不能写在 <FilesMatch> 里（mod_rewrite 不支持这个上下文） */
function blockedByFilesMatch(ctx: Ctx, directive: NginxDirective): boolean {
	if (ctx.inFilesMatch === 0) return false;
	report(
		ctx,
		directive,
		'manual',
		'RewriteRule 与 RewriteCond 不能写在 <FilesMatch> 里（mod_rewrite 不支持这个上下文），请把这条规则移出该块'
	);
	return true;
}

/**
 * 产出一条 RewriteRule：先带上所在 if 的条件，必要时整条注释掉。
 * 与正向「拿不准就降级」同一条口径 —— 条件表达不出来时宁可留给人看一眼，也不生成一条改了语义的规则。
 */
function emitRule(ctx: Ctx, directive: NginxDirective, head: string, flags: string[] = [], notes: string[] = []): void {
	const frame = ctx.ifStack[ctx.ifStack.length - 1];
	let conds: string[] = [];
	let muteReason: string | null = null;
	if (ctx.ifStack.length > 1) {
		muteReason = '外层 if 的条件在 Apache 里表达不出来（RewriteCond 不能嵌套），这条规则已注释保留';
	} else if (frame !== undefined) {
		if (frame.conds === null) {
			muteReason = '这条规则所在的 if 条件表达不出来，已注释保留';
		} else {
			conds = frame.conds;
		}
	}

	if (muteReason !== null) report(ctx, directive, 'manual', muteReason);
	for (const note of notes) push(ctx, note);
	const text = flags.length > 0 ? `${head} [${flags.join(',')}]` : head;
	const emit = (line: string): void => push(ctx, muteReason !== null ? `# ${line}` : line);
	for (const cond of conds) emit(cond);
	emit(text);
	// 被注释掉的规则不算「转过去了」：状态栏里的数字要能对上输出里真正生效的行数
	if (muteReason === null) {
		ctx.converted += 1;
		ctx.notedModule = true;
	}
}

function convertRewrite(ctx: Ctx, directive: NginxDirective): void {
	if (blockedByFilesMatch(ctx, directive)) return;

	const [rawPattern, rawTarget, flag = ''] = directive.args;
	if (rawPattern === undefined || rawTarget === undefined) {
		report(ctx, directive, 'manual', 'rewrite 缺参数：需要「模式 + 替换目标」两个');
		return;
	}

	const flagName = flag.toLowerCase();
	let redirect: '301' | '302' | null = null;
	const problems: Array<{ level: WarningLevel; reason: string }> = [];

	if (flagName === 'redirect') {
		redirect = '302';
	} else if (flagName === 'permanent') {
		redirect = '301';
	} else if (flagName === 'break') {
		problems.push({
			level: 'manual',
			reason:
				'rewrite 的 break 只在本 location 内生效、不会重新匹配 location，Apache 的 [L] 会重新跑一遍 —— 语义有差，请核对'
		});
	} else if (flagName !== '' && flagName !== 'last') {
		report(
			ctx,
			directive,
			'manual',
			`rewrite 的标记 ${flag} 没收录（Apache 侧只有 last / break / redirect / permanent）`
		);
		return;
	}

	const pattern = toApachePattern(rawPattern);
	if (!pattern.ok) {
		report(ctx, directive, 'manual', pattern.reason);
		return;
	}
	const target = toApacheTarget(rawTarget, redirect !== null);
	if (!target.ok) {
		report(ctx, directive, 'manual', target.reason);
		return;
	}

	if (pattern.strippedRoot || target.strippedRoot) {
		ctx.notedRoot = true;
		if (pattern.loose === true) {
			problems.push({
				level: 'manual',
				reason:
					'nginx 的模式没写 ^ 时是对完整 URI 做「包含」匹配，Apache 的 RewriteRule 是对「不含前导斜杠的路径」匹配 —— 去掉前导斜杠后匹配范围可能变大，请核对'
			});
		}
	}
	if (redirect === null && target.absolute) {
		problems.push({
			level: 'manual',
			reason:
				'替换目标是个绝对地址却没带 redirect / permanent 标记：nginx 会把它当内部跳转，Apache 侧要 [R] 才是同样的行为'
		});
	}
	if (target.hasQuery) {
		problems.push({
			level: 'manual',
			reason: '替换目标里带 ?：Apache 的 RewriteRule 一旦指定查询串就不会自动带上原参数，需要保留请加 [QSA]'
		});
	}

	for (const problem of problems) report(ctx, directive, problem.level, problem.reason);

	const flags: string[] = [];
	if (pattern.ignoreCase) flags.push('NC');
	if (redirect !== null) flags.push(`R=${redirect}`);
	if (redirect !== null || flagName === 'last' || flagName === 'break') flags.push('L');
	emitRule(ctx, directive, `RewriteRule ${pattern.text} ${target.text}`, flags);
}

function convertReturn(ctx: Ctx, directive: NginxDirective): void {
	if (blockedByFilesMatch(ctx, directive)) return;

	const code = (directive.args[0] ?? '').trim();
	const target = directive.args.slice(1).join(' ').trim();
	if (!/^\d{3}$/.test(code)) {
		report(ctx, directive, 'manual', '没认出 return 的写法（需要「状态码 [+ 目标地址]」）');
		return;
	}
	const status = Number(code);

	if (status === 403 || status === 410) {
		// Apache 的 F / G 标记就是这两个
		emitRule(ctx, directive, 'RewriteRule ^ -', [status === 403 ? 'F' : 'G', 'L']);
		return;
	}
	if (status === 444) {
		report(
			ctx,
			directive,
			'manual',
			'444 是 nginx 专有的「不响应直接断开」，Apache 没有这个状态码，请改用 403 或 Deny from all'
		);
		return;
	}
	if (status < 300 || status >= 400) {
		report(
			ctx,
			directive,
			'manual',
			`Apache 里没有「直接返回 ${code}」的等价指令：错误页请用 ErrorDocument ${code} <页面>，或在 Apache 2.4 用 RewriteRule ^ - [R=${code},L]`
		);
		return;
	}
	if (target === '') {
		report(ctx, directive, 'manual', 'return 带 3xx 状态码却没有目标地址，请核对');
		return;
	}

	let pattern = '^';
	let substitution = target;
	const notes: string[] = [];
	if (/\$\{?request_uri\}?/.test(target)) {
		// nginx 的 $request_uri 是「完整路径 + 查询串」，Apache 侧拆成 $1 + 由 RewriteRule 自动附带查询串
		pattern = '^(.*)$';
		substitution = target.replace(/\$\{?request_uri\}?/g, '/$1');
		notes.push('# 目标里的 $request_uri 已拆成 Apache 的 /$1（原查询串会由 RewriteRule 自动带上）');
	}
	if (hasNginxVariable(substitution)) {
		report(
			ctx,
			directive,
			'manual',
			`return 的重定向目标里用了 nginx 变量（${substitution}），Apache 里没有对应写法，请手工改写`
		);
		return;
	}

	const flags = [`R=${status}`, 'L'];
	const problems: Array<{ level: WarningLevel; reason: string }> = [];
	if (status === 303 || status === 307 || status === 308) {
		problems.push({
			level: 'manual',
			reason: `nginx 的 return ${status} 与 Apache 的 [R=${status}] 在「是否保留请求方法 / 正文」上有差别，请核对`
		});
	}
	if (/\?/.test(substitution)) {
		problems.push({ level: 'manual', reason: '重定向目标里带 ?：原来的查询串不会被自动带上，需要保留请加 [QSA]' });
	}
	for (const problem of problems) report(ctx, directive, problem.level, problem.reason);

	emitRule(ctx, directive, `RewriteRule ${pattern} ${substitution}`, flags, notes);
}

function convertTryFiles(ctx: Ctx, directive: NginxDirective): void {
	if (blockedByFilesMatch(ctx, directive)) return;

	const args = [...directive.args];
	const fallback = args.pop() ?? '';
	const checks = args;

	if (fallback === '' || checks.length === 0) {
		report(ctx, directive, 'manual', '没认出 try_files 的写法（需要「候选… + 兜底」）');
		return;
	}
	if (!checks.every((check) => check === '$uri' || check === '$uri/')) {
		report(
			ctx,
			directive,
			'manual',
			`try_files 的候选里除了 $uri / $uri/ 还有别的（${checks.join(' ')}），Apache 侧要手工改写`
		);
		return;
	}
	if (fallback.startsWith('=')) {
		report(
			ctx,
			directive,
			'manual',
			`try_files 的兜底是 ${fallback}（直接返回状态码）：Apache 侧要用 ErrorDocument 或 RewriteRule ^ - [R=${fallback.slice(1)},L] 实现，请手工对应`
		);
		return;
	}
	if (fallback.startsWith('@')) {
		report(ctx, directive, 'manual', `try_files 的兜底是具名 location ${fallback}，Apache 里没有对应写法，请手工对应`);
		return;
	}

	// 兜底里的查询串交给 RewriteRule 自动带（目标不带 ? 时 Apache 会原样附上原参数）
	const target = fallback.split('?')[0].replace(/^\//, '');
	if (target === '' || hasNginxVariable(target)) {
		report(ctx, directive, 'manual', `try_files 的兜底（${fallback}）转不成 Apache 的替换目标，请手工改写`);
		return;
	}

	report(
		ctx,
		directive,
		'manual',
		`try_files 与 Apache 的「文件 / 目录测试」不是一一对应：这里按最常见的 $uri + $uri/ + 站内兜底给出模板（目标已去掉前导斜杠、查询串交给 RewriteRule 自动带上），请核对`
	);
	if (checks.includes('$uri')) push(ctx, 'RewriteCond %{REQUEST_FILENAME} !-f');
	if (checks.includes('$uri/')) push(ctx, 'RewriteCond %{REQUEST_FILENAME} !-d');
	push(ctx, `RewriteRule ^ ${target} [L]`);
	ctx.converted += 1;
	ctx.notedModule = true;
}

// ------------------------------------------------------------------ 其它指令

function convertAddHeader(ctx: Ctx, directive: NginxDirective): void {
	const args = [...directive.args];
	let always = false;
	if ((args[args.length - 1] ?? '').toLowerCase() === 'always') {
		always = true;
		args.pop();
	}
	const name = args.shift() ?? '';
	const value = args.join(' ');

	if (name === '') {
		report(ctx, directive, 'manual', 'add_header 缺响应头名');
		return;
	}
	if (hasNginxVariable(name) || hasNginxVariable(value)) {
		report(
			ctx,
			directive,
			'manual',
			`响应头里用了 nginx 变量（${hasNginxVariable(name) ? name : value}），Apache 的 Header 不能直接插变量，请手工改写`
		);
		return;
	}
	if (!always && !ctx.notedHeader) {
		ctx.notedHeader = true;
		push(ctx, '# 提示：nginx 的 add_header 是「追加」，Apache 的 Header set 是「替换」——同名头已在响应里时不会被顶掉');
	}
	push(ctx, `Header ${always ? 'always ' : ''}set ${name} ${quote(value)}`);
	ctx.converted += 1;
}

function convertErrorPage(ctx: Ctx, directive: NginxDirective): void {
	const args = [...directive.args];
	const target = args.pop() ?? '';

	if (target === '' || args.length === 0) {
		report(ctx, directive, 'manual', '没认出 error_page 的写法（需要「状态码… + 目标」）');
		return;
	}
	if (target.startsWith('@')) {
		report(
			ctx,
			directive,
			'manual',
			`error_page 的目标 ${target} 是具名 location（内部跳转），Apache 的 ErrorDocument 做不到，请手工对应`
		);
		return;
	}
	const codes = args;
	if (codes.some((code) => !/^\d{3}$/.test(code))) {
		report(
			ctx,
			directive,
			'manual',
			`没认出 error_page 的状态码：${args.join(' ')}（\`=200\` 这种「顺带改状态码」的写法 Apache 的 ErrorDocument 做不到，要人工处理）`
		);
		return;
	}
	for (const code of codes) push(ctx, `ErrorDocument ${code} ${target}`);
	ctx.converted += 1;
}

function convertAutoindex(ctx: Ctx, directive: NginxDirective): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'on') {
		push(ctx, 'Options +Indexes');
		ctx.converted += 1;
		return;
	}
	if (value === 'off') {
		push(ctx, 'Options -Indexes');
		ctx.converted += 1;
		return;
	}
	report(ctx, directive, 'manual', 'autoindex 只认 on / off');
}

function convertCharset(ctx: Ctx, directive: NginxDirective): void {
	const value = (directive.args[0] ?? '').trim();
	if (value === '') {
		report(ctx, directive, 'manual', 'charset 没带值');
		return;
	}
	push(ctx, `AddDefaultCharset ${value.toLowerCase() === 'off' ? 'Off' : value}`);
	ctx.converted += 1;
}

function convertServerTokens(ctx: Ctx, directive: NginxDirective): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'off') {
		push(ctx, 'ServerSignature Off');
		ctx.converted += 1;
		return;
	}
	if (value === 'on' || value === 'build') {
		push(ctx, 'ServerSignature On');
		ctx.converted += 1;
		return;
	}
	report(ctx, directive, 'manual', `server_tokens ${value} 没收录（nginx 里是 on / off / build）`);
}

function convertEtag(ctx: Ctx, directive: NginxDirective): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'off') {
		push(ctx, 'FileETag None');
		ctx.converted += 1;
		return;
	}
	if (value === 'on') {
		push(ctx, '# etag on：Apache 本来就发 ETag（FileETag MTime Size），无需设置');
		return;
	}
	report(ctx, directive, 'manual', `etag ${value} 没收录（只有 on / off）`);
}

function convertGzipTypes(ctx: Ctx, directive: NginxDirective): void {
	if (directive.args.length === 0) {
		report(ctx, directive, 'manual', 'gzip_types 没带 MIME 类型');
		return;
	}
	if (!ctx.notedGzip) {
		ctx.notedGzip = true;
		push(ctx, '# 提示：Apache 侧压缩要开 mod_deflate（SetOutputFilter DEFLATE），并确认 deflate_module 已加载');
	}
	push(ctx, `AddOutputFilterByType DEFLATE ${directive.args.join(' ')}`);
	ctx.converted += 1;
}

function convertGzip(ctx: Ctx, directive: NginxDirective): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'on') {
		push(ctx, '# gzip on：Apache 侧用 mod_deflate，在 .htaccess 里写 SetOutputFilter DEFLATE');
		return;
	}
	if (value === 'off') {
		push(ctx, '# gzip off：Apache 侧不加载 mod_deflate / 不写 SetOutputFilter 即可');
		return;
	}
	report(ctx, directive, 'manual', `gzip ${value} 是 nginx 的压缩参数，Apache 的 mod_deflate 没有同名开关，请手工对应`);
}

function convertSet(ctx: Ctx, directive: NginxDirective): void {
	const [name, ...rest] = directive.args;
	if (name === undefined || !name.startsWith('$')) {
		report(ctx, directive, 'manual', '没认出 set 的写法（需要「set $变量 值」）');
		return;
	}
	const value = rest.join(' ');
	if (hasNginxVariable(value)) {
		report(
			ctx,
			directive,
			'manual',
			`set 的值里用了 nginx 变量（${value}），Apache 的 SetEnv 不能直接插变量，请手工改写`
		);
		return;
	}
	report(
		ctx,
		directive,
		'manual',
		'nginx 的 set 变量在内部跳转后仍然有效，Apache 的 SetEnv 只是环境变量（少数指令读得到），请核对'
	);
	push(ctx, `SetEnv ${name.slice(1)} ${quote(value)}`);
	ctx.converted += 1;
}

function convertAccess(ctx: Ctx, directive: NginxDirective): void {
	const action = directive.name.toLowerCase() === 'deny' ? 'Deny' : 'Allow';
	const target = directive.args.join(' ');
	if (target === '') {
		report(ctx, directive, 'manual', `${directive.name} 没带来源参数`);
		return;
	}
	if (hasNginxVariable(target)) {
		report(
			ctx,
			directive,
			'manual',
			`来源里用了 nginx 变量（${target}），Apache 侧要用 SetEnvIf / <If> 改写，请手工处理`
		);
		return;
	}
	if (!ctx.notedOrder) {
		ctx.notedOrder = true;
		push(
			ctx,
			'# 提示：Apache 的 Deny / Allow 谁赢由 Order 决定，要先写一条 Order deny,allow 或 Order allow,deny（Apache 2.4 更推荐 Require，装 mod_access_compat 后这两条仍可用）'
		);
	}
	push(ctx, `${action} from ${target}`);
	ctx.converted += 1;
}

function convertAuthBasic(ctx: Ctx, directive: NginxDirective): void {
	const realm = directive.args[0] ?? '';
	if (realm.toLowerCase() === 'off') {
		report(
			ctx,
			directive,
			'manual',
			'auth_basic off 是关掉认证：Apache 侧就是不写 AuthType / AuthName / AuthUserFile，请手工核对'
		);
		return;
	}
	if (realm === '' || hasNginxVariable(realm)) {
		report(ctx, directive, 'manual', `auth_basic 的领域名（${realm}）转不成 Apache 的 AuthName，请手工改写`);
		return;
	}
	push(ctx, 'AuthType Basic');
	push(ctx, `AuthName ${quote(realm)}`);
	ctx.converted += 1;
}

// ------------------------------------------------------------------ 条件（if → RewriteCond）

type CondParse = { ok: true; lines: string[]; notes: string[] } | { ok: false; reason: string };
type CondResult = { ok: true; line: string; notes: string[] } | { ok: false; reason: string };

function toRewriteConds(expression: string): CondParse {
	if (hasBareParens(expression)) {
		return {
			ok: false,
			reason: 'if 的条件里带括号：Apache 的 RewriteCond 只能表达「相邻条件相与」与「相邻条件相或」，括号分组要自己拆开'
		};
	}

	const chunks = expression.split(/\s*(&&|\|\|)\s*/);
	const parts: string[] = [];
	const joins: string[] = [];
	for (let index = 0; index < chunks.length; index += 1) {
		if (index % 2 === 0) parts.push(chunks[index]);
		else joins.push(chunks[index]);
	}
	if (joins.includes('&&') && joins.includes('||')) {
		return {
			ok: false,
			reason: 'if 的条件里同时用了 && 与 ||：Apache 的 RewriteCond 只有「与」和相邻的「或」，混在一起要人工拆开'
		};
	}

	const lines: string[] = [];
	const notes: string[] = [];
	for (const part of parts) {
		const one = toRewriteCond(part.trim());
		if (!one.ok) return { ok: false, reason: one.reason };
		lines.push(one.line);
		for (const note of one.notes) if (!notes.includes(note)) notes.push(note);
	}

	// nginx 的 || 落到 Apache 侧就是「除最后一条外都带 [OR]」
	const ors = joins.every((join) => join === '||');
	return {
		ok: true,
		lines: ors ? lines.map((line, index) => (index < lines.length - 1 ? `${line} [OR]` : line)) : lines,
		notes
	};
}

function toRewriteCond(part: string): CondResult {
	// 文件 / 目录测试：if (-f $request_filename)
	const fileTest = /^(!?)\s*(-[a-zA-Z])\s+(\S+)$/.exec(part);
	if (fileTest !== null) {
		const [, negate, test, subject] = fileTest;
		const mapped = mapVar(subject);
		if (mapped === null) {
			return { ok: false, reason: `${subject} 在 Apache 里没有等价变量，这条条件请手工改写` };
		}
		if (!APACHE_FILE_TESTS.includes(test)) {
			return {
				ok: false,
				reason: `条件测试 ${test} 在 Apache 的 RewriteCond 里没有对应（只有 ${APACHE_FILE_TESTS.join(' / ')}）`
			};
		}
		return {
			ok: true,
			line: `RewriteCond ${mapped.text} ${negate}${test}`,
			notes: mapped.note === undefined ? [] : [mapped.note]
		};
	}

	// 变量与正则：if ($http_user_agent ~* "bot")
	const regexTest = /^(\$\w+)\s*(!~|~)(\*)?\s*(.+)$/.exec(part);
	if (regexTest !== null) {
		const [, subject, operator, ignoreCase, rawPattern] = regexTest;
		const mapped = mapVar(subject);
		if (mapped === null) {
			return { ok: false, reason: `${subject} 在 Apache 里没有等价变量，这条条件请手工改写` };
		}
		const notes = mapped.note === undefined ? [] : [mapped.note];
		const flags = ignoreCase === '*' ? ' [NC]' : '';
		if (ignoreCase === '*') notes.push('条件里的 ~* 是大小写不敏感，已转成 Apache 的 [NC] 标记');
		const pattern = quote(stripQuotes(rawPattern.trim()));
		return { ok: true, line: `RewriteCond ${mapped.text} ${operator === '!~' ? '!' : ''}${pattern}${flags}`, notes };
	}

	// 等值比较：if ($request_method = POST)
	if (/(^|[^!<>=])==|<>/.test(part)) {
		// 放在正则那一支之后，`~ "a==b"` 不会误伤
		return {
			ok: false,
			reason: `没认出这条 if 条件：${part}（nginx 只有 = 与 != 两种比较），请手工改写成 RewriteCond`
		};
	}
	const equalTest = /^(\$\w+)\s*(!=|=)\s*(.+)$/.exec(part);
	if (equalTest !== null) {
		const [, subject, operator, rawValue] = equalTest;
		const mapped = mapVar(subject);
		if (mapped === null) {
			return { ok: false, reason: `${subject} 在 Apache 里没有等价变量，这条条件请手工改写` };
		}
		const value = escapeRegex(stripQuotes(rawValue.trim()));
		const notes = mapped.note === undefined ? [] : [mapped.note];
		notes.push('条件里的 = / != 是精确等值，Apache 的 RewriteCond 走正则，这里已自动补上 ^ 与 $ 锚点');
		return { ok: true, line: `RewriteCond ${mapped.text} ${operator === '!=' ? '!' : ''}^${value}$`, notes };
	}

	// 只给变量：if ($request_method)
	const bare = /^(\$\w+)$/.exec(part);
	if (bare !== null) {
		const mapped = mapVar(bare[1]);
		if (mapped === null) {
			return { ok: false, reason: `${bare[1]} 在 Apache 里没有等价变量，这条条件请手工改写` };
		}
		const notes = mapped.note === undefined ? [] : [mapped.note];
		notes.push('nginx 的 if ($变量) 表示「非空且不是 0」，Apache 里只能近似成「非空」，请核对');
		return { ok: true, line: `RewriteCond ${mapped.text} .`, notes };
	}

	return { ok: false, reason: `没认出这条 if 条件：${part}，请手工改写成 RewriteCond` };
}

interface MappedVar {
	text: string;
	note?: string;
}

/** nginx 变量 → Apache 测试串；认不出返回 null（调用方会报一条提示） */
function mapVar(subject: string): MappedVar | null {
	const name = subject.replace(/^\$/, '').toLowerCase();
	if (REVERSE_VARS[name] !== undefined) return { text: REVERSE_VARS[name] };
	if (name.startsWith('http_')) return { text: `%{${name.toUpperCase()}}` };
	if (name === 'uri' || name === 'document_uri') {
		return {
			text: '%{REQUEST_URI}',
			note: '$uri / $document_uri 在 Apache 里没有等价变量，已用 %{REQUEST_URI} 近似（它含查询串）'
		};
	}
	return null;
}

// ------------------------------------------------------------------ 模式、目标与文本

type PatternResult = { ok: true; text: string; ignoreCase: boolean; strippedRoot: boolean; loose: boolean };
type TargetResult = { ok: true; text: string; absolute: boolean; hasQuery: boolean; strippedRoot: boolean };

/** nginx 的 rewrite 模式 → Apache 的 RewriteRule 模式 */
function toApachePattern(raw: string): PatternResult | { ok: false; reason: string } {
	if (hasNginxVariable(raw)) {
		return {
			ok: false,
			reason: `rewrite 的模式里用了 nginx 变量（${raw}）：Apache 的 RewriteRule 模式只匹配路径，变量要挪到 RewriteCond 里，请手工改写`
		};
	}

	let text = raw;
	let ignoreCase = false;
	if (text.startsWith('(?i)')) {
		ignoreCase = true;
		text = text.slice(4);
	}

	const anchored = text.startsWith('^');
	const body = anchored ? text.slice(1) : text;
	if (!body.startsWith('/')) {
		return { ok: true, text, ignoreCase, strippedRoot: false, loose: false };
	}
	return {
		ok: true,
		text: `${anchored ? '^' : ''}${body.slice(1)}`,
		ignoreCase,
		strippedRoot: true,
		loose: !anchored
	};
}

/** nginx 的 rewrite / return 目标 → Apache 的替换串；keepAbsolute = 重定向要的是绝对路径 */
function toApacheTarget(raw: string, keepAbsolute: boolean): TargetResult | { ok: false; reason: string } {
	const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
	if (absolute) {
		if (hasNginxVariable(raw)) {
			return { ok: false, reason: `替换目标里的 nginx 变量（${raw}）在 Apache 里没有对应写法，请手工改写` };
		}
		return { ok: true, text: raw, absolute: true, hasQuery: raw.includes('?'), strippedRoot: false };
	}
	if (hasNginxVariable(raw)) {
		return {
			ok: false,
			reason: `替换目标里的 nginx 变量（${raw}）：Apache 的 RewriteRule 目标只能用 $1～$9 反向引用，请手工改写`
		};
	}

	const strip = !keepAbsolute && raw.startsWith('/');
	const text = strip ? raw.slice(1) : raw;
	if (text === '') {
		return { ok: false, reason: '替换目标是空串，转不成 Apache 的 RewriteRule 目标，请手工核对' };
	}
	return { ok: true, text, absolute: false, hasQuery: raw.includes('?'), strippedRoot: strip };
}

/** 值是 nginx 变量（`$host` / `${x}`，不含 `$1`～`$9` 反向引用） */
function hasNginxVariable(text: string): boolean {
	return /\$(?=[A-Za-z_{])/.test(text);
}

/** 引号外的括号（引号里的 `(php)` 不算） */
function hasBareParens(text: string): boolean {
	let quote: '"' | "'" | '' = '';
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '\\') {
			index += 1;
			continue;
		}
		if (quote === '') {
			if (char === '"' || char === "'") {
				quote = char;
				continue;
			}
			if (char === '(' || char === ')') return true;
			continue;
		}
		if (char === quote) quote = '';
	}
	return false;
}

function stripParens(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('(') && trimmed.endsWith(')')) return trimmed.slice(1, -1).trim();
	return trimmed;
}

function stripQuotes(text: string): string {
	if (text.length >= 2) {
		const first = text[0];
		if ((first === '"' || first === "'") && text[text.length - 1] === first) return text.slice(1, -1);
	}
	return text;
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 值里有空白或分号时必须加引号（Apache 的配置分词靠引号保住空格） */
function quote(value: string): string {
	if (value === '') return '""';
	return /[\s;]/.test(value) ? alwaysQuote(value) : value;
}

function alwaysQuote(value: string): string {
	return `"${value.replace(/"/g, '\\"')}"`;
}
