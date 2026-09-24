import { describe, expect, test } from 'vitest';
import { convertHtaccess, HEADER_PREFIXES } from './convert-htaccess.ts';

/** 摘掉顶部那段说明，只留正文（正文里的注释都不会以 HEADER_PREFIXES 开头） */
function body(text: string): string {
	return text
		.split('\n')
		.filter((line) => !HEADER_PREFIXES.some((prefix) => line.startsWith(prefix)))
		.join('\n')
		.trim();
}

describe('convertHtaccess · Rewrite 家族', () => {
	test('RewriteCond + RewriteRule 转成 if + rewrite，并补上前导斜杠', () => {
		const result = convertHtaccess(
			'RewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.example\\.com$ [NC]\nRewriteRule ^old/(.*)$ new/$1 [R=301,L]\n'
		);
		expect(body(result.text)).toBe(
			[
				'# RewriteEngine On —— nginx 不需要开关，rewrite 指令写了就生效',
				'if ($host ~* ^www\\.example\\.com$) {',
				'    rewrite ^/old/(.*)$ /new/$1 permanent;',
				'}'
			].join('\n')
		);
		expect(result.converted).toBe(2);
		expect(result.warnings).toEqual([]);
	});

	test('RewriteBase 补进模式与目标（装在子目录里的 .htaccess）', () => {
		const result = convertHtaccess('RewriteBase /shop/\nRewriteRule ^list$ index.php [L]\n');
		expect(body(result.text)).toBe(
			[
				'# RewriteBase /shop/ —— 已把它当作路径前缀，补给下面 rewrite 的模式与目标',
				'rewrite ^/shop/list$ /shop/index.php last;'
			].join('\n')
		);
	});

	test('没有 L / R 时不留后缀（Apache 里也是继续往下走）', () => {
		expect(body(convertHtaccess('RewriteRule ^a$ b\n').text)).toBe('rewrite ^/a$ /b;');
	});

	test('[F] / [G] 转成 return 403 / 410，不会再冒一条「未收录标记」', () => {
		const forbid = convertHtaccess('RewriteRule ^secret/ - [F]\n');
		expect(body(forbid.text)).toBe('return 403;');
		expect(forbid.warnings).toEqual([]);
		expect(body(convertHtaccess('RewriteRule ^old/ - [G]\n').text)).toBe('return 410;');
	});

	test('替换目标是 `-` 又没加 F / G：只给提示，不生成配置', () => {
		const result = convertHtaccess('RewriteRule ^a$ - [L]\n');
		expect(result.converted).toBe(0);
		expect(result.text).toContain('替换目标是 `-`');
	});

	test('[QSA] 就地说明 nginx 默认就保留原查询串', () => {
		const result = convertHtaccess('RewriteRule ^a$ /b [QSA,R=301]\n');
		expect(body(result.text)).toBe(
			['# QSA：替换目标里不带 ? 时，nginx 本来就会把原查询串接上去，不需要额外设置', 'rewrite ^/a$ /b permanent;'].join(
				'\n'
			)
		);
	});

	test('多个 RewriteCond 缺省取且，[OR] 取或', () => {
		const result = convertHtaccess(
			'RewriteCond %{HTTP_HOST} ^a$ [OR]\nRewriteCond %{HTTPS} off\nRewriteRule ^x$ y [L]\n'
		);
		expect(body(result.text)).toContain('if ($host ~ ^a$ || $https ~ off) {');
	});

	test('RewriteEngine Off 时规则注释保留，不计入已转换', () => {
		const result = convertHtaccess('RewriteEngine Off\nRewriteRule ^a$ b [R=301,L]\n');
		expect(body(result.text)).toBe(
			[
				'# RewriteEngine Off —— nginx 没有这个开关，下面的 rewrite 规则已按「不生效」注释保留',
				'# ⚠️ 需人工确认：RewriteRule ^a$ b [R=301,L]',
				'#    原配置是 RewriteEngine Off，这条规则本来不生效，已注释保留',
				'# rewrite ^/a$ /b permanent;'
			].join('\n')
		);
		expect(result.converted).toBe(0);
		expect(result.text).toContain('# 注意：原配置里有 RewriteEngine Off');
	});

	test('条件在 nginx 里表达不出来时，整条规则注释保留', () => {
		const result = convertHtaccess('RewriteCond %{REQUEST_FILENAME} -s\nRewriteRule ^a$ b [L]\n');
		expect(body(result.text)).toContain('条件测试 -s 在 nginx 的 if 里没有对应');
		expect(body(result.text)).toContain('# rewrite ^/a$ /b last;');
		expect(result.converted).toBe(0);
	});

	test('认不出的 Apache 变量会让整条规则降级', () => {
		const result = convertHtaccess('RewriteCond %{TIME_YEAR} >2020\nRewriteRule ^a$ b [L]\n');
		expect(result.warnings[0]).toMatchObject({ line: 1, level: 'manual' });
		expect(result.warnings[0].reason).toContain('%{TIME_YEAR}');
		expect(result.converted).toBe(0);
	});
});

describe('convertHtaccess · 重定向', () => {
	test('Redirect 301 转成前缀匹配的 rewrite（子路径跟着走）', () => {
		expect(body(convertHtaccess('Redirect 301 /old /new\n').text)).toBe(
			'# Redirect 301 /old /new\nrewrite ^/old(.*)$ /new$1 permanent;'
		);
	});

	test('Redirect 缺状态时按 302 处理', () => {
		expect(body(convertHtaccess('Redirect /old /new\n').text)).toBe(
			'# Redirect /old /new\nrewrite ^/old(.*)$ /new$1 redirect;'
		);
	});

	test('RedirectMatch 的模式是完整正则，原样用', () => {
		expect(body(convertHtaccess('RedirectMatch 301 ^/tag/(.*)$ /topic/$1\n').text)).toBe(
			'# RedirectMatch 301 ^/tag/(.*)$ /topic/$1\nrewrite ^/tag/(.*)$ /topic/$1 permanent;'
		);
	});

	test('301 / 302 之外的码只给提示（nginx 关键字只有这两个）', () => {
		const result = convertHtaccess('Redirect seeother /old /new\n');
		expect(result.converted).toBe(0);
		expect(result.warnings[0].reason).toContain('303');
	});
});

describe('convertHtaccess · 其它指令', () => {
	test('Header set → add_header，并把这个语义差只提一次', () => {
		const result = convertHtaccess(
			'Header set Cache-Control "max-age=31536000, immutable"\nHeader set X-Frame-Options DENY\n'
		);
		expect(body(result.text)).toBe(
			[
				'# 提示：Apache 的 Header set 是「替换」，nginx 的 add_header 是「追加」——同名头本来存在时不会顶掉它',
				'add_header Cache-Control "max-age=31536000, immutable";',
				'add_header X-Frame-Options DENY;'
			].join('\n')
		);
	});

	test('Header unset 标未支持（nginx 标准模块做不到）', () => {
		const result = convertHtaccess('Header unset X-Powered-By\n');
		expect(result.warnings[0].level).toBe('unsupported');
		expect(body(result.text)).toContain('# ⚠️ 未支持：Header unset X-Powered-By');
	});

	test('一条对应一行的那些指令', () => {
		expect(body(convertHtaccess('ErrorDocument 404 /404.html\n').text)).toBe('error_page 404 /404.html;');
		expect(body(convertHtaccess('DirectoryIndex index.html index.php\n').text)).toBe('index index.html index.php;');
		expect(body(convertHtaccess('Options -Indexes\n').text)).toBe('autoindex off;');
		expect(body(convertHtaccess('Deny from all\n').text)).toBe('deny all;');
		expect(body(convertHtaccess('AddDefaultCharset UTF-8\n').text)).toBe('charset utf-8;');
		expect(body(convertHtaccess('ServerSignature Off\n').text)).toBe('server_tokens off;');
		expect(body(convertHtaccess('AddOutputFilterByType DEFLATE text/css text/html\n').text)).toBe(
			'# 记得配套开启 gzip：gzip on;\ngzip_types text/css text/html;'
		);
	});

	test('未收录的指令降级成「未支持」注释，原文一并留着', () => {
		const result = convertHtaccess('SetHandler none\n');
		expect(body(result.text)).toContain('# ⚠️ 未支持：SetHandler none');
		expect(body(result.text)).toContain('#    这条指令未收录');
		expect(result.warnings[0]).toMatchObject({ line: 1, level: 'unsupported' });
	});

	test('Order 这种「有语义差」的标需人工确认', () => {
		const result = convertHtaccess('Order deny,allow\n');
		expect(result.warnings[0].level).toBe('manual');
		expect(result.warnings[0].reason).toContain('先匹配先赢');
	});
});

describe('convertHtaccess · 容器与缩进', () => {
	const source =
		'<FilesMatch "\\.(gif|jpg)$">\nHeader set Cache-Control "max-age=31536000, immutable"\n</FilesMatch>\n';

	test('<FilesMatch> 转成 location 块，内容跟着缩进', () => {
		const result = convertHtaccess(source);
		// 注释落在 location 块内、紧贴它说明的那条 add_header
		expect(body(result.text)).toBe(
			[
				'location ~ \\.(gif|jpg)$ {',
				'    # 提示：Apache 的 Header set 是「替换」，nginx 的 add_header 是「追加」——同名头本来存在时不会顶掉它',
				'    add_header Cache-Control "max-age=31536000, immutable";',
				'}'
			].join('\n')
		);
		expect(result.converted).toBe(1);
	});

	test('缩进档可换成 tab / 2 空格', () => {
		expect(body(convertHtaccess(source, 'tab').text)).toContain('\tadd_header Cache-Control');
		expect(body(convertHtaccess(source, '2spaces').text)).toContain('\n  add_header Cache-Control');
	});

	test('<IfModule> 不产块，只留两行说明', () => {
		const result = convertHtaccess('<IfModule mod_rewrite.c>\nRewriteEngine On\n</IfModule>\n');
		expect(body(result.text)).toBe(
			[
				'# ↓ <IfModule mod_rewrite.c> 块：nginx 不需要模块判断，内容已展开',
				'# RewriteEngine On —— nginx 不需要开关，rewrite 指令写了就生效',
				'# ↑ </IfModule mod_rewrite.c> 块结束'
			].join('\n')
		);
	});
});

describe('convertHtaccess · 顶部说明', () => {
	test('有提示时给出汇总，用了 if 会额外提醒', () => {
		const result = convertHtaccess('RewriteCond %{HTTPS} off\nRewriteRule ^a$ b [L]\nSetHandler none\n');
		expect(result.text).toContain('# 本次共 1 处提示：需人工确认 0 处、未支持 1 处');
		expect(result.text).toContain('if is evil');
	});

	test('一条提示都没有时不加汇总行', () => {
		expect(convertHtaccess('RewriteRule ^a$ b [L]\n').text).not.toContain('# 本次共');
	});

	test('空输入返回空文本', () => {
		expect(convertHtaccess('   \n\n').text).toBe('');
	});

	test('原注释原样带进输出（顺序与源文件一致）', () => {
		expect(body(convertHtaccess('# 老地址迁移\nRedirect 301 /a /b\n').text)).toBe(
			'# 老地址迁移\n# Redirect 301 /a /b\nrewrite ^/a(.*)$ /b$1 permanent;'
		);
	});
});
