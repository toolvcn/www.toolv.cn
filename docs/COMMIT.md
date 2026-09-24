# Git 提交规范（COMMIT.md）

> 本文件是「微工具」的**提交信息、提交粒度与推送**规范，从 AGENTS.md 拆出、放 `docs/` 独立维护。
> **提交前扫一遍 §0 那张表就够了**；type 说不清时看 §2 的判据，scope 看 §3。
>
> 分工：**流程、runes、测试、门禁看 `AGENTS.md`；目录与档位看 `STRUCTURE.md`；纯样式取值看 `UI-STYLE.md`；提交看本文件。**
> 小节编号 0-9，AGENTS.md 引用时写作 `COMMIT §2` 这种形式。

**用不到的 type 不列全，列了的都有本站实例。**

## 0. 速查表

| 你要做的事                                  | 写法                                           | 本站实例                                                                |
| ------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| 新增工具 / 功能 / 选项                      | `feat(<tool>): 新增……`                         | `feat(ecommerce-roi): 广告费双填法 + 敏感性 10 档 + 中栏左右分栏`       |
| 修一个具体的 bug                            | `fix(<tool>): 修……（症状 + 触发条件）`         | `fix(ecommerce-roi): 修 7 处边界态 bug，三列卡片在窄面板回退单列`       |
| 重构收口、统一组件、不改动外部行为          | `refactor(ui): ……统一到……`                     | `refactor(ui): 开关统一到 Switch，26 处手写 textarea 全部迁到 Textarea` |
| 写 / 改文档、工具 README、长期记忆          | `docs(<scope>): ……`（记忆一律 `docs(memory)`） | `docs(memory): 记主题机制、验证结论与 oklch 对比度坑`                   |
| 只跑了一遍 `pnpm format`、改缩进 / 分号     | `style: 全站 prettier`（逻辑改动另提）         | 全站 `pnpm format` 的独立提交                                           |
| 加 / 改测试与测试设施                       | `test(<tool>): ……`                             | `test(ecommerce-roi): 补退货口径的边界用例`                             |
| 依赖升级、类型同步、配置清理                | `chore(types): ……` / `chore(deps): ……`         | `chore(types): 同步 wrangler 生成的运行时类型（workerd 1.20260915.1）`  |
| 流水线（`.cnb.yml` / GitHub workflows）     | `ci(cnb): ……` / `ci: ……`                       | `ci(cnb): 修正模型配置软链源路径为 models.json，并预建 .codebuddy 目录` |
| 构建与部署配置（vite / wrangler / adapter） | `build: ……`                                    | `build: 打开 Cloudflare Pages 的 nodejs_als flag`                       |
| 性能优化                                    | `perf: ……`（单独提，别塞进 `refactor`）        | ——                                                                      |
| 回滚                                        | `revert: <被回滚的主题行>`（正文写原因）       | `revert: feat(home): 首页改版 —— 去外链、移动端分组菜单、头部搜索`      |

三条硬约束：

1. **主题行必须是 `type(scope): 中文描述`**，scope 可省，type 不可省。
2. **一个 commit 只做一件事**（§6）。
3. **提交前跑完门禁**（§7），不是提交后再补。

## 1. 格式

```
type(scope): 主题

正文（可选）

脚注（可选）
```

- `type` 与 `scope` 用**英文小写**，`(` 后无空格，`:` 后**一个空格**再写主题。
  反例：`编辑文件 .cnb.yml` —— 漏了 type 就完全看不出改了什么（本站真实提交）。
- scope 用 **kebab-case**（`ecommerce-roi`，不是 `ecommerceROI` / `电商ROI`）。
- 主题行长度 ≤ **72 个半角字符宽度**（一个汉字算 2）；写不下说明该拆提交，不是缩写。
- 正文与主题之间**空一行**；正文每条 `- ` 开头。
- 破坏性改动用脚注 `BREAKING CHANGE: <说明>`，不要用 `!` 后缀（`feat!:`）—— 中文主题行里 `!` 容易被当成标点忽略。

## 2. type 怎么判断

判据只有一条：**用户 / 线上行为变没变**。变了是 `feat` / `fix`，没变是 `refactor` / `style` / `test` / `chore`。

两个易混点：

- **UI 调整算 `feat` 还是 `fix`？** 新增 / 重做视觉与交互 = `feat`；修「某一端破版、错位、看不见」= `fix`。
- **`refactor` 与 `chore`？** 动了源码结构 = `refactor`；只动配置 / 依赖 / 生成物 = `chore`。

## 3. scope（能指到目录就指到目录）

| scope        | 指什么                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `<tool>`     | 工具路由目录名，与 `src/routes/<tool>/` 严格一致：`ecommerce-roi`、`regex`、`http`、`websocket`… |
| `ui`         | `$lib/ui/` 控件原语；两层都动了也用 `ui`                                                         |
| `components` | `$lib/components/` 工具通用组装件（只动这一层时）                                                |
| `tools`      | `src/lib/tools.ts` —— 首页卡片、分类侧栏、工具页菜单共用这份数据                                 |
| `home`       | 首页路由                                                                                         |
| `theme`      | 深浅主题机制（`src/lib/ui/theme.svelte.ts`、`routes/layout.css`）                                |
| `types`      | 类型同步，主要是 `worker-configuration.d.ts`                                                     |
| `deps`       | 依赖增删与升级                                                                                   |
| `cnb`        | `.cnb.yml`（CNB 流水线）                                                                         |
| `ci`         | 其它流水线（GitHub Actions 等）—— 作 type 时也写作 `ci:`                                         |
| `memory`     | 记忆：`docs/MEMORY.md` 长期记忆（入库）+ `.workbuddy/` 工作日志（不入库）（配 `docs(memory)`）   |
| _省略_       | 跨全站或说不清归属（如 `chore: …`）；此时主题行必须自解释                                        |

## 4. 主题行怎么写

- **中文**，动词开头：`新增` / `修复` / `统一` / `移除` / `同步` / `收口` / `改`。
- **不加句号**，不用 `。`、不用英文引号；并列项用 `+` 或 `；`。
- **禁词**（不带对象就是废话）：`修改`、`更新`、`完善`、`优化`、`一些`、`若干`、`wip`、`tmp`。
  要写就写清对象与结果：`改单件成本默认值 35` 好过 `修改参数`。
- **不列文件清单**（正文里写），不写 `改了 3 个文件`。
- 同一主题行里**不要塞两件不相干的事** —— 拆成两个 commit。

## 5. 正文与脚注

**只写 git 看不出来的东西**：为什么这么改、被否掉的替代方案、影响面、后续待办。

必写的情况：

1. **行为变了且用户能感知**（默认参数、口径、交互路径）—— 写清新旧值与影响范围。
2. **破坏性改动** —— 脚注 `BREAKING CHANGE: <迁移方式>`。
3. **重新生成了产物** —— 例如改 Cloudflare 绑定后跑 `pnpm gen`，正文写「绑定改动：`<name>`，重新生成运行时类型」。
4. **回滚** —— 写被回滚的 commit 与原因。
5. **明知没按规范做** —— 写偏离项与理由（对应 AGENTS.md §12 C-11）。

不写：逐文件清单、`修改了 xx 文件`、把主题行复述一遍。
不加 `Co-authored-by` 或任何 AI 署名（§9）。

## 6. 提交粒度与顺序

| 规则                   | 说明                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **一件事一个 commit**  | 反例：一个 commit 里同时「修 A 工具 bug + 调 B 工具间距 + 升级依赖」。                                         |
| **重构与功能分开**     | 先 `refactor(ui): …统一到…`，再 `feat(<tool>): …`。混在一起没人能评审。                                        |
| **格式化单独提**       | `pnpm format` 会把没动过的文件也标成 M（行尾 / stat 缓存）；纯格式 diff 单独一个 `style:` 提交，别淹掉真改动。 |
| **生成物随改动一起提** | `worker-configuration.d.ts` 由 `pnpm gen` 生成，**改了绑定就要同 commit 提交**（AGENTS.md §11）。              |
| **讨论态不留中间档**   | 反复调版式的中间态不提交；按 AGENTS.md §0.1 确认版式、跑完门禁再收口。                                         |
| **同步项不另提**       | README 工具列表、`src/lib/tools.ts`、SEO head 与功能同属一件事，同 commit（AGENTS.md §8）。                    |

## 7. 提交前门禁

按顺序过：

1. `git status` **逐文件**看一遍清单。不该出现的：`.env`（只有 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）、密钥、`.svelte-kit/`、`test-results/`、`storybook-static/`、临时脚本（一律放 `/tmp`，AGENTS.md §10）；`.vscode/mcp.json` 已入库，**别把 token 写进去**（AGENTS.md §11）。
2. 命令全绿（AGENTS.md §12 A-6）：`pnpm format && pnpm lint` + 一次类型检查（`pnpm check` 在本机会挂住，命令见 AGENTS.md §3 坑 1）。
   改了逻辑 / 共享状态时另跑 `pnpm test`（不进常规收尾的理由见 AGENTS.md §0.1）。
3. 自查（AGENTS.md §12 B 层 → §10 的验证表）：a11y、375 / 1280 响应式、纯前端承诺、无 `{@html}` 渲用户输入。
4. 新增 / 改工具：README 工具列表、SEO head 已同步（首页卡片 / 分类侧栏 / 工具页菜单同源于 `src/lib/tools.ts`）。

> `pnpm deploy` / `pnpm deploy:preview` 带 `--commit-dirty=true`，**脏工作区也能部署成功**。
> 部署 ≠ 已提交，提交要单独做。

## 8. 分支与远端

- 主线 **`main`**（`origin` = cnb.cool）；`github` 远端是镜像，由维护者手动同步。
- 提交线性推进：**已推送的共享分支不 force push**；rebase / 改信息只动本地未推送的提交。
- merge commit 保留默认信息，其余所有 commit 一律按本规范。
- 部署分支：`main` → 生产（`pnpm deploy`），`preview` → 预览（`pnpm deploy:preview`）。

## 9. AI 助手代提交的边界

本仓库的日常提交相当一部分由 AI 助手执行，因此明确：

1. **默认不 `git push`**，除非用户明确要求。
2. **不主动 commit**（讨论态见 AGENTS.md §0.1）：用户说「提交 / 收尾」才提交。
3. 提交前把**文件清单 + 完整提交信息**给用户过一眼，确认后再执行。
4. **不加** `Co-authored-by`、`Generated by …` 之类的署名 trailer。
5. 不 `--amend` 已推送的提交，不改他人提交信息。

## 附：为什么不装 commitlint

规范靠人工 + review 执行，**不为「检查提交信息」引入依赖**：
`husky` + `@commitlint/cli` + `@commitlint/config-conventional` 三个 devDep、一条 `prepare` 钩子，
还要为「中文主题行长度按 2 计」这种本站规则写自定义规则 —— 成本高于收益，因此不装。
