// SQL 分词器的单测：重点是**无损**与几处容易写错的边界（双写转义、嵌套块注释、小数与 $1）。
import { describe, expect, it } from 'vitest';
import { tokenizeSql, type SqlTokenKind } from './highlight.ts';
import { MAX_HIGHLIGHT_CHARS } from '../config.ts';

const textsOf = (sql: string, kind: SqlTokenKind): string[] =>
	tokenizeSql(sql)
		.filter((token) => token.kind === kind)
		.map((token) => token.text);

describe('分词：无损', () => {
	it('拼回去与输入逐字相同', () => {
		const samples = [
			'SELECT 1',
			"-- 注释\nSELECT id, name FROM users WHERE status = 'active' AND created_at > NOW() - INTERVAL '7 days';",
			"INSERT INTO t (a, b) VALUES ($1, 'it''s');",
			'/* 块 /* 嵌套 */ 注释 */',
			"a->>'k' || b::text <> 'x' -- 尾注释",
			'   ',
			''
		];
		for (const source of samples) {
			expect(
				tokenizeSql(source)
					.map((token) => token.text)
					.join('')
			).toBe(source);
		}
	});

	it('空串给空数组', () => {
		expect(tokenizeSql('')).toEqual([]);
	});

	it('超过上限时整段降级成一个 plain 片段', () => {
		const long = 'x'.repeat(MAX_HIGHLIGHT_CHARS + 1);
		const tokens = tokenizeSql(long);
		expect(tokens).toHaveLength(1);
		expect(tokens[0]!.kind).toBe('plain');
		expect(tokens[0]!.text.length).toBe(MAX_HIGHLIGHT_CHARS + 1);
	});
});

describe('分词：关键字与函数名', () => {
	it('关键字大小写不敏感', () => {
		expect(textsOf('select 1 from t', 'keyword')).toEqual(['select', 'from']);
		expect(textsOf('SELECT 1 FROM t', 'keyword')).toEqual(['SELECT', 'FROM']);
		expect(textsOf('SeLeCt 1', 'keyword')).toEqual(['SeLeCt']);
	});

	it('后跟括号的标识符判成函数名（含中间有空格的情况）', () => {
		expect(textsOf('SELECT COUNT(*) FROM t', 'function')).toEqual(['COUNT']);
		expect(textsOf('SELECT now ()', 'function')).toEqual(['now']);
		expect(textsOf('SELECT total FROM t', 'function')).toEqual([]);
	});

	it('普通标识符与表名不上色（相邻同类会合并成一段）', () => {
		expect(textsOf('SELECT user_id FROM orders', 'plain')).toEqual([' user_id ', ' orders']);
	});
});

describe('分词：字符串与注释', () => {
	it('单引号串里的双写转义与反斜杠转义都不收尾', () => {
		expect(textsOf("SELECT 'it''s ok'", 'string')).toEqual(["'it''s ok'"]);
		expect(textsOf("SELECT 'a\\'b'", 'string')).toEqual(["'a\\'b'"]);
	});

	it('双引号与反引号标识符也当字符串上色', () => {
		expect(textsOf('SELECT "my col" FROM t', 'string')).toEqual(['"my col"']);
		expect(textsOf('SELECT `my col` FROM t', 'string')).toEqual(['`my col`']);
	});

	it('未闭合的引号吃到行尾，不把后面的内容吞错', () => {
		expect(textsOf("SELECT 'oops", 'string')).toEqual(["'oops"]);
	});

	it('-- 注释到行尾为止', () => {
		expect(textsOf('-- 说明\nSELECT 1', 'comment')).toEqual(['-- 说明']);
	});

	it('块注释支持嵌套、整段算一个片段', () => {
		expect(textsOf('/* a /* b */ c */ SELECT 1', 'comment')).toEqual(['/* a /* b */ c */']);
	});
});

describe('分词：数字与运算符', () => {
	it('整数、小数、.5、十六进制、指数、$1 参数位都是数字', () => {
		expect(textsOf('1 1.5 .5 0x1F 1e3', 'number')).toEqual(['1', '1.5', '.5', '0x1F', '1e3']);
		expect(textsOf('WHERE id = $1', 'number')).toEqual(['$1']);
	});

	it('::、||、->>、% 这些运算符归标点（长的优先匹配）', () => {
		expect(textsOf('a::text', 'punct')).toEqual(['::']);
		expect(textsOf('a || b % c', 'punct')).toEqual(['||', '%']);
		expect(textsOf("payload->>'name'", 'punct')).toEqual(['->>']);
		expect(textsOf('a >= 1 AND b <> 2', 'punct')).toEqual(['>=', '<>']);
	});

	it('小数里的点不会被当成标点', () => {
		expect(textsOf('SELECT 1.5', 'punct')).toEqual([]);
	});
});
