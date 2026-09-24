# UI 视觉规范（UI-STYLE.md）

> 本文件是「微工具」全站视觉的**查表手册**，从 AGENTS.md 拆出、放 `docs/` 独立维护。
> **写任何界面前先扫一遍对应的小节，不要凭感觉挑 class。**
> 数值是从 websocket / regex / json-formatter 三个已上线工具的实际代码里提炼的，改动它们等于改动全站观感。
>
> 分工：**流程、runes、测试、门禁看 `AGENTS.md`；目录与档位看 `STRUCTURE.md`；纯样式取值看本文件。**
> 小节编号 0-18，AGENTS.md 引用时写作 `UI-STYLE §9` 这种形式。

## 0. 写 UI 的入口：先复用，再手写

**第一步永远是查这张表**——下面这些组件都已存在，直接 import 用，不要重新实现。
两层：**控件原语在 `$lib/ui/`，工具通用组装件在 `$lib/components/`**（边界见 `STRUCTURE.md` §2 C）。

**控件原语 + 全站反馈层**（`$lib/ui/`）：

| 组件        | 引用路径                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Button      | `import Button from '$lib/ui/Button/Button.svelte'`                                                                            |
| IconButton  | **已并入 Button**：行内图标按钮写 `<Button icon label="..." onclick={...}>`（见 §9）                                           |
| Checkbox    | `import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte'`                                                                      |
| Switch      | `import Switch from '$lib/ui/Switch/Switch.svelte'`（滑动开关：`role="switch"` + `bind:checked`，见 §12）                      |
| Dropdown    | `import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte'`                                                                      |
| Input       | `import Input from '$lib/ui/Input/Input.svelte'`（单行输入框：size 三档 + 焦点环 + 错误态，见 §11.2）                          |
| Textarea    | `import Textarea from '$lib/ui/Textarea/Textarea.svelte'`（多行输入框：label 关联 + 透明无边框，外观套 `EditorBox`，见 §11.1） |
| CopyButton  | `import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte'`（复制按钮：空内容拦截 + 成败提示，见 §11.3）                   |
| Toast       | `import Toast from '$lib/ui/Toast/Toast.svelte'`（全局提示条，每个工具页放一个，见 §11.3）                                     |
| Confirm     | `import { confirm } from '$lib/ui/confirm.svelte'`（二次确认：破坏性操作前 `await confirm.ask('…')`，见 §19）                  |
| ThemeToggle | `import ThemeToggle from '$lib/ui/ThemeToggle/ThemeToggle.svelte'`（深浅主题切换，见 §1.1；导航条与抽屉各挂一次）              |

**工具通用组装件**（`$lib/components/`）：

| 组件             | 引用路径                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ToolShell        | `import ToolShell from '$lib/components/ToolShell/ToolShell.svelte'`（**每个工具页的外壳**：SEO head + 顶部导航 + 主区，见 §8.1）              |
| ToolMenu         | `import ToolMenu from '$lib/components/ToolMenu/ToolMenu.svelte'`（**工具页左上角的全站导航菜单**，当前工具自动 active，见 §8.1）              |
| Panel            | `import Panel from '$lib/components/Panel/Panel.svelte'`（卡片壳：标题行 / `header` 槽 / `footer` 槽；给 `fullscreen` 多一枚全屏按钮，见 §8）  |
| EmptyState       | `import EmptyState from '$lib/components/EmptyState/EmptyState.svelte'`                                                                        |
| CodeView         | `import CodeView from '$lib/components/CodeView/CodeView.svelte'`（代码高亮 `<pre>`，`tokens` + `classMap` 两个 prop，见 §14）                 |
| StatusPill       | `import StatusPill from '$lib/components/StatusPill/StatusPill.svelte'`（输出卡片底部的状态胶囊，见 §13.1）                                    |
| SegmentedControl | `import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte'`（分段选择，见 §12.1）                                |
| Tabs             | `import Tabs from '$lib/components/Tabs/Tabs.svelte'`（多工作区标签条：card / flat / line，见 §12.2）                                          |
| ResultRow        | `import ResultRow from '$lib/components/ResultRow/ResultRow.svelte'`（结果列表的一行：名称 / 值 / 行尾按钮，见 §13.2）                         |
| Badge            | `import Badge from '$lib/components/Badge/Badge.svelte'`（小徽章：状态码、分类、「输入」标记，见 §12.3）                                       |
| CodegenTab       | `import CodegenTab from '$lib/components/CodegenTab/CodegenTab.svelte'`（语言 chips + 深底代码块 + 复制，见 §14 尾）                           |
| PresetPanel      | `import PresetPanel from '$lib/components/PresetPanel/PresetPanel.svelte'`（参数预设面板：导出 / 导入 / 保存 / 回填 / 删除）                   |
| TabShell         | `import TabShell from '$lib/components/TabShell/TabShell.svelte'`（标签条 + 内容区的外壳，见 §12.2 尾）                                        |
| EditorBox        | `import EditorBox from '$lib/components/EditorBox/EditorBox.svelte'`（**编辑区外框**：边框 / 底色 / 聚焦转蓝，输入与只读结果同一副，见 §11.1） |
| EditorPane       | `import EditorPane from '$lib/components/EditorPane/EditorPane.svelte'`（双栏工具的**一侧**面板：空态 / 错误态 / 内容三选一，见 §8.2）         |
| FullscreenButton | `import FullscreenButton from '$lib/components/FullscreenButton/FullscreenButton.svelte'`（面板标题行的全屏按钮：原生全屏 + Esc 同步）         |

**样式常量**：

| 用途           | 引用路径                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| 基础样式常量   | `import { FOCUS_RING, FOCUS_RING_DANGER, DISABLED, INPUT_BASE, INPUT_FOCUS } from '$lib/ui/styles'` |
| 工具页版式常量 | 同上（`TOOLBAR` / `TAB_BAR` / `PRESET_ROW` / `CHIP_ON` 等都在这一份里，见 §8.2）                    |
| 工具内样式常量 | `import { ... } from './ui/styles.ts'`（`ui/` 内用 `../` 同理）                                     |

**通用工具函数**（`$lib/utils/`，一个主题一个文件，详见 `STRUCTURE.md` §2 C）：

| 用途             | 引用路径                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| JSON 解析 / 分词 | `import { tokenizeJson, tokenizeSource, type JsonToken } from '$lib/utils/json'`                     |
| 剪贴板 / 下载    | `import { copyText, readText, downloadText } from '$lib/utils/browser'`（复制见 §11.3）              |
| 成功 / 失败结果  | `import { fail, ok, type Result } from '$lib/utils/result'`（纯逻辑报中文原因，见 `STRUCTURE §2 C`） |
| 全站工具清单     | `import { TOOL_CATEGORIES, TOOL_COUNT } from '$lib/tools'`（清单数据在 `$lib` 根层，不进 `utils/`）  |

**两层通用组件的调用方只做业务绑定**：store 读写、文案、数据形状留在 `src/routes/<tool>/ui/` 的薄文件里
（例：`http/ui/PresetPanel.svelte` 十行 props；`regex/ui/Workspace.svelte` 传 `langs` / `code` / `oncopy`）。
**不要**把某个工具的业务逻辑塞进 `$lib/components/` 的组件里去「顺便复用」。

样式常量的存放有**两级**，别搞混：

| 级别           | 位置                             | 放什么                                                                                                                                                                                                                                                                                   | 是否必建                            |
| -------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **跨工具共用** | `src/lib/ui/styles.ts`           | 全站复用的基础片段（`FOCUS_RING`、`DISABLED`、`INPUT_BASE`、`INPUT_FOCUS`）与**工具页版式常量**（`TOOLBAR`、`SEG_BTN`、`ACTION_BTN`、`FOOTER_BAR`、`EDITOR_INPUT`、`EDITOR_OUTPUT`、`OUTPUT_EMPTY`、`OUTPUT_PRE`、`CODE_BLOCK`、`PRESET_ROW`、`SEARCH_ROW`、`SEARCH_INPUT` 等，见 §8.2） | **已有，直接用**；确实缺再往里加    |
| **工具内**     | `src/routes/<tool>/ui/styles.ts` | 该工具专属的重复样式串（如 JSON token 配色、状态点配色）                                                                                                                                                                                                                                 | **按需，见 `STRUCTURE.md` §0 门槛** |

**关键区分**（这里最容易跑偏）：

- `$lib/ui/styles.ts` 是**共享**的，写 UI 前先看一眼里面有什么，能复用就复用，**不要重复造常量**。
- 工具内 `ui/styles.ts` **要不要建，判断标准只在一处**：`STRUCTURE.md` §0 硬约束第 2 条（本文件不复制）。

其余通则（**全站唯一定义处**，其它章节不再重复）：

- **不新增** `<style>` 块、不新建 CSS 文件。无法用工具类表达的（滚动条伪元素、`content-visibility`）
  用 Tailwind 任意属性语法：`[content-visibility:auto] [contain-intrinsic-size:auto_72px]`。
- 组件只内联**简单的一次性 class**（如 `flex flex-col gap-1.5`），重复出现的串才进常量。
- Tailwind class 顺序交给 `prettier-plugin-tailwindcss` 自动排序，**不要手改顺序**。
- 主要区块给**稳定的 `id`**（如 `id="log-panel"`、`id="composer"`、`id="sidebar"`），e2e 与排查靠它定位。
- **`src/lib/ui/**` 与 `src/lib/components/**` 下的通用组件统一三件事**（照 `Button` 写，见 §9）：
  ① props 继承 `svelte/elements` 里对应的 `HTMLXxxAttributes`，并把显式声明的那几个 `Omit` 掉；
  ② `...rest` 透传到**根元素**（`id` / `name` / `data-*` / `aria-*` / `on*` 都不用在组件里开 prop）；
  ③ 需要 DOM 时给 `ref?: HTMLXxxElement | null` + `ref = $bindable(null)` + `bind:this`。
  **禁止**用 `[key: string]: unknown` 索引签名接透传属性 —— 它会把 props 变成全 any，`label` 拼错也不报错。
  条件类名在 `<script>` 里拼成 `$derived`，不要写在 `class` 属性里的三元（会被 prettier 拆断而静默失效）。

## 1. 颜色体系（Tailwind 默认调色板 + 主题变量）

**写颜色类时仍然用 Tailwind 默认调色板**（`bg-white` / `text-gray-600` / `border-gray-200` …），
不要用 `bg-brand`、`text-brand` 这类自定义 `@theme` token —— 主题（深浅）不是靠新 token 实现的，
而是把现有 utility **重绑到语义变量**（机制与变量表见 §1.1）。

两条硬约束：

1. **不要引入下表之外的中性色 / 语义色**：新色不会被重绑，深色下不会跟随主题，等于留下一个亮斑。
   要加新色先按 §1.1 补一条映射。
2. **`text-white` / `text-black` 不要替换成灰阶**：白字（按钮实底上）与黑字（颜色预览的样本）
   是「不跟随主题」的语义，重绑只覆盖 `bg-white`，不覆盖 `text-white`。

| 语义                 | 颜色                                                                                                                                                                                                                                                                                                                              | 用途                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 主操作 / 焦点 / 激活 | `blue-600`（实底）、`blue-500`（焦点环 / 边框）、`blue-700`（文字 / 深色态）、`blue-50`（淡底）、`blue-300`（淡边）、`blue-100`（徽章底）                                                                                                                                                                                         | 主按钮、选中行、激活筛选按钮、选中分段按钮、JSON key、焦点容器边框 |
| 成功 / 已连接 / 接收 | `emerald-500`（状态点 / 实底）、`emerald-600`（图标）、`emerald-700`（文字）、`emerald-50`（淡底）                                                                                                                                                                                                                                | 状态点 connected、开关 on、JSON string、成功 toast                 |
| 警告 / 连接中        | `amber-500`（脉冲状态点）、`amber-600`（图标）、`amber-700`（文字）、`amber-50`（淡底）、`amber-100`（交替高亮底）                                                                                                                                                                                                                | connecting 状态点、JSON number、匹配高亮交替色                     |
| 危险 / 断开 / 删除   | `red-600`（图标）、`red-700`（文字）、`red-200`（淡边）、`red-50`（淡底）、`red-500`（危险焦点环）、`red-400`（错误输入边框）、`red-300`（环视虚线边框）                                                                                                                                                                          | danger 按钮、断开状态、错误态                                      |
| 中性 / 系统 / 未连接 | `gray-900`（标题 / 主文本 / 深底代码块）、`gray-700`（次文本 / 按钮文字）、`gray-600`（次级文字 / 图标 / 标签）、`gray-500`（占位文字 / punct）、`gray-400`（占位图标）、`gray-300`（边框 / 状态点 off / 开关 off 轨道）、`gray-200`（卡片边框 / 分隔线）、`gray-100`（淡底 / 分隔线 / 行间分隔）、`gray-50`（页面底 / hover 底） | 全站中性色                                                         |
| 代码语义色           | `violet-700`（JSON literal）、`purple-700`（反向引用）、`gray-900` / `gray-100`（代码块深底浅字）                                                                                                                                                                                                                                 | JSON 高亮、正则图解                                                |

### 1.1 深色主题（变量表在 `src/routes/layout.css`）

`layout.css` 把 utility 重绑到语义变量、`.dark` 只换变量值 —— 所以颜色类**一处都不用改**。
覆盖规则写成 `.dark .x`（特异性 0,2,0）压过 `@layer utilities` 里的 `.x`（0,1,0），
浅色态一条不覆盖。`dark:` 变体已改成 class 策略（`@custom-variant dark (&:where(.dark, .dark *))`），
所以**也可以用 `dark:` 写个别例外**，但常规颜色一律走变量。

**代价是一条硬约束：不要引入下表之外的颜色类。** 重绑定是**逐类登记**的，没登记的类不会跟随主题 ——
`bg-gray-400`、`text-sky-600` 这类写下去在浅色下看着正常，切到深色就是一个亮斑（或一整块读不清的字）。
`hover:` / `focus-within:` / `disabled:` / `placeholder:` / `divide-*` 各变体要**单独登记一行**（Tailwind
生成的是不同的类名），加颜色类时顺手 grep 一遍 `layout.css` 对照。真需要新色，先决定它属于哪个语义
（面 / 字 / 线 / hover / accent / ok / warn / danger），再同时补 `:root`、`.dark` 与重绑定三处。

| 语义        | 浅色                 | 深色                  | 绑定的类（含 hover / divide / ring 变体）                                                     |
| ----------- | -------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| 面          | `white`              | `gray-900`            | `bg-white`（卡片 / 输入 / 导航条，alpha 版走 `color-mix`）                                    |
| 沉底        | `gray-50`            | `gray-950`            | `bg-gray-50`（页面底、公式块）、`disabled:bg-gray-50`                                         |
| 填充        | `gray-100`…`300`     | `gray-800`…`600`      | `bg-gray-100`（徽章）、`bg-gray-200`、`bg-gray-300`                                           |
| 极淡层      | `black/5`            | `white/10`            | `bg-black/5`                                                                                  |
| 字          | `gray-900` / `700`   | `gray-100` / `300`    | `text-gray-900`、`text-gray-800`、`text-gray-700`                                             |
| 次字 / 弱字 | `gray-600` / `500`   | `gray-400` / `400`    | `text-gray-600`、`text-gray-500`、`text-gray-400`、`placeholder:text-gray-*`                  |
| 线          | `gray-200` / `100`   | `gray-700` / `800`    | `border-gray-*`、`divide-gray-*`（divide 打在子元素上，选择器照抄 Tailwind 的 `:where(...)`） |
| hover       | `gray-50` / `100`    | `gray-800` / `700`    | `hover:bg-gray-50`、`hover:bg-gray-100`、`hover:bg-gray-200`（深底上 hover 是**变亮**）       |
| accent      | `blue-600` / `500`   | 同 / `blue-400`       | `bg-blue-600`（实底保持 -600：白字在 -500 上只有 3.9:1）、`border-blue-500`、焦点环           |
| accent 文字 | `blue-700` / `600`   | `blue-300` / `400`    | `text-blue-700`、`text-blue-600`、`hover:text-blue-*`                                         |
| accent 淡底 | `blue-50` / `100`    | `blue-950` / `900`    | `bg-blue-50`、`bg-blue-100`、`hover:bg-blue-50`                                               |
| ok / warn   | `emerald-700` / `50` | `emerald-300` / `950` | `text-emerald-*`、`bg-emerald-50`、`border-emerald-200`、同构的 amber 一套                    |
| danger      | `red-700` / `50`     | `red-300` / `950`     | `text-red-*`、`bg-red-50`、`border-red-200` / `red-400`                                       |
| 代码块      | `gray-900` + `100`   | `gray-950` + `100`    | `bg-gray-900`（深底两态都深，所以深色下再压一档与卡片底区分）                                 |

**不跟随主题的几处例外**（都是有意的）：`text-white`（主按钮字）、`text-black/85`（颜色预览的黑字样张）、
`bg-gray-600` / `bg-emerald-700` / `bg-red-700` / `bg-amber-500`（实底 + 白字）、`bg-blue-400` / `text-blue-500`（折线图）。

**光标**：`caret-gray-900` 绑到 `--caret`，深色下切 `gray-100`（regex 的透明输入层压在镜像层上）。

**深底块要单独声明 `color-scheme`**：`bg-gray-900` 这类块**两态都是深底**，但它的 `color-scheme`
是从根继承的（浅色主题下是 `light`）—— 于是块内一旦出现滚动条或表单控件，就会长出浅色的一套压在深底上。
`layout.css` 里给 `.bg-gray-900` 写了 `color-scheme: dark`，**新加深底块时要么复用 `bg-gray-900`，
要么自己补一条同样的声明**。注意 `bg-gray-900/85`（Toast）、`bg-gray-900/20`（抽屉遮罩）是别的类名，不受这条影响。

**主题状态**：`$lib/ui/theme.svelte.ts`（三态：跟随系统 / 浅 / 深，存 `localStorage['toolv:theme']`，
「跟随系统」= 删键）；首帧由 `app.html` 的内联脚本定好，`+layout.svelte` 的 `onMount` 接手。
按钮是 `$lib/ui/ThemeToggle`，导航条一份、工具抽屉一份（`lg:hidden`）。

## 2. WCAG 对比度（实测为准，不靠肉眼）

- 白底正文文字 ≥ 4.5:1（WCAG AA）：
  - `emerald-600` 在 12px 白底上只有 3.65:1 → **用 `emerald-700`**
  - `rose-600` 配 `bg-emerald-50` 只有 4.29:1 → **用 `rose-700`**
  - `gray-500` 配 `bg-gray-100` 只有 3.58:1 → **用 `gray-600`**
  - `red-600` 在 12px 小字下也不到 4.5:1 → **用 `red-700`**
  - **禁止 `text-gray-400` 用于正文**（对比度 2.6:1）
- 图标按 WCAG 非文本对比度走 3:1，`-600` 这档刚好够（**文字才需要 `-700`**）
- 小字（`text-xs` / `text-[11px]`）**一律用 `-700` 一档**
- **深色态按同一把尺子**：浅色下成立的 `-700` 文字，深色下必须换成 `-300`（`layout.css` 已统一映射）；
  `bg-gray-900` 上 `text-gray-500` 只有 4.8:1、`text-gray-600` 只有 4.6:1 —— 所以弱字统一取 `gray-400`（7.4:1）
- 加新颜色时**浅深两档一起给**；验对比度别靠肉眼，用脚本量（把 `oklch()` 转成 sRGB 再算比值，
  注意 Chrome 的 computed value 不是 `rgb()`）

## 3. 尺寸与图标档位

**高度** — 同一行内的控件**统一一种高度**，混 `h-7` 和 `h-8` 会让同一行出现两种高度。

| 值               | 像素  | 用途                                                          |
| ---------------- | ----- | ------------------------------------------------------------- |
| `h-6` / `size-6` | 24px  | 筛选按钮、Checkbox、底部计数行、状态指示器 — **触控目标下限** |
| `h-7`            | 28px  | 面板 header 批量操作、分段按钮内档、开关                      |
| `h-8`            | 32px  | 次级操作按钮、分段按钮、表单输入                              |
| `h-9`            | 36px  | 主操作按钮、URL 输入                                          |
| `h-11`           | 44px  | 正则输入条                                                    |
| `h-12`           | 48px  | 面板头部                                                      |
| `h-56`           | 224px | 移动端固定高度编辑区                                          |

**图标** — 尺寸与所在按钮的 size 档位**严格对应**。

| 值         | 像素 | 用途                                                             |
| ---------- | ---- | ---------------------------------------------------------------- |
| `size-3`   | 12px | 面板头部 xs 按钮内图标、筛选按钮图标、日志行内方向图标、复制图标 |
| `size-3.5` | 14px | 行内图标按钮（发送、删除、展开 / 收起）、折叠图标按钮            |
| `size-4`   | 16px | 主操作按钮内图标、展开箭头、标题图标                             |
| `size-4.5` | 18px | 编号徽章容器（少用）                                             |
| `size-5`   | 20px | 图标按钮 sm / xs 档（`<Button icon size="sm">`，需扩热区）       |
| `size-6`   | 24px | 图标按钮 md / lg 档（默认，触控下限）                            |

图标统一 `@lucide/svelte`。**不要用已 `@deprecated` 的别名**（编辑器里带删除线，
如 `FileJson` / `Loader2` / `ActivitySquare` / `CheckCircle` / `Edit` / `Unlock`），
用改名后的版本（`FileBraces` / `LoaderCircle` / `SquareActivity` / `CircleCheckBig` / `SquarePen` / `LockOpen`）。
`pnpm lint` 已开 `@typescript-eslint/no-deprecated`（error）会自动拦下，**不要加 disable 注释绕过**；
遇拦就查 `node_modules/@lucide/svelte/dist/aliases/aliases.js` 换名（每条 `default as X` 上方都有 `@deprecated` 注释）。

## 4. 间距体系

| 值        | 用途                                                          |
| --------- | ------------------------------------------------------------- |
| `gap-0.5` | 行内图标组（如操作图标紧密排列）                              |
| `gap-1`   | 最紧排列（图解节点间、Button xs 内图标与文字）                |
| `gap-1.5` | **最常见** — 面板头部操作区、状态胶囊、标题与图标、分段按钮内 |
| `gap-2`   | 匹配行、行内元素、网格、表单纵向                              |
| `gap-3`   | 卡片正文纵向、PresetList 根                                   |
| `gap-4`   | 页面栅格、footer 计数横向间距                                 |

| 内边距        | 用途                                     |
| ------------- | ---------------------------------------- |
| `p-4`         | 面板正文、页面栅格                       |
| `p-3`         | 预设卡片、表单、工具条卡片、编辑区       |
| `p-2.5`       | 连接行、日志行                           |
| `p-2`         | 任务行、筛选工具条、菜单容器             |
| `p-1`         | 下拉菜单容器                             |
| `px-4 py-2`   | 面板头部、footer、筛选条、日志行内分隔块 |
| `px-2 py-1.5` | 菜单项                                   |
| `px-1.5`      | 筛选按钮、日志内小标签                   |

## 5. 圆角体系

**层级规律**：外层卡片 `xl` → 内部块 `lg` → 小元素 `rounded` → 圆形 / 点状 `full`。

| 值             | 用途                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| `rounded-xl`   | Panel 外壳、顶层卡片（最大圆角）                                            |
| `rounded-lg`   | 卡片内子元素（行、表单、预设卡片、按钮、输入框、编辑盒、代码块、图解组）    |
| `rounded-md`   | 日志展开态内容块                                                            |
| `rounded`      | 菜单项、chip / badge、地址按钮、折叠 IconButton                             |
| `rounded-full` | 状态点、徽章、开关、图标按钮（`<Button icon>`，圆形）、Toast、footer 计数点 |

## 6. 阴影体系

| 值          | 用途                                        |
| ----------- | ------------------------------------------- |
| `shadow-sm` | Panel 外壳、ConnectionBar section、开关滑块 |
| `shadow-lg` | 下拉菜单、Toast                             |
| 无阴影      | 内部元素一律无阴影，靠边框和底色区分层级    |

## 7. 边框分隔体系

| 颜色                           | 用途                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `border-gray-200`              | 卡片外边框、面板头部 / 底部 `border-b` / `border-t`、表单边框 |
| `border-gray-300`              | 输入框边框、次级按钮边框、开关 off 轨道                       |
| `border-gray-100`              | 行间分隔 `border-b`、菜单项分隔 `divide-y`                    |
| `border-blue-500` / `blue-300` | 选中态边框                                                    |
| `border-red-200` / `red-400`   | danger 按钮边框、错误输入边框                                 |
| `border-dashed`                | 空态虚线、环视组虚线边框                                      |

## 8. 卡片与面板

**Panel 外壳**（`$lib/components/Panel/Panel.svelte`）：`rounded-xl border border-gray-200 bg-white shadow-sm`

- 头部：`flex h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4`
  - 标题：`text-sm font-semibold text-gray-900`
  - 标题右侧补充信息 snippet（如当前连接地址）
  - 头部右侧操作区：`flex shrink-0 items-center gap-1.5`
- 正文容器：`flex min-h-0 flex-1 flex-col`
- 可选底栏 snippet（计数 / 状态条）：渲染在正文容器**之外**，分隔线贴卡片边框
- 头部整条换成别的（工作区放 `<Tabs variant="line">`）用 `header` snippet：**替换**默认标题行，
  `heading` 仍必填并降级成 `sr-only` 的 h2，region 的名字不丢（regex / http 的工作区就是这么写的）
- **`clip`（默认 `true`）**：卡片带 `overflow-hidden` 来裁圆角。若卡片里有浮层（`Dropdown` 的菜单是
  `absolute` 挂在卡片内），**必须 `clip={false}`** —— 否则菜单被裁掉；那种卡片由自己裁圆角
  （`Tabs` 上加 `overflow-hidden rounded-t-xl`）。http 的主工作区卡片即为此例。
  **面板矮的时候照样栽**：预设面板（`$lib/components/PresetPanel`）的 CSV 下拉在移动端
  只有 224px 高的面板里展开 213px 的菜单，最后一项被整块切掉 —— 所以它的 `extraActions` 槽里
  挂了浮层时，调用方要传 `clip={false}`（`PresetPanel` 已把这个 prop 转发给 `Panel`）。
  这种裁切 axe 查不出来（元素在 DOM 里、只是看不见），只能肉眼点开菜单看。
  **卡内的滚动容器同样会裁，而且 `clip={false}` 管不到它**：`overflow` 只要不是 `visible` 就是裁剪上下文，
  菜单落在滚动区的下边界之外照样被切（`overflow-y-auto` 一样）。http 的「请求构造 → 授权」栽过一次 ——
  那个标签页的根容器是滚动区，最上面一行的「认证方式」下拉菜单被切掉下半截。
  处置是**把带浮层的那一行提到滚动区之外**（钉成固定行，字段与说明自己滚），
  **不要**为了露出菜单而去掉滚动（内容一长就溢出卡片，那比裁菜单更糟）。
  关掉 `clip` 前先确认卡内没有**带底色 / 带通栏边框**的子元素（它们会露出直角）；
  预设面板内部都是白底 + 内边距，关掉后看不出差别。
- **栅格 / 行向 flex 的子项要带 `min-w-0`**：这类子项的 `min-width: auto` 等于「最小内容宽度」，
  宽内容（`whitespace-pre` 的代码块、长 URL）会**把轨道撑开**、连带把整页顶宽 ——
  手机上表现为**整页被缩小**（卡片只有 380px，而代码块 527px）。
  **判据不是 `scrollWidth > innerWidth`**：布局视口已经被撑宽，两者相等，这样量不出来；
  要量 **`innerWidth > screen.width`**。http 的「代码生成」栽过一次（代码块最长行约 495px
  把 393px 的视口撑到 577px），给 http 工作区的栅格子项补齐 `min-w-0` 后，代码块回到块内横向滚动。
- **窄屏的「一组 chips + 右侧图标按钮」别让包裹层吃满整行**：包裹层（`role="group"` 那类）是工具条的
  一个 flex 子项，它自己按内容换行时会占满整行，右侧那枚按钮只能另起一行 —— 选择区下面凭空多出一块
  「只有一个小图标」的空白（http 代码生成的工具栏实测 111px，其中 32px 是那一行空行）。
  处置：窄屏给包裹层 `max-md:contents`（chips 直接参与工具条的换行流，按钮自然落到末行末尾）、
  工具条配 `max-md:justify-start`（否则 `justify-between` 会把每一行都拉到两端，两个 chip 也撑开）；
  宽屏恢复 `flex`，与原先完全一致（实测桌面 1280px 下 `display` 仍是 `flex`、复制仍在最右端）。
- **栅格的 `align-content` 默认 `stretch` 会拉高 `auto` 行**：内容没占满整个栅格时，多出来的高度会分摊给
  `auto` 行，于是「高度本该由内容决定」的卡片被撑高 —— http 的「代码生成」工作区里，左栏的工作区标签卡
  从 54px 被拉到 92px，看着就是「三个工作区选择下面多出一块白」（同一个页面在内容较长的「请求调试」下正常，
  因为那时没有富余高度）。内容按行排的栅格窄屏要加 `content-start`；宽屏用显式行模板
  （`auto + minmax(0,1fr)`）本来就填满，不受影响。
- **`flex-1` 的 `flex-basis: 0%` 会盖过 `width`**：想让某个 flex 子项独占一行要用 `basis-full`
  （`flex-basis: 100%`），写 `w-full` 不生效（那一层若是 `flex-1`，宽度仍按 0% 起算）。
  http 请求条窄屏的第一行就是这么排的；同理，一串控件想换行分组时，用 `order` + `basis-full`
  比靠内容宽度「碰巧换行」可控得多。
- 外壳自带 `relative`（不能去掉）：内部的 `sr-only` h2 / label 是 `absolute`，没有定位上下文会逃出裁剪撑高文档（§18）

**内边距与分隔线规矩**：

- 卡片外壳**不加内边距**：正文用 `p-4`，行用 `px-4 py-2`，使横向分隔线（`border-b`、`divide-y`）通栏贴到卡片边框
- 面板头部 / 底部 `border-b` / `border-t` 与正文行间分隔线同一个口径
- 工具条 / 状态条这类通栏底栏走 footer，不吃正文的内边距

**不用 Panel 组件时**（结构不同，如 json-formatter 的工具条）：直接用 `$lib/ui/styles.ts` 的 `TOOLBAR`
（同为 `rounded-xl border border-gray-200 bg-white shadow-sm`，见 §8.2），保持视觉一致。

### 8.1 工具页外壳（ToolShell）

每个工具页都用 `$lib/components/ToolShell/ToolShell.svelte` 包一层，**不要各写一份外壳**。
**首页也用它**，只靠 `mainClass` + 三个可选槽补自己的东西（见下方「首页怎么用」）。
外壳负责：SEO head（title / description / keywords / canonical / og:*）、sticky 顶部导航（**左上角 `<ToolMenu>` 全站工具菜单** +
图标 + 工具名 + 副标题 +「数据本地处理」胶囊 + 文档 / 源码外链）、页面唯一的 `sr-only` `<h1>`、主区布局。工具页只写自己的面板。

**左上角工具菜单（`<ToolMenu current={path} />`）**：图标按钮（`size-9` 方块 + `size-5` 的 `Menu`）+ **从左侧弹出的抽屉**，
按 `$lib/tools` 的分组列出全部工具，命中当前页的那条打 `aria-current="page"` 并给蓝底 + 勾。
抽屉 `absolute top-0 left-0 h-dvh w-72 max-w-[85vw]`：

- **不要写 `fixed`**：导航条带 `backdrop-blur`，`backdrop-filter` 会给 fixed 子元素当包含块，
  抽屉会被压进那条 56px 高的导航条里。导航条 `sticky top-0`，它的 top 恒等于视口顶部，
  所以 `absolute top-0 + h-dvh` 就是整屏 —— 这是这里能用 absolute 的前提，动导航条定位时要重看
- 遮罩 `z-0`、抽屉 `z-10`：两者都是定位元素，要盖住导航条里的品牌文字，且抽屉在遮罩之上
- 顶部 `h-14` 标题行（「全部工具」+ 计数 + 关闭按钮），下面内容区 `min-h-0 flex-1 overflow-y-auto` 自己滚，
  底部可再钉一块（`shrink-0 border-t`，如移动端的文档链接，见上）
- 滑入用 `transition:fly={{ x: -320, duration: 200 }}`（与 `Toast` 同一套）
- 关闭三路：点抽屉外、Esc、点任一链接后；按钮与抽屉都带 `data-tool-menu`，点它们不算「点在外面」
- **每个分组可展开 / 收起**（收藏组与各分类共用 `groupHeader`）：标题整行是一枚 `<button>`（`aria-expanded` +
  `aria-controls`），右侧 `ChevronDown` 收起时 `-rotate-90`。收起只给 `<ul>` 加 `hidden` 属性，
  **不要用 `{#if}` 摘掉它** —— `aria-controls` 指向的 id 必须存在（否则踩 axe 的 `aria-valid-attr-value`）。
  默认全展开；收起态只活在组件里，不落存储

导航条 `gap-1`（36px 方块按钮自带 8px 内空）、右侧一簇用 `ml-auto`，**不要用 `justify-between`**（会把工具名顶到中间）。

布局只有三个旋钮（+ 一个逃生口）：

| Prop        | 取值                                         | 用途                                                                                                                                           |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`     | `narrow` / `medium` / `wide`（默认）/ `full` | 主区最大宽度（`max-w-3xl` / `5xl` / `7xl` / 不封顶）：单栏窄表单用 `narrow`，多栏与长列表用 `wide`                                             |
| `fill`      | `flow`（默认）/ `fill`                       | `flow` 走页面自然流；`fill` 钉住视口（`h-dvh overflow-hidden`）并让面板自己滚，编辑器型用                                                      |
| `fillFrom`  | `md`（默认）/ `lg`                           | 从哪个断点开始铺满；面板在 `lg` 才切多列时写 `lg`                                                                                              |
| `mainClass` | 类名串                                       | 给了就**整段替换**主区类名，自绘栅格的页面用（如 websocket、首页）。<br>**自定义时必须自带 `relative`**（`sr-only` 的 h1 是 absolute，见 §18） |

**首页怎么用**（三个可选槽 + 一个 title 覆盖，工具页都不传）：

| Prop / 槽    | 首页传什么                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `title`      | `微工具 · 小而美的在线开发工具 - www.toolv.cn`（默认格式是「`{name}` by 无情」，首页标题里要带卖点） |
| `mainClass`  | `relative flex-1 w-full px-4 pt-4 pb-10 md:px-6`（`flex-1` 才能把页脚顶到底部）                      |
| `navExtra`   | 桌面端搜索框（`hidden lg:block`）+ 官网链接 —— 排在「数据本地处理」之后                              |
| `menuHeader` | 移动端搜索框（`lg:hidden`）—— 小屏导航条放不下，收进工具菜单抽屉顶部                                 |
| `footer`     | 首页页脚（工具页没有）                                                                               |

搜索框在两端是**两个 `Input` 节点、同一个 `query` 状态**（一个 `lg:hidden` 一个 `hidden lg:block`），
不是「一个节点两种形态」—— 因为它要落在两个不同的父容器里（导航条 / 抽屉）。

必填的 SEO props：`icon` / `name` / `tagline` / `description` / `keywords` / `path`；
可选 `heading`（省略同 `name`）、`ogDescription`（省略同 `description`）、`docUrl` / `docLabel`。
`path` 同时用于 canonical、og:url 和导航栏的「源码直达」。

**导航条右侧的站外链接两端分开放**：`docUrl`（文档）与源码链接在桌面端落在导航条右侧那一簇，
**移动端导航条放不下，收进 `<ToolMenu>` 抽屉底部钉住** —— 导航条那份加 `max-lg:hidden`、
抽屉那一整块加 `lg:hidden`，同一条链接在两端各出现一次，不重复也不丢。

- **两条都走 ToolMenu 的 `footer` snippet**：ToolShell 把「文档（有 `docUrl` 才有）+ 源码」两行整段塞进去，
  组件自己不认 `docUrl` / `sourceUrl` —— 菜单只负责钉住与分隔线，链接内容归外壳
- 底部块只在 `footer` 有内容时才渲染，别留空壳
  **站外文档链接必须带 `ArrowUpRight` 外链角标**（`size-3.5 text-gray-500`）——跟首页「官网」同一个口径，
  让人点之前就知道会跳走；「源码」是图标按钮（有 `aria-label`），不再叠角标。

### 8.2 工具页标准版式（工具条 + 双栏编辑区）

「输入 → 输出」类工具的统一骨架。常量全在 `$lib/ui/styles.ts`，**各工具不要再抄一份**；
结构源自 json-formatter，base64 / URL 编解码 / HTML 实体 / JWT 解码 / hash-calculator /
timestamp-converter / radix-converter / case-converter / json-to-ts / csv-json / text-tools /
generator / date-calculator / color-converter / unit-converter 均已跟进。

**双栏的每一侧走 `<EditorPane>`**（不要各写一份 Panel + 三选一）：它给 `Panel` 外壳 +
`headingExtra`（传字符串即按 `PANEL_HINT` 渲染小字，要放 Badge 之类才传 snippet）/ `actions` /
`footer` 三个槽，并在传了 `empty` / `error` 时套上 `relative min-h-56 flex-1 md:min-h-0` 那个容器
—— `EDITOR_OUTPUT`（`absolute inset-0`）全靠它，漏一项输出区就撑不满或塌成 0。
`ready` 由调用方给（「什么算有结果」只有工具自己知道）。槽名跟 `Panel` 一致，不用记两套。

**不适用、继续用 `Panel` 手写的两类**（jwt-decoder 与 http 的响应面板就是这两类，别硬套）：
① 三选一容器要自己带 `tabindex="0" role="region" aria-label`（可滚动区要能键盘滚动），
`EditorPane` 的容器不接这些属性；② 空态里要放按钮等复合内容（http 错误态是「文案 + 复制 cURL 按钮」），
而 `EditorPane` 的 `empty` / `error` 只收字符串。

```svelte
<div class="flex min-h-0 flex-1 flex-col gap-4">
	<!-- ① 工具条：分组在左，操作 md:ml-auto 靠右 -->
	<div id="xxx-toolbar" role="group" aria-label="…操作" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL}>模式</span>
			<div class="flex divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
				<button class={onBtnClass} aria-pressed={…}>A</button>
				<button class={offBtnClass} aria-pressed={…}>B</button>
			</div>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2 md:ml-auto">
			<!-- 工具条按钮一律走 Button（默认 sm 档即 h-8），label 写完整的一句无障碍名 -->
			<Button label="填入示例 JSON">示例</Button>
			<Button variant="primary" label="复制格式化结果">复制输出</Button>
		</div>
	</div>

	<!-- ② 双栏：小屏堆叠，md 起并排。每侧是 <EditorPane> —— 「空态 / 错误态 / 内容」三选一由它管 -->
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<EditorPane
			id="xxx-input-panel"
			heading="JSON 输入"
			headingExtra="0 字符"
			class="relative min-w-0 flex-1 md:min-h-0"
		>
			<Textarea mono label="JSON 输入" bind:value={store.input} class={EDITOR_INPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}><p class="truncate text-xs text-gray-600">操作在顶部工具条</p></div>
			{/snippet}
		</EditorPane>
		<EditorPane
			id="xxx-output-panel"
			heading="输出结果"
			headingExtra={`${store.outputCount} 字符`}
			class="relative min-w-0 flex-1 md:min-h-0"
			empty="在左侧粘贴 JSON，结果会实时显示在这里"
			ready={store.output !== ''}
		>
			<Textarea mono label="格式化结果" size="sm" readonly value={store.output} class={EDITOR_OUTPUT} />
			{#snippet footer()}
				<div class={FOOTER_BAR}>
					<StatusPill tone={statusTone}>{statusText}</StatusPill>
				</div>
			{/snippet}
		</EditorPane>
	</div>
</div>
```

规则：

- **同排控件高度必须一致，一律 `h-8`**：分段按钮、`<Button size="sm">`（默认档就是它）、`Dropdown size="sm"`。
  选项超过 4 个用 Dropdown，别把分段按钮堆成一片。
- **工具条按钮只走 `<Button>`**：次级 `<Button>`（默认 sm / secondary）、主操作 `<Button variant="primary">`。
  `$lib/ui/styles` 的 `ACTION_BTN` 这条常量**只给不是 `<button>` 的元素用**
  （如 base64 上传图片的 `<label>`）—— 手写 `<button class={ACTION_BTN}>` 没有 `aria-label`，
  读屏只念到图标旁那两个字。它的样式串已逐字对齐（见 Button 的 `SIZE_TEXT.sm`）。
  例外只有一处：工具内**分组标题行**的轻档分段按钮（`SEG_BTN_QUIET`，`h-7`，§12.1「两档」）——
  那行不跟工具条同排，跟它同排的控件（如手机端的「收起」）也走 `h-7`。
- **右侧操作区整块用 `TOOLBAR_ACTIONS`**：`flex shrink-0 flex-wrap items-center gap-2 md:ml-auto`。
  26 个工具页逐字相同的同一串（`shrink-0` 防按钮被压扁、`flex-wrap` 防溢出卡片、
  `md:ml-auto` 与 `TOOLBAR` 的 `md:flex-row` 同断点靠右），**不要再手写**。
- **工具条以外那几类重复结构也有常量**，写之前先扫一眼 `$lib/ui/styles.ts`：
  `SEARCH_ROW` + `SEARCH_INPUT` + `SEARCH_ICON`（列表顶部的搜索条三件套，§8.2）、
  `PANEL_SCROLL`（面板正文：移动端限高 60vh 内滚、lg 起交给栅格）、
  `DATA_TABLE` + `TABLE_TH`（数据表本体与表头）、`LIST_HEADING`（分组小标题）、
  `HOVER_CARD`（挂在指针 / 焦点上的信息卡外壳，§8.2 尾）、`HEADER_BTN`（标题行 h-7 小按钮）。
- 编辑区**透明无边框**，外观（边框 / 底色 / 聚焦转蓝）由 `<EditorBox>` 给：控件用 `<Textarea mono>`，
  布局传 `EDITOR_INPUT`（输入，移动端 `h-[45vh]`、md 起 `flex-1` 填满卡片）/ `EDITOR_OUTPUT`（只读输出，
  `absolute inset-0`）。**框与定位容器都由 `<EditorPane>` 给**（输入侧自动套框；传了 `empty` / `error`
  的输出侧给 `relative min-h-56 flex-1 md:min-h-0`），只在手写 `Panel` 时才要自己写这两层。
  输出是 `<pre>` 高亮块时用共享的 `OUTPUT_PRE`（配 `<CodeView>`）。`<Textarea>` 自己就是
  `border-0 bg-transparent`，不要再给控件手写边框 / 底色 —— 会和 `EditorBox` 叠成两层。
- 每张卡片跟一条 `FOOTER_BAR`：输入卡放提示，输出卡放状态胶囊 —— 用 `<StatusPill tone={…}>`（见 §13.1），
  它的 `role="status" aria-live="polite"` 是内置的，不要再手写；静态文案不要挂 `role="status"`。
- 当前不生效的选项组**常驻渲染 + `opacity-60` + `aria-disabled`**（Dropdown 用 `disabled` + `disabledTitle`），
  不要 `{#if}` 整组删掉——状态切换不能引起高度跳变。
  `aria-disabled` 不是可选项：半透明会把组内文字的实际对比度压到 3:1 以下（`text-gray-600` 乘 0.6 只有 2.87:1），
  标上 `aria-disabled="true"` 后 axe 才按「当前不生效」而不是「对比度不合格」判定（见 §18）。
- 可滚动区（`overflow-y-auto` / `overflow-x-auto` / `overflow-auto`）若内部没有可聚焦元素，
  必须自己可聚焦，否则键盘用户滚不动：`tabindex="0"` + `role="region"` + `aria-label="…"`，
  并在元素上一行写 `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->`
  （svelte 的静态规则不认识 `role="region"`）。示例见 `http/ui/CodegenTab.svelte`。
  同一页面上的多个滚动区用**不同的** `aria-label`（landmark 名称不能重复）。
- 多工作区（标签页）工具：标签条单独一行放工具条之上，用 `TAB_BAR` + `TAB_BTN` + `TAB_ON` / `TAB_OFF`
  （`h-9` + `aria-pressed` + `role="group"`，小屏标签均分整宽、`sm` 起收成自然宽度），
  各工作区内部再按本版式排（有配置项的工作区把配置放工具条、结果放面板）。

## 9. 按钮体系

**Button**（`$lib/ui/Button/Button.svelte`，带文字与 `icon` 图标两种形态，图标形态见下方）

| 尺寸 | 高度   | 内边距   | 字号        | 用途                                      |
| ---- | ------ | -------- | ----------- | ----------------------------------------- |
| `lg` | `h-11` | `px-5`   | `text-base` | 页级主 CTA、移动端主操作（44px 触控目标） |
| `md` | `h-9`  | `px-4`   | `text-sm`   | 主操作（发送、保存、添加连接）            |
| `sm` | `h-8`  | `px-2.5` | `text-xs`   | 次级操作（格式化、压缩、示例、清空）      |
| `xs` | `h-7`  | `px-2`   | `text-xs`   | 面板 header 批量操作 / 筛选按钮           |

| Variant     | 样式                                                             |
| ----------- | ---------------------------------------------------------------- |
| `primary`   | `bg-blue-600 text-white hover:bg-blue-700`                       |
| `secondary` | `border border-gray-300 text-gray-700 hover:bg-gray-50`          |
| `danger`    | `border border-red-200 text-red-700 hover:bg-red-50`             |
| `ghost`     | `text-blue-600 hover:underline`                                  |
| `success`   | `border border-emerald-200 text-emerald-700 hover:bg-emerald-50` |
| `warning`   | `border border-amber-200 text-amber-700 hover:bg-amber-50`       |
| `neutral`   | `text-gray-700 hover:bg-gray-100`                                |

基础类：`inline-flex items-center rounded-lg font-medium whitespace-nowrap` + 焦点环 + 禁用态。

**`whitespace-nowrap` 不能省**：按钮高度是固定的（`h-8` / `h-9`…），文字一旦换行就溢出按钮框、
压到相邻控件上 —— 窄屏下按钮是 flex 项、会被压缩，而中文可以在任意字间断行。
实在放不下时让整行溢出（由调用方给横向滚动），也比文字挤出框强。
`$lib/ui/styles` 的 `SEG_BTN`（分段按钮）与 `ACTION_BTN`（「按钮长相，但不是 `<button>`」，
如 base64 那个上传图片的 `<label>`）是同一条约定。

**按下态（`:active`）全站统一，组件里不要再逐处写**：`layout.css` 的 base 层给
`button:not(:disabled)` / `summary` / `[role="button"]` / `[role="switch"]` 加了
`filter: brightness(0.96)` —— 四种变体（实底 / 描边 / 幽灵 / 危险）一律成立。
**不要改成位移或改色**：位移（哪怕 `translateY(1px)`）会被 `overflow-hidden` 的容器切掉一角 ——
分段控件与标签条的盒子高度**正好等于**按钮高度，下移 1px 就是把按钮底边切掉；改色则要给每个变体各配一套 token。
新写按钮时若用了自己的类而没套 `Button`，记得它的容器才可能是 `overflow-hidden` 的那一层。

**图标按钮**（`<Button icon label="..." onclick={...}>`，行内圆形图标钮；原 IconButton 已并入）

`icon` 一开就走另一张尺寸表与配色表，两种形态的默认档也不同（文字默认 `secondary` / `sm`，图标默认 `neutral` / `md`）：

| size        | 值               | 说明                                                  |
| ----------- | ---------------- | ----------------------------------------------------- |
| `md` / `lg` | `size-6`（24px） | 默认 `md`，满足触控目标下限                           |
| `sm` / `xs` | `size-5`（20px） | 视觉更小时用，**调用方需自行用 `after` 伪元素扩热区** |

| variant     | 图标色 / hover                                                | 说明           |
| ----------- | ------------------------------------------------------------- | -------------- |
| `neutral`   | `text-gray-600 hover:bg-gray-100 hover:text-gray-900`         | **图标默认**   |
| `primary`   | `text-blue-600 hover:bg-blue-50`                              |                |
| `success`   | `text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700` |                |
| `warning`   | `text-amber-600 hover:bg-amber-50 hover:text-amber-700`       |                |
| `danger`    | `text-red-600 hover:bg-red-50 hover:text-red-700`             | 焦点环用红     |
| `secondary` | 同 `neutral`                                                  | 与文字形态同键 |
| `ghost`     | 同 `primary`                                                  |                |

基础类：`inline-flex shrink-0 items-center justify-center rounded-full` + 焦点环 + 禁用态。

**触控热区**：图标视觉做小（`size-5`）时用 `after` 伪元素把热区撑到 ≥24px：

```
relative rounded after:absolute after:-inset-3 after:content-['']
```

`after:-inset-3` 向四周扩 12px；只横向扩时用 `after:-inset-x-2`。

**Dropdown**（`$lib/ui/Dropdown/Dropdown.svelte`）

触发按钮走与 Button 相同的档位高度：`md = h-9 px-3 text-sm`（默认）、`sm = h-8 px-2.5 text-xs`（密集工具条）、
**`xs = h-7 px-2 text-xs`（面板标题行，跟 `HEADER_BTN` 同高）**。
展开态 `border-blue-300 bg-blue-50 text-blue-700`；菜单宽 224–320px，按可用空间往大的一侧展开，
**高度同样按视口余量收紧（上限 320px）**，并在按钮下方不足 200px 而上方的余量更大时**翻到上方展开**，
超高由菜单内部滚动 —— 纯 `left-0` + 固定宽度会在按钮靠右时被屏幕裁掉，固定 `max-h-80` 则会在按钮
贴近视口底时（收起后的响应面板、页面最后一张卡的标题行）把菜单顶出屏幕，最后几项连内部滚动都够不着。

`label` 同时是无障碍名称与菜单的 `aria-label`；**动作型菜单**（点一下就执行，没有「当前值」）
把 `value` 传空串、再用 `triggerLabel` 给按钮上一句短的字 —— 那句话要长到说清干什么，
长到摆不进按钮时就用它分离「读屏听到的」与「看到的」。

## 10. 焦点环

| 场景                      | 样式                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 按钮级（默认蓝）          | `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`                              |
| 按钮级（危险操作）        | `focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none`                               |
| 容器级（输入条 / 编辑盒） | `focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:outline-none` |
| 容器级（错误态）          | `focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:outline-none`   |
| 输入框级                  | `focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none`                             |

透明度统一 `/20`；toast 背景 `/85`。

## 11. 输入框

**基础外观**（`$lib/ui/styles.ts` 已导出，直接 import）：

```
INPUT_BASE  = 'rounded-lg border border-gray-300 bg-white'
INPUT_FOCUS = 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
```

尺寸、内边距、字号由调用方补。

| 场景                      | 样式                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正则输入条（h-11）        | `flex h-11 w-full items-center rounded-lg border border-gray-300 bg-white` + `focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:outline-none` |
| 文本替换输入（h-9）       | `h-9 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm` + `INPUT_FOCUS`                                                                                          |
| 双栏编辑器（输入 / 输出） | 控件用 `<Textarea mono>`（透明），外套 `<EditorBox>` 给外观，布局传 `EDITOR_INPUT` / `EDITOR_OUTPUT`，见 §8.2 / §11.1                                                                   |

禁用态：`disabled:cursor-not-allowed disabled:opacity-40`

### 11.1 多行输入框（Textarea）

`$lib/ui/Textarea/Textarea.svelte`，继承 `HTMLTextareaAttributes`，`rows` / `placeholder` / `readonly` /
`maxlength` / `oninput` 这些原生属性**直接透传**，不用往组件里加 prop。`value` 用 `bind:value` 双向绑定。
组件本身**透明、无边框、内边距固定 8px**：边框、底色、聚焦转蓝（含错误态）一律由外层 `EditorBox` 给，
所以它只该放进 `EditorBox` 里用。

| Prop       | 默认     | 说明                                                                                               |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| `label`    | —        | 渲染成 `sr-only` 的 `<label for>`（可访问性必需）。外部已标注好就别传，改给 `aria-label`           |
| `value`    | `''`     | `bind:value` 双向绑定                                                                              |
| `size`     | `'md'`   | `md` = `text-sm leading-6`（编辑区）/ `sm` = `text-xs leading-5 sm:text-sm sm:leading-6`（输出区） |
| `mono`     | `false`  | 等宽字体（代码 / JSON / Base64 一律开），占位符自动回退成 sans                                     |
| `resize`   | `'none'` | `none` / `y` / `both`；面板里高度归容器管，默认不许拖                                              |
| `textSize` | —        | 传了就以它为准、`size` 档位失效（字号与行高绑在一起给，别只给字号）                                |
| `ref`      | —        | `bind:ref={el}` 拿 DOM 节点（自动聚焦、选区操作）                                                  |

**底色与边框挂在框上，不在控件上**：`EditorBox` 的 `bg-gray-50` / `border-gray-300` 是常态样式，
不靠 hover / focus 触发；深色下由 `.dark` 变量组自动换档（§1.1），调用方两套主题都不用写 `dark:`。

**高度与定位不归组件管**，由调用方用 `class` 传 —— 那是「放在页面哪儿」，每个工具不一样：

| 常量            | 用途                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| `EDITOR_INPUT`  | 双栏工具输入区：移动端 `h-[45vh]`，md 起 `flex-1` 填满卡片                           |
| `EDITOR_OUTPUT` | 只读输出区：`absolute inset-0`，**外层必须是 `relative min-h-56 flex-1 md:min-h-0`** |

**编辑区外框统一走 `EditorBox`**（`$lib/components/EditorBox`）—— 多行编辑区不再各自手写边框：

- **同一副面貌**：`rounded-lg border border-gray-300 bg-gray-50`，聚焦 `focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20`。
- **可编辑输入区与只读结果区用同一个框**，不靠底色区分能不能输入；区分靠卡片标题与只读光标。
- **焦点只由框表达**：框内控件不画自己的焦点环（会和框叠成两层）。
- 框内编辑层内边距 8px：`Textarea` 自带、镜像编辑器的 `EDITOR_TYPE` 同档；框与卡片边的间距由调用方补（`EDITOR_FRAME_PAD` = 8px）。
- **错误态也走框**：`<EditorBox invalid={…}>` 把边框与焦点环转红（如正则替换结果非法）。
- **例外**：regex / sql 的镜像高亮编辑器必须用裸 `<textarea>`（两层逐字对齐），但同样套 `EditorBox`。

```svelte
<!-- 输入区：框（外观）+ EDITOR_INPUT（布局）+ 透明控件 -->
<div class={EDITOR_FRAME_PAD}>
	<EditorBox>
		<Textarea id="…" mono label="JSON 输入" bind:value={store.input} class={EDITOR_INPUT} />
	</EditorBox>
</div>
<!-- 只读输出区：同一副框、同一套写法 -->
<div class={EDITOR_FRAME_PAD}>
	<EditorBox>
		<Textarea id="…" mono label="格式化结果" size="sm" readonly value={output} class={EDITOR_OUTPUT} />
	</EditorBox>
</div>
```

- `spellcheck` 默认 `false`（本站输入基本是代码与数据，拼写红线碍事），要开自己传。
- `id` 不传时用 `$props.id()` 生成一个，保证 `label` 一定能关联上。
- `sr-only` 的 label 是 `absolute`，**父级必须带 `relative`**（§18 的陷阱），否则会逃出裁剪把文档撑高。
- **唯一的例外**：regex / sql 的编辑器是「透明文字 + 镜像层高亮」的组合，两层必须逐字共用
  `EDITOR_TYPE`，`<Textarea>` 的底色 / 字色在这里全不适用 —— 控件刻意手写；但**外框照套 `EditorBox`**。
- 组件上的 `rows` / `tabindex` 等数字属性要写 `rows={3}`，写 `rows="3"` 会被 svelte-check 判类型错。

### 11.2 单行输入框（Input）

`$lib/ui/Input/Input.svelte`，继承 `HTMLInputAttributes`，`type` / `placeholder` / `maxlength` /
`readonly` / `pattern` / `oninput` 这些原生属性**直接透传**。`value` 用 `bind:value` 双向绑定。

| Prop      | 默认    | 说明                                                                                     |
| --------- | ------- | ---------------------------------------------------------------------------------------- |
| `label`   | —       | 渲染成 `sr-only` 的 `<label for>`（可访问性必需）。外部已标注好就别传，改给 `aria-label` |
| `value`   | `''`    | `bind:value` 双向绑定                                                                    |
| `invalid` | `false` | 错误态：`border-red-400` + 红焦点环，并落 `aria-invalid`                                 |
| `mono`    | `false` | 等宽字体（正则、token、编码串一律开），占位符自动回退成 sans                             |
| `size`    | `'md'`  | `sm` = `h-8 px-2.5 text-xs` / `md` = `h-9 px-3 text-sm` / `lg` = `h-11 px-4 text-base`   |
| `ref`     | —       | `bind:ref={el}` 拿 DOM 节点（自动聚焦、选区操作）                                        |

与 Textarea 的两点差别：**高度走 `size` 档位**、**没有 `resize` / `textSize`**（要覆盖就传 `class`）。
`spellcheck` 同样默认 `false`，`id` 不传时同样用 `$props.id()` 生成。

**正则输入条那种「前缀 / 后缀挂在输入框里」的形态**（如 `h-11` + 左右 `/` 与修饰符按钮）
不是 Input 的职责：它是一条 `h-11` 的容器，用 `focus-within` 焦点环（§10 容器级）+ 内部一个
`border-0 bg-transparent focus:outline-none` 的 Input 拼。别给 Input 加 prefix/suffix prop。

### 11.3 复制与提示

**复制只有一条实现路径**：`import { copyToClipboard } from '$lib/ui/copy'`。

```ts
const copied = await copyToClipboard(text, {
	ok: '已复制输出结果', // 成功提示，默认「已复制」
	empty: '输出为空，没有可复制的内容', // 内容为空时弹这条（错误色），默认「没有可复制的内容」
	fail: '复制失败，请手动选中输出内容复制', // 默认「复制失败，请手动选中复制」
	isEmpty: (t) => t === '' || t === '—' // 默认 trim 后为空串
});
```

它内部走 `$lib/utils/browser` 的 `copyText()`：先试 `navigator.clipboard`，失败回退 `execCommand`，
**返回真实成功与否**再决定弹哪条提示。不要自己写 `try { await navigator.clipboard.writeText() }`——
那样既丢了回退，也会把失败误报成「已复制」。

**UI 上有两种按钮，分工不要混**：

| 场景                                                                         | 写法                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **行内复制**（结果列表每行、逐行生成结果的每一条、时间戳那几个只读结果）     | `<CopyButton text={...} ok="..." />`（图标形态传 `icon` + children 给图标）        |
| **工具条整块复制**（复制全部输出 / 复制 cURL / 复制生成代码 / 复制全文假文） | 留在 `core/store.svelte.ts` 里调 `copyToClipboard()`，UI 上的按钮仍手写或 `Button` |

分界的理由：工具条那几个复制带工具级守卫（「请先填写 URL」「当前输入有误」）与专属文案，
且已有纯逻辑单测覆盖；行内复制则是同一套文案反复出现，收进组件最划算。

```svelte
<!-- 行内复制：空内容/失败文案都可省，组件给了默认值 -->
<CopyButton icon text={line} ok="已复制这条 UUID" label="复制第 {index + 1} 条 UUID">
	<Copy class="size-3.5" aria-hidden="true" />
</CopyButton>

<!-- 结果里用「—」占位时，必须放宽 isEmpty，否则点了会误报「没有可复制的内容」 -->
<CopyButton text={output} isEmpty={(t) => t === '' || t === '—'} empty="还没有可复制的结果" />
```

**提示条**：`$lib/ui/toast.svelte.ts` 是全局单例（`toast.show(message, isError?)`，
`TOAST_DURATION = 2000`），组件侧 `<Toast />` 每个工具页只放一个。位置默认 `bottom`；
底部有输入区的页面（websocket）传 `position="top"`，`top-16` 让开 `h-14` 导航栏。
失败一律 `toast.show(msg, true)`（红色），不要自己拼 `toastTone`。

## 12. 分段选择与开关

### 12.1 分段选择（SegmentedControl）

一组互斥的小按钮（模式 / 方向 / 单位 / 大小写……）。**同一形态一律走组件**，别再手写按钮组：

```svelte
<SegmentedControl
	aria-labelledby="ts-unit-group-label"
	options={UNIT_OPTIONS}
	value={tsStore.tsUnit}
	onchange={(v) => tsStore.setTsUnit(v)}
/>
```

| prop       | 说明                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| `options`  | `{ value, label, disabled?, title? }[]`；通常写成模块级 `as const` 常量，顺序即渲染顺序 |
| `value`    | 当前选中值；组件是泛型的，`T` 由 `options` 的 value 推出来                              |
| `onchange` | 只回传新值，不派发 Event —— 名字跟原生 `onchange` 撞，组件里已把原生的 Omit 掉          |
| `edge`     | 分隔线/边框深浅：`light` gray-200（工具条，默认）/ `dark` gray-300（卡片正文）          |
| `tone`     | `default` 实心蓝底选中 / `quiet` 浅蓝底选中 + 按钮更矮更窄（见下「两档」）              |

组件自带 `role="group"` + 每项 `aria-pressed`（**不是 tablist / radiogroup**：它不切换面板、也不参与表单提交）；
`aria-label` / `aria-labelledby` 由调用方给。按钮外观走 `SEG_BTN*` / `SEG_ON*` / `SEG_OFF*`（见下），**调用方不再拼这几个常量**。

**分段按钮两档**（组件内部用；直接改样式时看这里）

```
基础：inline-flex flex-1 items-center justify-center gap-1 text-xs font-medium transition-colors
      focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none md:flex-none
      （高度不在基础里：两档差的就是这一项）

默认档（tone="default"，SEG_BTN / SEG_ON / SEG_OFF）
  高度：h-8        内边距：px-3      选中：bg-blue-600 text-white hover:bg-blue-700
                                    未选：text-gray-600 hover:bg-gray-50

轻档（tone="quiet"，SEG_BTN_QUIET / SEG_ON_QUIET / SEG_OFF_QUIET）
  高度：h-7        内边距：px-2.5    选中：bg-blue-50 text-blue-700 hover:bg-blue-100
                                    未选：text-gray-600 hover:bg-gray-50 hover:text-gray-900
```

**选中态也要写 hover，别只给未选那档写**：同一排里未选中的项悬上去会变色，唯独当前选中那条毫无反应，
用户会以为「选中的那条不能再点」。口径与 `CHIP_ON`、`Button primary`（都写了 `hover:bg-blue-700`）一致 ——
`SEG_ON` / `SEG_ON_QUIET` / `TAB_ON` / `LINE_ON` / `NAV_ON`（http 的竖排工作区导航）以及抽屉里
`aria-current="page"` 那条，全部已补齐。**新写一排切换控件时照抄这套两态**。

**什么时候用轻档**：同一屏里会**同时出现好几处**分段按钮时（如 ecommerce-roi 的参数卡：面板头部走默认档，
两处组标题行用轻档）。
实心蓝块叠在一起会互相抢镜头 —— 控件比它自己那行 12px 的标题还响；
浅底档把这个主次扳回来。高度也矮一档（`h-7`）：12px 的标题旁边架一个 `h-8` 的按钮框，
按钮比标题高出一倍，这行看着就是它在主导 —— **用轻档的那行，其余控件也走 `h-7`**，别混高度。
一屏只有一两处时（工具条、卡片正文）用默认档：对比更强，扫读更快。

**只管一个字段的开关不用分段，用一枚交换按钮**（ecommerce-roi 首例：广告花费 / 订单数 / 商品成本）。
两个选项来回切的场景，一枚「当前填法 + 交换图标」比两枚分段省一半宽度，够贴在字段名右端；
分段按钮留给组级开关（管一组字段的那种）。
尺寸与摆放的两个坑，改动前先读：

- **高度 24px（`h-6`）是触控下限**（axe `target-size`，§18），但字段名（`text-xs`）的行高只有 16px ——
  照 24px 排版会把这一格的标题行顶高，栅格是两列并排，**同排另一列的输入框会跟着掉 8px**。
  解法是 `h-6` + `-my-1`：负外边距把上下各 4px 的盒模型吃掉，按钮在行里只占 16px，点击区仍是 24px。
- **宽度按最挤的一格倒推**：字段格在 lg / 2xl 两档只有 150–167px，字段名本身能占 106px，
  所以按钮内边距收到 `px-1.5`、图标 `size-3`、字图间距 `gap-0.5`（2 字 50px、3 字 62px）。
  原样（`px-2.5` + `size-3.5`）会把这两格挤折行，而折行等于把上面的错位问题又带回来。

完整写法与宽度账见 `src/routes/ecommerce-roi/ui/InputPanel.svelte` 的 `MODE_SWAP_BTN`。

**开关按钮**（`aria-pressed`）

```
关：inline-flex h-7 items-center gap-1 rounded-lg border border-gray-300 px-2.5 text-xs font-medium
    text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none
开：inline-flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white
    hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none
```

**Switch**（`$lib/ui/Switch/Switch.svelte`）

```
外框：relative inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-full + 焦点环 + 禁用态
轨道：relative h-5 w-9 rounded-full transition-colors   开 bg-emerald-500 / 关 bg-gray-300
圆钮：absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform
      开 translate-x-4 / 关 translate-x-0
```

- 外框 `h-7` 是 §3 的开关档，同时满足触控目标下限；视觉轨道只有 `h-5`，看起来不笨重。
- 开态走**成功语义色 `emerald-500`**（§1「开关 on」），**不要用 `blue-600`**。
- `checked` 用 `bind:checked` 双向绑定；`label` 必填（无障碍名称），`title` 写「开了会怎样」。
- **别和上面的「开关按钮」混用**：Switch 是状态开关（`role="switch"` + `aria-checked`，如发送方式）；
  开关按钮是切换按钮（`aria-pressed`，用于筛选 / 视图切换）。

全站两处开关都已统一到本组件（http 的服务器代发、websocket 的两个开关卡片），**不再有内联实现**。
http 那处原先自己写了一套蓝色 `h-6 w-11`，换过来之后开态变绿、外框跟着长到 `h-7` —— 这是有意的
（§1 的「开关 on 用成功语义色」全站唯一口径）。

### 12.2 多工作区标签条（Tabs）

```svelte
<Tabs aria-label="工具模式" options={TABS} value={store.tab} onchange={(v) => store.setTab(v)} />
```

| prop                 | 说明                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `options`            | `{ value, label, icon? }[]`；`icon` 传 @lucide/svelte 组件，组件在小屏自动隐藏（`hidden sm:block`） |
| `value` / `onchange` | 同 SegmentedControl：泛型 + 只回传新值                                                              |
| `variant`            | `card`（h-9 带阴影）/ `flat`（h-9 不带阴影，下方紧跟卡片时用）/ `line`（h-12 贴顶横线）             |

- 常量 `TAB_BAR` **不含 `shadow-sm`**，阴影由 Tabs 按 variant 加 —— 常量里写死阴影就没法做 flat 了。
- 比分段按钮高一档（`h-9` / `h-12`）：它是页面级的区域切换，不是工具条里的选档；小屏标签均分整宽。
- **刻意不用 `role="tablist"`**：真 tablist 要求方向键在标签间移动焦点、还要管 tabpanel 关联，
  这里只是「按钮组切内容」，上 tablist 反而要补一堆键盘逻辑。

http 的工作区标签是左栏里的**竖排导航**，没走本组件的横排 `line` —— 那套常量留在它自己的 `ui/styles.ts`。

**标签条 + 内容区的外壳是 `<TabShell>`**，别各写一份：它只负责外层纵向容器与 `gap-4`，
`options` / `value` / `onchange` / `variant` 原样转发给 `Tabs`，分支内容由 children 写。
**`<Toast />` 不收进组件**（全局提示层跟标签切换无关），仍由工具页自己放一个。
文件名用 `ui/Workspace.svelte` —— 它装的是工作区切换外壳，不是 `Panel` 卡片，
叫 `Panel.svelte` 会跟共享组件撞名。

### 12.3 小徽章（Badge）

一行短标签，**静态**内容（响应状态码、状态码分类、「输入」标记……）：

```svelte
<Badge tone="ok" class="max-w-40"><span class="truncate">200 OK</span></Badge>
<Badge mono class="min-w-11" tone="warn">404</Badge>
<Badge size="sm" tone="info">输入</Badge>
```

| prop   | 说明                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| `tone` | `neutral` / `info` / `ok` / `warn` / `error`，配色见 `BADGE_TONE`；默认 `neutral` |
| `size` | `sm` = h-6（贴在列表行里，跟行内 h-6 控件同高）/ `md` = h-7（面板标题行，默认）   |
| `mono` | 内容是数字 / 进制值时开；配合 `class="min-w-11"` 保证三位数不抖宽                 |

**跟 StatusPill 别搞混**：StatusPill 是卡片脚注里**会变**的运行态文字（撑满宽度 + `role="status"` 播报）；
Badge 是贴在标题行 / 列表行里的**静态**标记（内容宽度、不播报）。所以 Badge 没有 `role="status"`，
底色也更实一档（`-100` vs `-50`）。

## 13. 状态点

```ts
connected    → 'bg-emerald-500'
connecting   → 'bg-amber-500 animate-pulse'
disconnected → 'bg-gray-300'
```

基础类：`size-2.5 shrink-0 rounded-full`

### 13.1 输出状态胶囊（StatusPill）

输出卡片底部那条「校验 / 进度 / 错误」运行态文字，形态统一：
**挂在 `FOOTER_BAR` 里 + `role="status" aria-live="polite"` + 三态底色**。不要各工具再写一份：

```svelte
import StatusPill from '$lib/components/StatusPill/StatusPill.svelte';

<div class={FOOTER_BAR}>
	<StatusPill tone={statusTone} truncate>{statusText}</StatusPill>
</div>
```

| prop       | 说明                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `tone`     | `neutral` 等待输入 / `info` 进行中 / `ok` 成功 / `warn` 有降级 / `error` 失败；默认 `neutral`          |
| `truncate` | 文案可能超长时加（`FOOTER_BAR` 是固定 `h-9`，不截断会把卡片撑高）；短文案不用加                        |
| `class`    | 追加类；胶囊本体 `w-full rounded-lg px-3 py-1 text-xs font-medium` 由组件给，配色在 `STATUS_PILL_TONE` |

`role` / `aria-live` 由组件内置 —— 它存在的意义就是给读屏播报；真要改（如 `aria-live="assertive"`）用 rest 覆盖。
jwt-decoder 那种**独立一条、不在卡片脚注里**的状态条也用它，补 `class="flex h-9 shrink-0 items-center"` 即可。

### 13.2 结果行（ResultRow）

结果列表的一行：左侧名称、中间值、右侧行内操作（通常是复制按钮）。

```svelte
<ResultRow>
	<span class="w-20 shrink-0 text-xs font-medium text-gray-600">HEX</span>
	<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{value}</span>
	<CopyButton icon text={value} label="复制 HEX 格式"><Copy class="size-3.5" /></CopyButton>
</ResultRow>
```

| prop      | 说明                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `density` | `md` = `px-4 py-2`（默认）/ `sm` = `px-2 py-1.5`（卡片里行多的用，color-converter） |

- 组件只管**行骨架**（间距、行距、悬浮底色）；名称列宽度、值是否截断/右对齐、行尾放什么由 children 决定。
- 行尾有按钮时整行给 `hover:bg-gray-50 focus-within:bg-gray-50` —— 鼠标悬浮与**键盘聚焦到按钮**都要有反馈。

## 14. JSON / 代码语法高亮

**分词与渲染都是全站唯一一份**，不要再在工具里写第二套：

| 环节 | 位置                                          | 说明                                                                                                                                                                      |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分词 | `src/lib/utils/json.ts`                       | `tokenizeSource(source)` 保留原始排版；`tokenizeJson(text)` 先按 2 空格重排再分词（非 JSON 返回 `null`）                                                                  |
| 类型 | `src/lib/utils/json.ts`                       | `JsonTokenKind` = key / string / number / literal / punct / plain——**六个 kind，少一个 `Record` 就查不到**                                                                |
| 配色 | `src/lib/ui/styles.ts` 的 `JSON_TOKEN_CLASS`  | 白底专用；下面这张表就是它的内容                                                                                                                                          |
| 渲染 | `src/lib/components/CodeView/CodeView.svelte` | `<pre><code>` + 一串上色 `<span>`；`classMap` 由调用方传（JSON / TS / SQL 各一套色板）；版式（`font-mono` / `p-4` / 高度 / `tabindex` / `role`）也全部由调用方用 class 传 |

选分词的判断只有一条：**要不要保留用户自己的排版**。json-formatter 要保缩进 → `tokenizeSource`；
jwt-decoder / http / websocket 拿到的是一行紧凑 JSON、要美化 → `tokenizeJson`。

| Token   | 颜色               |
| ------- | ------------------ |
| key     | `text-blue-700`    |
| string  | `text-emerald-700` |
| number  | `text-amber-700`   |
| literal | `text-violet-700`  |
| punct   | `text-gray-500`    |
| plain   | `text-gray-900`    |

**一张渲染块、三套色板**：渲染统一走 `src/lib/components/CodeView/CodeView.svelte`
（`tokens` + `classMap` 两个 prop，`<pre><code>` + 一串上色 `<span>`），色板留在各自工具 ——
JSON 用 `$lib/ui/styles.ts` 的 `JSON_TOKEN_CLASS`，TypeScript 用 json-to-ts `ui/Panel.svelte` 里的
`TS_TOKEN_CLASS`，SQL 用 sql `ui/styles.ts` 里的 `SQL_TOKEN_CLASS`。

| 高亮 | 分词在哪                                  | kind                                                           |
| ---- | ----------------------------------------- | -------------------------------------------------------------- |
| JSON | `src/lib/utils/json.ts`（全站唯一）       | key / string / number / literal / punct / plain                |
| TS   | `src/routes/json-to-ts/core/highlight.ts` | keyword / type / property / primitive / punct / plain          |
| SQL  | `src/routes/sql/core/highlight.ts`        | keyword / string / comment / number / function / punct / plain |

分词的提升门槛与组件一致（被两个以上工具用到才进 `$lib`）：JSON 分词进 `$lib/utils/json`，
TS / SQL 各自留在工具内 —— 它们只服务自己那一种文法。**TS / SQL 的分词不要互相套用**，
`{{占位符}}` 那一套是速查层的事，与语法高亮无关。

**唯一例外**：websocket 的日志面板（`ui/LogPanel.svelte`）自带一套更深的配色 —— 它的 token 渲染在带底色的日志行里
（收到的消息是 `bg-emerald-50`），上面这套 -700 在绿底上会糊。kind 仍共用，只是颜色另配；改配色时两边都要看。

深底代码块：用 `$lib/ui/styles.ts` 的 `CODE_BLOCK`（与 `CodegenTab` 共用一份，
`p-4` 跟编辑区同档）。可滚动区记得配 `tabindex="0" role="region" aria-label`。

**代码生成标签页**：直接用 `$lib/components/CodegenTab`（语言 chips + 深底代码块 + 复制按钮），
不要各工具再写一份 —— 它原先在 http 与 regex 各有一份 98% 相同的实现。
语言列表与生成函数仍留在各工具的 `core/codegen.ts`，通过 `langs` / `value` / `onchange` / `code` /
`oncopy` / `copyLabel` / `blockId` / `blockLabel` 传进去（`blockId` 要在页内唯一，`copyLabel` 要能区分「请求代码」与「生成代码」）。
chips 的两种态用 `$lib/ui/styles.ts` 的 `CHIP_ON` / `CHIP_OFF`。

## 15. 排版

| 场景                             | 样式                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| 代码 / URL / 消息内容            | `font-mono`                                                            |
| 数字（计数、时间戳、延迟、统计） | `tabular-nums`（防数字宽度变化导致布局抖动）                           |
| 占位符                           | `placeholder:text-gray-500`，等宽输入框用 `placeholder:font-sans` 回退 |
| 主标题（h2）                     | `text-sm font-semibold text-gray-900`                                  |
| 小标签 / 提示                    | `text-xs font-medium text-gray-600`                                    |
| 说明小字                         | `text-[11px] leading-4 text-gray-600`                                  |
| 角标 / 图解标注                  | `text-[10px] font-semibold tracking-wide`                              |
| 长文本溢出                       | `min-w-0 flex-1 truncate` 或 `min-w-0 flex-1 break-all`                |

## 16. 空态

```
absolute inset-0 flex items-center justify-center px-6 text-center text-xs leading-5 text-gray-600
```

或用 `EmptyState` 组件（`$lib/components/EmptyState`），边框用 `border-dashed`。

## 17. 响应式（硬性要求）

所有页面必须同时适配手机端与电脑端，只做桌面布局视为未完成。

**断点节奏**：`默认（移动窄屏） → sm:（图标 / 辅助文案显隐） → lg:（栅格列数、垂直堆叠、高度策略切换） → xl:（三列）`

**移动端面板高度封顶**（不封顶会把整页撑到几千甚至几万 px）：

| 场景                | 样式                                         |
| ------------------- | -------------------------------------------- |
| 列表 / 日志（较短） | `max-lg:max-h-[45vh] max-lg:overflow-y-auto` |
| 列表 / 日志（较长） | `max-lg:max-h-[60vh] max-lg:overflow-y-auto` |
| 速查表 / 折叠区     | `max-lg:max-h-40 max-lg:overflow-y-auto`     |
| 编辑器              | `h-56 lg:h-auto lg:min-h-0 lg:flex-1`        |

**桌面交回栅格**：`lg:min-h-0 lg:flex-1 lg:overflow-y-auto`

**关键规则**：

- 移动优先：默认样式按窄屏写，`sm:` / `md:` / `lg:` 逐级增强；桌面专属布局用 `max-lg:` 反向覆盖
- 栅格：`grid-cols-1` 起步再切多列。`grid` 必须**显式**写 `grid-cols-1`，否则隐式列按 `max-content` 撑开、被长文本顶出横向滚动条
- 禁止横向溢出：不用固定像素宽度撑布局；`truncate` 的元素要配 `min-w-0`，否则不会收缩
- **`w-fit` 必须配 `max-w-full`**：内容宽的盒子（标签条那种）在小屏是 `w-full`、到了 `sm` 收成 `w-fit`，
  而 `w-fit` **没有上限** —— 标签多的工具（速查表、单位换算这一档）那条自然宽度能超过 768 / 1024 的容器宽，
  于是**滚动的不是标签条而是整个文档**（实测整页横向溢出 248 / 386px）。
  `overflow-x-auto` 只有在盒子本身被限宽时才接得住。**给 `w-fit` 加 `max-w-full`**（`TAB_BAR` 已加）。
  这类问题在 375（那时还是 `w-full`）与 1280（放得下）两端都看不出来，只有中间档才暴露 ——
  所以横向溢出别只按两个断点看
- 上限用 `vh` 而不是固定 `rem`，小屏也能留出一截页面
- 滚到头时让页面自然接续，**不要**加 `overscroll-contain`（会把手势锁在面板里）
- 禁止「外层定高 + 容器滚 + 面板再滚」的**三层**嵌套（手指划在面板上页面不动），不是禁止面板自己滚；
  面板自己是滚动区时，它外面必须是普通页面流，不能再套一层定高滚动容器
- 不要用 `flex-1` 撑移动端列表（父级高度不确定时会塌成 0）
- 高度别锁死：移动端慎用 `h-screen`，需要满屏时用 `h-dvh` / `min-h-dvh`
- **状态切换不能引起高度跳变**：`{#if}` 整组渲染/移除会让容器高度突变。
  要么常驻渲染 + `disabled`，要么给容器固定高度（面板 header 统一 `h-12`）
- 长内容（URL、日志）用 `truncate` 或 `break-all`
- 交付自查：至少按 **375px（手机）** 和 **1280px（桌面）** 两个宽度各看一遍布局

## 18. 无障碍（axe 实测为准，不靠肉眼）

**必须做**：

- 图标按钮必须有 `aria-label`（往往比 `title` 更完整）；所有可点项带 `title`
- 表单控件必须有关联 `<label>`（视觉隐藏用 `sr-only`）
- 每个页面**有且仅有一个** `<h1>`（可以是 `sr-only`）
- 弹层提示用 `role="status" aria-live="polite"` 并放进 landmark 内
- 面板 `<section>` / `<aside>` 带 `aria-labelledby` 关联标题
- 开关按钮用 `aria-pressed`；当前选中项用 `aria-current="true"`
- 展开 / 收起用 `aria-expanded` + `aria-controls`
- 装饰元素（斜杠、点号、序号、角标）一律 `aria-hidden="true"`
- **触控目标：可点区域高度不小于 `h-6`（24px）**，小屏不要堆叠过密的图标按钮。
  视觉做小用 `after` 伪元素扩热区（见 §9）

**`sr-only` 的陷阱**：`sr-only` 是 `position: absolute`，**父级必须带 `relative`**。
祖先没有定位上下文时它的包含块是初始包含块，会**逃出所在滚动容器的裁剪**并把整个文档撑高。
实测：列表行里的 `sr-only` 让桌面端页面从 900px 变成 2319px、整页可滚。

**自查方式**：起 dev server，用 Playwright 注入 `axe-core` 跑 `wcag2a/aa` 规则，要求 0 violations。
Storybook 的 a11y 检查默认是 `'todo'`（只提示不失败），**别指望它兜底**。

### 18.1 动效与键盘：两处「加了才有」的基建（已就位，别重复造）

- **动效时长一律经 `$lib/ui/motion.svelte.ts` 的 `motionDuration(ms)`**。
  理由：`transition:` 的 `fly` 在 Svelte 5 里走 **Web Animations API**（`element.animate()`），
  不是 CSS animation —— `layout.css` 里那条 `@media (prefers-reduced-motion: reduce)` 压
  `animation-duration` 的写法**对它无效**（实测：开了 reduce，抽屉 60ms 后仍停在 x=-95 的半路上）。
  所以 `transition:fly={{ duration: motionDuration(200) }}`；纯 CSS 的动效（`animate-pulse` /
  `animate-spin` / `transition-*`）仍由那条媒体查询管，不必再处理。
- **「跳到主要内容」与 `<main id="toolv-main" tabindex="-1">` 在 `ToolShell` 里**，
  全站每个页面（含 404）都有。**工具页不要再自己加第二份**；新写的外壳若绕过 `ToolShell`，
  记得补这两样（缺了的话键盘用户每进一页都要 Tab 过整条导航）。
- 顶部是 `h-14` 的 sticky 导航条，锚点与键盘滚动靠 `html { scroll-padding-top: 3.5rem }` 让开，
  **不要再逐元素加 `scroll-mt-*`**。

## 19. 破坏性操作的二次确认（Confirm）

**规则：删除 / 清空 / 覆盖这类不可撤销的操作，先 `await confirm.ask('…')`，不要用原生 `window.confirm`。**

```ts
import { confirm } from '$lib/ui/confirm.svelte';

async function clearAll(): Promise<void> {
	if (await confirm.ask('确定要清空全部参数吗？这一步不能撤销。')) store.clearAll();
}
```

**为什么不用原生 `confirm()`**：① 按钮文案由浏览器给，中文站碰上英文界面的浏览器就是
「OK / Cancel」；② 不跟随主题，深色页面里弹出一块白底系统框；③ 同步阻塞主线程。
现在的实现是原生 `<dialog>` + `showModal()`（`$lib/ui/Confirm/Confirm.svelte`），
焦点陷阱 / Esc 关闭 / 背景 inert / `::backdrop` / 顶层渲染全由浏览器提供，
遮罩色沿用 `--scrim`（`layout.css` 里 `dialog.toolv-confirm::backdrop`）。

**实践口径**：

- 组件挂在 `+layout.svelte`（**全站一个实例**），工具页不要再挂第二个 —— 状态是模块级单例，
  多挂一个会出现「两个框抢一个状态」。
- 调用方**必须是 `async` 函数**，事件绑定时写 `onclick={() => void clearAll()}`。
- 破坏性操作**不要**写成内联的异步 IIFE，提成具名函数（`await` 要有个名字承载）。
- 确认框**不下放到 `core/`**：`store` 的方法保持同步，`ask()` 由组件层调
  （`store` 才好在 node 里单测）。`core` 里确有一处例外：generator 的「生成条数超阈值先问一句」
  在 `store.svelte.ts` 里，它是 async 的，SSR 下直接放行。
- 按钮文案默认「确定 / 取消」，动作更具体时给 `confirmLabel`（如「清空」「覆盖」）。
  初始焦点落在**取消**上 —— 误按回车不该把东西删掉。
