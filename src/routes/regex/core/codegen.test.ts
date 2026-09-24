// 代码生成单测：各语言片段的关键写法、转义与修饰符映射。
import { describe, expect, it } from 'vitest';
import { CODE_LANGS, generateCode } from './codegen.ts';

const PATTERN = '(\\d{4})-(\\d{2})-(\\d{2})';
const FLAGS = 'gi';

describe('语言与转义', () => {
	it('JS 输出正则字面量与修饰符，斜杠被转义', () => {
		const code = generateCode('a/b', 'g', 'javascript');
		expect(code).toContain('const regex = /a\\/b/g;');
	});

	it('TS 声明带类型标注', () => {
		const code = generateCode('\\d+', 'g', 'typescript');
		expect(code).toContain('const regex: RegExp');
	});

	it('Java 字符串里反斜杠转义成双反斜杠', () => {
		const code = generateCode('\\d+', '', 'java');
		expect(code).toContain('"\\\\d+"');
	});

	it('Go 用 MustCompile，且内联 (?i) 写在表达式开头', () => {
		const code = generateCode('\\d+', 'i', 'go');
		expect(code).toContain('regexp.MustCompile');
		expect(code).toContain('pattern := "(?i)\\\\d+"');
	});

	it('Python 用 re.compile，i 映射为 re.I', () => {
		const code = generateCode('\\d+', 'i', 'python');
		expect(code).toContain('re.compile(pattern, re.I)');
	});

	it('PHP 用 preg_match_all', () => {
		const code = generateCode('\\d+', 'i', 'php');
		expect(code).toContain('preg_match_all');
		expect(code).toContain('~i"');
	});

	it('Ruby 里 JS 的 s 修饰符映射成 m', () => {
		const code = generateCode('.', 's', 'ruby');
		expect(code).toContain('regex = /./m');
	});

	it('C 用 POSIX regcomp，i 映射为 REG_ICASE', () => {
		const code = generateCode('\\d+', 'i', 'c');
		expect(code).toContain('regcomp(&regex,');
		expect(code).toContain('REG_EXTENDED | REG_ICASE');
	});

	it('C 字符串里反斜杠转义成双反斜杠', () => {
		const code = generateCode('\\d+', '', 'c');
		expect(code).toContain('"\\\\d+"');
	});
});

describe('修饰符边界', () => {
	it('没有 g 时 JS 示例自动补 g 并说明', () => {
		const code = generateCode('\\d+', '', 'javascript');
		expect(code).toContain('/\\d+/g');
		expect(code).toContain('自动补了 g');
	});

	it('替换示例按各语言语法给出', () => {
		const py = generateCode(PATTERN, FLAGS, 'python');
		expect(py).toContain('regex.sub');
		const java = generateCode(PATTERN, FLAGS, 'java');
		expect(java).toContain('replaceAll');
		const ruby = generateCode(PATTERN, FLAGS, 'ruby');
		expect(ruby).toContain('gsub');
	});
});

describe('覆盖全部语言', () => {
	it('每种语言都能生成非空代码', () => {
		for (const lang of CODE_LANGS) {
			const code = generateCode(PATTERN, FLAGS, lang.id);
			expect(code.length).toBeGreaterThan(20);
		}
	});
});
