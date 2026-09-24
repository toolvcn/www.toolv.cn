// SQL 速查表的静态数据：分组元数据 + 语句表。**只有数据，没有逻辑** ——
// 占位符替换、搜索、分组、预设与界面都在共用的 `$lib/utils/command-cheatsheet` 与
// `$lib/components/CommandCheatsheet`（docker / git / linux 三个速查工具同一套）。
//
// 模板里的 `{{变量名}}` 是可替换占位符，键名在 ../config.ts 的 VAR_DEFS 里定义。
// **只替换认得的键**：别的花括号原样保留。
//
// 写数据时的四条口径（体检单测会拦下写错的）：
//   - `id` 全局唯一（keyed each 的 key 用它，不用语句文本 —— 文本会随变量变）；
//   - 模板里出现的 `{{xxx}}` 必须在 VAR_DEFS 里有定义，且每个定义都要被用到；
//   - 标了 `danger` 的必须写 `note`：危险语句要说明代价，否则徽章只是个红点；
//   - 每条都要有 `desc` 与 `keywords`（搜索靠中文动作词也能命中）。
//
// 方言口径：默认写成**标准 SQL 能在多数库上跑通的样子**，Postgres 专有的（`pg_*` 系列函数、
// `CONCURRENTLY`、`VACUUM`）在 `note` 里注明，能给 MySQL 备选写法的就挂一个 variant。
// 本页**不连数据库、不执行任何语句**，复制出去在哪儿跑由用户自己决定。

import type { CheatsheetCommand, CheatsheetGroup } from '$lib/utils/command-cheatsheet';

/** 分组元数据，顺序即渲染顺序；chip 行与列表分节都用它 */
export const SQL_GROUPS: CheatsheetGroup[] = [
	{ id: 'select', name: '查询与基础' },
	{ id: 'filter', name: '筛选与排序' },
	{ id: 'aggregate', name: '聚合与分组' },
	{ id: 'join', name: '连接' },
	{ id: 'subquery', name: '子查询与 CTE' },
	{ id: 'ddl', name: '建表与改表' },
	{ id: 'index', name: '索引与性能' },
	{ id: 'txn', name: '事务与锁' },
	{ id: 'trouble', name: '排错与元信息' }
];

export const SQL_COMMANDS: CheatsheetCommand[] = [
	// ------------------------------------------------------------------ 查询与基础
	{
		id: 's-select',
		group: 'select',
		template: 'SELECT {{columns}} FROM {{table}} LIMIT {{limit}};',
		desc: '查指定字段，最多返回若干行',
		keywords: ['查询', '取数', 'select', '看表', '前几行', '查数据'],
		featured: true,
		variants: [
			{ label: '带排序', template: 'SELECT {{columns}} FROM {{table}} ORDER BY {{order}} LIMIT {{limit}};' },
			{ label: '去重', template: 'SELECT DISTINCT {{columns}} FROM {{table}} LIMIT {{limit}};' }
		],
		note: '显式列出字段而不是 `*`：少读用不上的列，也避免表结构变更后按位置读错列'
	},
	{
		id: 's-all',
		group: 'select',
		template: 'SELECT * FROM {{table}} LIMIT {{limit}};',
		desc: '看整行内容，排查时最常用',
		keywords: ['看全部字段', 'select *', '看一行', '看原始数据'],
		note: '只适合临时排查：`*` 会把大字段（JSON / 长文本）一起读出来，也依赖列顺序'
	},
	{
		id: 's-count',
		group: 'select',
		template: 'SELECT COUNT(*) FROM {{table}} WHERE {{where}};',
		desc: '数一下符合条件的有多少行',
		keywords: ['计数', '有多少条', 'count', '总数', '行数'],
		featured: true,
		note: 'COUNT(*) 数行；COUNT(列名) 只数那一列非 NULL 的行，两者结果可能不同'
	},
	{
		id: 's-paging',
		group: 'select',
		template: 'SELECT {{columns}} FROM {{table}} ORDER BY {{order}} LIMIT {{limit}} OFFSET 20;',
		desc: '翻页：跳过前 20 行再取若干行',
		keywords: ['分页', '翻页', 'offset', 'limit', '第几页'],
		featured: true,
		note: 'OFFSET 越大越慢（前面那些行仍要读出来再丢掉）；深翻页改用「记住上一页最后一条的排序键」'
	},
	{
		id: 's-alias',
		group: 'select',
		template: 'SELECT id AS user_id, name AS user_name FROM {{table}} LIMIT {{limit}};',
		desc: '给字段起别名，让结果列名好认',
		keywords: ['别名', 'as', '重命名列', '改列名'],
		note: '别名只在结果集里生效，不影响表结构；`AS` 在多数库可省，但省掉后一旦拼错就变成两个列名，建议留着'
	},
	{
		id: 's-cast',
		group: 'select',
		template: 'SELECT CAST({{columns}} AS TEXT) FROM {{table}} LIMIT {{limit}};',
		desc: '临时转换字段类型（这里转成文本）',
		keywords: ['类型转换', 'cast', '转字符串', '转文本'],
		note: 'Postgres 还可写 `列::text`；转换失败会直接报错，不会给个默认值'
	},
	{
		id: 's-concat',
		group: 'select',
		template: "SELECT name || ' #' || id AS label FROM {{table}} LIMIT {{limit}};",
		desc: '把多个字段拼成一个显示用的字符串',
		keywords: ['拼接', 'concat', '字符串连接', '合并字段'],
		note: '`||` 是标准写法（MySQL 默认要 `CONCAT()`，除非开了 PIPES_AS_CONCAT）；有 NULL 参与时整段变 NULL，用 COALESCE 兜一下'
	},
	{
		id: 's-union',
		group: 'select',
		template: 'SELECT {{columns}} FROM {{table}} UNION ALL SELECT {{columns}} FROM {{join_table}};',
		desc: '把两张表的查询结果摞在一起',
		keywords: ['合并结果', 'union', '两张表一起查', '并集'],
		variants: [
			{
				label: '去重（UNION）',
				template: 'SELECT {{columns}} FROM {{table}} UNION SELECT {{columns}} FROM {{join_table}};'
			}
		],
		note: '`UNION ALL` 不去重、不排序，比 `UNION` 快得多；两边列数、类型、顺序必须对得上（列名以前一条为准）'
	},

	// ------------------------------------------------------------------ 筛选与排序
	{
		id: 'f-where',
		group: 'filter',
		template: 'SELECT {{columns}} FROM {{table}} WHERE {{where}};',
		desc: '按条件筛出需要的行',
		keywords: ['条件查询', '过滤', 'where', '筛选', '查符合条件的'],
		featured: true,
		note: '条件是 `=`、`>` 这类比较式的组合；字符串要加单引号，NULL 不能用 `=` 判（见「判空」那条）'
	},
	{
		id: 'f-order',
		group: 'filter',
		template: 'SELECT {{columns}} FROM {{table}} ORDER BY {{order}};',
		desc: '按某个字段排序',
		keywords: ['排序', 'order by', '按时间排', '倒序', '最大的在前'],
		featured: true,
		variants: [
			{ label: '多字段排序', template: 'SELECT {{columns}} FROM {{table}} ORDER BY {{order}} LIMIT {{limit}};' }
		],
		note: '不写 ORDER BY 时行的顺序是**不保证**的，别依赖「看起来是按插入顺序」；NULL 排在最前还是最后各库不同'
	},
	{
		id: 'f-in',
		group: 'filter',
		template: 'SELECT {{columns}} FROM {{table}} WHERE id IN (1, 2, 3);',
		desc: '在一组值里挑，等价于一串 OR',
		keywords: ['in', '枚举', '几个值之一', '批量匹配'],
		note: '列表元素多到几百个时改写成 JOIN 临时表或 `= ANY(数组)` 更好；`NOT IN` 遇到列表里有 NULL 会一行都不返回'
	},
	{
		id: 'f-like',
		group: 'filter',
		template: "SELECT {{columns}} FROM {{table}} WHERE name LIKE 'prefix%';",
		desc: '模糊匹配，这里找以某串开头的',
		keywords: ['模糊查询', 'like', '包含', '搜索', '以什么开头'],
		variants: [
			{ label: '包含（前后都通配）', template: "SELECT {{columns}} FROM {{table}} WHERE name LIKE '%mid%';" },
			{ label: '忽略大小写', template: "SELECT {{columns}} FROM {{table}} WHERE name ILIKE '%mid%';" }
		],
		note: '`%` 放开头就用不上普通索引，全靠全表扫；`ILIKE` 是 Postgres 写法，MySQL 默认排序规则本来就不区分大小写'
	},
	{
		id: 'f-between',
		group: 'filter',
		template: "SELECT {{columns}} FROM {{table}} WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31';",
		desc: '取一个区间（含两端）',
		keywords: ['区间', 'between', '日期范围', '时间范围', '这几天'],
		note: 'BETWEEN 两端都含；写日期区间要小心时间部分 —— `<= 2026-01-31` 会漏掉当天 00:00 之后的记录，常用写法是 `< 下个月一号`'
	},
	{
		id: 'f-null',
		group: 'filter',
		template: 'SELECT {{columns}} FROM {{table}} WHERE deleted_at IS NULL;',
		desc: '判断字段是否为空值',
		keywords: ['判空', 'is null', '没有值', '空值', '未删除'],
		variants: [
			{ label: '非空', template: 'SELECT {{columns}} FROM {{table}} WHERE deleted_at IS NOT NULL;' },
			{
				label: '空或等于某值',
				template: "SELECT {{columns}} FROM {{table}} WHERE deleted_at IS NULL OR deleted_at = '1970-01-01';"
			}
		],
		note: 'NULL 表示「未知」，`= NULL` 永远不成立（结果是 NULL 而不是 true），只能用 IS NULL'
	},
	{
		id: 'f-or',
		group: 'filter',
		template: "SELECT {{columns}} FROM {{table}} WHERE status = 'active' OR status = 'pending';",
		desc: '几个条件满足其一即可',
		keywords: ['或', 'or', '任一条件', '多个状态'],
		variants: [
			{
				label: '与（AND）',
				template: "SELECT {{columns}} FROM {{table}} WHERE status = 'active' AND created_at > '2026-01-01';"
			},
			{
				label: '加括号分组',
				template:
					"SELECT {{columns}} FROM {{table}} WHERE (status = 'active' OR status = 'pending') AND created_at > '2026-01-01';"
			}
		],
		note: 'AND 比 OR 先算：混着写必须加括号，否则条件会粘错'
	},
	{
		id: 'f-case',
		group: 'filter',
		template: "SELECT id, CASE WHEN status = 'active' THEN 1 ELSE 0 END AS is_active FROM {{table}} LIMIT {{limit}};",
		desc: '按条件在结果里生成一个新字段',
		keywords: ['case when', '条件列', '分支', '打标记'],
		note: '没写 ELSE 且条件都不满足时结果是 NULL（不是 0 也不是空串）；要做「分档统计」用它比写多个子查询省事'
	},

	// ------------------------------------------------------------------ 聚合与分组
	{
		id: 'a-group',
		group: 'aggregate',
		template: 'SELECT status, COUNT(*) AS cnt FROM {{table}} GROUP BY status ORDER BY cnt DESC;',
		desc: '按字段分组数数，看看每类各有多少',
		keywords: ['分组统计', 'group by', '每类多少', '分类汇总', '按状态统计'],
		featured: true,
		note: 'SELECT 里没被聚合的列都必须出现在 GROUP BY 里，否则报错（MySQL 宽松模式下会随便取一行，更危险）'
	},
	{
		id: 'a-having',
		group: 'aggregate',
		template: 'SELECT status, COUNT(*) AS cnt FROM {{table}} GROUP BY status HAVING COUNT(*) > 10;',
		desc: '分组后按聚合结果再筛一遍',
		keywords: ['having', '分组后筛选', '大于多少条', '过滤聚合结果'],
		featured: true,
		note: 'WHERE 在分组**之前**过滤行、不能用聚合函数；HAVING 在分组**之后**。能挪到 WHERE 的条件就挪过去，少算一堆行'
	},
	{
		id: 'a-sum-avg',
		group: 'aggregate',
		template: 'SELECT SUM(amount) AS total, AVG(amount) AS avg_amount FROM {{table}} WHERE {{where}};',
		desc: '求和与求平均',
		keywords: ['求和', 'sum', '平均', 'avg', '总额', '均值'],
		note: 'AVG / SUM 会跳过 NULL，分母是「非 NULL 的行数」；想按总行数算平均要用 `SUM(x) / COUNT(*)` 或 `AVG(COALESCE(x, 0))`'
	},
	{
		id: 'a-min-max',
		group: 'aggregate',
		template: 'SELECT MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM {{table}};',
		desc: '找最早与最晚的一条',
		keywords: ['最大', '最小', 'max', 'min', '最早', '最晚', '最新一条'],
		note: 'MIN/MAX 只给值不给那一行的其他字段；要连着其他列一起看，用 `ORDER BY … LIMIT 1` 或窗口函数取序号'
	},
	{
		id: 'a-count-distinct',
		group: 'aggregate',
		template: 'SELECT COUNT(DISTINCT user_id) AS users FROM {{table}};',
		desc: '数不重复的取值有几个（去重统计）',
		keywords: ['去重计数', 'count distinct', '有多少个不同的', 'uv'],
		note: 'COUNT(DISTINCT) 在大表上很贵（要排序或哈希去重）；只要近似值可用预估行数（Postgres 的 `EXPLAIN`）替代'
	},
	{
		id: 'a-window',
		group: 'aggregate',
		template: 'SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY {{order}}) AS rn FROM {{table}};',
		desc: '组内排名，给每一行编个序号',
		keywords: ['窗口函数', 'row_number', 'over', '排名', '组内序号'],
		note: '窗口函数不改行数（不像 GROUP BY 会合并行）；MySQL 8 / Postgres / SQL Server 支持，5.7 与更老的库没有'
	},
	{
		id: 'a-window-top',
		group: 'aggregate',
		template:
			'SELECT * FROM (SELECT {{columns}}, ROW_NUMBER() OVER (PARTITION BY status ORDER BY {{order}}) AS rn FROM {{table}}) t WHERE t.rn = 1;',
		desc: '取每组里最新（或排序最靠前）的那一条',
		keywords: ['每组取一条', '最新一条', '去重保留最新', 'top 1 per group'],
		featured: true,
		note: '必须套一层子查询再筛 rn —— 窗口函数的结果不能写在同一层的 WHERE 里（那时它还没算出来）'
	},
	{
		id: 'a-string-agg',
		group: 'aggregate',
		template: "SELECT status, STRING_AGG(name, ', ') AS names FROM {{table}} GROUP BY status;",
		desc: '把一组的多个值拼成一个字符串',
		keywords: ['拼接多行', 'string_agg', 'group_concat', '合并成一行'],
		variants: [
			{
				label: 'MySQL（GROUP_CONCAT）',
				template: "SELECT status, GROUP_CONCAT(name SEPARATOR ', ') AS names FROM {{table}} GROUP BY status;"
			}
		],
		note: '两者默认都不保证拼接顺序，要固定顺序得在聚合里写 `ORDER BY`（Postgres）；结果串有长度上限'
	},

	// ------------------------------------------------------------------ 连接
	{
		id: 'j-inner',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} JOIN {{join_table}} ON {{join_on}};',
		desc: '只保留两张表都能对上的行',
		keywords: ['连接', '关联查询', 'join', '连表', '两张表一起看'],
		featured: true,
		note: '`JOIN` 就是 `INNER JOIN`；两张表都有的列名要写全（`用户表.id`），否则报「列名有歧义」'
	},
	{
		id: 'j-left',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} LEFT JOIN {{join_table}} ON {{join_on}};',
		desc: '左连接：主表全保留，关联表没对上就补空',
		keywords: ['左连接', 'left join', '主表全要', '没有关联也保留', '查缺失'],
		featured: true,
		variants: [
			{
				label: '只看没关联上的',
				template:
					'SELECT {{columns}} FROM {{table}} LEFT JOIN {{join_table}} ON {{join_on}} WHERE {{join_table}}.id IS NULL;'
			}
		],
		note: '关联表的条件写在 `ON` 上和写在 `WHERE` 上结果不同：写进 `WHERE` 会把补 NULL 的行滤掉，左连接退化成内连接'
	},
	{
		id: 'j-right',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} RIGHT JOIN {{join_table}} ON {{join_on}};',
		desc: '右连接：关联表全保留',
		keywords: ['右连接', 'right join', '反过来'],
		note: '`A RIGHT JOIN B` 等于 `B LEFT JOIN A`：把两张表调个个儿写 LEFT JOIN，读起来清楚得多，实际很少用 RIGHT'
	},
	{
		id: 'j-full',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} FULL OUTER JOIN {{join_table}} ON {{join_on}};',
		desc: '两边都保留，对不上的地方补空',
		keywords: ['全连接', 'full join', '两边都要', '找差异'],
		note: 'Postgres / SQL Server 支持；**MySQL 没有 FULL OUTER JOIN**，要用 LEFT JOIN 与 RIGHT JOIN 的结果 UNION'
	},
	{
		id: 'j-using',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} JOIN {{join_table}} USING (id);',
		desc: '同名字段做连接，少写一遍条件',
		keywords: ['using', '同名字段连接', '简化 join'],
		note: 'USING 的列在结果里只出现一次（不像 `ON a.id = b.id` 会出现两列）；跨库移植性不如 ON'
	},
	{
		id: 'j-cross',
		group: 'join',
		template: 'SELECT {{columns}} FROM {{table}} CROSS JOIN {{join_table}} LIMIT {{limit}};',
		desc: '笛卡尔积：每行都与另一张表的每行配一次',
		keywords: ['笛卡尔积', 'cross join', '所有组合', '组合表'],
		note: '结果行数是两边行数之积，几张万行表一交叉就是几亿行 —— 写漏连接条件时也会变成这个，看到结果行数暴涨先查 ON'
	},
	{
		id: 'j-self',
		group: 'join',
		template:
			'SELECT child.id, parent.id AS parent_id FROM {{table}} child JOIN {{table}} parent ON child.parent_id = parent.id;',
		desc: '同一张表自己连自己（层级 / 推荐关系）',
		keywords: ['自连接', 'self join', '上下级', '树形', '父子'],
		note: '必须给同一张表起两个不同别名，否则第二处引用报错；层级很深时用递归 CTE'
	},

	// ------------------------------------------------------------------ 子查询与 CTE
	{
		id: 'q-cte',
		group: 'subquery',
		template:
			"WITH recent AS (SELECT {{columns}} FROM {{table}} WHERE created_at > NOW() - INTERVAL '7 days') SELECT * FROM recent;",
		desc: '把一段查询提成带名字的临时结果，后面反复用',
		keywords: ['cte', 'with', '临时结果集', '拆复杂查询', '最近七天'],
		featured: true,
		variants: [
			{
				label: '多段 CTE',
				template:
					'WITH a AS (SELECT id FROM {{table}}), b AS (SELECT user_id FROM {{join_table}}) SELECT * FROM a JOIN b ON a.id = b.user_id;'
			}
		],
		note: 'CTE 比嵌套子查询好读，也便于分段调试；`INTERVAL` 的写法各库不同（MySQL 用 `DATE_SUB(NOW(), INTERVAL 7 DAY)`）'
	},
	{
		id: 'q-exists',
		group: 'subquery',
		template: 'SELECT {{columns}} FROM {{table}} WHERE EXISTS (SELECT 1 FROM {{join_table}} WHERE {{join_on}});',
		desc: '只要另一张表里存在对应行就保留',
		keywords: ['exists', '存在判断', '有没有关联', '存在即保留'],
		note: '`EXISTS` 只判断有没有，子查询里写 `SELECT 1` 就够；它找到一行就停，通常比 `IN (子查询)` 更友好'
	},
	{
		id: 'q-in-sub',
		group: 'subquery',
		template: 'SELECT {{columns}} FROM {{table}} WHERE id IN (SELECT user_id FROM {{join_table}});',
		desc: '把另一张表的查询结果当成条件值列表',
		keywords: ['子查询', 'in 子查询', '嵌套查询', '按另一张表筛'],
		note: '子查询结果里若有 NULL，`NOT IN` 会一行都不返回（这是最常踩的一条）；`IN` 与 `EXISTS` 优化器常会改写成同一种计划'
	},
	{
		id: 'q-derived',
		group: 'subquery',
		template: 'SELECT t.id FROM (SELECT id, status FROM {{table}} WHERE {{where}}) t LIMIT {{limit}};',
		desc: '把子查询当成一张临时表再用它查',
		keywords: ['派生表', '子查询当表', 'from 子查询', '临时表'],
		note: '派生表必须有别名（这里 `t`），否则报语法错；多层嵌套 + UNION 时优先改成 CTE'
	},
	{
		id: 'q-scalar',
		group: 'subquery',
		template: 'SELECT {{columns}}, (SELECT COUNT(*) FROM {{join_table}}) AS total FROM {{table}} LIMIT {{limit}};',
		desc: '子查询返回单个值时，可以当成一个字段用',
		keywords: ['标量子查询', '查一个值', '当列用'],
		note: '子查询必须只返回一行一列，多了直接报错；它对外层每一行都要算一次，放在 SELECT 里对性能不友好'
	},
	{
		id: 'q-lateral',
		group: 'subquery',
		template:
			'SELECT {{columns}} FROM {{table}} t, LATERAL (SELECT * FROM {{join_table}} WHERE {{join_on}} LIMIT 1) x;',
		desc: '让子查询引用外层当前行（每行单独取一条关联记录）',
		keywords: ['lateral', '相关子查询', '每行取一条', '跨层引用'],
		note: 'Postgres / MySQL 8.0.14+ 才支持；要用它解决「每组取最新一条」时，窗口函数通常更通用'
	},
	{
		id: 'q-recursive',
		group: 'subquery',
		template:
			'WITH RECURSIVE tree AS (SELECT id, parent_id FROM {{table}} WHERE parent_id IS NULL UNION ALL SELECT c.id, c.parent_id FROM {{table}} c JOIN tree ON c.parent_id = tree.id) SELECT * FROM tree;',
		desc: '递归展开层级数据（组织树、分类树）',
		keywords: ['递归', 'recursive', '树形结构', '上下级展开', '层级'],
		danger: 'warn',
		note: '⚠️ 数据里有环或条件写错会**一直递归下去**，把连接和磁盘吃满 —— 先在只读副本上试，或加深度上限（`WHERE depth < 10`）'
	},

	// ------------------------------------------------------------------ 建表与改表
	{
		id: 'd-create',
		group: 'ddl',
		template:
			"CREATE TABLE {{table}} (id BIGINT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
		desc: '建一张新表，带上主键、非空与默认值',
		keywords: ['建表', 'create table', '新建表', '加表'],
		featured: true,
		note: '主键别用业务字段（手机号会改、身份证涉隐私）；`BIGINT` 而不是 `INT`，避免自增到 21 亿后翻车'
	},
	{
		id: 'd-alter-add',
		group: 'ddl',
		template: "ALTER TABLE {{table}} ADD COLUMN remark TEXT DEFAULT '';",
		desc: '给已有表加一列',
		keywords: ['加字段', '加列', 'alter table add', '新增字段'],
		note: '带默认值加列在部分库里会重写整张表（大表要选低峰期）；新列默认允许 NULL，要非空得补 NOT NULL 与默认值'
	},
	{
		id: 'd-alter-type',
		group: 'ddl',
		template: 'ALTER TABLE {{table}} ALTER COLUMN id TYPE BIGINT;',
		desc: '改字段类型',
		keywords: ['改类型', 'alter column', '字段类型', '扩长度'],
		variants: [
			{ label: 'MySQL（MODIFY COLUMN）', template: 'ALTER TABLE {{table}} MODIFY COLUMN id BIGINT NOT NULL;' }
		],
		note: '收窄类型（大变小）或改字符集可能锁表重写数据；MySQL 的 MODIFY 必须把列定义整段重写一遍，漏掉的属性会被丢掉'
	},
	{
		id: 'd-alter-drop',
		group: 'ddl',
		template: 'ALTER TABLE {{table}} DROP COLUMN remark;',
		desc: '删掉一列',
		keywords: ['删字段', '删列', 'drop column', '去掉字段'],
		danger: 'destructive',
		note: '⚠️ 列里的数据一并删除且**不可回滚**。先确认没有代码在读它：`DROP COLUMN` 在 Postgres 上是立即生效的（MySQL 8 也是），生产上建议先改名、观察一周再删'
	},
	{
		id: 'd-drop',
		group: 'ddl',
		template: 'DROP TABLE {{table}};',
		desc: '整张表连结构一起删掉',
		keywords: ['删表', 'drop table', '删掉整张表'],
		danger: 'destructive',
		note: '⚠️ 表与数据一起消失，事务里未必能回滚（DDL 在多数库是隐式提交）。Postgres 可加 `IF EXISTS` 避免「表不存在」报错，但不会帮你确认「删对了表」'
	},
	{
		id: 'd-truncate',
		group: 'ddl',
		template: 'TRUNCATE TABLE {{table}};',
		desc: '清空表里的所有行，保留表结构',
		keywords: ['清空表', 'truncate', '删所有行', '快速清空'],
		danger: 'destructive',
		note: '⚠️ 比 `DELETE FROM` 快得多（不逐行记日志）但也更狠：多数库**不可回滚**，还会重置自增列、连带清掉级联引用。执行前先 `SELECT COUNT(*)` 确认是哪张表'
	},
	{
		id: 'd-view',
		group: 'ddl',
		template: 'CREATE OR REPLACE VIEW v_{{table}} AS SELECT {{columns}} FROM {{table}} WHERE {{where}};',
		desc: '把常用查询存成一个视图',
		keywords: ['视图', 'create view', '存查询', '虚拟表'],
		note: '视图不存数据、每次查询展开原表；`OR REPLACE` 方便迭代，但列名或类型变化时可能报错，需要先 DROP 再建'
	},
	{
		id: 'd-comment',
		group: 'ddl',
		template: "COMMENT ON COLUMN {{table}}.status IS '订单状态';",
		desc: '给表或字段加注释说明',
		keywords: ['注释', 'comment', '字段说明', '加备注'],
		note: "Postgres / Oracle 用独立的 COMMENT 语句；MySQL 把注释写在列定义里（`status TEXT COMMENT '订单状态'`），改注释要 MODIFY COLUMN"
	},

	// ------------------------------------------------------------------ 索引与性能
	{
		id: 'i-create',
		group: 'index',
		template: 'CREATE INDEX {{index}} ON {{table}} ({{columns}});',
		desc: '给常用筛选 / 排序字段建索引',
		keywords: ['建索引', 'create index', '加速查询', '加索引'],
		featured: true,
		variants: [{ label: '唯一索引', template: 'CREATE UNIQUE INDEX {{index}} ON {{table}} (email);' }],
		note: '索引让查询快、写入慢（每次写都要维护索引）；等值条件在前、范围条件在后，顺序反了用不上'
	},
	{
		id: 'i-concurrent',
		group: 'index',
		template: 'CREATE INDEX CONCURRENTLY {{index}} ON {{table}} ({{columns}});',
		desc: '不锁表地建索引（大表上线的写法）',
		keywords: ['不锁表建索引', 'concurrently', '在线加索引', '大表索引'],
		note: 'Postgres 专属，且不能在事务块里执行、失败会留一个「无效索引」需手动删；MySQL 对应写法是 `ALTER TABLE … ADD INDEX …, ALGORITHM=INPLACE, LOCK=NONE`'
	},
	{
		id: 'i-drop',
		group: 'index',
		template: 'DROP INDEX {{index}};',
		desc: '删掉一个索引',
		keywords: ['删索引', 'drop index', '去掉索引'],
		danger: 'warn',
		note: '⚠️ 删掉后依赖它的查询会突然变慢（甚至拖垮库），先看有没有慢查询在用；MySQL 必须写成 `DROP INDEX 索引名 ON 表名`，Postgres 不许加表名'
	},
	{
		id: 'i-explain',
		group: 'index',
		template: 'EXPLAIN SELECT {{columns}} FROM {{table}} WHERE {{where}};',
		desc: '看优化器打算怎么执行这条语句',
		keywords: ['执行计划', 'explain', '看索引', '没走索引', '查询慢'],
		featured: true,
		note: '关注三件事：扫了多少行（rows）、走的是索引还是全表（Seq Scan / ALL）、有没有临时排序（Sort / Using filesort）'
	},
	{
		id: 'i-explain-analyze',
		group: 'index',
		template: 'EXPLAIN ANALYZE SELECT {{columns}} FROM {{table}} WHERE {{where}};',
		desc: '真的跑一遍，给每个步骤的实际耗时与行数',
		keywords: ['实际耗时', 'explain analyze', '慢在哪一步', '执行时间'],
		danger: 'warn',
		note: '⚠️ `ANALYZE` 会**真正执行**这条语句：写操作要先包在事务里再 ROLLBACK，或有条件时加 `BEGIN; … ROLLBACK;` 包起来'
	},
	{
		id: 'i-list',
		group: 'index',
		template: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '{{table}}';",
		desc: '看一张表上已有哪些索引',
		keywords: ['看索引', '索引列表', 'pg_indexes', '有哪些索引'],
		variants: [
			{ label: 'MySQL（SHOW INDEX）', template: 'SHOW INDEX FROM {{table}};' },
			{ label: 'MySQL（看结构）', template: 'SHOW CREATE TABLE {{table}};' }
		],
		note: '`pg_indexes` 是 Postgres 的系统视图；MySQL 用 `SHOW INDEX FROM 表名`。看结构时用 `SHOW CREATE TABLE` 最直观'
	},
	{
		id: 'i-usage',
		group: 'index',
		template: "SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = '{{table}}' ORDER BY idx_scan;",
		desc: '看索引到底有没有被用到（用来找多余索引）',
		keywords: ['索引没用上', 'idx_scan', '多余索引', '索引统计'],
		note: 'Postgres 专属；`idx_scan` 很小（尤其为 0）的索引用不上却仍在拖慢写入，可考虑删。统计从上次重置起算，进程重启也会清零'
	},
	{
		id: 'i-bloat',
		group: 'index',
		template: "SELECT pg_size_pretty(pg_total_relation_size('{{table}}')) AS total;",
		desc: '看一张表连索引一共占多大',
		keywords: ['表大小', '占多少空间', '膨胀', '磁盘占用'],
		variants: [
			{
				label: '分表 / 索引拆开看',
				template:
					"SELECT pg_size_pretty(pg_relation_size('{{table}}')) AS tbl, pg_size_pretty(pg_indexes_size('{{table}}')) AS idx;"
			}
		],
		note: "Postgres 的 `pg_*size` 系列函数；MySQL 用 `SELECT data_length, index_length FROM information_schema.tables WHERE table_name = '表名'`"
	},

	// ------------------------------------------------------------------ 事务与锁
	{
		id: 't-begin',
		group: 'txn',
		template: 'BEGIN;',
		desc: '开始一个事务，之后的语句要么一起成功、要么一起回滚',
		keywords: ['事务', 'begin', '开启事务', 'start transaction'],
		variants: [
			{ label: 'START TRANSACTION', template: 'START TRANSACTION;' },
			{ label: '读已提交隔离级别', template: 'BEGIN ISOLATION LEVEL READ COMMITTED;' }
		],
		note: '事务**开着不提交**会一直占着锁与被改的行，排查时优先看有没有卡在 idle in transaction 的会话'
	},
	{
		id: 't-rollback',
		group: 'txn',
		template: 'ROLLBACK;',
		desc: '撤销当前事务里的所有改动',
		keywords: ['回滚', 'rollback', '撤销', '改错了怎么退'],
		featured: true,
		note: '只能撤销**当前事务**里的改动；事务已提交就回不去了（要靠备份或反向补数据）'
	},
	{
		id: 't-commit',
		group: 'txn',
		template: 'COMMIT;',
		desc: '提交事务，让改动生效',
		keywords: ['提交', 'commit', '确认改动', '保存'],
		note: '提交之后才真正落盘（并开始占用 WAL / binlog）；`COMMIT` 之后再写 `ROLLBACK` 不会有任何效果'
	},
	{
		id: 't-savepoint',
		group: 'txn',
		template: 'SAVEPOINT sp1;',
		desc: '在事务里打一个存档点，可只回滚到这一点',
		keywords: ['保存点', 'savepoint', '部分回滚', '分段回滚'],
		variants: [
			{ label: '回滚到存档点', template: 'ROLLBACK TO SAVEPOINT sp1;' },
			{ label: '释放存档点', template: 'RELEASE SAVEPOINT sp1;' }
		],
		note: '适合「批量写入里某一条错了但其余的想保留」：整段仍在同一个事务里，最后还是要 COMMIT 才生效'
	},
	{
		id: 't-lock-row',
		group: 'txn',
		template: 'SELECT * FROM {{table}} WHERE id = 1 FOR UPDATE;',
		desc: '锁住这一行，别的事务改不了（读-改-写的经典写法）',
		keywords: ['行锁', 'for update', '锁一行', '并发扣减', '防止并发改'],
		danger: 'warn',
		note: '⚠️ 锁在**事务提交前一直有效**：忘提交就把这一行卡死，别的事务会排队等（`lock_timeout` 到了就报错）。锁的粒度看有没有走索引，没走索引会升级成锁全表行'
	},
	{
		id: 't-lock-skip',
		group: 'txn',
		template: "SELECT * FROM {{table}} WHERE status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED;",
		desc: '抢一条待处理任务，被别人占着就跳过（任务队列写法）',
		keywords: ['任务队列', 'skip locked', '抢任务', '不排队'],
		note: '`SKIP LOCKED` 让并发消费者各拿各的任务而不互相等；MySQL 8 / Postgres 9.5+ 支持。取到的这条在提交前对别人不可见'
	},
	{
		id: 't-isolation',
		group: 'txn',
		template: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
		desc: '设置当前事务的隔离级别',
		keywords: ['隔离级别', 'isolation', '可重复读', '读已提交'],
		variants: [{ label: '读已提交', template: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;' }],
		note: 'Postgres 默认 READ COMMITTED，MySQL InnoDB 默认 REPEATABLE READ；级别越高一致性越强、冲突与重试越多。这个词的**语义在各库并不完全一致**'
	},
	{
		id: 't-activity',
		group: 'txn',
		template: "SELECT pid, state, wait_event_type, query FROM pg_stat_activity WHERE datname = '{{database}}';",
		desc: '看当前有哪些连接在干什么（谁卡住了）',
		keywords: ['当前会话', '谁在跑', '卡住了', '活跃连接', '锁等待'],
		variants: [
			{ label: '只看非空闲', template: "SELECT pid, state, query FROM pg_stat_activity WHERE state <> 'idle';" },
			{ label: 'MySQL（PROCESSLIST）', template: 'SHOW FULL PROCESSLIST;' }
		],
		note: "Postgres 看 `pg_stat_activity`（`wait_event_type = 'Lock'` 就是卡在等锁），MySQL 用 `SHOW FULL PROCESSLIST` 或 `information_schema.innodb_trx`"
	},

	// ------------------------------------------------------------------ 排错与元信息
	{
		id: 'p-tables',
		group: 'trouble',
		template:
			"SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = '{{schema}}' ORDER BY table_name;",
		desc: '列出这个库里有哪些表',
		keywords: ['有哪些表', '表列表', 'information_schema', '找表'],
		featured: true,
		variants: [
			{ label: 'MySQL（当前库）', template: 'SHOW TABLES;' },
			{
				label: '按名字模糊找表',
				template: "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%user%';"
			}
		],
		note: '`information_schema` 是标准视图、各库都有（MySQL 的 `table_schema` 就是库名）；想连大小一起看用各库自己的系统表'
	},
	{
		id: 'p-columns',
		group: 'trouble',
		template:
			"SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '{{table}}' ORDER BY ordinal_position;",
		desc: '看一张表的字段、类型、是否可空与默认值',
		keywords: ['表结构', '字段列表', '看列定义', '有哪些字段', 'desc 表'],
		featured: true,
		variants: [
			{ label: 'MySQL（DESC）', template: 'DESC {{table}};' },
			{ label: 'MySQL（建表语句）', template: 'SHOW CREATE TABLE {{table}};' }
		],
		note: '`ordinal_position` 是列的物理顺序；同名表出现在多个 schema 时会都列出来，加上 `table_schema` 条件更准'
	},
	{
		id: 'p-indexes',
		group: 'trouble',
		template:
			"SELECT index_name, column_name, seq_in_index FROM information_schema.statistics WHERE table_name = '{{table}}' ORDER BY index_name, seq_in_index;",
		desc: '看索引由哪些列按什么顺序组成',
		keywords: ['索引结构', '组合索引顺序', '看索引列', 'statistics'],
		note: '`seq_in_index` 就是组合索引里的顺序 —— 判断「这个条件能不能用上索引」要靠它，只看索引名看不出顺序'
	},
	{
		id: 'p-conn',
		group: 'trouble',
		template: "SELECT count(*) AS conns FROM pg_stat_activity WHERE datname = '{{database}}';",
		desc: '数当前有多少连接，排查连接数打满',
		keywords: ['连接数', '打满了', 'too many connections', '连接池'],
		variants: [
			{ label: '看上限', template: 'SHOW max_connections;' },
			{ label: 'MySQL（当前连接数）', template: 'SELECT count(*) FROM information_schema.processlist;' }
		],
		note: '连接数满通常不是「人太多」而是**连接没释放**（应用没关连接池 / 卡住的事务占着）；调大上限前先看 `state` 那一列'
	},
	{
		id: 'p-slow',
		group: 'trouble',
		template:
			'SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT {{limit}};',
		desc: '按平均耗时排出最慢的语句',
		keywords: ['慢查询', '慢sql', 'pg_stat_statements', '哪个语句慢', '性能排查'],
		variants: [
			{ label: 'MySQL（慢日志开关）', template: "SHOW VARIABLES LIKE 'slow_query_log%';" },
			{
				label: 'MySQL（按总耗时排）',
				template:
					'SELECT digest_text, count_star, avg_timer_wait FROM performance_schema.events_statements_summary_by_digest ORDER BY sum_timer_wait DESC LIMIT {{limit}};'
			}
		],
		note: 'Postgres 要先 `CREATE EXTENSION pg_stat_statements` 并重启；统计口径是「同一种语句模板合并」，看 `mean_exec_time` 也要看 `calls`'
	},
	{
		id: 'p-kill',
		group: 'trouble',
		template: 'SELECT pg_terminate_backend(12345);',
		desc: '踢掉一个卡住的连接（进程号从 pg_stat_activity 里拿）',
		keywords: ['杀会话', 'kill', '踢连接', '卡住了怎么办', 'pg_terminate_backend'],
		danger: 'destructive',
		note: '⚠️ 直接掐断连接：**它正在跑的事务会回滚**，客户端会收到连接中断。先确认 `state` / `query` 是不是真该杀；MySQL 对应 `KILL 12345;`'
	},
	{
		id: 'p-vacuum',
		group: 'trouble',
		template: 'VACUUM ANALYZE {{table}};',
		desc: '回收垃圾行并更新统计信息，让优化器选对计划',
		keywords: ['vacuum', '回收空间', '统计信息', 'analyze', '表膨胀'],
		variants: [
			{ label: 'MySQL（更新统计）', template: 'ANALYZE TABLE {{table}};' },
			{ label: 'Postgres（只看不清理）', template: 'VACUUM VERBOSE {{table}};' }
		],
		note: 'Postgres 的 `VACUUM` 清理失效行、`ANALYZE` 更新统计（两条常一起跑）；MySQL 的 `ANALYZE TABLE` 只更新统计、不回收空间（要 `OPTIMIZE TABLE`，会锁表）'
	},
	{
		id: 'p-grants',
		group: 'trouble',
		template:
			"SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = '{{table}}';",
		desc: '看谁对这张表有什么权限',
		keywords: ['权限', 'grant', '谁能访问', '权限不足', '没有权限'],
		variants: [
			{ label: 'MySQL（当前用户权限）', template: 'SHOW GRANTS FOR CURRENT_USER();' },
			{ label: 'Postgres（当前用户）', template: 'SELECT current_user, session_user;' }
		],
		note: '报「权限不足」时先确认 `current_user` 到底是哪个账号（应用连接池里配的常不是你以为的那个）；`information_schema` 只列当前用户看得见的授权'
	}
];
