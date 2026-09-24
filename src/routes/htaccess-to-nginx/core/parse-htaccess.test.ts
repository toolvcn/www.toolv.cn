import { describe, expect, test } from 'vitest';
import { parseFlagList, parseHtaccess, readLogicalLines, tokenize } from './parse-htaccess.ts';

describe('readLogicalLines', () => {
	test('跳过空行，注释单独保留（去掉 # 与两侧空白），行号照原文件数', () => {
		expect(readLogicalLines('\n# 说明\n\nRewriteEngine On\n')).toEqual([
			{ line: 2, text: '说明', comment: true },
			{ line: 4, text: 'RewriteEngine On', comment: false }
		]);
	});

	test('行尾 \\ 续行合并成一条，行号取首行', () => {
		const lines = readLogicalLines('RewriteCond %{HTTP_HOST} ^a$ \\\n  [OR]\n');
		expect(lines).toHaveLength(1);
		expect(lines[0]).toEqual({ line: 1, text: 'RewriteCond %{HTTP_HOST} ^a$ [OR]', comment: false });
	});

	test('行内的 # 不算注释：URL 锚点与正则里的 # 要留住', () => {
		const lines = readLogicalLines('Redirect 301 /old /new#section\n');
		expect(lines[0].comment).toBe(false);
		expect(lines[0].text).toBe('Redirect 301 /old /new#section');
	});
});

describe('tokenize', () => {
	test('引号段算一个 token，引号本身剥掉', () => {
		expect(tokenize('Header set X-Foo "a b c"')).toEqual(['Header', 'set', 'X-Foo', 'a b c']);
	});

	test('正则里的 \\. 原样保留（吃掉反斜杠会改语义）', () => {
		expect(tokenize('RewriteCond %{HTTP_HOST} ^www\\.example\\.com$ [NC]')).toEqual([
			'RewriteCond',
			'%{HTTP_HOST}',
			'^www\\.example\\.com$',
			'[NC]'
		]);
	});

	test('只还原 \\" 与 \\\\，其余反斜杠照留', () => {
		expect(tokenize('Header set X "a\\"b"')).toEqual(['Header', 'set', 'X', 'a"b']);
		expect(tokenize('Header set X a\\\\b')).toEqual(['Header', 'set', 'X', 'a\\b']);
	});

	test('空引号也算一段（值可以为空串）', () => {
		expect(tokenize('Header set X ""')).toEqual(['Header', 'set', 'X', '']);
	});
});

describe('parseFlagList', () => {
	test('[R=301,L] → 逐个标记：标记名大写、等号右边的值原样', () => {
		expect(parseFlagList('[R=301,l]')).toEqual(['R=301', 'L']);
		expect(parseFlagList('[e=lang:zh-CN]')).toEqual(['E=lang:zh-CN']);
	});

	test('不是方括号就当作没有标记', () => {
		expect(parseFlagList('')).toEqual([]);
		expect(parseFlagList('R=301')).toEqual([]);
	});
});

describe('parseHtaccess', () => {
	test('RewriteCond 挂到后面那条 RewriteRule 上', () => {
		const directives = parseHtaccess(
			'RewriteCond %{HTTPS} off\nRewriteCond %{HTTP_HOST} ^a$ [OR]\nRewriteRule ^x$ y [L]\n'
		);
		expect(directives).toHaveLength(1);
		expect(directives[0].name).toBe('RewriteRule');
		expect(directives[0].conditions.map((condition) => condition.pattern)).toEqual(['off', '^a$']);
		expect(directives[0].conditions[1].flags).toEqual(['OR']);
	});

	test('RewriteCond 后面不是 RewriteRule 时单独成条（交给转换层报错）', () => {
		const directives = parseHtaccess('RewriteCond %{HTTPS} off\nRedirect 301 /a /b\n');
		expect(directives.map((directive) => directive.name)).toEqual(['RewriteCond', 'Redirect']);
		expect(directives[0].conditions).toEqual([]);
		expect(directives[1].conditions).toEqual([]);
	});

	test('容器记路径：里面的指令能看到容器，闭合后回到上一层', () => {
		const directives = parseHtaccess('<IfModule mod_rewrite.c>\nRewriteEngine On\n</IfModule>\nRewriteEngine Off\n');
		expect(directives.map((directive) => [directive.kind, directive.containers.length])).toEqual([
			['open', 0],
			['directive', 1],
			['close', 1],
			['directive', 0]
		]);
		expect(directives[1].containers).toEqual(['IfModule mod_rewrite.c']);
	});

	test('容器标签也分词：<FilesMatch "\\.(gif|jpg)$"> 的正则进 args', () => {
		const [open] = parseHtaccess('<FilesMatch "\\.(gif|jpg)$">\n');
		expect(open.kind).toBe('open');
		expect(open.name).toBe('FilesMatch');
		expect(open.args).toEqual(['\\.(gif|jpg)$']);
	});
});
