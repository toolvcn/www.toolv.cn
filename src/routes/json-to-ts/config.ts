// JSON 转 TypeScript 的**可配置参数**：默认示例、默认根类型名、默认 export 开关。
// 后期要调这一页的行为，先改这里 —— 不必去 core/ 与 ui/ 里翻。
//
// 边界（免得这个文件越长越杂，也免得下一个人不知道某样东西该不该放进来）：
//   - 只放**业务数值与开关**。类型在 `core/types.ts`、界面文案在各 ui 组件的 label / hint、
//     样式在 `ui/styles.ts` —— 都不进这里。
//   - 纯数据、不碰 DOM：`core/*`、`ui/*` 与 `+page.svelte` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找；
// 与 STRUCTURE §1「逻辑进 core/」的偏离是有意的，理由是「让人一眼看到去哪改」。

// ---------------------------------------------------------------- 默认示例

/**
 * 首屏示例：覆盖嵌套对象、对象数组（含可选键）、标量数组、混合数组、null 与需要引号的键。
 * 「粘贴即生成」的页面首屏必须有东西可看，所以示例就是空盘数据（清空后也是靠它恢复）。
 */
export const EXAMPLE_JSON = `{
	"id": 42,
	"name": "微工具",
	"tags": ["dev", "tools"],
	"scores": [98, 87.5],
	"owner": {
		"id": 1,
		"nickname": "无情",
		"roles": ["admin", "dev"]
	},
	"members": [
		{ "id": 1, "name": "alice", "email": "alice@example.com" },
		{ "id": 2, "name": "bob" }
	],
	"mixed": [1, "two", null],
	"created_at": "2026-01-01T00:00:00.000Z",
	"retry-count": 3
}`;

// ---------------------------------------------------------------- 默认选项

/**
 * 默认根类型名。取 `Root` 而不是 `RootObject`：生成的子接口名是「父名 + 字段」
 * （`RootOwner` / `RootMembersItem`），根名越短，嵌套越深时名字越不会长得没法看。
 * 不合法的字符会被净化成合法标识符，所以这里填什么都出不了错。
 */
export const DEFAULT_ROOT_NAME = 'Root';

/** 默认给声明加 `export`：生成的代码直接粘进 .ts 文件就能用，不用再手动补 */
export const DEFAULT_EXPORT_KEYWORD = true;

/**
 * 根类型名的输入上限（字符）。
 * 不是业务限制 —— 名字过长会让所有子接口名一起变长（`RootOwner` 之类），
 * 输入框里也看不全；40 个字符已经足够写清一个类型名。
 */
export const MAX_ROOT_NAME = 40;
