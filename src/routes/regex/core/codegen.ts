// 代码生成：把当前的 /表达式/修饰符 转成各语言的示例代码（匹配 + 替换），纯函数、无 DOM。
// 每种语言按各自的转义规则把 pattern 包进字面量，并映射修饰符到该语言的写法
// （Python 的 re.I / Java 的 Pattern.MULTILINE / Go 的内联 (?i) 等）。
// 输出固定的中文注释示例，便于复制后直接跑。
export type CodeLang = 'javascript' | 'typescript' | 'python' | 'php' | 'java' | 'go' | 'ruby' | 'c';

export interface CodeLangOption {
	id: CodeLang;
	label: string;
}

/** 界面展示顺序即数组顺序 */
export const CODE_LANGS: ReadonlyArray<CodeLangOption> = [
	{ id: 'javascript', label: 'JavaScript' },
	{ id: 'typescript', label: 'TypeScript' },
	{ id: 'python', label: 'Python' },
	{ id: 'php', label: 'PHP' },
	{ id: 'java', label: 'Java' },
	{ id: 'go', label: 'Go' },
	{ id: 'ruby', label: 'Ruby' },
	{ id: 'c', label: 'C' }
];

/** 示例文本：跟 README 首页默认样例一致，换任何语言跑结果都可对照 */
const SAMPLE_TEXT = '开始日期 2026-09-05，结束日期 2026-10-01';

// ------------------------------------------------------------ 转义助手

/** JS / Ruby 的正则字面量：只转义分隔斜杠 */
function escapeForLiteral(pattern: string): string {
	return pattern.replace(/\//g, '\\/');
}

/** Java / Go 的字符串字面量：反斜杠与双引号都要转义 */
function escapeForQuoted(pattern: string): string {
	return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Python 的 r"" 原始串：只转义双引号 */
function escapeForPythonRaw(pattern: string): string {
	return pattern.replace(/"/g, '\\"');
}

/** PHP 双引号串（\d 这类未知转义原样保留）：转义反斜杠、双引号、$ 与定界符 ~ */
function escapeForPhp(pattern: string): string {
	return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/~/g, '\\~');
}

// ------------------------------------------------------------ 修饰符映射

/** JS 兼容的修饰符字母（d / v 是较新的规范，也保留） */
const JS_VALID_FLAGS = 'gimsuydv';

function jsFlags(flags: string): string {
	return [...flags].filter((f) => JS_VALID_FLAGS.includes(f)).join('');
}

/** 示例要「列出全部匹配」就离不开 g；没有就补上并在注释里说明 */
function jsFlagsForExample(flags: string): { f: string; note: string } {
	const base = jsFlags(flags);
	if (base.includes('g')) return { f: base, note: '' };
	return { f: `${base}g`, note: '（示例自动补了 g 修饰符）' };
}

function pythonFlagArgs(flags: string): string {
	const parts: string[] = [];
	if (flags.includes('i')) parts.push('re.I');
	if (flags.includes('m')) parts.push('re.M');
	if (flags.includes('s')) parts.push('re.S');
	return parts.join(' | ');
}

function phpModifiers(flags: string): string {
	return [...flags].filter((f) => 'ims'.includes(f)).join('');
}

function javaFlagArgs(flags: string): string {
	const parts: string[] = [];
	if (flags.includes('i')) parts.push('Pattern.CASE_INSENSITIVE');
	if (flags.includes('m')) parts.push('Pattern.MULTILINE');
	if (flags.includes('s')) parts.push('Pattern.DOTALL');
	return parts.join(' | ');
}

/** Go 没有 i/m/s 修饰符参数，用内联 (?i) 写在表达式开头 */
function goInlinePrefix(flags: string): string {
	let prefix = '';
	if (flags.includes('i')) prefix += '(?i)';
	if (flags.includes('m')) prefix += '(?m)';
	if (flags.includes('s')) prefix += '(?s)';
	return prefix;
}

/** Ruby 里 /m 让 . 匹配换行（等价 JS 的 s），m（多行）本来就是默认行为 */
function rubyFlags(flags: string): string {
	let out = '';
	if (flags.includes('i')) out += 'i';
	if (flags.includes('s')) out += 'm';
	return out;
}

/** C / POSIX：无 DOTALL；i → REG_ICASE，m → REG_NEWLINE（^ $ 匹配行首尾） */
function cFlags(flags: string): string {
	const parts: string[] = [];
	if (flags.includes('i')) parts.push('REG_ICASE');
	if (flags.includes('m')) parts.push('REG_NEWLINE');
	return parts.length ? ` | ${parts.join(' | ')}` : '';
}

// ------------------------------------------------------------ 各语言代码

function jsTsSnippet(pattern: string, flags: string, lang: 'javascript' | 'typescript'): string {
	const { f, note } = jsFlagsForExample(flags);
	const typed = lang === 'typescript' ? ': RegExp' : '';
	const decl = `const regex${typed} = /${escapeForLiteral(pattern)}/${f};`;
	return `// 匹配：找出所有匹配${note}
${decl}
const text = '${SAMPLE_TEXT}';
const matches = [...text.matchAll(regex)];
for (const m of matches) {
  console.log('匹配：', m[0], '位置：', m.index);
}

// 替换：$1 引用第 1 组，$<name> 引用命名组，$& 引用整段匹配
const replaced = text.replace(regex, '年份=$1');
console.log(replaced);`;
}

function pythonSnippet(pattern: string, flags: string): string {
	const args = pythonFlagArgs(flags);
	const compile = args ? `re.compile(pattern, ${args})` : 're.compile(pattern)';
	return `import re

# 匹配：找出所有匹配（finditer 天然全局，无需 g 修饰符）
pattern = r"${escapeForPythonRaw(pattern)}"
regex = ${compile}
text = "${SAMPLE_TEXT}"
for m in regex.finditer(text):
    print("匹配：", m.group(0), "位置：", m.start())

# 替换：\\1 引用第 1 组，命名组用 \\g<name>
replaced = regex.sub(r"年份=\\1", text)
print(replaced)`;
}

function phpSnippet(pattern: string, flags: string): string {
	const mods = phpModifiers(flags);
	return `<?php

// 匹配：找出所有匹配（preg_match_all 天然全局，无需 g 修饰符）
$pattern = "~${escapeForPhp(pattern)}~${mods}";
$text = '${SAMPLE_TEXT}';
if (preg_match_all($pattern, $text, $matches)) {
    print_r($matches[0]);
}

// 替换：$1 引用第 1 组，\${name} 引用命名组
$replaced = preg_replace($pattern, '年份=$1', $text);
echo $replaced;`;
}

function javaSnippet(pattern: string, flags: string): string {
	const args = javaFlagArgs(flags);
	const compile = args ? `Pattern.compile(pattern, ${args})` : 'Pattern.compile(pattern)';
	return `import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 匹配：找出所有匹配
String pattern = "${escapeForQuoted(pattern)}";
Pattern regex = ${compile};
Matcher matcher = regex.matcher("${SAMPLE_TEXT}");
while (matcher.find()) {
    System.out.println("匹配：" + matcher.group(0));
}

// 替换：$1 引用第 1 组，\${name} 引用命名组
String replaced = regex.matcher("${SAMPLE_TEXT}").replaceAll("年份=$1");
System.out.println(replaced);`;
}

function goSnippet(pattern: string, flags: string): string {
	const inline = goInlinePrefix(flags);
	return `package main

import (
	"fmt"
	"regexp"
)

func main() {
	// 匹配：找出所有匹配（Go 的 i/m/s 用内联 (?i)(?m)(?s) 写在开头）
	pattern := "${escapeForQuoted(inline + pattern)}"
	regex := regexp.MustCompile(pattern) // 非法表达式会直接 panic
	text := "${SAMPLE_TEXT}"
	for _, m := range regex.FindAllStringSubmatch(text, -1) {
		fmt.Println("匹配：", m[0])
	}

	// 替换：$1 引用第 1 组，\${name} 引用命名组
	replaced := regex.ReplaceAllString(text, "年份=$1")
	fmt.Println(replaced)
}`;
}

function rubySnippet(pattern: string, flags: string): string {
	const mods = rubyFlags(flags);
	return `# 匹配：找出所有匹配（scan 天然全局，无需 g；Ruby 的 /m 让 . 匹配换行，等价 JS 的 s）
regex = /${escapeForLiteral(pattern)}/${mods}
text = "${SAMPLE_TEXT}"
text.scan(regex) { |m| p m }

# 替换：\\1 引用第 1 组，命名组用 \\k<name>
replaced = text.gsub(regex, '年份=\\1')
puts replaced`;
}

function cSnippet(pattern: string, flags: string): string {
	const mods = cFlags(flags);
	return `#include <regex.h>
#include <stdio.h>
#include <string.h>

// 匹配：POSIX ERE。注意 \\d \\w 这类简写不支持，要用 [[:digit:]] [[:alpha:]] 等字符类
regex_t regex;
int rc = regcomp(&regex, "${escapeForQuoted(pattern)}", REG_EXTENDED${mods});
if (rc != 0) { /* 编译失败，可 regerror() 取详情 */ }

const char *text = "${SAMPLE_TEXT}";
regmatch_t m[3]; // 1 组 + 整体，按需调整大小
size_t cursor = 0;
while (regexec(&regex, text + cursor, 3, m, 0) == 0) {
	printf("匹配：%.*s 位置：%zu\\n",
	       (int)(m[0].rm_eo - m[0].rm_so), text + cursor + m[0].rm_so, cursor + m[0].rm_so);
	cursor += m[0].rm_eo;
	if (m[0].rm_eo == m[0].rm_so) cursor++; // 防空匹配死循环
}

// 替换：C 无现成 API，用 regexec 手工拼；$1 等组引用需按 m[n].rm_so/rm_eo 自行展开
char out[1024] = "";
cursor = 0;
size_t out_len = 0;
while (regexec(&regex, text + cursor, 3, m, 0) == 0 && out_len < sizeof(out) - 1) {
	int keep = (int)(m[0].rm_so);
	int len = m[0].rm_eo - m[0].rm_so;
	memcpy(out + out_len, text + cursor, (size_t)keep); out_len += (size_t)keep;
	// 这里演示替换为固定文本，需要组引用时用 text[cursor+m[n].rm_so] 拷贝
	const char *rep = "年份=$1";
	memcpy(out + out_len, rep, strlen(rep)); out_len += strlen(rep);
	cursor += m[0].rm_eo;
	if (m[0].rm_eo == m[0].rm_so) cursor++;
}
strcpy(out + out_len, text + cursor);
out[out_len + strlen(text + cursor)] = '\\0';
printf("%s\\n", out);

regfree(&regex);`;
}

const GENERATORS: Record<CodeLang, (pattern: string, flags: string) => string> = {
	javascript: (p, f) => jsTsSnippet(p, f, 'javascript'),
	typescript: (p, f) => jsTsSnippet(p, f, 'typescript'),
	python: pythonSnippet,
	php: phpSnippet,
	java: javaSnippet,
	go: goSnippet,
	ruby: rubySnippet,
	c: cSnippet
};

/** 生成某一语言的示例代码。pattern / flags 直接来自正则栏，不在此处再校验。 */
export function generateCode(pattern: string, flags: string, lang: CodeLang): string {
	return GENERATORS[lang](pattern, flags);
}
