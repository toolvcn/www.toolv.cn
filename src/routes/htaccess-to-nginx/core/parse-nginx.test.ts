import { describe, expect, test } from 'vitest';
import { parseNginx, tokenizeNginx } from './parse-nginx.ts';

/** 只挑出 [类型, 值] 方便断言；text 保留引号与转义，单独断言 */
function shape(source: string): Array<[string, string]> {
	return tokenizeNginx(source).map((token) => [token.kind, token.value]);
}

describe('tokenizeNginx', () => {
	test('引号段算一个 token，引号本身剥掉', () => {
		const [token] = tokenizeNginx('"a b c";').filter((item) => item.kind === 'word');
		expect(token.value).toBe('a b c');
		expect(token.text).toBe('"a b c"');
	});

	test('分号、花括号各成一个 token；行号独立跟着走', () => {
		expect(shape('server {\n  index index.html;\n}\n')).toEqual([
			['word', 'server'],
			['open', '{'],
			['word', 'index'],
			['word', 'index.html'],
			['semi', ';'],
			['close', '}']
		]);
	});

	test('词中间的花括号属于词本身：^/a{2}$ 不被拆开', () => {
		expect(shape('location ~ ^/a{2}$ {\n}\n')).toEqual([
			['word', 'location'],
			['word', '~'],
			['word', '^/a{2}$'],
			['open', '{'],
			['close', '}']
		]);
	});

	test('正则里的 \\. 原样保留（吃掉反斜杠会改语义）', () => {
		const words = tokenizeNginx('location ~ \\.(php)$ {').filter((token) => token.kind === 'word');
		expect(words.map((word) => word.value)).toEqual(['location', '~', '\\.(php)$']);
	});

	test('只还原 \\" 与 \\\\，其余反斜杠照留', () => {
		expect(shape('add_header X "a\\"b";').filter((item) => item[0] === 'word')).toContainEqual(['word', 'a"b']);
		expect(shape('add_header X a\\\\b;').filter((item) => item[0] === 'word')).toContainEqual(['word', 'a\\b']);
	});

	test('引号里的 # 不是注释，引号外的才是', () => {
		expect(shape('return 301 "https://a/#x";\n# 真注释\n')).toEqual([
			['word', 'return'],
			['word', '301'],
			['word', 'https://a/#x'],
			['semi', ';'],
			['comment', '真注释']
		]);
	});
});

describe('parseNginx', () => {
	test('跨行写的指令接成一条，行号取首行', () => {
		const directives = parseNginx('add_header X-Foo\n    bar;\n');
		expect(directives).toHaveLength(1);
		expect(directives[0].line).toBe(1);
		expect(directives[0].name).toBe('add_header');
		expect(directives[0].args).toEqual(['X-Foo', 'bar']);
		expect(directives[0].text).toBe('add_header X-Foo bar;');
	});

	test('块记路径：location 里的指令能看到两层容器，闭合后回到上一层', () => {
		const directives = parseNginx(
			'server {\n    location /api/ {\n        proxy_pass http://127.0.0.1:8080;\n    }\n}\n'
		);
		expect(directives.map((directive) => [directive.kind, directive.containers.length])).toEqual([
			['open', 0],
			['open', 1],
			['directive', 2],
			['close', 2],
			['close', 1]
		]);
		expect(directives[0].text).toBe('server {');
		expect(directives[1].text).toBe('location /api/ {');
		expect(directives[2].containers).toEqual(['server', 'location /api/']);
		expect(directives[3].containers).toEqual(['server', 'location /api/']);
	});

	test('if 的条件单独切出来，引号与括号原样（从 token 反拼会把 ) 并进引号）', () => {
		const [open] = parseNginx('if ($scheme != "https") {\n}\n');
		expect(open.kind).toBe('open');
		expect(open.name).toBe('if');
		expect(open.text).toBe('if ($scheme != "https") {');
		expect(open.condition).toBe('($scheme != "https")');
	});

	test('text 是源文件切片：跨行压成一行，引号里的空白不动', () => {
		expect(parseNginx('add_header X-Foo\n    bar;\n')[0].text).toBe('add_header X-Foo bar;');
		expect(parseNginx('add_header X "a  b";\n')[0].text).toBe('add_header X "a  b";');
	});

	test('注释单独成条，正文去掉 # 与两侧空白', () => {
		const directives = parseNginx('#  老地址迁移\nrewrite ^/a$ /b last;\n');
		expect(directives[0].kind).toBe('comment');
		expect(directives[0].text).toBe('老地址迁移');
		expect(directives[1].name).toBe('rewrite');
	});

	test('末尾没写 ; 的半条指令也留下（不静默丢）', () => {
		const directives = parseNginx('index index.html;\nautoindex off');
		expect(directives.map((directive) => directive.text)).toEqual(['index index.html;', 'autoindex off']);
	});

	test('空输入得到空列表', () => {
		expect(parseNginx('   \n\n# 只有注释\n')).toHaveLength(1);
		expect(parseNginx('')).toEqual([]);
	});
});
