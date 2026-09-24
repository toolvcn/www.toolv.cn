// SQL 速查表的**可配置参数**：占位符（变量）定义、两个 localStorage 键与几个上限。
// 要改示例值（换成自己库里的表名 / 字段）、加一个新占位符，改这里就够了。
//
// 为什么建这个文件（STRUCTURE §2 B 的门槛）：同一份定义被**两处以上**引用 ——
// ① `core/store.svelte.ts` 把它交给共享的 CheatsheetStore（取 `sample` 当初始值与留空时的回落值）；
// ② 变量条（`$lib/components/CommandCheatsheet/VarBar`）取 `label` / `hint` 渲染输入框，
//    并按 `secondary` 决定哪些收进「更多变量」；
// ③ `ui/SqlEditor.svelte` 的片段名兜底与 `core/snippets.ts` 的上限同属这一份口径。
// 分开写迟早出现「改了示例值、输入框提示没变」。
//
// 边界（免得这个文件越长越杂）：
//   - 只放**数值与文案**。命令数据与分组在 `core/commands.ts`、类型在
//     `$lib/utils/command-cheatsheet`、SQL 分词与配色各自在自己的文件里 —— 都不进这里。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放工具根目录（不在 `core/` 下）：它是面向人的调参入口，跟 `+page.svelte` 同级最好找。

import type { CheatsheetVarDef } from '$lib/utils/command-cheatsheet';

/**
 * 全部占位符，顺序即「更多变量」里的渲染顺序。
 *
 * 第一个（`table`）是主要变量，常驻工具条；其余 `secondary` 的收进「更多变量」折叠。
 * 示例值之间是**配合好的一套**：拿默认值直接跑，`SELECT id, name, email FROM users LIMIT 10;`
 * 这类语句是完整可用的，不是各写各的占位符。
 *
 * `where` / `order` 刻意**不带关键字**（只写条件与排序项本身）：模板里已经有 `WHERE` / `ORDER BY`，
 * 让用户连关键字一起填，复制出去就是 `WHERE WHERE status = 'active'`。
 */
export const VAR_DEFS: CheatsheetVarDef[] = [
	{
		key: 'table',
		label: '表名',
		sample: 'users',
		hint: '主查询那张表；带 schema 时写 public.users'
	},
	{
		key: 'columns',
		label: '字段',
		sample: 'id, name, email',
		hint: '逗号分隔，可带别名（id AS user_id）',
		secondary: true
	},
	{
		key: 'where',
		label: '筛选条件',
		sample: "status = 'active'",
		hint: '只写条件本身，不用写 WHERE',
		secondary: true
	},
	{
		key: 'order',
		label: '排序',
		sample: 'created_at DESC',
		hint: '只写排序项，不用写 ORDER BY',
		secondary: true
	},
	{ key: 'limit', label: '行数上限', sample: '10', hint: 'LIMIT / FETCH 后面那个数', secondary: true },
	{
		key: 'join_table',
		label: '关联表',
		sample: 'orders',
		hint: 'JOIN 进来那张表',
		secondary: true
	},
	{
		key: 'join_on',
		label: '关联条件',
		sample: 'orders.user_id = users.id',
		hint: 'ON 后面的条件，两个表名都写全',
		secondary: true
	},
	{
		key: 'index',
		label: '索引名',
		sample: 'idx_users_email',
		hint: '约定叫 idx_表_字段，方便按表找',
		secondary: true
	},
	{
		key: 'schema',
		label: 'schema',
		sample: 'public',
		hint: 'Postgres 的命名空间；MySQL 里一般是库名',
		secondary: true
	},
	{
		key: 'database',
		label: '数据库名',
		sample: 'app_db',
		hint: '连的是哪个库，排查连接数时要用',
		secondary: true
	}
];

/**
 * 编辑器里的首屏示例。给一段**能看出高亮效果**的真实语句（注释 / 字符串 / 数字 / 函数 / 关键字都有），
 * 顺带也是「一条完整查询长什么样」的示范 —— 空编辑器对新用户没有信息量。
 */
export const EXAMPLE_SQL = `-- 最近 7 天的活跃用户与订单数
SELECT u.id,
       u.name,
       COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.status = 'active'
  AND u.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 10;
`;

/** 参数预设（一组变量值）的 localStorage 键 —— 与 docker / git / linux 同一套机制 */
export const PRESETS_STORAGE_KEY = 'toolv:sql-presets';

/** 自定义 SQL 片段的 localStorage 键 —— 与预设分开存：一个存变量快照，一个存用户的长文本 */
export const SNIPPETS_STORAGE_KEY = 'toolv:sql-snippets';

/** 片段条数上限：本地存档不是数据库，超出的在解析时直接截断 */
export const MAX_SNIPPETS = 50;

/** 片段名上限，超出截断（名称留空时用 SQL 首行兜底，同样截断到这个长度） */
export const MAX_SNIPPET_NAME = 40;

/**
 * 编辑器高亮的字符上限。超过就整段按纯文本渲染 ——
 * 粘一整个数据库 dump 进来时，逐个 token 生成 `<span>` 会把页面卡死，
 * 而这时候用户要的是「能看见、能复制」，不是「上色」。
 */
export const MAX_HIGHLIGHT_CHARS = 200000;
