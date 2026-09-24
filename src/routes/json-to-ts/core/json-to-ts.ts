// JSON → TypeScript 的纯函数：JSON.parse + 一次 DFS 收集 interface 声明。
// 不碰 DOM、不读 UI 状态，node 环境可直接单测。
// 合并规则对齐主流工具的习惯：对象数组的所有元素合成一个 interface，缺失的键标可选。
import { describeParseError } from '$lib/utils/json';
import type { GenOptions, GenResult } from './types.ts';

/** JSON 解析后的值域（JSON.parse 的产物只可能是这几种） */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface Field {
	/** 已经处理好的键名（不合法的加了引号） */
	key: string;
	type: string;
	optional: boolean;
}

interface InterfaceDecl {
	name: string;
	fields: Field[];
}

/** 生成过程的共享上下文 */
interface GenContext {
	decls: InterfaceDecl[];
	/** 已占用的接口名，用于冲突时加后缀 */
	used: Set<string>;
}

const VALID_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** 把任意字符串净化成合法标识符；空结果退回 Value */
function pascalCase(input: string): string {
	const parts = input
		.replace(/[^A-Za-z0-9_$]+/g, ' ')
		.trim()
		.split(/[\s_]+/)
		.filter((part) => part !== '');
	const joined = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join('');
	if (joined === '') return 'Value';
	return /^[A-Za-z_$]/.test(joined) ? joined : `_${joined}`;
}

/** 取一个未占用的接口名：冲突时追加 2、3、4…… */
function reserve(hint: string, ctx: GenContext): string {
	const base = pascalCase(hint);
	let name = base;
	let suffix = 2;
	while (ctx.used.has(name)) {
		name = `${base}${suffix}`;
		suffix += 1;
	}
	ctx.used.add(name);
	return name;
}

/** 键名不是合法标识符时用双引号包起来（TS 允许引号键） */
function fieldKey(raw: string): string {
	return VALID_IDENT.test(raw) ? raw : JSON.stringify(raw);
}

/** 判断是不是「真对象」——排除 null 与数组；守卫签名要贴着 JsonValue，filter 才能收窄 */
function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 递归推导类型表达式。对象（或对象数组）会注册一个 interface 并返回它的名字；
 * hint 是「父接口名 + 字段链」，用来给嵌套 interface 起可读的名字。
 */
function typeExpr(value: JsonValue, hint: string, ctx: GenContext): string {
	if (value === null) return 'null';
	switch (typeof value) {
		case 'boolean':
			return 'boolean';
		case 'number':
			return 'number';
		case 'string':
			return 'string';
	}

	if (Array.isArray(value)) {
		if (value.length === 0) return 'unknown[]';
		const elemTypes: string[] = [];
		const objects = value.filter(isPlainObject);
		// 所有对象元素合并成一个 interface（缺键的元素得到可选字段）
		if (objects.length > 0) elemTypes.push(objectInterface(objects, `${hint}Item`, ctx));
		const scalars = value.filter((item) => !isPlainObject(item));
		for (const item of scalars) {
			// 数组里的标量没有字段名，统一用 Item 后缀避免深层命名爆炸
			const type = typeExpr(item, `${hint}Item`, ctx);
			if (!elemTypes.includes(type)) elemTypes.push(type);
		}
		// 去重后单类型给 T[]，多类型给 (A | B)[]
		const uniq = [...new Set(elemTypes)];
		return uniq.length === 1 ? `${uniq[0]}[]` : `(${uniq.join(' | ')})[]`;
	}

	return objectInterface([value], hint, ctx);
}

/** 把一个或多个「同位置的候选对象」合成一个 interface，返回接口名 */
function objectInterface(objects: Array<{ [key: string]: JsonValue }>, hint: string, ctx: GenContext): string {
	const name = reserve(hint, ctx);
	// 先占位再递归：子接口的声明会在下面递归时追加，父接口保持在它前面
	const decl: InterfaceDecl = { name, fields: [] };
	ctx.decls.push(decl);

	// 键并集：记录每个键出现过的类型（去重）与出现次数（次数不足即跨元素缺失 → 可选）
	const entries = new Map<string, { types: string[]; count: number }>();
	for (const object of objects) {
		for (const [key, value] of Object.entries(object)) {
			const entry = entries.get(key) ?? { types: [], count: 0 };
			const type = typeExpr(value, hint + pascalCase(key), ctx);
			if (!entry.types.includes(type)) entry.types.push(type);
			entry.count += 1;
			entries.set(key, entry);
		}
	}

	decl.fields = [...entries].map(([key, entry]) => ({
		key: fieldKey(key),
		type: entry.types.join(' | '),
		optional: entry.count < objects.length
	}));

	return name;
}

/** 渲染一个声明块 */
function renderDecl(decl: InterfaceDecl, prefix: string): string {
	const head = `${prefix}interface ${decl.name} {`;
	if (decl.fields.length === 0) return `${head}\n}`;
	const body = decl.fields.map((field) => `\t${field.key}${field.optional ? '?' : ''}: ${field.type};`);
	return [head, ...body, '}'].join('\n');
}

/**
 * JSON 样例 → TypeScript 类型声明。
 * - 对象 → interface；标量数组 → T[]；混合数组 → (A | B)[]
 * - 对象数组合并成一个 interface，只在部分元素出现的键标 `?`
 * - null 参与 union（string | null）；空数组 → unknown[]
 */
export function jsonToTypeScript(input: string, options: GenOptions): GenResult {
	let root: JsonValue;
	try {
		root = JSON.parse(input) as JsonValue;
	} catch (error) {
		return { ok: false, error: describeParseError(input, error as Error) };
	}

	const ctx: GenContext = { decls: [], used: new Set() };
	const rootType = typeExpr(root, options.rootName, ctx);
	const prefix = options.exportKeyword ? 'export ' : '';

	// 根是对象时 decls[0] 就是根接口（占位式 push 保证顺序）；否则补一个 type 别名
	const blocks: string[] = [];
	if (!isPlainObject(root)) {
		blocks.push(`${prefix}type ${pascalCase(options.rootName)} = ${rootType};`);
	}
	for (const decl of ctx.decls) blocks.push(renderDecl(decl, prefix));

	const code = blocks.join('\n\n');
	return { ok: true, code, declarations: blocks.length };
}
