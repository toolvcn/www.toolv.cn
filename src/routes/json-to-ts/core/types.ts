// JSON → TypeScript 的类型与选项。
//
// 生成选项与结果类型在这里；**示例 JSON 是业务参数，收在根层 `config.ts`**
// （STRUCTURE §2 B：默认示例 / 空盘数据归 config.ts）。

/** 生成选项 */
export interface GenOptions {
	/** 根类型名；不合法或为空时自动净化成合法标识符 */
	rootName: string;
	/** 声明前是否加 export */
	exportKeyword: boolean;
}

/** 生成成功的结果：完整的 .d.ts 风格代码与统计 */
export interface GenSuccess {
	ok: true;
	code: string;
	/** 生成的 interface / type 声明个数 */
	declarations: number;
}

/** 生成失败：JSON 解析错误（尽量带行列） */
export interface GenFailure {
	ok: false;
	error: string;
}

export type GenResult = GenSuccess | GenFailure;
