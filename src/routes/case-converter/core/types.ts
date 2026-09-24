/** 目标风格类型与展示信息。与纯逻辑放一起便于单测引用 */
export type CaseStyle = 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'title' | 'lower';

export interface CaseStyleInfo {
	style: CaseStyle;
	label: string;
	sample: string;
	/** 常用场景：告诉用户这种风格一般用在哪，选起来不纠结 */
	scenario: string;
}

export const CASE_STYLES: ReadonlyArray<CaseStyleInfo> = [
	{
		style: 'camel',
		label: '小驼峰 camelCase',
		sample: 'httpRequestTimeout',
		scenario: 'JS / Java 变量与函数名'
	},
	{
		style: 'pascal',
		label: '大驼峰 PascalCase',
		sample: 'HttpRequestTimeout',
		scenario: '类名、组件名、TypeScript 类型'
	},
	{
		style: 'snake',
		label: '下划线 snake_case',
		sample: 'http_request_timeout',
		scenario: 'Python 变量、数据库字段名'
	},
	{
		style: 'kebab',
		label: '短横线 kebab-case',
		sample: 'http-request-timeout',
		scenario: 'CSS 类名、URL 路径、文件名'
	},
	{
		style: 'constant',
		label: '常量 CONSTANT_CASE',
		sample: 'HTTP_REQUEST_TIMEOUT',
		scenario: '程序常量、环境变量名'
	},
	{
		style: 'title',
		label: '标题 Title Case',
		sample: 'Http Request Timeout',
		scenario: '文章标题、文档名称'
	},
	{
		style: 'lower',
		label: '小写空格 lower case',
		sample: 'http request timeout',
		scenario: '普通文本、备注说明'
	}
];

export const EXAMPLE_INPUT = 'parse HTTPResponse_2s-delay';

/** 输出列表的一行：风格信息（含常用场景）+ 转换结果 */
export interface CaseRow {
	style: CaseStyle;
	label: string;
	scenario: string;
	output: string;
}
