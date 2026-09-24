# /regex 工具改造计划

## Context

对 `src/routes/regex/` 做一次功能性升级，用户已确认三个方向：

1. **测试文本 + 匹配详情合并成一个中央工作区面板**，用标签切换；代码生成、图解也收进同一个工作区。
2. 正则输入栏新增**清空按钮**。
3. 新增三个能力：**文本替换**、**代码生成**（js/ts/python/php/java/go/ruby）、**正则图解**（自实现分组树状图，不引入依赖，SSR 可预渲染）。
4. 体验类收尾：**速查表样式优化**、**常用正则内边距优化**、术语「旗标」统一改名**「修饰符」**。

附加要求：代码结构保持清晰、模块职责单一，交付时附一份代码结构讲解便于用户理解。

约束（AGENTS.md）：纯前端、数据本地；不引大型依赖；runes 模式；逻辑进 `core/`、界面进 `ui/`；不整页 `csr`、内容不包 `{#if browser}`；样式只用 Tailwind 默认调色板；测试按需写、就近放。

## 目标布局

```
桌面 lg（两列）              桌面 xl（三列）
┌─────────┬───────────────┐  ┌─────────┬───────────────┬──────────┐
│ 常用正则 │  正则表达式 /…/修饰符  │  │ 常用正则 │  正则表达式 /…/修饰符  │  速查表    │
│（左栏通高）│ [文本|匹配|替换|代码|图解] │  │（左栏通高）│ [文本|匹配|替换|代码|图解] │（右栏通高）│
│         │  当前标签内容（自适应滚动）│  │         │  当前标签内容            │          │
└─────────┴───────────────┘  └─────────┴───────────────┴──────────┘
```

- `lg` 用 `grid-cols-[15rem_minmax(0,1fr)]`；`xl` 加右栏 `21rem`。
- 左栏 = 常用正则（PresetCard，通高）；中央上 = 正则栏（PatternCard）；中央下 = 工作区（Workspace，`lg:min-h-0 lg:flex-1`）；右栏 = 速查表（CheatSheetCard，通高）。
- 移动端单列自然流，工作区各标签内容自带封顶滚动（`max-lg:max-h-[60vh]`），沿用现有约束。
- 默认 tab = `text`（测试文本），SSR 首屏即渲染编辑器与高亮，保证 HTML 有货。

## 文件改动清单

### 新增 core 模块（纯函数，可单测）

| 文件              | 职责                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/replace.ts` | `replaceAll(pattern, flags, input, replacement) → { error, output, count }`。复用 `new RegExp` 编译；强制补 `g`；exec 循环数匹配数（沿用零宽推进）；`input.replace(regex, replacement)` 输出。支持 `$1` / `$<name>` / `$&` / `` $` `` / `$'`。                                                                                                |
| `core/codegen.ts` | `generateCode(pattern, flags, lang) → string`。`CODE_LANGS: { id, label }[]`，覆盖 javascript / typescript / python / php / java / go / ruby。每语言输出「构造正则 + 匹配示例 + 替换示例」。flags → 各语言写法映射（如 Python 的 `re.IGNORECASE`、Java 的 `Pattern.CASE_INSENSITIVE`、Go 的内联 `(?i)`）。注意模板字面量内转义反引号与 `${`。 |
| `core/parse.ts`   | 递归下降解析器：pattern → AST。支持字面量 / `.` / 转义（`\d \w \b \t \u{...}` 等）/ 字符类 / 组（捕获、命名、非捕获、四种环视）/ 量词（含惰性）/ 交替 / 锚点 / 反向引用。不支持的结构（内联修饰 `(?i)`、八进制 `\123`、原子组 `(?>…)`、条件组）抛带说明的错误，UI 显示「暂不支持图解」兜底。                                                  |
| 对应 `*.test.ts`  | `replace.test.ts` / `codegen.test.ts` / `parse.test.ts`，与实现同目录。                                                                                                                                                                                                                                                                       |

### 改造 core

| 文件                   | 改动                                                                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/types.ts`        | 新增 `WorkspaceTab` 类型（`'text' \| 'matches' \| 'replace' \| 'code' \| 'diagram'`）；CHEAT_GROUPS 中「旗标」组标题 → 「修饰符」。                                                                                                     |
| `core/store.svelte.ts` | 新增 `tab`（默认 `'text'`）、`replacement`（默认示例 `'$1'`）、`codeLang`（默认 javascript）；派生 `replaceResult`、`parsed`；方法 `clearPattern()`（清空 pattern）、`copyReplaced()`；`applyPreset` 的 toast 文案「旗标」→「修饰符」。 |
| `core/regex.ts`        | 不动（`testRegex` 继续供文本/匹配两个 tab 用）。                                                                                                                                                                                        |

### 界面

| 文件                       | 改动                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/Panel.svelte`          | 重写布局栅格（见上）；组合 PresetCard / PatternCard / Workspace / CheatSheetCard。                                                                                                                                                                  |
| `ui/Workspace.svelte`      | 新增。中央工作区外壳：tab 条（仿 generator 的分段式按钮，`aria-pressed`）+ 按 `tab` 条件渲染五个子面板。                                                                                                                                            |
| `ui/TextTab.svelte`        | 从 `TextCard.svelte` 迁移内容（透明 textarea + 镜像高亮）。                                                                                                                                                                                         |
| `ui/MatchesTab.svelte`     | 从 `MatchesCard.svelte` 迁移内容（匹配列表 + 捕获组展开 + 复制/展开全部）。                                                                                                                                                                         |
| `ui/ReplaceTab.svelte`     | 新增。替换内容输入框（placeholder 提示 `$1` 等写法）+ 结果只读区 + 复制按钮 + 计数播报（`role="status"`）。                                                                                                                                         |
| `ui/CodegenTab.svelte`     | 新增。语言 chips（h-7）+ 代码块（`pre font-mono` 灰底）+ 复制按钮。                                                                                                                                                                                 |
| `ui/DiagramTab.svelte`     | 新增。错误 → 显示错误；解析失败 → 「暂不支持图解」；正常 → 递归渲染 `DiagramNode`。                                                                                                                                                                 |
| `ui/DiagramNode.svelte`    | 新增。递归组件：sequence 横排、alternation 竖排分支、group 圆角盒（捕获绿 / 非捕获灰 / 环视蓝虚线 + `?=` 角标）、quantified 右下角标 `×n / ? / + / {n,m}`、literal 灰 chip、escape 蓝 mono、charClass 方括号盒、dot 圆点、anchor / backref 特殊色。 |
| `ui/PatternCard.svelte`    | actions 区加「清空」按钮（xs）；区块标题「旗标」→「修饰符」，`aria-label` 同步。                                                                                                                                                                    |
| `ui/CheatSheetCard.svelte` | 样式优化：token 盒从固定 `w-28` 改为内容自适应（`min-w-*` 收缩），长占位符（如 `(?<name>…)`）不再截断难看；描述列自适应截断。                                                                                                                       |
| `ui/PresetCard.svelte`     | 内边距优化：chips 与说明的对齐间距微调。                                                                                                                                                                                                            |
| `ui/styles.ts`             | 新增 workspace tab / 替换区 / 代码块 / 图解样式常量。                                                                                                                                                                                               |
| 删除                       | `ui/TextCard.svelte`、`ui/MatchesCard.svelte`（内容已迁入 tab）。                                                                                                                                                                                   |

### 文案与文档

| 文件                      | 改动                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `+page.svelte`            | tagline / description / keywords 更新：加替换、代码生成、图解能力；「旗标」→「修饰符」。 |
| `README.md`（regex 目录） | 补充新功能说明；「旗标」→「修饰符」。                                                    |
| 站点 `README.md`          | 工具列表第 3 行简介补充新能力（可选，一行内）。                                          |

## 关键实现要点

- **SSR / 预渲染**：`parse.ts`、`codegen.ts`、`replace.ts` 全部纯函数无 DOM；默认 tab 为 text，SSR 输出编辑器骨架。图解/代码 tab 只在切换后渲染，不阻塞首屏。
- **runes 约定**：条件类名一律脚本里拼好；不在 class 属性写裸三元；keyed each 用唯一 key（tab 用 `tab` 字符串、语言用 `id`）。
- **XSS**：代码块与图解全部 `{@render}` / 文本插值，不用 `{@html}`；解析出的字面量原样渲染。
- **触控与对比度**：tab 按钮与 chips 高 ≥ `h-7`；灰字用 `text-gray-600` 起步，不用 `text-gray-400`。
- **重置单测基线**：现有 `store.test.ts` / `regex.test.ts` 保持通过；新增三个模块的单测按现有风格（`expect.requireAssertions`）。

## 验证

1. `pnpm format && pnpm lint && pnpm check && pnpm test`（含新增单测）。
2. 起 `pnpm dev`，Playwright 手工走一遍：
   - 375px / 1280px 两个宽度：无横向溢出，tab 条不折行，工作区高度封顶可滚。
   - 五个 tab 切换正常；替换输出与计数正确；代码生成各语言可复制；图解随 pattern 实时变化。
   - 修改交互元素与 DOM 结构后用 axe（`wcag2a/aa`）0 violations。
3. `curl` 页面 HTML 确认首屏含正则栏与文本编辑区骨架。
