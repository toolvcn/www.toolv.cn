# Git 命令速查 · /git

> 在线使用：<https://www.toolv.cn/git> ・ 数据全部本地处理，不上传、不落库

- **九类命令按组列出**：起步与配置 / 暂存与提交 / 分支与合并 / 远程与同步 / 历史与查看 / 撤销与回退 / 暂存工作区 / 标签与发布 / 高级与排错，共 65 条；分组 chips 单选用 `aria-pressed`，默认停在「全部」（整张表都在 SSR 的 HTML 里），点「常用」只看 22 条高频命令
- **填一次变量，全部命令跟着变**：`{{branch}}` 这类占位符由变量条统一替换；你填的值加淡绿底（一眼看出哪几个是自己填的），留空回落示例值的只有绿字。分支名常驻工具条，「更多变量」（远程名 / 仓库地址 / 文件路径 / 提交引用 / 标签名 / 提交信息 / 用户名 / 邮箱 / 检出目录）收在折叠区
- **留空回落到示例值**：输入框空着时命令用示例值（`main` / `origin` / `src/lib/tools.ts`），所以不填任何东西也能直接复制即用，命令里不会残留 `{{...}}` 原文；「重置」把全部输入清空回到示例值
- **备选写法 chips**：`--soft` ↔ `--hard` ↔ 默认（mixed）、`switch -c` ↔ `checkout -b`、`fetch` ↔ `fetch --prune`、`push -u` ↔ `push --tags`、`revert` ↔ `revert -n` 等；下标 0 是主模板，第一个 chip 是「默认」
- **危险命令标注**：`reset --hard` / `restore` / `clean -fd` / `push --force` / `gc --prune=now` / `branch -d` 等 13 条给红或琥珀徽章 + 悬浮说明。**只标注、不弹窗确认** —— 复制的只是文本，真正执行在用户自己的仓库里
- **价格写进 note**：每条危险命令都必须在 `note` 里说明代价（「本地未推送的提交与未提交的改动都会没」「`-f` 才是真的删、`-n` 只预览」），体检单测会拦住没写 note 的危险命令
- **检索口径**：命令本体、中文说明、英文子命令与分组名都参与匹配（输 `变基`、`rebase`、`找回提交`、`冲突` 都能命中）；筛选只影响渲染，不写回数据
- **复制**：每条行首一个图标按钮，一键复制渲染后的完整命令
- **参数预设（左栏）**：在变量条里填好分支名 / 远程 / 仓库地址等参数，起个名字点「保存」就存在本地（`localStorage`），点条目一键回填整个变量条、所有命令跟着变；悬浮条目逐条删除，标题行可导出 / 导入 JSON 备份（与 http 请求调试、电商 ROI 同一套面板）
- **版式：左右双栏** —— 左栏「变量条在上、预设面板在下」，右栏命令列表；宽屏（lg 起）走 ToolShell 的 `fill` 满屏，两栏各占视口高度、各自内部滚。小屏退回自然流单列：变量条 → 预设 → 命令列表
- **SSR 首屏有货**：命令与分组在构建期就写进 HTML，打开即可读（`+page.ts` 开了 `prerender`）

## 参数在哪调

占位符的键名、中文标签与默认示例值都在根目录 `config.ts`（`VAR_DEFS`）：要改示例值（换成自己仓库常用的分支名 / 远程名）、加一个新变量（比如 `{{sha}}`），改这一份即可 —— store 取它的 `sample` 当初始值与留空时的回落值，变量条取 `label` / `hint` 渲染输入框，并按 `secondary` 决定哪些收进「更多变量」。

参数预设的 `localStorage` 键也在 `config.ts`（`PRESETS_STORAGE_KEY` = `toolv:git-presets`）。持久化写在 `+page.svelte`（挂载时恢复、之后每次改动写回，带 `restored` 开关防止首帧空值覆盖）。命令数据与分组在 `core/commands.ts`；占位符替换、分词、搜索、分组、预设序列化与数据体检的纯逻辑在共享层 `$lib/utils/command-cheatsheet`；界面在共享的 `$lib/components/CommandCheatsheet`。本工具目录里没有 `core/types.ts` —— 类型定义随共享层走。

## 档位

**本工具目录内是 L1**：`config.ts`、`core/commands.ts`（数据）、`core/store.svelte.ts`（拿数据 new 出共享编排类）与 `core/commands.test.ts`；`+page.svelte` 做 ToolShell + SEO head + 组装 + 预设持久化；`ui/PresetPanel.svelte` 是预设面板的业务绑定（本工具独有）。

界面与纯逻辑**不在本目录**：docker / git / linux 三个命令速查工具共用 `$lib/components/CommandCheatsheet`（`VarBar` 变量条、`CommandList` 命令列表、`CommandCheatsheet` 组装件与 `cheatsheet.svelte.ts` 里的 `CheatsheetStore` 编排类）和 `$lib/utils/command-cheatsheet`（`resolveVars` / `tokenizeCommand` / `filterCommands` / `groupCommands` / `validateCheatsheetData` / `serializeCheatsheetPresets` / `parseCheatsheetPresets`）。按 STRUCTURE §2 C 的「被两个以上工具共用才提升」——三个工具只各自提供分组、命令表、占位符定义三样数据。双栏栅格收在共享组装件里（命令列表传 `fill`，满屏布局下吃满右栏高度、撤掉 `60vh` 封顶）。预设逻辑也收在共享层：`savePreset` 等五个方法在 `CheatsheetStore`、序列化 / 解析在 `$lib/utils/command-cheatsheet`，而 `ui/PresetPanel.svelte` 这种业务绑定留在本工具目录（只接 store 与文案，各工具只差 idPrefix、导出文件名与空态文案）。

## 实现口径

- **占位符只替换认得的键**：模板里 `{{key}}` 的 key 若在 `VAR_DEFS` 里就替换，否则整段跳过原样保留 —— 所以 `stash@{1}`、`git tag -l "v1.*"` 这类命令能直接写进模板，不用转义。
- **危险命令强制写 note**：13 条红 / 琥珀徽章命令每条都必须在 `note` 里说明代价，体检单测（`core/commands.test.ts`）会拦住没写 note 的危险命令，避免「只标危险不说是啥危险」。
- **搜索多字段 OR 命中**：命令本体、中文说明、英文子命令、分组名都参与匹配；筛选只改渲染，不写回数据、不影响复制内容。
- **预设是完整快照**：一条预设只存填了值的变量，留空的不存；回填是完整快照，没存过的变量一律清空、回落示例值。分组筛选 / 搜索词 / 备选写法不进预设。

## 刻意不统一

- **不做危险命令的二次确认弹窗**：与 regex 删除已保存配置时的确认弹窗不同 —— 那边删的是本机数据，这边只是复制一段文本，确认弹窗拦不住任何后果，只会给高频操作添噪音。
- **变量条用「留空 = 回落示例值」而不是禁用复制**：命令永远可复制，比「没填就禁用复制按钮」更顺手。
- **预设不做拖动排序**（面板支持，本工具没接 `onreorder`）：条目按保存顺序排，够用；电商 ROI 接它是因为要按口径分组对比，与这里「给几个自己常用的分支名」不是一回事（http 也没接）。

## 数据口径

- 命令表里**只写通用子命令**，不绑定任何托管平台（GitHub / GitLab / cnb 的操作不在本页）。
- `note` 记的是**坑与代价**，不是复述命令：如「`-a` 只自动暂存已跟踪文件」「`rebase` 会改写提交哈希，只对没推到共享分支的本地提交用」「`git push` 不会顺手推标签」，都是排查时最容易踩的那几条。

## 已知取舍 / 暂不支持

- **只做查阅与复制，不执行任何命令**：本页不碰用户仓库，复制的是文本，真正执行在用户自己的终端。
- **不绑任何托管平台**：GitHub / GitLab / cnb 的网页操作不收录，只列通用 CLI。
- **危险命令只标注不弹窗**（理由见「刻意不统一」）。
- **预设不做拖动排序**（理由见「刻意不统一」）。

## 验证过什么

- `core/commands.test.ts`：覆盖命令数据完整性 —— 九组分组齐全、共 65 条、每条模板里的占位符键都能在 `VAR_DEFS` 里对上、13 条危险命令都有 note、备选写法 chips 合法。
- 共享层 `$lib/utils/command-cheatsheet` 与 `$lib/components/CommandCheatsheet` 另有各自的单测（占位符替换、搜索、预设序列化），本工具直接复用。
- 浏览器实测：375 / 1280 无横向溢出，axe 0 violations；SSR 首屏命令与分组在 HTML 里可见。
