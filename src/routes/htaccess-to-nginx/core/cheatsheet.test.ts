import { describe, expect, test } from 'vitest';
import {
	cheatsheetFor,
	filterCheatsheet,
	insertCheatsheetEntry,
	snippetPreview,
	type CheatsheetEntry,
	type CheatsheetSection
} from './cheatsheet.ts';
import { VAR_MAP } from './convert-htaccess.ts';
import { REVERSE_VARS } from './convert-nginx.ts';

/** 拍平成一层，方便按 id 找条目、查 id 是否重复 */
function flat(sections: CheatsheetSection[]): CheatsheetEntry[] {
	return sections.flatMap((section) => section.items);
}

/** 取某组（找不到就是空数组，让断言失败得更直白） */
function section(sections: CheatsheetSection[], id: string): CheatsheetEntry[] {
	return sections.find((item) => item.id === id)?.items ?? [];
}

describe('cheatsheetFor', () => {
	test('内容跟着方向走：正向列 .htaccess 写法，反向列 nginx 写法', () => {
		const toNginx = flat(cheatsheetFor('toNginx')).map((item) => item.snippet);
		expect(toNginx.some((snippet) => snippet.startsWith('RewriteRule '))).toBe(true);
		expect(toNginx.some((snippet) => snippet.startsWith('add_header '))).toBe(false);

		const toHtaccess = flat(cheatsheetFor('toHtaccess')).map((item) => item.snippet);
		expect(toHtaccess.some((snippet) => snippet.startsWith('add_header '))).toBe(true);
		expect(toHtaccess.some((snippet) => snippet.startsWith('RewriteRule '))).toBe(false);
	});

	test('变量组跟转换器的映射表对齐（加一个变量只改一处）', () => {
		const htaccessVars = section(cheatsheetFor('toNginx'), 'vars');
		expect(htaccessVars).toHaveLength(Object.keys(VAR_MAP).length);
		expect(htaccessVars.map((item) => item.snippet)).toContain('%{HTTPS}');

		const nginxVars = section(cheatsheetFor('toHtaccess'), 'vars');
		expect(nginxVars).toHaveLength(Object.keys(REVERSE_VARS).length);
		expect(nginxVars.map((item) => item.snippet)).toContain('$host');
	});

	test('变量组按名字排序，且带「对面怎么写」的说明', () => {
		const labels = section(cheatsheetFor('toHtaccess'), 'vars').map((item) => item.label);
		expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
		expect(section(cheatsheetFor('toNginx'), 'vars').find((item) => item.label === 'HTTPS')?.note).toContain('$https');
	});

	test('两套表的 id 都不重复，label 与 snippet 都不为空', () => {
		for (const sections of [cheatsheetFor('toNginx'), cheatsheetFor('toHtaccess')]) {
			const items = flat(sections);
			expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
			expect(items.every((item) => item.label !== '' && item.snippet !== '')).toBe(true);
		}
	});

	// 介绍是行内显示的（不是 tooltip）—— 少一句就只剩一个光秃秃的指令名，等于让人去翻官方文档
	test('每条都带一句非空介绍（note）', () => {
		for (const sections of [cheatsheetFor('toNginx'), cheatsheetFor('toHtaccess')]) {
			expect(flat(sections).filter((item) => item.note.trim() === '')).toEqual([]);
		}
	});

	test('标记与变量是行内插入，指令是整行插入', () => {
		const byId = new Map(flat(cheatsheetFor('toNginx')).map((item) => [item.id, item]));
		expect(byId.get('rewritecond')?.insert).toBeUndefined();
		expect(byId.get('flag-qsa')?.insert).toBe('inline');
		expect(byId.get('var-HTTPS')?.insert).toBe('inline');
	});
});

describe('filterCheatsheet', () => {
	test('空关键词原样返回', () => {
		const sections = cheatsheetFor('toNginx');
		expect(filterCheatsheet(sections, '   ')).toBe(sections);
	});

	test('label / snippet / note 三处都能命中，且大小写不敏感', () => {
		const sections = cheatsheetFor('toNginx');
		expect(flat(filterCheatsheet(sections, 'rewritecond')).map((item) => item.label)).toEqual(['RewriteCond']);
		expect(flat(filterCheatsheet(sections, 'NOSNIFF')).map((item) => item.label)).toEqual(['Header set']);
		const byNote = flat(filterCheatsheet(sections, '对应的 nginx 写法'));
		expect(byNote.length).toBeGreaterThan(0);
		expect(byNote.every((item) => item.id.startsWith('var-'))).toBe(true);
	});

	test('没命中的组不返回；全都没命中返回空数组', () => {
		const sections = cheatsheetFor('toNginx');
		expect(filterCheatsheet(sections, 'nosniff')).toHaveLength(1);
		expect(filterCheatsheet(sections, '没有这种东西')).toEqual([]);
	});
});

describe('insertCheatsheetEntry', () => {
	test('inline：插在光标处并返回新光标（标记追加在规则末尾）', () => {
		const result = insertCheatsheetEntry('RewriteRule ^a$ b', '[L]', 17, 17, 'inline');
		expect(result.value).toBe('RewriteRule ^a$ b[L]');
		expect(result.caret).toBe(20);
	});

	test('inline：有选区时整段替换（选中旧标记换成新标记）', () => {
		const result = insertCheatsheetEntry('RewriteRule ^a$ b [R=301]', '[R=301,QSA]', 18, 25, 'inline');
		expect(result.value).toBe('RewriteRule ^a$ b [R=301,QSA]');
		expect(result.caret).toBe(29);
	});

	test('line：光标在行中间时插到该行下面，不改原行', () => {
		const result = insertCheatsheetEntry('RewriteEngine On\nRewriteBase /', 'RewriteCond %{HTTPS} off', 5, 5);
		expect(result.value).toBe('RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteBase /');
		expect(result.value.slice(0, result.caret)).toBe('RewriteEngine On\nRewriteCond %{HTTPS} off');
	});

	test('line：光标在空行上时就写进那一行，不留空行', () => {
		const result = insertCheatsheetEntry('RewriteEngine On\n\nOptions -Indexes', 'Options +Indexes', 17, 17);
		expect(result.value).toBe('RewriteEngine On\nOptions +Indexes\nOptions -Indexes');
		expect(result.caret).toBe(33);
	});

	test('line：只有空白字符的行也算空行', () => {
		expect(insertCheatsheetEntry('a\n   \nb', 'X', 3, 3).value).toBe('a\nX\nb');
	});

	test('line：光标在末行末尾时追加一行', () => {
		const result = insertCheatsheetEntry('RewriteEngine On', 'RewriteBase /', 16, 16);
		expect(result.value).toBe('RewriteEngine On\nRewriteBase /');
		expect(result.caret).toBe(result.value.length);
	});

	test('line：空输入直接写入', () => {
		expect(insertCheatsheetEntry('', 'RewriteEngine On', 0, 0)).toEqual({ value: 'RewriteEngine On', caret: 16 });
	});

	test('line：多行片段整块插进来，光标落在末尾', () => {
		const snippet = 'if ($scheme != "https") {\n    return 301 /x;\n}';
		const result = insertCheatsheetEntry('autoindex off;', snippet, 14, 14);
		expect(result.value).toBe(`autoindex off;\n${snippet}`);
		expect(result.caret).toBe(result.value.length);
	});

	test('line：整行插入忽略选区（跨行选区没有「插到下一行」之外的解释）', () => {
		const result = insertCheatsheetEntry('RewriteEngine On\nOptions -Indexes', 'RewriteBase /', 0, 32);
		expect(result.value).toBe('RewriteEngine On\nRewriteBase /\nOptions -Indexes');
	});
});

describe('snippetPreview', () => {
	test('单行原样返回', () => {
		expect(snippetPreview('autoindex off;')).toBe('autoindex off;');
	});

	test('多行只取前两行（窄栏里展不开）', () => {
		expect(snippetPreview('if ($x) {\n    return 403;\n}')).toBe('if ($x) {\n    return 403;');
	});
});
