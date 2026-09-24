# Docker 命令速查 · /docker

> 在线使用：<https://www.toolv.cn/docker> ・ 数据全部本地处理，不上传、不落库

- **九类命令按组列出**：容器 / 镜像 / 构建 / 网络 / 卷与数据 / 日志与排查 / 资源与状态 / 清理 / Compose 与仓库，共 65 条；分组 chips 单选用 `aria-pressed`，默认停在「全部」（整张表都在 SSR 的 HTML 里），点「常用」只看 17 条高频命令
- **填一次变量，全部命令跟着变**：`{{container}}` 这类占位符由变量条统一替换；**你填的值加淡绿底**（一眼看出哪几个是自己填的），留空回落示例值的只有绿字。容器 ID / 名称常驻工具条，「更多变量」（容器名 / 镜像 / 端口 / 仓库地址 / 卷 / 网络 / 宿主目录 / 容器内路径 / 环境变量）收在折叠区
- **留空回落到示例值**：输入框空着时命令用示例值（`my-nginx` / `nginx:1.27`），所以**不填任何东西也能直接复制即用**，命令里不会残留 `{{...}}` 原文；「重置」把全部输入清空回到示例值
- **备选写法 chips**：`/bin/bash` ↔ `/bin/sh`、`docker ps` ↔ `docker ps -a`、不用缓存 / 指定 Dockerfile 等；下标 0 是主模板，第一个 chip 是「默认」
- **危险命令标注**：`docker rm -f` / `docker volume rm` / `prune` 系给红或琥珀徽章 + 悬浮说明。**只标注、不弹窗确认** —— 复制的只是文本，真正执行在用户自己的终端里
- **注释与坑写在命令下面**：如「`exec` 需要容器在运行」「绑定挂载的宿主目录必须写绝对路径」「`compose down -v` 会删卷」，都是排错时最容易踩的那几条
- **搜索**：命令本体、中文说明、英文子命令与分组名都参与匹配（输 `进入容器`、`exec`、`日志`、`网络` 都能命中）；筛选只影响渲染，不写回数据
- **复制**：每条**行首**一个图标按钮，一键复制渲染后的完整命令（按钮统一在左侧，命令起始位置因此也整齐）
- **参数预设（左栏）**：在变量条里填好容器名 / 镜像 / 端口等参数，起个名字点「保存」就存在本地（`localStorage`，刷新与重开都在），点条目一键回填**整个变量条**、所有命令跟着变；悬浮条目逐条删除，标题行可导出 / 导入 JSON 备份（与 http 请求调试、电商 ROI 同一套面板）
- **版式：左右双栏 —— 左栏「变量条在上、预设面板在下」，右栏命令列表**：宽屏（lg 起）走 ToolShell 的 `fill` **满屏**，两栏各占视口高度、各自内部滚 —— 命令列表**填满右栏**（`CommandList` 传 `fill`，lg 起撤掉 `60vh` 封顶换成 `flex-1`）；变量条展开时滚的是左栏，不会把命令列表顶下去、也不会把预设面板压扁。栅格收在共享的 `CommandCheatsheet` 组装件里（docker / git / linux 同一套），左栏 `22rem` 是下限（再窄「更多变量」的网格只剩一列、9 个变量拖成 9 行），嫌宽 / 嫌窄改这一个数即可。小屏退回自然流单列：变量条 → 预设 → 命令列表
- **「更多变量」展开是自适应网格**（每列至少 `9rem`，共享 `VarBar`）：写死 3 列时 9 个次要变量占 3 行、右半边还空着；自适应后在 22rem 左栏里排 **2 列**
- **一条预设只存「填了值的变量」**：留空的变量不存 —— 保存时一个都没填会被拦下（存下来跟示例值一样）；回填是**完整快照**，没存过的变量一律清空、回落示例值，而不是往当前输入上叠。分组筛选 / 搜索词 / 备选写法**不进预设**（那是「当前在看什么」，不是「这套参数」）
- **Go 模板原样保留**：`docker inspect -f '{{.State.Status}}'` 这类命令里的 `{{…}}` 不属于本页变量，替换时按「键名不认识就整段跳过」处理，不用转义
- **SSR 首屏有货**：命令与分组在构建期就写进 HTML，打开即可读（`+page.ts` 开了 `prerender`）

## 参数在哪调

占位符的键名、中文标签与默认示例值都在根目录 `config.ts`（`VAR_DEFS`）。
要改示例值、加一个新变量（比如 `{{tag}}`），改这一份即可 —— store 取它的 `sample` 当初始值，
变量条取 `label` / `hint` 渲染输入框，两处引用同一份定义。

**参数预设的 `localStorage` 键**也在 `config.ts`（`PRESETS_STORAGE_KEY` = `toolv:docker-presets`）。
持久化本身写在 `+page.svelte`（挂载时恢复、之后每次改动写回，带 `restored` 开关防止首帧空值覆盖），
面板逻辑在共享的 `CheatsheetStore`（`savePreset` / `applyPreset` / `deletePreset` / `restorePresets` /
`importPresetsText`）与 `$lib/components/PresetPanel`，序列化 / 解析纯函数在
`$lib/utils/command-cheatsheet`（`serializeCheatsheetPresets` / `parseCheatsheetPresets`）。
本工具的 `ui/PresetPanel.svelte` 只做业务绑定（idPrefix、导出文件名、徽章与摘要文案、空态）。

与 `config.ts` 的边界：**命令数据与分组在 `core/commands.ts`**；占位符替换、分词、搜索、分组、预设序列化与数据体检的
纯逻辑在 `$lib/utils/command-cheatsheet`，界面在 `$lib/components/CommandCheatsheet`（见下）。
本工具自己的 `core/` 只放数据、store 与体检单测。

## 档位

**本工具目录内是 L1**：`config.ts`、`core/commands.ts`（数据）、`core/store.svelte.ts`（拿数据 new 出共享编排类）
与 `core/commands.test.ts`；`+page.svelte` 做 ToolShell + SEO head + 组装 + 预设持久化；
`ui/PresetPanel.svelte` 是预设面板的业务绑定（这一层是本工具独有，见「预设逻辑为什么在共享层」）。

界面与纯逻辑**不在本目录**：docker / git / linux 三个命令速查工具共用
`$lib/components/CommandCheatsheet`（`VarBar` 变量条、`CommandList` 命令列表、
`CommandCheatsheet` 组装件与 `cheatsheet.svelte.ts` 里的 `CheatsheetStore` 编排类）和 `$lib/utils/command-cheatsheet`
（`resolveVars` / `tokenizeCommand` / `filterCommands` / `groupCommands` / `validateCheatsheetData` /
`serializeCheatsheetPresets` / `parseCheatsheetPresets`）。
按 STRUCTURE §2 C 的「被两个以上工具共用才提升」——三个工具只各自提供**分组、命令表、占位符定义**三样数据。
所以本工具目录里**没有 `core/types.ts`**：类型定义随共享层走，不在这里再抄一份。

**三个工具共用 `CommandCheatsheet` 组装件，双栏栅格就收在它里面**：变量条与命令列表不再绑在一起顺序渲染，
改成左栏「变量条 + 预设面板」、右栏命令列表。docker 先改双栏时是页面自己画栅格，git / linux 跟上就是第三份
一模一样的栅格（连「左栏 22rem 是下限」这种数都要抄三遍），所以收口成组装件的一个版式。
命令列表由组装件传 **`fill`**：满屏布局下吃满右栏高度（`lg:flex-1`、撤掉 `60vh` 封顶）。

**预设面板怎么接**：组装件开了一个 `presets` snippet 槽，各工具把自己的 `ui/PresetPanel.svelte` 传进去，
不传就不出这一块 —— 摆位统一、绑定各管各的（见下）。

**预设逻辑为什么在共享层**：预设存的就是 `CheatsheetStore.vars`
（「当前这组变量值」），读写只能由持有它的那个类来做 —— 放到工具自己的 store 里就得反向伸进去改
`dockerStore.vars`，两个单例互相引用。所以 `savePreset` 等五个方法收在 `CheatsheetStore`、
序列化 / 解析收在 `$lib/utils/command-cheatsheet`（与 http / 电商 ROI「预设逻辑住在各自 store、
面板收在 `$lib/components/PresetPanel`」同一分工），而 `ui/PresetPanel.svelte` 这个**业务绑定**留在本工具目录
（跟 http 的 `ui/PresetPanel.svelte` 一样，只接 store 与文案）。docker / git / linux 各有一份，
只差 idPrefix、导出文件名与空态文案。

## 刻意不统一

- **不做危险命令的二次确认弹窗**：与 regex 删除已保存配置时的确认弹窗不同 —— 那边删的是本机数据，
  这边只是复制一段文本，确认弹窗拦不住任何后果，只会给高频操作添噪音。
- **变量条用「留空 = 回落示例值」而不是禁用复制**：命令永远处于可复制状态，
  要比「没填就禁用复制按钮」更顺手，也避免用户对着灰按钮猜该填什么。
- **预设不做拖动排序**（面板支持，本工具没接 `onreorder`）：条目按保存顺序排，够用；
  电商 ROI 接它是因为要按口径分组对比，与这里「给几个自己常用的容器名」不是一回事（http 也没接）。

## 数据口径

- **收录范围**：九类共 65 条，都在 `core/commands.ts`（分组元数据 `DOCKER_GROUPS`，顺序即渲染顺序；
  命令表 `DOCKER_COMMANDS`）。只收 `docker` 与 `docker compose` 的常用子命令 ——
  容器 / 镜像 / 构建 / 网络 / 卷与数据 / 日志与排查 / 资源与状态 / 清理 / Compose 与仓库，
  `featured` 标出「常用」那一档的 17 条。
- **`desc` 说「干什么」，`note` 只记坑与代价**，不复述命令本身（如「`-it` 缺一不可，少了 `t` 就没有 TTY」
  「`compose down -v` 会删卷」）—— 排错时最容易踩的那几条才配进 `note`。

## 已知取舍 / 暂不支持

- **不执行任何命令、不连 Docker daemon**：这页只是文本速查，看不到你本机有哪些容器 / 镜像在跑 ——
  要看状态就复制 `docker ps` 那几条自己执行。
- **不给多步脚本**：一条命令一个模板（备选写法挂 `variants`），要串流程请按分组自己拼；
  没有「一次复制一段部署脚本」这种形态。
- **危险命令只标注、不拦**：理由见「刻意不统一」第一条。

## 验证过什么

- `core/commands.test.ts` **6 例**：数据自洽（id 不重复、分组都存在、占位符都有定义、危险命令都写了 `note`）、
  命令量 ≥ 50 且「常用」≥ 12、按默认值渲染后只剩那两条 Go 模板带 `{{`、搜索能命中中文动作词与英文子命令、
  「全部」档分节顺序与分组表一致、「常用」档只有一节。
- 共用逻辑（占位符替换 / 分词 / 搜索 / 分组 / 预设序列化与解析）的单测在 `$lib/utils/command-cheatsheet`，
  这里不重复列。
