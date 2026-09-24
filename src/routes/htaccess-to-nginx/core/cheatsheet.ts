// 参数速查表的数据与纯函数：写配置时查「这条指令怎么写」「这个变量对面叫什么」。
//
// 四条口径（改这张表之前先看，它们解释了为什么有些指令故意不在里面）：
//
//   ① **只列转换器能完整转过去的写法**。`php_value`、`expires*`、独立的 `RewriteCond`、
//      `Order`、`location /api/` 这类会被降级成 ⚠️ 的写法不进速查表 —— 它们出现在输出里时
//      自带「为什么不行 / 怎么改」的说明，这里再列一遍只会让人插进去再撞一次墙。
//   ② **内容跟着「方向」走**：速查表列的就是输入框当前该写的那种格式，不设独立的格式开关。
//      插入必须和输入框同格式，否则插进去就是废配置（选了 nginx 条目插进 .htaccess 里）。
//   ③ **变量组从转换器的映射表派生**（正向 `VAR_MAP`、反向 `REVERSE_VARS`），不手抄一份 ——
//      于是「速查表里查得到的变量」永远等于「转换器认识的变量」，加一个变量只改一处。
//   ④ **每条都要有 `note`，而且它是行内可见的介绍**，不是悬浮提示 —— 只丢一个 `RewriteCond`
//      或 `[QSA]` 给人看，等于让人去翻官方文档，那速查表就白做了。缺 `note` 会被单测拦住。
import { VAR_MAP } from './convert-htaccess.ts';
import { REVERSE_VARS } from './convert-nginx.ts';
import type { Direction } from './types.ts';

/** 插入方式：line = 整条指令另起一行；inline = 插在光标处（标记、变量这类行内片段） */
export type InsertMode = 'line' | 'inline';

export interface CheatsheetEntry {
	/** 渲染 key（同一份表内唯一） */
	id: string;
	/** 左列：这一行在说什么（指令名 / 用途 / 变量名） */
	label: string;
	/**
	 * 右列：写法，也是点一下插进输入框的文本。可以多行（比如完整的 `if` 块），
	 * 右列只显示前两行 —— 窄栏展不开，悬浮看完整形态。
	 */
	snippet: string;
	/**
	 * 这一条是干什么用的。**行内显示**在第二行（缩进对齐到写法列），不是 tooltip ——
	 * 介绍藏进悬浮提示等于没写。也可以放「对面的写法」「什么时候用得上」。每条都必须有。
	 */
	note: string;
	/** 插入方式，缺省 `line` */
	insert?: InsertMode;
}

export interface CheatsheetSection {
	id: string;
	name: string;
	items: CheatsheetEntry[];
}

/** 速查表右列的预览文本：只取前两行（多行片段在窄栏里展不开） */
export function snippetPreview(snippet: string): string {
	return snippet.split('\n').slice(0, 2).join('\n');
}

// ------------------------------------------------------------------ .htaccess 侧

/** 变量组：正向从 `VAR_MAP` 的键派生 —— 也就是转换器认得的那批 `%{…}` */
function htaccessVarEntries(): CheatsheetEntry[] {
	return Object.entries(VAR_MAP)
		.map(([name, nginxVar]) => ({
			id: `var-${name}`,
			label: name,
			snippet: `%{${name}}`,
			note: `对应的 nginx 写法：${nginxVar}`,
			insert: 'inline' as const
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

const HTACCESS_SECTIONS: CheatsheetSection[] = [
	{
		id: 'rewrite',
		name: '重写与跳转',
		items: [
			{
				id: 'rewriteengine',
				label: 'RewriteEngine',
				snippet: 'RewriteEngine On',
				note: '开启重写引擎（一组规则的开关）'
			},
			{ id: 'rewritebase', label: 'RewriteBase', snippet: 'RewriteBase /', note: '只有结果放在子目录里才需要' },
			{
				id: 'rewritecond',
				label: 'RewriteCond',
				snippet: 'RewriteCond %{HTTPS} off',
				note: '给下一条规则加一个前提条件'
			},
			{
				id: 'rewriterule',
				label: 'RewriteRule',
				snippet: 'RewriteRule ^(.*)$ https://www.example.com/$1 [R=301,L]',
				note: '模式里不含前导斜杠，$1 是括号捕到的部分'
			},
			{
				id: 'redirect',
				label: 'Redirect',
				snippet: 'Redirect 301 /old-page /new-page',
				note: '前缀匹配，目标是站内路径'
			},
			{
				id: 'redirectmatch',
				label: 'RedirectMatch',
				snippet: 'RedirectMatch 301 ^/old/(.*)$ /new/$1',
				note: '按正则匹配'
			}
		]
	},
	{
		id: 'header',
		name: '响应头与错误页',
		items: [
			{
				id: 'header-set',
				label: 'Header set',
				snippet: 'Header set X-Content-Type-Options "nosniff"',
				note: '新增或覆盖一个响应头'
			},
			{
				id: 'header-unset',
				label: 'Header unset',
				snippet: 'Header unset X-Powered-By',
				note: '删掉服务器默认带的响应头'
			},
			{
				id: 'header-always',
				label: 'Header always',
				snippet: 'Header always set X-Frame-Options "SAMEORIGIN"',
				note: '错误响应也要带上这个头时用 always'
			},
			{
				id: 'errordocument',
				label: 'ErrorDocument',
				snippet: 'ErrorDocument 404 /404.html',
				note: '指定错误码返回哪个页面'
			}
		]
	},
	{
		id: 'dir',
		name: '目录与索引',
		items: [
			{ id: 'options', label: 'Options', snippet: 'Options -Indexes', note: '关掉目录列表，防被列文件' },
			{
				id: 'directoryindex',
				label: 'DirectoryIndex',
				snippet: 'DirectoryIndex index.html index.php',
				note: '目录请求默认返回哪个文件'
			},
			{
				id: 'adddefaultcharset',
				label: 'AddDefaultCharset',
				snippet: 'AddDefaultCharset utf-8',
				note: '给没声明编码的响应补字符集'
			},
			{
				id: 'serversignature',
				label: 'ServerSignature',
				snippet: 'ServerSignature Off',
				note: '隐藏错误页里的服务器版本号'
			},
			{ id: 'fileetag', label: 'FileETag', snippet: 'FileETag None', note: '关掉 ETag，多机部署时免得缓存打架' },
			{
				id: 'addoutputfilterbytype',
				label: 'AddOutputFilterByType',
				snippet: 'AddOutputFilterByType DEFLATE text/css text/html text/javascript',
				note: '要在服务器上开 mod_deflate 才生效'
			}
		]
	},
	{
		id: 'access',
		name: '访问控制与认证',
		items: [
			{ id: 'require', label: 'Require', snippet: 'Require valid-user', note: '要求通过认证才能访问' },
			{ id: 'authtype', label: 'AuthType', snippet: 'AuthType Basic', note: '认证方式，Basic 是明文口令' },
			{ id: 'authname', label: 'AuthName', snippet: 'AuthName "Restricted"', note: '弹给用户的认证提示语' },
			{
				id: 'authuserfile',
				label: 'AuthUserFile',
				snippet: 'AuthUserFile /path/to/.htpasswd',
				note: '口令文件的绝对路径'
			},
			{ id: 'deny', label: 'Deny', snippet: 'Deny from all', note: '拒掉某个来源（要配 Order）' },
			{ id: 'allow', label: 'Allow', snippet: 'Allow from 127.0.0.1', note: '放行某个来源（要配 Order）' }
		]
	},
	{
		id: 'flags',
		name: 'RewriteRule 标记',
		items: [
			{ id: 'flag-r301', label: '永久跳转 301', snippet: '[R=301]', insert: 'inline', note: '地址栏会变成新地址' },
			{ id: 'flag-r302', label: '临时跳转 302', snippet: '[R=302]', insert: 'inline', note: '权重仍算在原地址上' },
			{ id: 'flag-l', label: '最后一条规则', snippet: '[L]', insert: 'inline', note: '这条匹配后不再往下走' },
			{ id: 'flag-nc', label: '忽略大小写', snippet: '[NC]', insert: 'inline', note: '模式里的大小写不再敏感' },
			{ id: 'flag-qsa', label: '保留原查询串', snippet: '[QSA]', insert: 'inline', note: '替换目标里带 ? 时特别需要' },
			{ id: 'flag-f', label: '直接拒绝', snippet: '[F]', insert: 'inline', note: '返回 403' },
			{ id: 'flag-g', label: '直接消失', snippet: '[G]', insert: 'inline', note: '返回 410' },
			{ id: 'flag-p', label: '反向代理', snippet: '[P]', insert: 'inline', note: 'nginx 侧要 proxy_pass + upstream' }
		]
	},
	{ id: 'vars', name: '变量', items: htaccessVarEntries() }
];

// ------------------------------------------------------------------ nginx 侧

/** 变量组：反向从 `REVERSE_VARS` 的键派生 —— 也就是反向转换器认得的那批 `$…` */
function nginxVarEntries(): CheatsheetEntry[] {
	return Object.entries(REVERSE_VARS)
		.map(([name, apacheVar]) => ({
			id: `var-${name}`,
			label: name,
			snippet: `$${name}`,
			note: `对应的 Apache 写法：${apacheVar}`,
			insert: 'inline' as const
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

const NGINX_SECTIONS: CheatsheetSection[] = [
	{
		id: 'rewrite',
		name: '重写与跳转',
		items: [
			{
				id: 'if',
				label: 'if 块',
				snippet: 'if ($scheme != "https") {\n    return 301 https://www.example.com$request_uri;\n}',
				note: 'nginx 的 if 只适合放 rewrite 与 return（俗称 if is evil）'
			},
			{
				id: 'rewrite-permanent',
				label: 'rewrite 永久跳转',
				snippet: 'rewrite ^/old-page(.*)$ /new-page$1 permanent;',
				note: '模式带前导斜杠，匹配的是完整 URI'
			},
			{
				id: 'rewrite-last',
				label: 'rewrite 内部改写',
				snippet: 'rewrite ^/old/(.*)$ /new/$1 last;',
				note: '地址栏不变，改完重匹配 location'
			},
			{ id: 'return-301', label: 'return 跳转', snippet: 'return 301 /new-page;', note: '直接回状态码，目标写在后面' },
			{ id: 'return-403', label: 'return 拒绝', snippet: 'return 403;', note: '403 / 410 对应 Apache 的 [F] / [G]' },
			{
				id: 'try-files',
				label: 'try_files 路由兜底',
				snippet: 'try_files $uri $uri/ /index.php?$query_string;',
				note: '按顺序找文件，最后一个参数是兜底'
			}
		]
	},
	{
		id: 'header',
		name: '响应头与错误页',
		items: [
			{
				id: 'add-header',
				label: 'add_header',
				snippet: 'add_header X-Content-Type-Options "nosniff";',
				note: '给响应加一个头'
			},
			{
				id: 'add-header-always',
				label: 'add_header always',
				snippet: 'add_header X-Frame-Options "SAMEORIGIN" always;',
				note: '错误响应也要带上时加 always'
			},
			{ id: 'error-page', label: 'error_page', snippet: 'error_page 404 /404.html;', note: '指定错误码返回哪个页面' },
			{
				id: 'error-page-multi',
				label: 'error_page 多个码',
				snippet: 'error_page 500 502 503 504 /50x.html;',
				note: '一个页面接管多个错误码'
			}
		]
	},
	{
		id: 'dir',
		name: '目录与索引',
		items: [
			{ id: 'index', label: 'index', snippet: 'index index.html index.php;', note: '目录请求默认返回哪个文件' },
			{ id: 'autoindex', label: 'autoindex', snippet: 'autoindex off;', note: 'off 对应 Options -Indexes' },
			{ id: 'charset', label: 'charset', snippet: 'charset utf-8;', note: '给文本响应声明字符集' },
			{
				id: 'server-tokens',
				label: 'server_tokens',
				snippet: 'server_tokens off;',
				note: '隐藏响应头与错误页里的版本号'
			},
			{ id: 'etag', label: 'etag', snippet: 'etag off;', note: '关掉 ETag，多机部署时免得缓存打架' },
			{
				id: 'gzip-types',
				label: 'gzip_types',
				snippet: 'gzip_types text/css text/html text/javascript;',
				note: '指定哪些类型的响应要压缩'
			}
		]
	},
	{
		id: 'access',
		name: '访问控制与认证',
		items: [
			{ id: 'deny', label: 'deny', snippet: 'deny all;', note: '拒掉某个来源，先命中的先生效' },
			{ id: 'allow', label: 'allow', snippet: 'allow 127.0.0.1;', note: '放行某个来源，通常与 deny 一起用' },
			{
				id: 'auth-basic',
				label: 'auth_basic',
				snippet: 'auth_basic "Restricted";',
				note: '开启基础认证，引号里是提示语'
			},
			{
				id: 'auth-basic-user-file',
				label: 'auth_basic_user_file',
				snippet: 'auth_basic_user_file /path/to/.htpasswd;',
				note: '口令文件的绝对路径'
			},
			{ id: 'set', label: 'set', snippet: 'set $lang zh-CN;', note: '定义一个变量，后面可以引用' }
		]
	},
	{
		id: 'flags',
		name: 'rewrite 标记',
		items: [
			{
				id: 'flag-permanent',
				label: '永久跳转 301',
				snippet: 'permanent',
				insert: 'inline',
				note: '地址栏会变成新地址'
			},
			{ id: 'flag-redirect', label: '临时跳转 302', snippet: 'redirect', insert: 'inline', note: '权重仍算在原地址上' },
			{ id: 'flag-last', label: '本层结束', snippet: 'last', insert: 'inline', note: '改完按新地址重新匹配 location' },
			{ id: 'flag-break', label: '不再重匹配', snippet: 'break', insert: 'inline', note: '就地结束本层 rewrite' }
		]
	},
	{ id: 'vars', name: '变量', items: nginxVarEntries() }
];

// ------------------------------------------------------------------ 取表、筛选、插入

/** 速查表：列的就是输入框当前该写的那种格式（口径②） */
export function cheatsheetFor(direction: Direction): CheatsheetSection[] {
	return direction === 'toNginx' ? HTACCESS_SECTIONS : NGINX_SECTIONS;
}

/** 按关键词筛：label / snippet / note 三处都能命中，空组不返回（筛选只影响渲染，不动数据） */
export function filterCheatsheet(sections: CheatsheetSection[], query: string): CheatsheetSection[] {
	const keyword = query.trim().toLowerCase();
	if (keyword === '') return sections;
	return sections
		.map((section) => ({
			...section,
			items: section.items.filter((item) =>
				`${item.label}\n${item.snippet}\n${item.note}`.toLowerCase().includes(keyword)
			)
		}))
		.filter((section) => section.items.length > 0);
}

export interface CheatsheetInsertResult {
	/** 插入后的输入框内容 */
	value: string;
	/** 插入后光标该落在哪儿（插入内容之后） */
	caret: number;
}

/**
 * 点速查表一行 → 把写法插进输入框。
 * 光标位置一并给出：读 DOM 拿选区、写回选区都是组件层的事，这里只做纯计算（可单测）。
 *
 * `inline`（标记、变量）插在光标的 `[start, end)` 处 —— 它们本来就是行内片段。
 *
 * `line`（指令）另起一行，**不接在光标所在行后面**：`.htaccess` 与 nginx 都是一行一条，
 * 接在行中间会拼出一条跑不起来的配置。规则两条：
 *   - 光标所在的整行是空白 → 就用这一行（连空白一起换掉，不留空行）
 *   - 否则 → 插在光标所在行的**下面**那行
 * 所以 `end`（选区终点）在 `line` 方式下不用：跨行选区没有「插到下一行」之外更合理的解释。
 */
export function insertCheatsheetEntry(
	value: string,
	snippet: string,
	start: number,
	end: number,
	mode: InsertMode = 'line'
): CheatsheetInsertResult {
	if (mode === 'inline') {
		return { value: value.slice(0, start) + snippet + value.slice(end), caret: start + snippet.length };
	}

	const lineStart = value.lastIndexOf('\n', start - 1) + 1;
	const nextBreak = value.indexOf('\n', start);
	const lineEnd = nextBreak === -1 ? value.length : nextBreak;

	if (value.slice(lineStart, lineEnd).trim() === '') {
		return { value: value.slice(0, lineStart) + snippet + value.slice(lineEnd), caret: lineStart + snippet.length };
	}
	return {
		value: value.slice(0, lineEnd) + '\n' + snippet + value.slice(lineEnd),
		caret: lineEnd + 1 + snippet.length
	};
}
