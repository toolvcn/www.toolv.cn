# SQL 速查表 · /sql

> 在线使用：<https://www.toolv.cn/sql> ・ 数据全部本地处理，不上传、不落库、不连数据库

- **九类语句按组列出**：查询与基础 / 筛选与排序 / 聚合与分组 / 连接 / 子查询与 CTE / 建表与改表 / 索引与性能 / 事务与锁 / 排错与元信息，共 70 条；分组 chips 单选用 `aria-pressed`，默认停在「全部」（整张表都在 SSR 的 HTML 里），点「常用」只看 17 条高频语句
- **填一次变量，全部语句跟着变**：`{{table}}` 这类占位符由变量条统一替换；**你填的值加淡绿底**（一眼看出哪几个是自己填的），留空回落示例值的只有绿字。表名常驻工具条，「更多变量」（字段 / 条件 / 排序 / 行数上限 / 关联表 / 关联条件 / 索引名 / schema / 数据库名）收在折叠区
- **留空回落到示例值**：输入框空着时语句用示例值（`users` / `id, name, email` / `status = 'active'`），所以**不填任何东西也能直接复制即用**，语句里不会残留 `{{...}}` 原文；「重置」把全部输入清空回到示例值。`where` / `order` 刻意**不带关键字**（模板里已有 `WHERE` / `ORDER BY`），免得拼出 `WHERE WHERE`
- **备选写法 chips**：23 条挂了备选 —— `UNION ALL` ↔ `UNION`、`LIKE 'x%'` ↔ `'%x%'` ↔ `ILIKE`、`IS NULL` ↔ `IS NOT NULL`、`AND` ↔ `OR` ↔ 加括号、`STRING_AGG` ↔ `GROUP_CONCAT`、`CREATE INDEX` ↔ `UNIQUE`、`ALTER COLUMN … TYPE` ↔ `MODIFY COLUMN`、`EXPLAIN` ↔ `EXPLAIN ANALYZE`、Postgres ↔ MySQL 的系统视图查询等；下标 0 是主模板，第一个 chip 是「默认」
- **危险语句标注**：`DROP TABLE` / `TRUNCATE` / `DROP COLUMN` / `KILL`（destructive）与 `DROP INDEX` / 递归 CTE / `FOR UPDATE` / `EXPLAIN ANALYZE`（warn）共 8 条给红或琥珀徽章 + 悬浮说明。**只标注、不弹窗确认** —— 复制的只是文本，真正执行在用户自己的客户端里；`EXPLAIN ANALYZE` 那条特别写明「它会真的执行语句」
- **代价与平台差异写进 note**：危险语句必须写 note（体检单测会拦），如「TRUNCATE 多数库不可回滚、还会重置自增列」「递归 CTE 有环会一直跑下去」「`FOR UPDATE` 在提交前一直持锁」。Postgres 专有的（`pg_*` 函数、`CONCURRENTLY`、`VACUUM`、`LATERAL`）与 MySQL 不支持的点（`FULL OUTER JOIN`）都在 note 里注明，能给 MySQL 写法的就挂一条 variant
- **检索口径**：语句本体、中文说明、英文关键字与分组名都参与匹配（输 `慢查询`、`分页`、`去重`、`建索引`、`加字段`、`join` 都能命中）；筛选只影响渲染，不写回数据
- **复制**：每条**行首**一个图标按钮，一键复制渲染后的完整语句
- **参数预设（速查标签左栏）**：在变量条里填好表名 / 字段 / 条件等参数，起个名字点「保存」就存在本地（`localStorage` 键 `toolv:sql-presets`），点条目一键回填**整个变量条**、所有语句跟着变；悬浮条目逐条删除，标题行可导出 / 导入 JSON 备份（与 docker / git / linux 同一套面板）
- **SQL 编辑器（第二个标签）**：自己写的**词法高亮**（关键字 / 字符串 / 注释 / 数字 / 函数名 / 标点 / 其他七类），透明 textarea 叠在镜像层上，边打字边上色；工具栏给「示例 / 复制 / 清空 / 保存片段」，卡片脚注给「行数 · 字符数」并说明「高亮只做词法上色，不校验语法」
- **本地片段存档**：编辑器里写好的 SQL 可存成本地片段（`localStorage` 键 `toolv:sql-snippets`，与参数预设**分开存**：一个存变量快照、一个存长文本），上限 50 条、名称上限 40 字符；名称留空时用 SQL 首行兜底（比「未命名 1」好认）。点条目放回编辑器，列表可导出 / 导入 JSON
- **两处二次确认**：应用片段会盖掉编辑器里已有内容时先 `confirm` 问一句（内容空着或与这条一致时不问）；删除片段前也先确认 —— 本地存档删掉找不回来（与 regex 的已保存配置同一套做法）
- **超长输入降级**：编辑器内容超过 20 万字符时整段按纯文本渲染（脚注改琥珀色说明），避免粘一整个数据库 dump 进来把页面卡死；此时仍可复制
- **不连库、不执行、不上传**：本页只做「查写法 + 拼语句 + 暂存」，没有连接配置、没有凭据、不发任何请求
- **SSR 首屏有货**：语句与分组在构建期就写进 HTML，打开即可读（`+page.ts` 开了 `prerender`）

## 参数在哪调

占位符的键名、中文标签与默认示例值都在根目录 `config.ts`（`VAR_DEFS`），编辑器首屏示例也在那里（`EXAMPLE_SQL`）。
要改示例值、加一个新变量（比如 `{{alias}}`），改这一份即可 —— store 取它的 `sample` 当初始值与留空时的回落值，
变量条取 `label` / `hint` 渲染输入框，并按 `secondary` 决定哪些收进「更多变量」。

同一文件里还有三个上限与两个存储键：`MAX_SNIPPETS`（50）、`MAX_SNIPPET_NAME`（40）、
`MAX_HIGHLIGHT_CHARS`（20 万）、`PRESETS_STORAGE_KEY`（`toolv:sql-presets`）、
`SNIPPETS_STORAGE_KEY`（`toolv:sql-snippets`）。持久化本身写在 `+page.svelte`（挂载时恢复两个键、
之后每次改动写回，带 `restored` 开关防止首帧空值覆盖）；预设面板与片段面板的逻辑分别在共享的
`CheatsheetStore`（`savePreset` / `applyPreset` / `restorePresets` / `importPresetsText` 等）与
本工具的 `core/snippets.ts`（序列化 / 解析纯函数）+ `SqlStore`（片段增删与应用）。

**语句数据与分组在 `core/commands.ts`**；占位符替换、分词、搜索、分组、预设序列化与数据体检的纯逻辑在
`$lib/utils/command-cheatsheet`（四个速查工具共用），界面在 `$lib/components/CommandCheatsheet`。

## 档位

**本工具目录是 L2**：`+page.svelte` 用 `TabShell` 分了「速查表 / SQL 编辑器」两个标签
（STRUCTURE §0 把「多标签页」列为 L2 的触发条件），两个标签各自独占满屏高度、各管一层滚动 ——
同屏两栏会让两块抢高度，375 那档尤其明显。

- `config.ts`：占位符定义、两个存储键、三个上限、编辑器首屏示例
- `core/commands.ts`：九组 + 70 条语句（纯数据）；`core/store.svelte.ts`：`SqlStore`，**继承**共享的 `CheatsheetStore` 再挂上标签 / 编辑器内容 / 片段（继承而不是包一层，是因为 `CommandCheatsheet` 要的就是一个 `CheatsheetStore`）；
  `core/highlight.ts`：SQL 分词器；`core/snippets.ts`：片段存档；三者各配单测
- `ui/SqlEditor.svelte`、`ui/SnippetPanel.svelte`、`ui/PresetPanel.svelte`（后两个只是共享面板的业务绑定）、`ui/styles.ts`（高亮配色 + 编辑器镜像层排版）

界面与纯逻辑**大部分不在本目录**：速查部分的组装件与数据层是 `$lib/components/CommandCheatsheet` 与
`$lib/utils/command-cheatsheet`（被四个速查工具共用），高亮渲染是 `$lib/components/CodeView`
（被 JSON / TS / SQL 三处共用）。分词器留在本目录：只有 SQL 这一种文法用它，
按 STRUCTURE §2 C「被两个以上工具用到才提升」的口径不进 `$lib`。

## 刻意不统一

- **语句只标注危险、不做二次确认**：与「应用片段会覆盖编辑器内容」那条不同 —— 那边动的是本机数据，
  这边复制出去的只是文本，确认弹窗拦不住任何后果（与 docker / git / linux 三个速查页的口径一致）。
- **编辑器不做语法校验**：本轮只做词法上色。「缺 FROM」「括号不配对」这类结构告警属于语义层，
  要自己写一个极小的 SQL 解析器才靠谱，先不做 —— 半吊子的告警比没有告警更烦人（见「暂不支持」）。
- **片段与参数预设分开两个存储键**：形状与生命周期都不同（键值快照 vs 用户长文本），
  合并成一个 parse 会让两边都难读；两者共用同一个共享面板组件（它只认 `{ id, name }` 这个最小形状）。

## 已知取舍 / 暂不支持

- **连数据库、执行语句**：本页不发任何请求（与首页「数据本地处理」的承诺一致）；要跑语句请复制到自己客户端
- **语法校验与语义提示**：不报「缺 FROM」「字段不存在」「括号不配对」，也不做 SQL 格式化 / 美化
- **方言切换**：默认按标准 SQL 写，Postgres 专有写法在 note 里注明、能给 MySQL 写法的挂 variant，但不提供「切到 MySQL 方言」的开关
- **多语句脚本与执行计划可视化**：`EXPLAIN` 只给语句模板，不解析输出
- **片段跨设备同步**：只存本机 `localStorage`，换设备要自己导出 / 导入 JSON
- **表结构元信息拉取**：`information_schema` 那几条是给你在客户端里跑的模板，本页不连库自然也拿不到

## 数据口径

- **默认标准 SQL**：模板写成多数库都能跑通的样子；Postgres 专属的（`pg_stat_activity`、`pg_size_pretty`、
  `CONCURRENTLY`、`VACUUM`、`LATERAL`、`COMMENT ON COLUMN`）与 MySQL 不支持的（`FULL OUTER JOIN`）都在
  note 里点出来，并尽量挂一条 MySQL 的 variant。
- **note 记的是坑与代价**，不复述语句：如「`NOT IN` 的子查询里有 NULL 会一行都不返回」
  「`OFFSET` 越大越慢」「`BETWEEN` 两端都含，写日期区间要当心时间部分」
  「关联表的条件写进 `WHERE` 会把 LEFT JOIN 退化成 INNER JOIN」，都是实际排查时最常撞上的那几条。
- **每条模板都是可直接粘进客户端的完整语句**，不留「这里你自己补」的空档（变量也都有示例值兜底）。
- **危险语句的 note 说清不可逆性**：`TRUNCATE` / `DROP` 在多数库不可回滚、`DROP COLUMN` 会连数据一起没、
  `KILL` 会回滚对方正在跑的事务 —— 拿不准就先在只读副本上试。

## 实现口径

- **占位符只替换认得的键**：`{{table}}` 这类由变量条统一替换，「键名不认识就整段跳过」——`where` / `order` 刻意不带关键字（模板里已有 `WHERE` / `ORDER BY`），免得拼出 `WHERE WHERE`；留空回落 `sample`，命令里不残留 `{{...}}`
- **搜索多字段 OR**：语句本体、中文说明、英文关键字与分组名都参与匹配（输「慢查询」「分页」「join」都能命中）；筛选只影响渲染，不写回数据
- **危险语句强制写 note**：`DROP TABLE` / `TRUNCATE` / `DROP COLUMN` / `KILL`（destructive）与 `DROP INDEX` / 递归 CTE / `FOR UPDATE` / `EXPLAIN ANALYZE`（warn）共 8 条给红或琥珀徽章 + 悬浮说明，且必须在 `note` 里说清不可逆性（数据体检单测会拦住没写 note 的危险语句）
- **编辑器只做词法上色**：自己写的 SQL 分词器把关键字 / 字符串 / 注释 / 数字 / 函数名 / 标点分七类，透明 textarea 叠镜像层边打字边上色；高亮只做词法、不校验语法，超长输入（> 20 万字符）降级成纯文本渲染避免卡死
- **片段与预设分开存储**：变量快照（`toolv:sql-presets`）与长文本片段（`toolv:sql-snippets`）两个 localStorage 键，前者回填整个变量条、后者放回编辑器；应用片段会覆盖编辑器时先确认，删片段前也确认

## 验证过什么

- `core/commands.test.ts`：数据体检（危险语句必须带 note、占位符键必须能在 `VAR_DEFS` 找到、分组不重复），70 条语句与备选写法 / 危险标注全覆盖
- `core/highlight.test.ts`：SQL 分词七类（关键字 / 字符串 / 注释 / 数字 / 函数名 / 标点 / 其他）边界与转义
- `core/snippets.test.ts`：片段序列化 / 解析（空 / 超长 / 名称兜底）、两个存储键互不串扰
- 共享层单测（`$lib/utils/command-cheatsheet`）：`resolveVars` 留空回落与「不认识的键跳过」、`filterCommands` 多字段匹配
- 浏览器实测：变量条填值整表联动、预设 / 片段保存还原、双标签（速查 / 编辑器）切换、SSR 首屏有货
