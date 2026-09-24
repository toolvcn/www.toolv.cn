# 目录与档位规范（STRUCTURE.md）

> 本文件是「微工具」的**目录结构与复杂度档位**规范，从 AGENTS.md 拆出独立维护。
> **新建或修改任何工具页之前，先读 §0 定档**，再谈文件怎么摆；只问「某个文件该放哪」就直接跳 §2。
>
> 分工：**流程与门禁看 AGENTS.md；纯样式取值看 `UI-STYLE.md`；文件放哪、拆多细看本文件。**
> 小节编号 0-2，AGENTS.md 引用时写作 `STRUCTURE §0` 这种形式。

**一个工具的全部文件都放在它自己的功能目录里**，不往全局目录塞东西。

## 0. 先选档位，再谈目录（务必先读）

下面的目录树画的是**最大形态**，不是标准答案。**默认从最低档开始写，只有真的撑不住了才升档。**
升档的触发条件是「已经遇到」，不是「以后可能会」。

| 档     | 文件                                                                     | 适用判断                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0** | 只有 `+page.svelte`（可选 `+page.ts`、`ui/Panel.svelte`）                | 真正无状态的一次性页面：输入即算、没有需要在组件间共享或跨刷新留存的状态。**本站当前没有工具落这一档**（首页等静态页例外）。                                               |
| **L1** | `+page.svelte` + `core/store.svelte.ts`（可选 `core/<topic>.ts` + 单测） | **本站默认档**：有一份「输入 + 若干选项 + 模式切换」的交互状态要收在一处。连「输入 → 输出」的进制换算也算 —— 它带着模式切换与选项，收进 store 比散在组件里更好读、更好测。 |
| **L2** | L1 + `ui/*.svelte` 多面板／多标签                                        | 状态膨胀到要拆面板：多标签页、连接管理、日志流、定时任务。典型：websocket、HTTP 请求调试、正则、随机生成器。                                                               |

三条硬约束：

1. **不要预判复杂度**。新建工具先按 L1 起手；等状态明显膨胀（例如 `+page.svelte` 超过 ~200 行、
   或多处状态需要在兄弟组件间共享）再拆 `ui/` 升 L2。只有确认无状态可管时才退回 L0。
2. **`ui/styles.ts` 的门槛**：同一串 Tailwind 类在**同一工具目录内重复 2 处以上**，
   或单个组件里的长类名串多到把模板挤散时才建。只出现一次、串又短的直接写在组件里，
   不要为「统一」多开一个文件。**L0 一律不建**。跨工具共用的常量另有去处：`$lib/ui/styles.ts`（见 `UI-STYLE.md` §0）。
3. **只有 L0 不建 `core/store.svelte.ts`**。L1 / L2 的共享状态一律收进 `core/store.svelte.ts`
   （类 + `$state` 字段 + getter 派生，模块顶层导出单例）；纯函数多、边界情况多时再拆 `core/<topic>.ts` 并配单测。
   文件名统一叫 `store.svelte.ts`，不要按工具名另起。

## 1. 目录形态（按档位取用，不是每档都要有）

```
src/routes/<tool>/          一个工具一个路由目录（功能目录）
  +page.svelte              L0：页面 + SEO head + 全部逻辑；L1/L2：只负责组装 + SEO head
  +page.ts                  [可选] prerender / SSR 开关
  README.md                 [必填] 该工具的说明（写什么见 TOOL-README.md）
  config.ts                 [可选] 可配置的业务参数（默认值 / 示例与空盘数据 / 档位与步长 /
                            输入上限 / localStorage 键），规则见 §2 B
  core/                     [L1/L2] 逻辑：状态、模型、纯函数、类型、测试
    store.svelte.ts         [L1/L2] 编排层：类 + $state 字段 + getter 派生
    <topic>.ts              纯函数、类型、领域常量（不依赖 DOM，可单测）
    <topic>.test.ts         单测，跟被测代码放一起
  ui/                       [L1 单个 / L2 多个] 界面：只放渲染 DOM 的 .svelte 组件
    <XxxPanel>.svelte       面板，引用 ../core/store.svelte.ts
    Panel.svelte            主面板 / 多面板共用的卡片壳（薄封装 $lib/components/Panel）
    Workspace.svelte        [多标签] 标签切换外壳：各标签的面板由它组装
    styles.ts               [罕见] 门槛见 §0 硬约束 2
src/lib/                    只放被多个工具共用的代码，通过 $lib 引入
  ui/                       控件原语 + 全站反馈层（一个组件一个目录，见 §2 C）
  components/               工具通用组装件（页面结构 / 导航 / 呈现，见 §2 C）
  utils/                    通用工具函数，一个主题一个文件，通过 $lib/utils/xxx 引入
  tools.ts                  全站工具清单（首页卡片 / 分类侧栏 / 工具页菜单同一份数据）
```

**共享状态一律是 `src/routes/<tool>/core/store.svelte.ts`，不放在路由根层。**
遇到 `src/routes/websocket/core/websocket.svelte.ts` 按 store 理解（内容等价），改动它时顺手改名。
websocket（连接 / 日志 / 定时任务）规模最大，见它自己的 `README.md`，本节不展开。

**工具 README**（每个工具目录一份，**必填、随目录一起建**）：写什么、怎么组织见
[`TOOL-README.md`](./TOOL-README.md) —— 骨架、能力清单的写法、按需节都在那份文件里，**本文件不复述**。
这里只留一条：它是「已实现能力的清单」，**不要**复述目录结构与逐文件内容。

## 2. 摆放规则（按「工具目录内 → src/lib → 站点级」排列）

**A. 就近放置**（总原则）

- 页面、逻辑、组件、单测、组件测试、story、e2e **一律就近放在 `src/routes/<tool>/`**。不要新建 `src/stories/`、`tests/` 之类的全局目录。

**B. 工具目录内**

- **界面进 `ui/`，逻辑进 `core/`**（L1 / L2 才分得开；L0 就一个 `+page.svelte`，不存在这个划分）：
  `core/` 里不出现样式与 DOM。目录名统一小写（跟 `src/lib` 一致），`core/` 不叫 `lib/` —— 后者会和顶层
  「跨工具共用」的 `src/lib/` 撞含义。剪贴板 / 下载优先直接用 `$lib/utils/browser`。
- **可配置的业务参数集中在工具根目录的 `config.ts`**（与 `+page.svelte` 同级，L1 / L2 都适用）。
  只放**业务数值与开关**：默认值、示例与空盘数据、档位阈值与步长、输入上限、`localStorage` 键与防抖时长。
  边界是**其余四类各自归位**：类型在 `core/types.ts`、界面文案在各 `ui/` 组件、样式在 `ui/styles.ts`、
  格式化位数在 `core/format.ts` —— 都不进 `config.ts`。
  - **放根层、不放 `core/`，是有意的例外**：它是面向人的调参入口，跟页面同级才好找。
    别据此把别的文件也往根层搬。
  - **建它的门槛同 §0 硬约束 2**：业务参数**多到散在 `core/` 与 `ui/` 里找不着时**才建。
    典型判据两种：① 同一个数散在 `core/` 与 `ui/` 两边；② 同一个数被三处引用。
    参数少的小工具继续就近写，不要为「统一」先建空壳。KPI 是「改一个数要不要翻三个文件」。
  - 引用方向：`config.ts` 只 `import type`（从 `core/types.ts`），`core/*` 与 `ui/*` 都从它读；
    它不 import 组件与 store，`core/types.ts` 也不反向依赖它（无环）。
- 引用路径：`ui/` 里的组件互相引用用 `./Xxx.svelte`，引用逻辑用 `../core/xxx.ts`；
  根层的 `+page.svelte` 用 `./ui/Xxx.svelte` 与 `./core/xxx.ts`。
- 多个面板共用一个外壳（卡片 + h-12 头部）时，**抽 `ui/Panel.svelte`** 而不是各自写一份：
  `Panel` 接受 `id` / `headingId` / `heading` / `tag`（section 或 aside）/ `class`（各面板的滚动与高度策略不同），
  以及 `headingExtra` 与 `actions` 两个 snippet 槽，让每个面板只管自己的标题补充信息与操作按钮；
  要标题行的全屏按钮就传 `fullscreen`（整件在 `Panel` 里，别在工具里自己接，见 `docs/MEMORY.md` 的全屏口径）。
  面板的 `h2` 通过 `aria-labelledby` 与所在 `<section>` 关联，让 landmark 真的「有名字」。
- **全局副作用（定时器 / localStorage / 卸载清理）直接放在 `+page.svelte` 的 `<script>` 里**
  （**全站唯一定义处**，AGENTS.md §6 与 §12 均引用此处），不要再开一个 `XxxEffects.svelte` 文件。
  `$effect` 在任何组件实例里都能跑，既然 `+page.svelte` 是唯一入口，把 `setInterval` / `onMount` / `pagehide`
  这些都写在那里最省事。
- **不要建工具专属 CSS 文件**，所有样式用 Tailwind 工具类表达（见 `UI-STYLE.md` §0）。
  重复的样式串可以抽成常量，但门槛见 §0 硬约束第 2 条，**本节不重复规定**。

**C. `src/lib/`（跨工具共用）**

跨工具组件分**两层**，先判断它是「原语」还是「组装件」，再决定放哪：

| 层                    | 放什么                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ui/`         | **控件原语 + 全站反馈层**：用户直接输入 / 切换 / 触发的单个控件，不掺页面结构语义。如 `Button` / `Input` / `Switch` |
| `src/lib/components/` | **工具通用组装件**：承担工具页的结构与呈现，由 ui 原语拼成或直接落版式。如 `ToolShell` / `Panel` / `Tabs`           |

**完整清单与引用路径在 `UI-STYLE.md` §0** —— 那是组件清单的唯一定义处，本文件只留「该放哪层」的判据。

两层的共同规矩：

- 一个组件一个目录，组件文件与目录同名：`src/lib/ui/Button/Button.svelte`、`src/lib/components/Panel/Panel.svelte`。
  目录下的 story（`Button.stories.svelte`）、组件测试（`Button.svelte.test.ts`）、组件专用的 `styles.ts` 就近放同目录。
- **每个通用组件必须配一份 `*.stories.svelte`**（覆盖各 variant / 尺寸 / 禁用态），组件测试按需要才写。
  story 用 svelte-csf 的 `defineMeta` + `template` snippet 写（`pnpm test` 的 storybook project 会跑）。
- 引入路径写全：`import Button from '$lib/ui/Button/Button.svelte'`、
  `import Panel from '$lib/components/Panel/Panel.svelte'`。
- 判断标准是**复用度**：被两个以上工具用到才提升，只有单个工具用的组件留在 `src/routes/<tool>/ui/`。
- 组件只管外观与交互，**不掺任何工具的业务逻辑**。业务（store 绑定、文案、数据形状）留在
  `src/routes/<tool>/ui/` 的薄绑定文件里 —— 例：`http/ui/PresetPanel.svelte` 只有十来行 props，
  版式全在 `$lib/components/PresetPanel`（面板壳一件 + 条目 `PresetItem` 一件；
  条目想整个换版式时传 `item` snippet，不必再往面板里加 prop）。
- 新建组件照此办理（动手前先 `ls src/lib/ui/ src/lib/components/`，见 AGENTS.md §0.2）。
- `Input` / `Textarea` / `Switch` 已覆盖全站（见 `UI-STYLE.md` §11.1 / §11.2 / §12）。

`$lib/ui/` 根层另有**界面层共享模块**（不是组件、也不是样式常量），两层都引用：

| 文件                  | 内容                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `styles.ts`           | 跨工具共用的样式常量。基础片段与原语同层、版式常量组装件也用，所以留在 `ui/` 下不拆，避免同一条常量在两处出现 —— **写 UI 前先看一眼里面有什么**（`UI-STYLE.md` §0） |
| `toast.svelte.ts`     | 全局提示状态，跟 `Toast` 组件同层                                                                                                                                   |
| `theme.svelte.ts`     | 全局主题（三态：跟随系统 / 浅 / 深；变量表在 `src/routes/layout.css`，见 `UI-STYLE.md` §1.1）                                                                       |
| `favorites.svelte.ts` | 全局收藏状态（`favorites.has(path)` / `toggle(path)`，读 `localStorage['toolv:favorites']`）                                                                        |
| `copy.ts`             | 复制到剪贴板 + 提示（见 `UI-STYLE.md` §11.3）                                                                                                                       |

- **`src/lib/utils/` 放通用工具函数**：一个主题一个文件，通过 `$lib/utils/xxx` 引入。
  门槛是「被两个以上工具共用」，单个工具内的函数留在它的 `core/`；
  约束是**不反向依赖界面层**（不 import `$lib/ui` / `$lib/components` 与 store）。

  | 文件               | 内容                                                                                                                                                                                                                        |
  | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `utils/json.ts`    | JSON 解析助手 + **全站唯一的 JSON 高亮分词**（`tokenizeSource` / `tokenizeJson` 与 `JsonTokenKind`），配色在 `$lib/ui/styles.ts` 的 `JSON_TOKEN_CLASS`、渲染用 `$lib/components/CodeView` —— 详见 `UI-STYLE.md` §14         |
  | `utils/browser.ts` | 浏览器 API 薄封装（`copyText` / `readText` / `downloadText`）。依赖 DOM，但它是「按运行环境」划分的助手，跟工具函数同层                                                                                                     |
  | `utils/result.ts`  | 统一的「成功 / 失败」结果类型（`Result<T>` + `ok` / `fail`）：失败时带一句**能直接展示给用户**的中文说明。输入不合法走返回值而不抛异常 —— 那是正常流程的一部分（`core/` 里算错、解析失败都用它），`utils/` 里不认识任何业务 |

- **`src/lib/` 根层白名单**：只允许放**确实被两个以上工具共用**的东西 —— `assets/` / `ui/` / `components/` / `utils/` 目录，
  加 `tools.ts` 这一个文件（全站工具清单）。`tools.ts` **不进 `utils/`** —— 工具清单是站点数据而不是函数；
  它放 `$lib` 而不是 `src/routes/`，是因为 `ToolMenu` 在 `$lib/components/` 下，按分层不能反向依赖 `src/routes/`。

**D. 站点级**

- 站点级文件只有 `src/app.html`（首帧前跑的内联脚本，如主题防闪烁）、`src/routes/+layout.svelte`、
  `src/routes/+page.svelte`、`src/routes/layout.css`（含主题变量表），只有影响全站时才改（改动前问，见 AGENTS.md §0.3）。
