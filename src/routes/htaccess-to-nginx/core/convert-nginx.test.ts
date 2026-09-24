import { describe, expect, test } from 'vitest';
import { convertNginx, NGINX_HEADER_PREFIXES } from './convert-nginx.ts';

/** 摘掉顶部那段说明，只留正文（正文里的注释都不会以 NGINX_HEADER_PREFIXES 开头） */
function body(text: string): string {
	return text
		.split('\n')
		.filter((line) => !NGINX_HEADER_PREFIXES.some((prefix) => line.startsWith(prefix)))
		.join('\n')
		.trim();
}

describe('convertNginx · rewrite', () => {
	test('permanent 转成 [R=301,L]，模式与目标去掉前导斜杠', () => {
		const result = convertNginx('rewrite ^/old/(.*)$ /new/$1 permanent;\n');
		expect(body(result.text)).toBe('RewriteRule ^old/(.*)$ /new/$1 [R=301,L]');
		expect(result.converted).toBe(1);
		expect(result.warnings).toEqual([]);
		expect(result.text).toContain('# 注意：nginx 的 rewrite 模式匹配完整 URI');
	});

	test('last 转成 [L]，内部改写去掉前导斜杠', () => {
		expect(body(convertNginx('rewrite ^/a$ /b last;\n').text)).toBe('RewriteRule ^a$ b [L]');
	});

	test('没有标记时也不加标记（Apache 里同样是继续往下走）', () => {
		expect(body(convertNginx('rewrite ^/a$ /b;\n').text)).toBe('RewriteRule ^a$ b');
	});

	test('break 给 [L] 但要说明语义差', () => {
		const result = convertNginx('rewrite ^/a$ /b break;\n');
		expect(body(result.text)).toContain('RewriteRule ^a$ b [L]');
		expect(result.warnings[0].reason).toContain('break 只在本 location 内生效');
	});

	test('模式里的 (?i) 转成 [NC]（nginx 没有大小写不敏感开关之外的位置）', () => {
		expect(body(convertNginx('rewrite (?i)^/A$ /b last;\n').text)).toBe('RewriteRule ^A$ b [NC,L]');
	});

	test('没写 ^ 的模式去掉前导斜杠后范围会变大，要提醒', () => {
		const result = convertNginx('rewrite /old /new last;\n');
		expect(body(result.text)).toContain('RewriteRule old new [L]');
		expect(result.warnings.some((warning) => warning.reason.includes('范围可能变大'))).toBe(true);
	});

	test('替换目标带 ? 要提醒加 [QSA]', () => {
		const result = convertNginx('rewrite ^/a$ /b?x=1 last;\n');
		expect(result.warnings.some((warning) => warning.reason.includes('[QSA]'))).toBe(true);
	});

	test('模式或目标里用了 nginx 变量就降级，不硬拼', () => {
		const result = convertNginx('rewrite ^/(.*)$ $scheme://$host/$1 permanent;\n');
		expect(result.converted).toBe(0);
		expect(result.warnings[0].reason).toContain('nginx 变量');
	});

	test('没收录的标记只给提示，不生成配置', () => {
		const result = convertNginx('rewrite ^/a$ /b if=1;\n');
		expect(result.converted).toBe(0);
		expect(result.warnings[0].reason).toContain('if=1');
	});
});

describe('convertNginx · if → RewriteCond', () => {
	test('if 的条件带进 RewriteRule，!= 转成锚定的否定匹配', () => {
		const result = convertNginx('if ($scheme != "https") {\n    return 301 https://www.example.com$request_uri;\n}\n');
		expect(body(result.text)).toBe(
			[
				'# ⚠️ 需人工确认：if ($scheme != "https") {',
				'#    条件里的 = / != 是精确等值，Apache 的 RewriteCond 走正则，这里已自动补上 ^ 与 $ 锚点',
				'# 目标里的 $request_uri 已拆成 Apache 的 /$1（原查询串会由 RewriteRule 自动带上）',
				'RewriteCond %{REQUEST_SCHEME} !^https$',
				'RewriteRule ^(.*)$ https://www.example.com/$1 [R=301,L]'
			].join('\n')
		);
		expect(result.converted).toBe(1);
	});

	test('文件 / 目录测试原样落到 RewriteCond', () => {
		const result = convertNginx('if (-f $request_filename) {\n    rewrite ^ /index.php last;\n}\n');
		expect(body(result.text)).toBe(['RewriteCond %{REQUEST_FILENAME} -f', 'RewriteRule ^ index.php [L]'].join('\n'));
	});

	test('~* 转成 [NC]，正则里的空格用引号保住', () => {
		expect(body(convertNginx('if ($http_user_agent ~* "bot") {\n    return 403;\n}\n').text)).toContain(
			'RewriteCond %{HTTP_USER_AGENT} bot [NC]'
		);
		expect(body(convertNginx('if ($request_uri ~ "^/a b") {\n    return 403;\n}\n').text)).toContain(
			'RewriteCond %{REQUEST_URI} "^/a b"'
		);
	});

	test('&& 铺成多条 RewriteCond，|| 铺成带 [OR] 的', () => {
		const and = convertNginx('if ($https = "" && $host != "www.example.com") {\n    return 403;\n}\n');
		expect(body(and.text)).toContain('RewriteCond %{HTTPS} ^$\nRewriteCond %{HTTP_HOST} !^www\\.example\\.com$');
		const or = convertNginx('if ($host = "a" || $host = "b") {\n    return 403;\n}\n');
		expect(body(or.text)).toContain('RewriteCond %{HTTP_HOST} ^a$ [OR]\nRewriteCond %{HTTP_HOST} ^b$');
	});

	test('认不出的变量让整条 if 降级，里面的规则注释保留', () => {
		const result = convertNginx('if ($time_iso8601 ~ "^2024") {\n    return 403;\n}\n');
		expect(result.warnings[0].reason).toContain('$time_iso8601');
		expect(body(result.text)).toContain('# RewriteRule ^ - [F,L]');
		expect(result.converted).toBe(0);
	});

	test('嵌套 if 降级（RewriteCond 不能嵌套）', () => {
		const result = convertNginx('if ($host = "a") {\n    if ($https = "") {\n        return 403;\n    }\n}\n');
		expect(result.warnings.some((warning) => warning.reason.includes('不能'))).toBe(true);
		expect(result.converted).toBe(0);
	});

	test('没认出的条件写法报出来', () => {
		const result = convertNginx('if ($a == $b) {\n    return 403;\n}\n');
		expect(result.warnings[0].reason).toContain('没认出这条 if 条件');
	});

	test('if 里的非 rewrite / return 指令搬不出条件，整条注释保留（不放大作用范围）', () => {
		const result = convertNginx('if ($host = "a.com") {\n    add_header X-Foo "1";\n}\n');
		expect(result.converted).toBe(0);
		expect(body(result.text)).toContain('# Header set X-Foo 1');
		expect(result.warnings.some((warning) => warning.reason.includes('写在 nginx 的 if 块里'))).toBe(true);
	});

	test('if 里的 try_files 同样整条注释（它给的模板带不上条件，不如留给人看）', () => {
		const result = convertNginx('if ($host = "a") {\n    try_files $uri $uri/ /index.php;\n}\n');
		expect(result.converted).toBe(0);
		expect(body(result.text)).toContain('# RewriteRule ^ index.php [L]');
	});

	test('被注释掉的指令不占「只提一次」的名额，顶层那条仍给提示', () => {
		const result = convertNginx('if ($host = "a") {\n    add_header X-A "1";\n}\nadd_header X-B "2";\n');
		const lines = body(result.text).split('\n');
		expect(lines[lines.indexOf('Header set X-B 2') - 1]).toBe(
			'# 提示：nginx 的 add_header 是「追加」，Apache 的 Header set 是「替换」——同名头已在响应里时不会被顶掉'
		);
		expect(result.converted).toBe(1);
	});
});

describe('convertNginx · return', () => {
	test('3xx 转成 RewriteRule，重定向目标保留前导斜杠', () => {
		expect(body(convertNginx('return 301 /new-page;\n').text)).toBe('RewriteRule ^ /new-page [R=301,L]');
	});

	test('403 / 410 落到 Apache 的 F / G 标记', () => {
		expect(body(convertNginx('return 403;\n').text)).toBe('RewriteRule ^ - [F,L]');
		expect(body(convertNginx('return 410;\n').text)).toBe('RewriteRule ^ - [G,L]');
	});

	test('444 与 4xx / 5xx 给提示（Apache 没有直接返回状态码的指令）', () => {
		expect(convertNginx('return 444;\n').warnings[0].reason).toContain('444');
		const notFound = convertNginx('return 404;\n');
		expect(notFound.converted).toBe(0);
		expect(notFound.warnings[0].reason).toContain('ErrorDocument 404');
	});
});

describe('convertNginx · 其它指令', () => {
	test('add_header → Header set，并把这个语义差只提一次', () => {
		const result = convertNginx('add_header X-Content-Type-Options "nosniff";\nadd_header X-Frame-Options DENY;\n');
		expect(body(result.text)).toBe(
			[
				'# 提示：nginx 的 add_header 是「追加」，Apache 的 Header set 是「替换」——同名头已在响应里时不会被顶掉',
				'Header set X-Content-Type-Options nosniff',
				'Header set X-Frame-Options DENY'
			].join('\n')
		);
		expect(result.converted).toBe(2);
	});

	test('always 转成 Header always set', () => {
		expect(body(convertNginx('add_header X-Foo "a b" always;\n').text)).toBe('Header always set X-Foo "a b"');
	});

	test('error_page → ErrorDocument（多个状态码铺成多行）', () => {
		expect(body(convertNginx('error_page 404 /404.html;\n').text)).toBe('ErrorDocument 404 /404.html');
		expect(body(convertNginx('error_page 500 502 /50x.html;\n').text)).toBe(
			['ErrorDocument 500 /50x.html', 'ErrorDocument 502 /50x.html'].join('\n')
		);
	});

	test('error_page 的 =状态码 / 具名 location 降级', () => {
		expect(convertNginx('error_page 404 =200 /empty.gif;\n').warnings[0].level).toBe('manual');
		expect(convertNginx('error_page 404 @fallback;\n').warnings[0].reason).toContain('具名 location');
	});

	test('一条对应一行的那些指令', () => {
		expect(body(convertNginx('autoindex off;\n').text)).toBe('Options -Indexes');
		expect(body(convertNginx('autoindex on;\n').text)).toBe('Options +Indexes');
		expect(body(convertNginx('index index.html index.php;\n').text)).toBe('DirectoryIndex index.html index.php');
		expect(body(convertNginx('charset utf-8;\n').text)).toBe('AddDefaultCharset utf-8');
		expect(body(convertNginx('server_tokens off;\n').text)).toBe('ServerSignature Off');
		expect(body(convertNginx('etag off;\n').text)).toBe('FileETag None');
		expect(body(convertNginx('gzip_types text/css text/html;\n').text)).toBe(
			[
				'# 提示：Apache 侧压缩要开 mod_deflate（SetOutputFilter DEFLATE），并确认 deflate_module 已加载',
				'AddOutputFilterByType DEFLATE text/css text/html'
			].join('\n')
		);
	});

	test('deny / allow 带上 Order 的语义差提示（只提一次）', () => {
		const result = convertNginx('deny all;\nallow 127.0.0.1;\n');
		expect(body(result.text)).toBe(
			[
				'# 提示：Apache 的 Deny / Allow 谁赢由 Order 决定，要先写一条 Order deny,allow 或 Order allow,deny（Apache 2.4 更推荐 Require，装 mod_access_compat 后这两条仍可用）',
				'Deny from all',
				'Allow from 127.0.0.1'
			].join('\n')
		);
	});

	test('auth_basic 拆成 AuthType + AuthName', () => {
		expect(body(convertNginx('auth_basic "Restricted";\n').text)).toBe(
			['AuthType Basic', 'AuthName Restricted'].join('\n')
		);
		expect(body(convertNginx('auth_basic_user_file /etc/htpasswd;\n').text)).toBe('AuthUserFile /etc/htpasswd');
	});

	test('set → SetEnv，并说明变量作用域不同', () => {
		const result = convertNginx('set $lang zh-CN;\n');
		expect(body(result.text)).toContain('SetEnv lang zh-CN');
		expect(result.warnings[0].reason).toContain('SetEnv 只是环境变量');
	});

	test('try_files 给「文件 / 目录测试」模板', () => {
		const result = convertNginx('try_files $uri $uri/ /index.php?$query_string;\n');
		expect(body(result.text)).toContain(
			[
				'RewriteCond %{REQUEST_FILENAME} !-f',
				'RewriteCond %{REQUEST_FILENAME} !-d',
				'RewriteRule ^ index.php [L]'
			].join('\n')
		);
		expect(result.converted).toBe(1);
		expect(result.warnings[0].level).toBe('manual');
	});

	test('try_files 的 =404 / 具名 location 兜底只给提示', () => {
		expect(convertNginx('try_files $uri $uri/ =404;\n').converted).toBe(0);
		expect(convertNginx('try_files $uri @app;\n').warnings[0].reason).toContain('具名 location');
	});

	test('nginx 专有指令降级：proxy_pass 未支持、root / listen 只能人工', () => {
		expect(convertNginx('proxy_pass http://127.0.0.1:8080;\n').warnings[0].level).toBe('unsupported');
		expect(convertNginx('root /var/www;\n').warnings[0].reason).toContain('DocumentRoot');
		expect(convertNginx('listen 80;\n').warnings[0].reason).toContain('VirtualHost');
	});

	test('未收录的指令降级成「未支持」注释，原文一并留着', () => {
		const result = convertNginx('worker_processes 4;\n');
		expect(body(result.text)).toContain('# ⚠️ 未支持：worker_processes 4;');
		expect(result.warnings[0]).toMatchObject({ line: 1, level: 'unsupported' });
	});
});

describe('convertNginx · 容器与缩进', () => {
	test('server { } 是外壳，展开不缩进', () => {
		expect(body(convertNginx('server {\n    autoindex off;\n}\n').text)).toBe(
			['# ↓ server { } 是 nginx 的外壳，.htaccess 里没有对应写法，内容已展开', 'Options -Indexes'].join('\n')
		);
	});

	test('location ~ 文件名正则 → <FilesMatch>，内容跟着缩进', () => {
		const source = 'location ~ \\.(php|html)$ {\n    add_header Cache-Control "max-age=1";\n}\n';
		const result = convertNginx(source);
		expect(body(result.text)).toBe(
			[
				'<FilesMatch "\\.(php|html)$">',
				'    # 提示：nginx 的 add_header 是「追加」，Apache 的 Header set 是「替换」——同名头已在响应里时不会被顶掉',
				'    Header set Cache-Control max-age=1',
				'</FilesMatch>'
			].join('\n')
		);
		expect(result.converted).toBe(1);
	});

	test('location ~* 用 (?i) 表达大小写不敏感；缩进档可换', () => {
		const source = 'location ~* \\.(jpg|png)$ {\n    autoindex off;\n}\n';
		expect(body(convertNginx(source).text)).toContain('<FilesMatch "(?i)\\.(jpg|png)$">');
		expect(body(convertNginx(source, 'tab').text)).toContain('\tOptions -Indexes');
		expect(body(convertNginx(source, '2spaces').text)).toContain('\n  Options -Indexes');
	});

	test('location / 展开且点明「.htaccess 本来就作用在目录根」', () => {
		expect(body(convertNginx('location / {\n    autoindex off;\n}\n').text)).toBe(
			['# ↓ location / 是 nginx 的兜底块，.htaccess 本来就作用在目录根上，内容已展开', 'Options -Indexes'].join('\n')
		);
	});

	test('前缀 / 正则带路径 / 具名 / 精确匹配的 location 只能平铺并提醒', () => {
		expect(convertNginx('location /api/ {\n    autoindex off;\n}\n').warnings[0].reason).toContain('没有对应容器');
		expect(convertNginx('location ~ ^/admin/ {\n    autoindex off;\n}\n').warnings[0].reason).toContain('<FilesMatch>');
		expect(convertNginx('location @app {\n    autoindex off;\n}\n').warnings[0].reason).toContain('具名 location');
		expect(convertNginx('location = /x {\n    autoindex off;\n}\n').warnings[0].reason).toContain('精确匹配');
	});

	test('<FilesMatch> 里不能放 rewrite，就地拦下', () => {
		const result = convertNginx('location ~ \\.php$ {\n    rewrite ^ /index.php last;\n}\n');
		expect(result.warnings[0].reason).toContain('不能写在 <FilesMatch> 里');
		expect(result.converted).toBe(0);
	});

	test('map 与其它 nginx 专有块降级', () => {
		expect(convertNginx('map $http_host $name {\n    default 1;\n}\n').warnings[0].reason).toContain('RewriteMap');
		expect(convertNginx('upstream app {\n    server 127.0.0.1:8080;\n}\n').warnings[0].level).toBe('unsupported');
	});
});

describe('convertNginx · 顶部说明', () => {
	test('有提示时给出汇总', () => {
		const result = convertNginx('return 403;\nproxy_pass http://127.0.0.1:8080;\n');
		expect(result.text).toContain('# 本次共 1 处提示：需人工确认 0 处、未支持 1 处');
	});

	test('一条提示都没有时不加汇总行', () => {
		expect(convertNginx('autoindex off;\n').text).not.toContain('# 本次共');
	});

	test('空输入返回空文本', () => {
		expect(convertNginx('   \n\n').text).toBe('');
	});

	test('原注释原样带进输出（顺序与源文件一致）', () => {
		expect(body(convertNginx('# 老地址迁移\nrewrite ^/old-page(.*)$ /new-page$1 permanent;\n').text)).toBe(
			'# 老地址迁移\nRewriteRule ^old-page(.*)$ /new-page$1 [R=301,L]'
		);
	});

	test('有 RewriteRule 时提醒包一层 <IfModule mod_rewrite.c>', () => {
		expect(convertNginx('rewrite ^/a$ /b last;\n').text).toContain('mod_rewrite');
	});
});
