// .htaccess → nginx 的语义映射（纯函数，不依赖 DOM）。模块名里的 `-htaccess` 指**输入格式**。
//
// 三条口径（反向的 convert-nginx.ts 同样遵守）：
//   ① 输出与源文件**逐条对应**（顺序一致、原注释保留），不支持的指令就地落成注释 —— 不静默丢东西；
//   ② 拿不准的一律降级成「需人工确认」并说清该怎么改，宁可让人看一眼，也不生成一条「看着对、其实改了语义」的配置；
//   ③ 标准模块做不到的标「未支持」，原文同样保留在注释里。
import { parseFlagList, parseHtaccess } from './parse-htaccess.ts';
import {
	DEFAULT_INDENT,
	INDENT_UNIT,
	type ConversionResult,
	type ConversionWarning,
	type Directive,
	type IndentStyle,
	type RewriteCondition,
	type WarningLevel
} from './types.ts';

/** 顶部那段说明的前缀（单测用它把正文摘出来，正文里的注释不会以这些开头） */
export const HEADER_PREFIXES = ['# 由 .htaccess 转换而来', '# 请放进 nginx 的 server 块中', '# 本次共 ', '# 注意：'];

/**
 * 解析出来的 Apache 变量 → nginx 变量；HTTP_* 走下面的通用规则，不必逐个列。
 * **导出**是给参数速查表用的：速查表的变量组从这张表派生，「速查表里能查到的变量」于是
 * 永远等于「转换器认识的变量」，不会两边漂移（见 `core/cheatsheet.ts` 的口径③）。
 */
export const VAR_MAP: Record<string, string> = {
	HTTP_HOST: '$host',
	SERVER_NAME: '$server_name',
	SERVER_PORT: '$server_port',
	SERVER_PROTOCOL: '$server_protocol',
	REQUEST_METHOD: '$request_method',
	REQUEST_URI: '$request_uri',
	REQUEST_FILENAME: '$request_filename',
	QUERY_STRING: '$query_string',
	REMOTE_ADDR: '$remote_addr',
	REMOTE_HOST: '$remote_addr',
	REMOTE_PORT: '$remote_port',
	DOCUMENT_ROOT: '$document_root',
	HTTPS: '$https',
	REQUEST_SCHEME: '$scheme',
	THE_REQUEST: '$request',
	SCRIPT_FILENAME: '$request_filename'
};

/** nginx 的 if 里做不到的标记：原文 + 怎么办 */
const FLAG_NOTES: Record<string, string> = {
	S: 'S=（跳过后面 N 条规则）在 nginx 里没有对应机制，把被跳过的规则手工合并进这条',
	C: 'C（链式规则）nginx 里要拆成嵌套的 if',
	P: 'P（代理）要改成 proxy_pass + upstream 才能实现',
	T: 'T=（指定 MIME）nginx 侧由 default_type / types 决定',
	B: 'B（重转义）nginx 不做同样的处理',
	DPI: 'DPI（丢弃 PATH_INFO）nginx 里没有这个动作',
	NS: 'NS（只在没有子请求时匹配）nginx 无对应',
	NV: 'NV（不缓存条件结果）nginx 本来就不缓存'
};

interface Ctx {
	lines: string[];
	warnings: ConversionWarning[];
	/** 缩进单元 */
	indent: string;
	/** 当前块层级（容器 + if） */
	depth: number;
	/** RewriteBase 归一化后的前缀：以 / 开头、以 / 结尾 */
	base: string;
	/** 容器的开标签是否产出了 nginx 块（决定 close 时要不要补 `}`） */
	blocks: boolean[];
	/** 见过 RewriteEngine Off：后面的 rewrite 规则按「不生效」注释掉 */
	engineOff: boolean;
	/** 产出过 if 块（顶部要提醒 nginx 的 if 坑） */
	usedIf: boolean;
	/** Header set → add_header 的语义差只提一次 */
	notedHeader: boolean;
	/** gzip_types 只提一次「记得 gzip on」 */
	notedGzip: boolean;
	converted: number;
}

/** 入口：吃 .htaccess 原文，吐 nginx 配置 + 提示 */
export function convertHtaccess(source: string, indent: IndentStyle = DEFAULT_INDENT): ConversionResult {
	const ctx: Ctx = {
		lines: [],
		warnings: [],
		indent: INDENT_UNIT[indent],
		depth: 0,
		base: '/',
		blocks: [],
		engineOff: false,
		usedIf: false,
		notedHeader: false,
		notedGzip: false,
		converted: 0
	};

	for (const directive of parseHtaccess(source)) {
		if (directive.kind === 'comment') {
			push(ctx, `# ${directive.text}`);
			continue;
		}
		if (directive.kind === 'open') {
			openContainer(ctx, directive);
			continue;
		}
		if (directive.kind === 'close') {
			closeContainer(ctx, directive);
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
	ctx.lines.push(pad(ctx) + text);
}

/** 记一条警告，并把「哪一行、为什么、怎么办」就地写成注释（顺序与源文件一致，便于逐行核对） */
function report(ctx: Ctx, directive: Directive, level: WarningLevel, reason: string, extra: string[] = []): void {
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
		'# 由 .htaccess 转换而来 · www.toolv.cn/htaccess-to-nginx',
		'# 请放进 nginx 的 server 块中；标 ⚠️ 的位置需要人工确认'
	];

	if (ctx.warnings.length > 0) {
		header.push(`# 本次共 ${ctx.warnings.length} 处提示：需人工确认 ${manual} 处、未支持 ${unsupported} 处`);
	}
	if (ctx.usedIf) {
		header.push('# 注意：nginx 的 if 只适合放 rewrite 与 return（俗称「if is evil」），上线前请在测试环境过一遍');
	}
	if (ctx.engineOff) {
		header.push('# 注意：原配置里有 RewriteEngine Off，rewrite 规则已按「不生效」注释保留');
	}

	return `${[...header, ...ctx.lines].join('\n')}\n`;
}

// ------------------------------------------------------------------ 容器标签

/** `<IfModule>` 直接展开；`<Files>` / `<Directory>` / `<Location>` 映射成 location 块，里面的指令跟着缩进 */
function openContainer(ctx: Ctx, directive: Directive): void {
	const name = directive.name.toLowerCase();
	const block = (line: string): void => {
		push(ctx, line);
		ctx.depth += 1;
		ctx.blocks.push(true);
	};
	const flat = (): void => {
		ctx.blocks.push(false);
	};

	if (name === 'ifmodule') {
		if (directive.text.includes('!')) {
			report(
				ctx,
				directive,
				'manual',
				`原配置是 <${directive.text}>（取反），里面的指令本来「不生效」，展开后请自行核对`
			);
		} else {
			push(ctx, `# ↓ <${directive.text}> 块：nginx 不需要模块判断，内容已展开`);
		}
		flat();
		return;
	}

	if (name === 'files') {
		report(
			ctx,
			directive,
			'manual',
			'nginx 里用 location 匹配「路径结尾」来近似 <Files>（Apache 匹配任意目录下的同名文件）'
		);
		block(`location ~ /${escapeRegex(directive.args[0] ?? '')}$ {`);
		return;
	}
	if (name === 'filesmatch') {
		block(`location ~ ${directive.args[0] ?? ''} {`);
		return;
	}
	if (name === 'directory') {
		const path = directive.args[0] ?? '';
		report(
			ctx,
			directive,
			'manual',
			'nginx 的 location 按 URI 前缀匹配，与 Apache 的「文件系统目录」不是一回事，请核对路径'
		);
		block(`location ${path.endsWith('/') ? path : `${path}/`} {`);
		return;
	}
	if (name === 'location') {
		block(`location ${directive.args[0] ?? '/'} {`);
		return;
	}
	if (name === 'locationmatch') {
		block(`location ~ ${directive.args[0] ?? ''} {`);
		return;
	}

	report(
		ctx,
		directive,
		'unsupported',
		`<${directive.text}> 这类容器在 nginx 里没有对应写法，里面的指令已平铺展开，请自行归位`
	);
	flat();
}

function closeContainer(ctx: Ctx, directive: Directive): void {
	if (ctx.blocks.pop() === true) {
		ctx.depth = Math.max(0, ctx.depth - 1);
		push(ctx, '}');
		return;
	}
	if (directive.name.toLowerCase() === 'ifmodule') {
		// 闭合注释带上完整标签（`</IfModule mod_rewrite.c>`），只说 `</IfModule>` 看不出是哪个模块
		const label = directive.containers[directive.containers.length - 1] ?? directive.text;
		push(ctx, `# ↑ </${label}> 块结束`);
	}
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ------------------------------------------------------------------ 指令分发

function convertDirective(ctx: Ctx, directive: Directive): void {
	switch (directive.name.toLowerCase()) {
		case 'rewriteengine':
			return convertRewriteEngine(ctx, directive);
		case 'rewritebase':
			return convertRewriteBase(ctx, directive);
		case 'rewritecond':
			return report(
				ctx,
				directive,
				'manual',
				'RewriteCond 后面没有跟着 RewriteRule：nginx 的条件必须跟 rewrite / return 一起写'
			);
		case 'rewriterule':
			return convertRewriteRule(ctx, directive);
		case 'redirect':
			return convertRedirect(ctx, directive, false);
		case 'redirectmatch':
			return convertRedirect(ctx, directive, true);
		case 'header':
			return convertHeader(ctx, directive);
		case 'errordocument':
			return convertErrorDocument(ctx, directive);
		case 'options':
			return convertOptions(ctx, directive);
		case 'directoryindex':
			return convertSimple(ctx, directive, (args) => [`index ${args.join(' ')};`]);
		case 'adddefaultcharset':
			return convertCharset(ctx, directive);
		case 'addoutputfilterbytype':
			return convertOutputFilter(ctx, directive);
		case 'serversignature':
			return convertServerSignature(ctx, directive);
		case 'fileetag':
			return convertFileEtag(ctx, directive);
		case 'deny':
		case 'allow':
			return convertAccess(ctx, directive);
		case 'order':
			return report(
				ctx,
				directive,
				'manual',
				'nginx 的访问控制是「先匹配先赢」，没有 Apache Order 的两段合并语义：请把 deny / allow 按想要的优先级重排'
			);
		case 'authtype':
			return report(
				ctx,
				directive,
				'manual',
				'nginx 只支持 Basic 认证，用 auth_basic（realm 取 AuthName）+ auth_basic_user_file 两条即可'
			);
		case 'authname':
			return convertSimple(ctx, directive, (args) => [`auth_basic ${quote(args.join(' '))};`]);
		case 'authuserfile':
			return convertSimple(ctx, directive, (args) => [`auth_basic_user_file ${args[0] ?? ''};`]);
		case 'require':
			return convertRequire(ctx, directive);
		case 'expiresactive':
		case 'expiresbytype':
		case 'expiresdefault':
			return report(
				ctx,
				directive,
				'manual',
				'nginx 的缓存用 expires 指令，按类型写要配 location，例如：location ~* \\.(png|jpg)$ { expires 30d; }'
			);
		case 'addtype':
			return report(ctx, directive, 'manual', 'nginx 的类型表在 mime.types / types 块里，AddType 不会生效');
		case 'php_value':
		case 'php_flag':
		case 'php_admin_value':
		case 'php_admin_flag':
			return report(ctx, directive, 'unsupported', 'PHP 配置要写进 php-fpm（php.ini 或 pool 配置），nginx 无法设置');
		case 'setenv':
		case 'setenvif':
		case 'browsermatch':
			return report(
				ctx,
				directive,
				'manual',
				'nginx 里用 set $name value; 定义变量，但没有 SetEnvIf 那种「按条件设值」的写法（可用 map）'
			);
		case 'rewritemap':
			return report(ctx, directive, 'manual', 'RewriteMap 要改成 nginx 的 map … { } 块');
		default:
			return report(ctx, directive, 'unsupported', '这条指令未收录（或 nginx 没有对应写法），请在 nginx 里手工实现');
	}
}

/** 一条指令 ↔ 一行（或几行）nginx，参数原样拼进去的通用形态 */
function convertSimple(ctx: Ctx, directive: Directive, build: (args: string[]) => string[]): void {
	const lines = build(directive.args);
	for (const line of lines) push(ctx, line);
	ctx.converted += 1;
}

// ------------------------------------------------------------------ Rewrite 家族

function convertRewriteEngine(ctx: Ctx, directive: Directive): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'off') {
		ctx.engineOff = true;
		push(ctx, '# RewriteEngine Off —— nginx 没有这个开关，下面的 rewrite 规则已按「不生效」注释保留');
		return;
	}
	push(ctx, '# RewriteEngine On —— nginx 不需要开关，rewrite 指令写了就生效');
	ctx.converted += 1;
}

function convertRewriteBase(ctx: Ctx, directive: Directive): void {
	const raw = directive.args[0] ?? '';
	if (!raw.startsWith('/')) {
		report(ctx, directive, 'manual', 'RewriteBase 不是以 / 开头的路径，没法当前缀用，请手工核对下面 rewrite 的路径');
		return;
	}
	ctx.base = raw.endsWith('/') ? raw : `${raw}/`;
	push(ctx, `# RewriteBase ${raw} —— 已把它当作路径前缀，补给下面 rewrite 的模式与目标`);
	ctx.converted += 1;
}

function convertRewriteRule(ctx: Ctx, directive: Directive): void {
	const [rawPattern, rawTarget] = directive.args;
	if (rawPattern === undefined || rawTarget === undefined) {
		report(ctx, directive, 'manual', 'RewriteRule 缺参数：需要「模式」与「目标」两个');
		return;
	}

	const flags = parseFlagList(directive.args[2] ?? '');
	const isForbid = flags.includes('F') || flags.includes('G');
	if (rawTarget === '-' && !isForbid) {
		report(
			ctx,
			directive,
			'manual',
			'替换目标是 `-`（匹配后不改写路径），nginx 没有这种写法：如果只是想拦截，请用 F 或 G 标记'
		);
		return;
	}

	const preLines: string[] = [];
	const notes: string[] = [];
	const problems: { level: WarningLevel; reason: string }[] = [];
	let redirectCode: number | null = null;
	let hasLast = false;

	for (const flag of flags) {
		const equal = flag.indexOf('=');
		const key = equal === -1 ? flag : flag.slice(0, equal);
		const value = equal === -1 ? '' : flag.slice(equal + 1);

		if (key === 'L') {
			hasLast = true;
			continue;
		}
		if (key === 'R') {
			const code = value === '' ? 302 : Number(value);
			if (code === 301) {
				redirectCode = 301;
			} else if (code === 302 || code === 303) {
				redirectCode = 302;
				if (code === 303)
					problems.push({ level: 'manual', reason: 'R=303（See Other）在 nginx 里只能用 redirect(302) 近似，请核对' });
			} else if (code === 307) {
				redirectCode = 302;
				problems.push({
					level: 'manual',
					reason: 'R=307 在 nginx 里只能用 redirect(302) 近似（307 会保留请求方法），请核对'
				});
			} else if (code === 308) {
				redirectCode = 301;
				problems.push({ level: 'manual', reason: 'R=308 在 nginx 里只能用 permanent(301) 近似，请核对' });
			} else {
				redirectCode = 302;
				problems.push({
					level: 'manual',
					reason: `R=${code}：nginx 的 rewrite 只有 permanent(301) / redirect(302)，这里按 302 输出，需要其它码请改用 return ${code} <目标>;`
				});
			}
			continue;
		}
		if (key === 'NC' || key === 'PT') continue;
		// F / G 已经在上面的 isForbid 分支里处理成 return 了
		if (key === 'F' || key === 'G') continue;
		if (key === 'QSA') {
			notes.push('# QSA：替换目标里不带 ? 时，nginx 本来就会把原查询串接上去，不需要额外设置');
			continue;
		}
		if (key === 'NE') {
			notes.push('# NE：nginx 不做额外的百分号转义，需要原样 URL 时用 $request_uri');
			continue;
		}
		if (key === 'E') {
			const [name = '', varValue = ''] = value.split(':');
			preLines.push(`set $${name} ${quote(varValue)};`);
			problems.push({
				level: 'manual',
				reason: `E=${value}：已转成 nginx 的 set $${name}，但 nginx 变量在内部跳转后不保证保留`
			});
			continue;
		}
		problems.push({ level: 'manual', reason: FLAG_NOTES[key] ?? `未收录的标记 [${flag}]，请手工核对` });
	}

	const body: string[] = [...preLines];
	if (isForbid) {
		body.push(`return ${flags.includes('F') ? 403 : 410};`);
	} else {
		const pattern = toNginxPattern(rawPattern, ctx.base, flags.includes('NC'));
		const target = toNginxTarget(rawTarget, ctx.base);
		const suffix = redirectCode !== null ? (redirectCode === 301 ? ' permanent' : ' redirect') : hasLast ? ' last' : '';
		body.push(`rewrite ${pattern} ${target}${suffix};`);
		if (rawTarget.includes('?')) {
			problems.push({
				level: 'manual',
				reason: '替换目标里带 ?：nginx 会把原查询串接在它后面，需要「丢掉原参数」时请在目标末尾再加一个 ?'
			});
		}
	}

	const condition = directive.conditions.length > 0 ? buildCondition(ctx, directive) : null;
	// 条件表达不出来、或原配置本来就是 RewriteEngine Off：整条注释保留。
	// 宁可留给人看一眼，也不要生成一条「看着对、其实改了语义」的配置。
	const mute = ctx.engineOff || condition?.unresolved === true;
	if (ctx.engineOff) report(ctx, directive, 'manual', '原配置是 RewriteEngine Off，这条规则本来不生效，已注释保留');
	if (condition?.unresolved === true) {
		report(ctx, directive, 'manual', '这条规则的条件在 nginx 的 if 里表达不出来，整条已注释保留');
	}

	const emit = (line: string): void => push(ctx, mute ? `# ${line}` : line);
	for (const problem of problems) report(ctx, directive, problem.level, problem.reason);
	for (const note of notes) push(ctx, note);

	if (condition !== null && condition.expression !== '') {
		emit(`if (${condition.expression}) {`);
		ctx.depth += 1;
		for (const line of body) emit(line);
		ctx.depth -= 1;
		emit('}');
		ctx.usedIf = ctx.usedIf || !mute;
	} else {
		for (const line of body) emit(line);
	}
	// 被注释掉的规则不算「转过去了」：状态栏里的数字要能对上输出里真正生效的行数
	if (!mute) ctx.converted += 1;
}

function convertRedirect(ctx: Ctx, directive: Directive, isMatch: boolean): void {
	const args = [...directive.args];
	const first = args[0] ?? '';
	const statusWord = first.toLowerCase();
	const code = STATUS_WORDS[statusWord] ?? (/^\d{3}$/.test(first) ? Number(first) : undefined);

	let from: string;
	let to: string;
	if (code !== undefined) {
		args.shift();
		from = args.shift() ?? '';
		to = args[0] ?? '';
	} else {
		from = args[0] ?? '';
		to = args[1] ?? '';
	}

	if (from === '') {
		report(ctx, directive, 'manual', '没看出要重定向哪个路径，请核对写法（Redirect [状态] 旧路径 新路径）');
		return;
	}

	const status = code ?? 302;
	if (status === 410 && to === '') {
		push(ctx, `location ${escapePathPrefix(from)} { return 410; }`);
		ctx.converted += 1;
		return;
	}
	if (to === '') {
		report(ctx, directive, 'manual', '缺少重定向目标');
		return;
	}

	if (status !== 301 && status !== 302) {
		report(
			ctx,
			directive,
			'manual',
			`${status} 不是 301/302：nginx 的 rewrite 关键字只有 permanent(301) 与 redirect(302)，请改用 location ${from} { return ${status} ${to}; }（前缀 location 会丢掉子路径，注意核对）`
		);
		return;
	}

	const suffix = status === 301 ? 'permanent' : 'redirect';
	const pattern = isMatch ? from : `^${escapePathPrefix(from)}(.*)$`;
	const target = isMatch ? to : `${to}$1`;
	push(ctx, `# ${directive.text}`);
	if (ctx.engineOff) {
		report(ctx, directive, 'manual', '原配置是 RewriteEngine Off，这条重定向本来不生效，已注释保留');
		push(ctx, `# rewrite ${pattern} ${target} ${suffix};`);
		return;
	}
	push(ctx, `rewrite ${pattern} ${target} ${suffix};`);
	ctx.converted += 1;
}

/** 状态字 → HTTP 码 */
const STATUS_WORDS: Record<string, number> = {
	permanent: 301,
	temp: 302,
	seeother: 303,
	gone: 410
};

// ------------------------------------------------------------------ 其它指令

function convertHeader(ctx: Ctx, directive: Directive): void {
	const args = [...directive.args];
	let condition = '';
	if (['always', 'onsuccess'].includes((args[0] ?? '').toLowerCase())) condition = (args.shift() ?? '').toLowerCase();

	const action = (args.shift() ?? '').toLowerCase();
	const name = args.shift() ?? '';
	const value = args.join(' ');

	if (action === 'unset') {
		report(
			ctx,
			directive,
			'unsupported',
			`nginx 标准模块没有「删掉某个响应头」的指令，需要 headers-more 模块的 more_clear_headers，或在上游就不发这个头`
		);
		return;
	}
	if (action === 'edit') {
		report(
			ctx,
			directive,
			'unsupported',
			'Header edit 需要在响应头里做替换，nginx 标准模块做不到（要 headers-more 的 more_set_headers）'
		);
		return;
	}
	if (!['set', 'add', 'append'].includes(action) || name === '') {
		report(ctx, directive, 'manual', '没认出这是 set / add / append / unset 里的哪一种操作');
		return;
	}
	if (action === 'append') {
		report(
			ctx,
			directive,
			'manual',
			`Header append 是「追加」，nginx 的 add_header 同名时会再加一条而不是拼接，请核对最终想去掉哪一条`
		);
	}
	if (action === 'set' && !ctx.notedHeader) {
		ctx.notedHeader = true;
		push(ctx, '# 提示：Apache 的 Header set 是「替换」，nginx 的 add_header 是「追加」——同名头本来存在时不会顶掉它');
	}
	push(ctx, `add_header ${name} ${quote(value)}${condition === 'always' ? ' always' : ''};`);
	ctx.converted += 1;
}

function convertErrorDocument(ctx: Ctx, directive: Directive): void {
	const code = directive.args[0] ?? '';
	const target = directive.args[1] ?? '';
	if (!/^\d{3}$/.test(code) || target === '') {
		report(ctx, directive, 'manual', '没认出 ErrorDocument 的写法（需要「状态码 + 目标」）');
		return;
	}
	if (!target.startsWith('/') && !/^https?:\/\//i.test(target)) {
		report(
			ctx,
			directive,
			'manual',
			'ErrorDocument 的目标是文字提示（不是路径），nginx 的 error_page 只能指向页面或地址'
		);
		return;
	}
	push(ctx, `error_page ${code} ${target};`);
	ctx.converted += 1;
}

function convertOptions(ctx: Ctx, directive: Directive): void {
	const args = directive.args;
	if (args.length === 0) {
		report(ctx, directive, 'manual', 'Options 没带参数');
		return;
	}
	let handled = false;
	for (const option of args) {
		const lower = option.toLowerCase();
		if (lower === '-indexes' || lower === 'none') {
			push(ctx, 'autoindex off;');
			handled = true;
			continue;
		}
		if (lower === '+indexes') {
			push(ctx, 'autoindex on;');
			handled = true;
			continue;
		}
		if (lower.includes('followsymlinks') || lower === 'symlinksifownermatch' || lower === '-multiviews') {
			push(ctx, `# Options ${option}：nginx 没有这个限制（也没有 MultiViews），无需对应`);
			handled = true;
			continue;
		}
		if (lower === 'all') {
			push(ctx, 'autoindex on;');
			handled = true;
			continue;
		}
		report(ctx, directive, 'manual', `Options ${option} 在 nginx 里没有对应写法，请手工核对`);
	}
	if (handled) ctx.converted += 1;
}

function convertCharset(ctx: Ctx, directive: Directive): void {
	const value = directive.args[0] ?? '';
	if (value.toLowerCase() === 'off') {
		push(ctx, '# AddDefaultCharset Off：nginx 默认就不发 charset，无需设置');
		return;
	}
	push(ctx, `charset ${value.toLowerCase()};`);
	ctx.converted += 1;
}

function convertOutputFilter(ctx: Ctx, directive: Directive): void {
	const [filter = '', ...types] = directive.args;
	if (filter.toUpperCase() !== 'DEFLATE') {
		report(ctx, directive, 'unsupported', `AddOutputFilterByType ${filter}：nginx 只内建 gzip，其它过滤器做不到`);
		return;
	}
	if (!ctx.notedGzip) {
		ctx.notedGzip = true;
		push(ctx, '# 记得配套开启 gzip：gzip on;');
	}
	push(ctx, `gzip_types ${types.join(' ')};`);
	ctx.converted += 1;
}

function convertServerSignature(ctx: Ctx, directive: Directive): void {
	const value = (directive.args[0] ?? '').toLowerCase();
	if (value === 'off') {
		push(ctx, 'server_tokens off;');
		ctx.converted += 1;
		return;
	}
	push(ctx, '# ServerSignature On：nginx 侧对应 server_tokens on（默认）');
	ctx.converted += 1;
}

function convertFileEtag(ctx: Ctx, directive: Directive): void {
	if ((directive.args[0] ?? '').toLowerCase() === 'none') {
		push(ctx, 'etag off;');
		ctx.converted += 1;
		return;
	}
	report(ctx, directive, 'manual', 'nginx 只能整体开关 ETag（etag on/off），不能像 Apache 那样挑字段');
}

function convertAccess(ctx: Ctx, directive: Directive): void {
	const action = directive.name.toLowerCase();
	// Apache 写「Deny from <来源>」，nginx 直接 `deny <来源>;`，中间那个 from 要剥掉
	const args = (directive.args[0] ?? '').toLowerCase() === 'from' ? directive.args.slice(1) : directive.args;
	const target = args.join(' ');
	if (target === '') {
		report(ctx, directive, 'manual', `${directive.name} 没带来源参数`);
		return;
	}
	if (target.startsWith('env=')) {
		report(ctx, directive, 'manual', `${directive.name} from ${target} 依赖环境变量，nginx 侧要用 map 或 if 重写`);
		return;
	}
	push(ctx, `${action} ${target};`);
	ctx.converted += 1;
}

function convertRequire(ctx: Ctx, directive: Directive): void {
	const target = directive.args.join(' ').toLowerCase();
	if (target === 'valid-user') {
		push(ctx, '# Require valid-user：上面的 auth_basic_user_file 一写就生效，不需要额外指令');
		ctx.converted += 1;
		return;
	}
	report(
		ctx,
		directive,
		'manual',
		`Require ${target}：nginx 的访问控制要拆成 satisfy / allow / deny 或 auth_request，请手工对应`
	);
}

// ------------------------------------------------------------------ 表达式与路径

/** Apache 在 .htaccess 里的模式是「相对当前目录」的（不带前导斜杠），nginx 匹配的是完整 URI，所以要补前缀 */
function toNginxPattern(raw: string, base: string, ignoreCase: boolean): string {
	const anchored = raw.startsWith('^');
	const body = anchored ? raw.slice(1) : raw;
	const fixed = body.startsWith('/') ? body : `${base}${body}`;
	const pattern = `${anchored ? '^' : ''}${fixed}`;
	// nginx 的 rewrite 没有大小写不敏感开关，用 PCRE 的行内修饰符
	return ignoreCase ? `(?i)${pattern}` : pattern;
}

/** 目标：绝对地址与 nginx 变量原样，站内路径补上 RewriteBase 前缀 */
function toNginxTarget(raw: string, base: string): string {
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('//') || raw.startsWith('$')) return raw;
	return raw.startsWith('/') ? raw : `${base}${raw}`;
}

/** Output= 目标路径补上前导斜杠（Apache 的 Redirect 旧路径本来就带 /，这里兜个底） */
function escapePathPrefix(path: string): string {
	const fixed = path.startsWith('/') ? path : `/${path}`;
	return escapeRegex(fixed.replace(/\/$/, ''));
}

function buildCondition(ctx: Ctx, directive: Directive): { expression: string; unresolved: boolean } {
	const parts: string[] = [];
	const joiners: string[] = [];
	let unresolved = false;

	for (let index = 0; index < directive.conditions.length; index += 1) {
		const condition = directive.conditions[index];
		const part = toNginxCondition(ctx, directive, condition);
		if (part === null) {
			unresolved = true;
			// 表达式拼不完整，这里只是占位；调用方看到 unresolved 会把整条规则注释掉
			parts.push('$__unresolved__');
		} else {
			parts.push(part);
		}
		// Apache 的 [OR] 写在条件上，表示「它与下一个条件取或」，缺省是且
		if (index < directive.conditions.length - 1) joiners.push(condition.flags.includes('OR') ? '||' : '&&');
	}

	if (joiners.includes('&&') && joiners.includes('||')) {
		report(
			ctx,
			directive,
			'manual',
			'条件里同时用了 OR 与缺省的 AND：nginx 的 if 表达式没有括号，建议拆成嵌套 if 或改用 map'
		);
	}

	const expression = parts.reduce(
		(result, part, index) => (index === 0 ? part : `${result} ${joiners[index - 1]} ${part}`),
		''
	);
	return { expression, unresolved };
}

/** 条件 → nginx 的 if 表达式；返回 null 表示这条条件表达不出来（调用方会把整条规则注释掉） */
function toNginxCondition(ctx: Ctx, directive: Directive, condition: RewriteCondition): string | null {
	// 警告落到 RewriteCond 那一行上，而不是它后面那条 RewriteRule 的行号
	const at: Directive = { ...directive, line: condition.line, text: condition.source };
	const subject = mapVariables(condition.testString);
	for (const name of condition.testString.matchAll(/%\{([^}]+)\}/g)) {
		if (!isMappableVariable(name[1])) {
			report(ctx, at, 'manual', `%{${name[1]}} 在 nginx 里没有同名变量，请手工替换`);
			return null;
		}
	}

	let pattern = condition.pattern;
	let negate = false;
	if (pattern.startsWith('!') && pattern.length > 1) {
		negate = true;
		pattern = pattern.slice(1);
	}

	// 文件 / 目录测试：nginx 的 if 支持 -f -d -e -x（-s、-l 没有）
	if (/^-[a-zA-Z]$/.test(pattern)) {
		if (!['-f', '-d', '-x'].includes(pattern)) {
			report(ctx, at, 'manual', `条件测试 ${pattern} 在 nginx 的 if 里没有对应（只有 -f / -d / -e / -x）`);
			return null;
		}
		return `${negate ? '!' : ''}${pattern} ${subject}`;
	}

	// 字符串大小比较：Apache 支持 < > =，nginx 的 if 没有
	if (/^(<=|>=|<|>|=)$/.test(pattern)) {
		report(ctx, at, 'manual', `字符串比较 ${pattern} 在 nginx 的 if 里没有对应（可以用 map 或 Lua）`);
		return null;
	}

	const ignoreCase = condition.flags.includes('NC');
	const operator = ignoreCase ? (negate ? '!~*' : '~*') : negate ? '!~' : '~';
	return `${subject} ${operator} ${quote(pattern)}`;
}

/** Apache 变量 → nginx 变量；认不出的原样留着（上面会同时报一条提示） */
function mapVariables(text: string): string {
	return text.replace(/%\{([^}]+)\}/g, (whole, name: string) => {
		const upper = name.toUpperCase();
		if (VAR_MAP[upper] !== undefined) return VAR_MAP[upper];
		if (upper.startsWith('HTTP_')) return `$${upper.toLowerCase()}`;
		if (upper.startsWith('ENV:')) return `$${name.slice(4)}`;
		return whole;
	});
}

function isMappableVariable(name: string): boolean {
	const upper = name.toUpperCase();
	return VAR_MAP[upper] !== undefined || upper.startsWith('HTTP_') || upper.startsWith('ENV:');
}

/** 值里有空格或 nginx 的元字符（`{}` `;`）时必须加引号 */
function quote(value: string): string {
	if (value === '') return '""';
	return /[\s{};"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
