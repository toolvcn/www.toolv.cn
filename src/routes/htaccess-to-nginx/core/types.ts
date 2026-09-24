// htaccess ↔ Nginx 工具的类型与页面常量。两个方向共用这一份。

/** 转换方向：toNginx = .htaccess → nginx；toHtaccess = nginx → .htaccess（反向） */
export type Direction = 'toNginx' | 'toHtaccess';

/** 一次转换的结果：输出文本 + 转出来的条数 + 提示明细。两个方向形状一致 */
export interface ConversionResult {
	text: string;
	/** 真正转过去的条数（被注释掉、只留说明的不算） */
	converted: number;
	warnings: ConversionWarning[];
}

/** 警告级别：manual 能转但语义有差、unsupported 当前做不到 */
export type WarningLevel = 'manual' | 'unsupported';

/** 一条转换提示：行号 + 原文 + 级别 + 该怎么办 */
export interface ConversionWarning {
	/** 源文件行号（1 起；续行取首行） */
	line: number;
	/** 原始指令（续行已合并、注释已去掉） */
	source: string;
	level: WarningLevel;
	/** 为什么不能直译、该怎么改 */
	reason: string;
}

/** 输出缩进档 */
export type IndentStyle = '4spaces' | '2spaces' | 'tab';

export const INDENT_UNIT: Record<IndentStyle, string> = {
	'4spaces': '    ',
	'2spaces': '  ',
	tab: '\t'
};

export const DEFAULT_INDENT: IndentStyle = '4spaces';

/** 一条 RewriteCond（最终会并进它后面那条 RewriteRule 的 if 里） */
export interface RewriteCondition {
	/** 源文件行号（1 起） */
	line: number;
	/** 测试串，如 `%{HTTP_HOST}` */
	testString: string;
	/** 条件模式，如 `^www\.` 或 `-f`（`!` 取反前缀原样保留） */
	pattern: string;
	/** 原始标记（大写、已按逗号拆开），如 ['NC', 'OR'] */
	flags: string[];
	/** 原文，用于警告里回显 */
	source: string;
}

/** 解析出来的一行 */
export type DirectiveKind = 'directive' | 'comment' | 'open' | 'close';

export interface Directive {
	/** 源文件行号（1 起） */
	line: number;
	/** 原始文本（续行已合并） */
	text: string;
	kind: DirectiveKind;
	/** 指令名 / 容器名（原样大小写；注释为空串） */
	name: string;
	/** 分词后的参数（引号已剥掉） */
	args: string[];
	/** 所属容器标签，如 ['IfModule mod_rewrite.c']；顶层为空数组 */
	containers: string[];
	/** 紧跟其后的 RewriteCond（只有 RewriteRule 会带上） */
	conditions: RewriteCondition[];
}

/**
 * nginx 侧解析出来的一条语句。字段与 `Directive` 对齐（少一层 `conditions`），
 * 便于两个方向共用同一套「逐条对应 + 就地 ⚠️」的编排逻辑；
 * 差别只在容器形态：nginx 是 `server` / `location` / `if` 块，Apache 是 `<IfModule>` 这类标签。
 */
export type NginxDirective = Omit<Directive, 'conditions'> & {
	/**
	 * `if` 块的条件原文（含外层括号、引号原样，取自源文件切片）；其余语句没有这个字段。
	 * 从 token 反拼会把 `"y"` 的右括号并进引号里，所以解析时就切好存下来。
	 */
	condition?: string;
};

/** 首屏示例：六条主流用法 + 一条 nginx 标准模块做不到的，正好演示「转换 + 就地标注」 */
export const EXAMPLE_HTACCESS = `# 强制 HTTPS 并统一到 www
RewriteEngine On
RewriteBase /

RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://www.example.com/$1 [R=301,L]

# 老地址迁移
Redirect 301 /old-page /new-page

# 安全响应头
Header set X-Content-Type-Options "nosniff"

ErrorDocument 404 /404.html
DirectoryIndex index.html
Options -Indexes

# 下面这条 nginx 做不到，会被就地点名
php_value upload_max_filesize 10M
`;

/**
 * 反向首屏示例：与 `EXAMPLE_HTACCESS` 一一对应（HTTPS 跳转 / 老地址迁移 / 响应头 / 404 页 / 首页 / 目录索引），
 * 同样带一条「对面做不到的」，用来演示反向也会就地标注而不是静默丢掉。
 */
export const EXAMPLE_NGINX = `# 强制 HTTPS 并统一到 www
server {
    if ($scheme != "https") {
        return 301 https://www.example.com$request_uri;
    }

    # 老地址迁移
    rewrite ^/old-page(.*)$ /new-page$1 permanent;

    # 安全响应头
    add_header X-Content-Type-Options "nosniff";

    error_page 404 /404.html;
    index index.html;
    autoindex off;

    # 下面这条 .htaccess 做不到，会被就地点名
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
    }
}
`;
