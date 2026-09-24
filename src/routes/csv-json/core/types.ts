// CSV ↔ JSON 的类型、选项元数据与示例。

/** 支持的分隔符：逗号（RFC 4180）、分号（欧式 Excel）、Tab、竖线 */
export type Delimiter = ',' | ';' | '\t' | '|';

export interface DelimiterOption {
	value: Delimiter;
	label: string;
	description: string;
}

export const DELIMITER_OPTIONS: ReadonlyArray<DelimiterOption> = [
	{ value: ',', label: '逗号', description: 'RFC 4180 标准，最常见' },
	{ value: ';', label: '分号', description: '欧洲区 Excel 导出默认用它' },
	{ value: '\t', label: 'Tab', description: '从 Excel / 表格软件直接复制粘贴常见' },
	{ value: '|', label: '竖线', description: '日志与数据库导出常见' }
];

/** 转换方向：各自保留一份输入，切换不丢内容 */
export type Direction = 'csv-to-json' | 'json-to-csv';

export interface CsvToJsonOptions {
	delimiter: Delimiter;
	/** 首行是否为表头（键名）；关闭后用 col1、col2…… 当键 */
	headerRow: boolean;
	/** 值类型推断：数字 / true / false / null 自动转对应类型；关闭后全部按字符串 */
	inferTypes: boolean;
}

export interface JsonToCsvOptions {
	delimiter: Delimiter;
	/** 对象数组是否把键列表写成首行表头 */
	writeHeader: boolean;
}

export type ConvertResult = ConvertOk | ConvertError;

export interface ConvertOk {
	ok: true;
	text: string;
	/** 数据行数（不含表头） */
	rows: number;
	/** 列数 */
	columns: number;
}

export interface ConvertError {
	ok: false;
	error: string;
}

/** CSV → JSON 示例：覆盖引号包裹的逗号、内嵌引号、数值与布尔 */
export const EXAMPLE_CSV = `name,role,notes,active
无情,admin,"会写代码，""也写文档""",true
alice,dev,"负责前端，后面转全栈",true
bob,dev,"休假中",false`;

/** JSON → CSV 示例：对象数组，其中一行缺一个键（对应 CSV 留空） */
export const EXAMPLE_JSON = `[
	{ "name": "无情", "role": "admin", "email": "wuqing@example.com" },
	{ "name": "alice", "role": "dev", "email": "alice@example.com" },
	{ "name": "bob", "role": "dev" }
]`;
