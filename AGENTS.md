# AGENTS.md

写给 AI 编码助手的项目指南。在本仓库里写代码、评审、测试、部署前，**先看下面的路由表** —— 它决定这次要读哪几节。

**本仓库给 AI 看的文件，按用途分工：**

| 文件                                                     | 什么时候读                                 | 内容                                                   |
| -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| **`AGENTS.md`**（本文件）                                | 先读**下面的路由表**，再只读它指到的几节   | 工作模式、执行顺序、runes 约定、测试、门禁             |
| **[`docs/STRUCTURE.md`](./docs/STRUCTURE.md)**           | 新建 / 大改工具页时读                      | 复杂度档位（L0/L1/L2）、目录树、文件摆放规则           |
| **[`docs/UI-STYLE.md`](./docs/UI-STYLE.md)**             | 写 / 改界面时读                            | 颜色、尺寸、间距、圆角、焦点环、按钮档位、响应式、a11y |
| **[`docs/COMMIT.md`](./docs/COMMIT.md)**                 | 写提交信息、推送前读                       | type / scope 取值、主题行写法、提交粒度、提交前门禁    |
| **[`docs/TOOL-README.md`](./docs/TOOL-README.md)**       | 新建工具、或给工具加完能力要写 README 时读 | 工具 README 的骨架、能力清单怎么写、按需节             |
| **[`docs/MEMORY.md`](./docs/MEMORY.md)**                 | 开工前扫一眼、踩到新坑往回写               | 读代码看不出来的口径（内容与写法见 §14）               |
| **[`docs/EXTERNAL-LINKS.md`](./docs/EXTERNAL-LINKS.md)** | 要用到外部在线工具 / 参考资料时读          | 常用外部工具站清单（与本站无关，不是规范）             |

### 先跳路由表，不要通读本文件

一次任务通常只用到本文件里的两三节。**先看这张表，跳到该读的节，其余整段跳过。**

**例外：§0.1（讨论态 / 交付态开关）与 §3（常用命令）每轮都要读**，它们不在表里 ——
照表跳读会让新会话既不知道该不该跑命令、也不知道命令叫什么。

| 这次要干什么                          | 只读这几节                                                                                                                    | 其余跳过         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 刚进仓库 / 先要理解整体               | §4 末尾的「架构总览」+ §0.1 + §3                                                                                              | 其余             |
| 调版式 / 改文案 / 改参数（讨论态）    | §0.1、§7、§13，外加 `UI-STYLE.md` 里对应的那一节                                                                              | 本文件其余全跳过 |
| 修一个具体的 bug                      | §0.1、§0.2（按规模档）、§10 的验证表                                                                                          | §5、§9、§11      |
| 新增 / 大改一个工具页                 | 全部 + `STRUCTURE.md` 全文                                                                                                    | ——               |
| 写 / 改一个 UI 组件                   | §0.2 探索三档、**§7（先扫「写 UI 时的硬规则」表）**、`UI-STYLE.md` 的 §0 + 对应节（按钮 §9、输入框 §11、卡片 §8、响应式 §17） | §5、§9、§10、§11 |
| 写 / 改测试                           | §10                                                                                                                           | 其余             |
| 写 / 改工具 README                    | `TOOL-README.md` 全文                                                                                                         | 本文件其余       |
| 改规范文件（本文件 / `docs/` 下几份） | §0.4 + 被改规则所在的那一份                                                                                                   | 其余             |
| 查外部工具 / 参考资料                 | `docs/EXTERNAL-LINKS.md`                                                                                                      | 其余             |
| 提交                                  | `COMMIT.md` §0、§7                                                                                                            | 其余             |
| 部署                                  | §11                                                                                                                           | 其余             |

第 5、7 章只留索引，细节在 `docs/` 下各自的独立规范里。
引用写作 `STRUCTURE §0`、`UI-STYLE §9`、`COMMIT §2`、`TOOL-README §2` 这种形式。

---

## 0. 工作方式（先读这一节，其余章节是被它索引的细节）

这份文档后面有很多规则。规则越多，越容易因为「平均用力」而漏掉真正会出事的几条。
所以先把**工作模式**、**执行顺序**和**门禁分层**立起来，后面章节只作为具体依据。

三小节的阅读顺序就是依赖顺序：**先定模式（跑不跑命令）→ 再走流程 → 卡住了看何时该问**。

### 0.1 工作模式：讨论态 / 交付态（**最高级开关，决定跑不跑命令**）

本项目相当多时间花在**调 UI** 上，一轮里要来回改好几版。每改一次就跑 `format` / `lint` / `check` / `test`
是纯粹的浪费 —— 打断思路，而且 prettier 反复重写会把中间版本的 diff 冲掉。
**所以默认是讨论态：只改代码，不跑任何命令。**

|              | **讨论态（默认）**                                                                   | **交付态（用户显式切换才进）**                                     |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **何时进入** | 需求是「看看这样行不行 / 改成 X / 换个方式 / 讨论下 / 再调调」；一轮里显然还要继续改 | 用户说「确认」「就这版」「可以了」「跑一下测试」「收尾」「提交」等 |
| **改代码**   | 只改被点名的文件与位置                                                               | 正常                                                               |
| **跑命令**   | **一律不跑**（含 `format` / `lint` / `check` / `test`）                              | 按下方「交付态的命令节奏」                                         |
| **验证方式** | 靠读代码 + 描述渲染结果，不开浏览器、不注入 axe                                      | 按 §10 分档验证                                                    |
| **回复内容** | 改了哪几个文件的哪几处（一句话一处）+ 下一步选项                                     | 完整交付说明（§12 C 层）                                           |

**交付态的命令节奏**：改完一个 `.ts` / `.svelte.ts` 逻辑文件 → 跑一次类型检查（秒级，能挡住大部分 runes 误用）；
全部改完 → `pnpm format`；收尾 → `pnpm format && pnpm lint` + 一次类型检查。
**本机的类型检查命令见 §3 坑 1** —— `pnpm check` / `pnpm build` 的第一步（`wrangler types --check`）会挂住，别照字面跑。
`pnpm test` **不进常规收尾**，只在改了共享状态（`core/store.svelte.ts` 的模型 / 派生 / 筛选 / 定时器）
或纯逻辑（`core/*.ts`）时补跑。（逐条命令见 §3，写测试的规则见 §10）

**讨论态三条硬约束**：

1. **不跑任何命令**。用户没说跑就一个都别跑，包括 `pnpm format` —— 手写缩进与 class 顺序交付时会统一理顺。
   **尤其不要"顺手跑一下看看有没有错"**。
2. **只改被点名的位置**。说改按钮间距就只改按钮间距；**不要顺带重构**邻近代码、不要"顺手优化"命名、
   不要补没要求的测试 —— 讨论阶段最烦 diff 里混进一堆没要求的变化。
3. **不动无关文件**。不要为"保持一致"去改同目录其它工具、不要同步 `tools.ts`（那是交付态的事）。

**唯一的安全网**：一轮讨论累积改动涉及 **5 个以上文件**、或风险明显上升时，在回复末尾提醒
`改动已累积 N 个文件，要不要先跑一次类型检查收个口？` ——**只提醒，不自己跑**。

**切换词只有一个：「收尾」**（或「提交」「跑一下测试」）。**不要因为用户说了「好」「行」「嗯」就自行切态** ——
那通常只是认可这一版。判断不了是哪种状态时按讨论态处理，不要用提问打断用户。

每轮回复末尾**必须**留一行状态标记（态是跨轮次的，下一轮可能是另一个会话，只能靠这一行）：
`— 讨论态：未跑命令（本轮改动 N 个文件）` / `— 交付态：已跑 check / format + lint + check（结果…）`

> **`pnpm test:e2e` 是第三种情况**：会先 `build` 再起 `preview`，**单次耗时数分钟**，
> **只在用户明确要求 e2e 验证时才跑**，跑之前先告诉用户「这会先构建一次，需要几分钟」。

### 0.2 执行顺序：每次任务都按这个走，不要跳步

| 阶段       | 必做动作                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 定位** | 明确这次改动落在哪个工具目录（`src/routes/<tool>/`），以及它在 [README 工具列表](./README.md#工具列表) 里的状态（已上线 / 已并入）。README 与需求对不上时，**停下来问**（见 §0.3）。                                 |
| **2 探索** | 按**本次改动的规模**取档，不要一律做满 —— 档位表见下方「探索三档」。                                                                                                                                                 |
| **3 确认** | 需求有多种合理解读、或触发 §0.3 任一条件时，问完再动手。问的时候必须带方案，不要只抛问题。                                                                                                                           |
| **4 实现** | 按 §5 目录与档位（详见 `docs/STRUCTURE.md`）、§6 runes 约定、§7 样式入口（详见 `UI-STYLE.md`）写。**跑不跑命令由 §0.1 决定**：讨论态改完就停手，交付态按「交付态的命令节奏」边改边跑类型检查（本机命令见 §3 坑 1）。 |
| **5 验证** | 按 §10 的「改完怎么验证」分档执行。**仅交付态执行**；讨论态不验证、不开浏览器、不注入 axe。**不要默认上全套**，也不要什么都不跑。                                                                                    |

#### 探索三档（按改动规模取，不要一律做满）

| 规模            | 判断                                     | 必做                                                                                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **微改**        | 已知位置的样式 / 文案 / 业务参数值       | **不探索**，直接改                                                                                                                                                                                                                                                                         |
| **中等**        | 改某工具的行为、加选项、改一个组件的交互 | ① `ls src/lib/ui/ src/lib/components/ src/lib/utils/`，并对照 **`UI-STYLE §0` 的组件表**（那份是唯一清单，本文件不复制）—— 确认要写的 UI 没有可直接复用的<br>⑤ 读该工具根目录的 `config.ts`（若有）：默认值 / 示例 / 档位 / 输入上限 / localStorage 键等业务参数都在那里，**改参数先看它** |
| **新建 / 重构** | 新增工具页、跨工具抽组件、动目录结构     | ① ~ ⑤ 全做：① 同上；② 读 `src/lib/tools.ts`（首页卡片、分类侧栏、工具页菜单三处共用这一份数据）；③ 按 `STRUCTURE §0` **定档**（默认 L1）；④ 若与现有某工具功能相近，先读它的实现，按 §1 合并约定判断新建还是并入；⑤ 同上                                                                   |

**最常见的两种浪费，都是跳了第 ① 步造成的**：重新实现一遍已存在的 `Button`；或者没读 `tools.ts` 导致首页卡片漏改。

### 0.3 什么时候必须停下来问（问的时候带上方案）

触发任一条件，停下来问用户，不要自行决策：

1. **需要服务端能力**：KV / D1 / R2 / server endpoint / 任何会把数据送出浏览器的设计。
   问的时候必须同时给出：① 为什么纯前端做不到；② 具体方案；③ 对首页「数据本地处理」承诺的影响（§4.1）。
2. **要引入新依赖**：说明体积代价与为什么原生 API 不够用（§4.5）。
3. **要改站点级文件**：`src/app.html`、`src/routes/+layout.svelte`、`src/routes/+page.svelte`、`src/routes/layout.css`（`STRUCTURE §2` D）。
4. **README 工具列表与需求对不上**，或需要新增 / 合并工具条目。
5. **需求本身有多种合理解读**，或两种做法的后续维护成本差异很大。

提问格式：`问题 + 你推荐的方案 + 理由 + 被否决方案的代价`。不要只说「我需要 X，可以吗」。

### 0.4 改规范自己的规矩

规范文件（本文件与 `docs/` 下那几份）本身也在维护面上。改它们时：

1. **先摸引用面**：动章节编号、节名、或删节之前，先 grep 一遍 `<文件> §`（`*.md`、`*.svelte`、`*.ts` 注释里的引用都要算上），
   改完再抽查落点 —— 这些标号在代码注释与工具 README 里被广泛引用，改编号等于全仓失联。
2. **不写会过期的东西**：正文里不出现「几份规范」「N 处」「N 个工具」这类计数与工具名枚举；一条判断标准只在一处写全，其余地方只给指针。
3. **加 / 删规范文件时同步三处**：本文件头部那张索引表与路由表、其它规范头部那句「分工」、`docs/MEMORY.md` 的指针。
4. **描述别指着不存在的东西**：删了一整节，别处描述它还在的句子要一起删，不留悬空描述。

---

## 1. 项目概述

**微工具（Micro Tools）** — https://www.toolv.cn ，面向中文开发者的在线小工具聚合站。

- 工具清单与状态一律以 [README 工具列表](./README.md#工具列表) 为准，**本节不列举**，避免两边不同步。README 里**不出现工具 ID**（编号稳定但不连续，对读者无意义，已全部移除）—— 指认某个工具请用名称或路径。
- 后续要做的按 README 走，**功能相近的小工具合并成一页**（页内标签切换），被合并的项标 `🔀 已并入`，统一收在工具列表下方的「🔀 已并入的工具」清单里，用 `→` 指向最终页面。
- 产品调性：小而美、即开即用、**数据本地处理**。UI 文案全中文，署名「无情」。

**开工前先扫一眼「已决定不做」的清单**（代码里看不出来，不扫就会把已砍掉的需求当缺口重做一遍）：

- 各工具目录 `README.md` 里「刻意不做 / 暂不支持」一节 —— 例如 [`/dns`](./src/routes/dns/README.md)
  只查不测速不解析（DoH 解析跨域，纯前端做不到，而 `/http/proxy` 是既有唯一端点）、
  [`/device-info`](./src/routes/device-info/README.md) 不做 IP 检测（STUN 等于向外网发请求，
  与「数据本地处理」冲突）。
- [`docs/MEMORY.md`](./docs/MEMORY.md) 里的**跨工具 / 环境 / 操作层面**的口径与坑 ——
  「踩过的坑」按作用域分家：**本工具特有**的记在该工具 `README.md` 的 `## 踩过的坑`
  （写法见 `TOOL-README §2.1`），跨工具 / 环境 / 操作层面的记在 `docs/MEMORY.md`。完整的指针见 §14。

## 2. 技术栈

| 项              | 选型                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 框架            | SvelteKit 2 + Svelte 5（**强制 runes 模式**，见 `vite.config.ts`）                                                |
| 语言            | TypeScript，`strict: true`                                                                                        |
| 样式            | Tailwind CSS 4（`@tailwindcss/vite`，入口 `src/routes/layout.css`）                                               |
| 部署            | `@sveltejs/adapter-cloudflare` → Cloudflare Pages                                                                 |
| 测试            | Vitest 4（server / client / storybook 三个 project）+ Playwright + Storybook 10                                   |
| 图标            | `@lucide/svelte`                                                                                                  |
| 运行时 / 包管理 | Node `^20.19.0` / `>=22.12.0`，pnpm `12.4.2`（`.npmrc` 开了 `engine-strict`，`package.json` 的 `packageManager`） |

## 3. 常用命令

| 命令                                  | 作用                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | 开发服务器，端口 **8000**，监听 0.0.0.0                                                           |
| `pnpm build`                          | `wrangler types --check && vite build`（类型不过直接失败）+ 后置 `prettier` 格式化产出的 HTML     |
| `pnpm preview`                        | `wrangler pages dev`，端口 4173                                                                   |
| `pnpm check`                          | `wrangler types --check` + `svelte-kit sync` + `svelte-check`（第一步在本机走不通，见下方坑 1）   |
| `pnpm check:watch`                    | 同上去掉 wrangler 那步的 watch 版，**常驻不退出**，别当一次性检查跑                               |
| `pnpm lint`                           | `prettier --check .` + `eslint .`（两条都开 cache，见下方「门禁提速」）                           |
| `pnpm format`                         | `prettier --write .`（同上开 cache）                                                              |
| `pnpm test`                           | vitest 全量跑一次（含组件与 story，不含 e2e）                                                     |
| `pnpm test:unit`                      | vitest watch 模式                                                                                 |
| `pnpm test:e2e`                       | Playwright e2e（先 `build` 再起 `preview`；**当前仓库没有 `*.e2e.ts` 用例**，跑了只是白构建一遍） |
| `pnpm gen`                            | `wrangler types`，重新生成 `worker-configuration.d.ts`                                            |
| `pnpm storybook`                      | Storybook 开发服务器，端口 6006                                                                   |
| `pnpm build-storybook`                | Storybook 静态构建（本地一般不跑）                                                                |
| `pnpm deploy` / `pnpm deploy:preview` | 部署到 Cloudflare Pages                                                                           |

**跑的时机与节奏统一看 §0.1**：讨论态一律不跑；交付态先增量类型检查、再 `format`、收尾跑
`pnpm format && pnpm lint` + 一次类型检查（本机命令见坑 1）。`pnpm test` 不进常规收尾，只在改逻辑 / 共享状态时补跑；
`test:e2e` 只在用户明确要求时跑。

**门禁提速（cache）**：`lint` / `format` 对 prettier 与 eslint 都开了持久化 cache，落在 `node_modules/.cache/`
—— **别改回 eslint 默认的 `.eslintcache`**，那会落在仓库根。取舍：cache 只认「被 lint 文件自身的内容 + 配置版本」，
**不看它依赖的其它文件** —— 升级 `@lucide/svelte` 这类依赖后旧结论会被复用，本地要安心就
`rm -rf node_modules/.cache` 或跑一次 `eslint . --no-cache`。

**本机已知的三个坑**（环境事实，不是代码问题，遇到别慌 —— 别为此改代码、也别停下问）：

1. **`wrangler types --check` 在本机走不通**（离线环境下实测是**挂住**不返回，2 分钟被超时杀掉，
   不是快速报错）。凡以它为第一步的脚本都跟着走不通 —— `pnpm check`、`pnpm build`、
   `pnpm test:e2e`（它的 webServer 先跑 build）。要验类型就绕开这一步（一次性）：
   `pnpm exec svelte-kit sync && pnpm exec svelte-check --tsconfig ./tsconfig.json`；
   要出产物就 `pnpm exec vite build`。**不要为了让命令变绿去改 `worker-configuration.d.ts`。**
   `pnpm check:watch` 是同一个命令的 watch 版，**会常驻不退出**，不要拿来跑一次性门禁。
2. Playwright 的浏览器在 `PLAYWRIGHT_BROWSERS_PATH`（本机是 `/ms-playwright`），
   **不在 `~/.cache/ms-playwright`** —— 按后者判断「没装浏览器」是错的，那里空是正常的。
   vitest 的 client / storybook project 与临时 `playwright` 脚本都能跑起来；
   卡住的只有 e2e 默认用的 headless shell。
3. **提交时若本机没配 git 身份**（`git config user.name` / `user.email` 为空），直接 `git commit` 会失败。
   用一次性参数提交（不写进 config）：`git -c user.name=admin -c user.email=admin@toolv.cn commit …`。
   已经配好身份的环境（如 CNB 容器）直接 `git commit` 即可，不需要这条。

> **这三条只在这一节定义**（唯一定义处，§0.1 与 §12 都按「§3 坑 1／坑 2」引用到这里），
> [`docs/MEMORY.md`](./docs/MEMORY.md) 只留指回本节的指针、不再各抄一份；
> 那份还记着几条本节没写的操作口径（`read_lints` 不能替代 `svelte-check`、手机视口截图命令等），
> 开工前可扫一眼（见 §14）。

**浏览器验证要用的 dev server：先探测 8000，活着就复用，不要另起一个。** 用户本地常驻着一个
`pnpm dev`（8000），自己再起一个既占内存、又容易看错版本、还常常忘了关。
探测方式：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/`（PowerShell 下用
`Invoke-WebRequest http://127.0.0.1:8000/ -TimeoutSec 3`）或 Playwright 直接 `goto`；
确实没起才自己跑，且**不要加 `--port` 覆盖** —— 端口写死在 `vite.config.ts`（8000）。

## 4. 架构约束（重要）

1. **纯前端优先**。工具逻辑全部跑在浏览器，不引入服务端 API、数据库或用户数据上传 —— 首页对外承诺了「数据本地处理」。
2. 需要持久化时用 `localStorage` / `sessionStorage`。
3. **确需服务端能力时（KV / D1 / R2 / server endpoint），先停下来问用户，不要自作主张引入**（提问要求见 §0.3）。
   - 既有的唯一服务端端点是 `src/routes/http/proxy/+server.ts`（HTTP 工具的「可选服务器代发」，绕过 CORS）——
     它是产品选择、不是漏网之鱼，**别再新增同类端点**；新增仍按本条第 1 句先问。其余工具一律纯前端。
4. 部署目标是 Cloudflare Pages（静态资产 + Pages Functions）。不要引入依赖长驻进程或 Node 专有 API 的库。
5. 小工具优先用原生 API 实现，不要为单个工具引入大型依赖。
6. **尽可能让 SvelteKit 输出 HTML**：内容默认走 SSR / 预渲染，让首屏在 HTML 里就可读（利于 SEO 与首屏速度）。
   - 能静态预渲染的页面在 `+page.ts` 里 `export const prerender = true`；需要运行时数据的保持 SSR。
   - 只有真正依赖浏览器 API 的部分（WebSocket、剪贴板、localStorage）才放到客户端，且不得阻塞首屏内容的 HTML 输出。
   - 不要为了省事把整页设成 `csr = true` 或把内容包在 `{#if browser}` 里 —— 那等于放弃 SSR。
   - 自检：`curl <页面>` 返回的 HTML 里应当能看到主要区块（如 `id="log-panel"`、`id="composer"`）与空态文案。

### 架构总览（读代码前先建立心智模型）

这一节只写**要读多个文件才能拼出来**的连接关系；目录形态与文件摆放见 `STRUCTURE §1-2`，不复述。

- **数据流**：`src/routes/<tool>/+page.svelte`（外壳 + SEO head，唯一入口）
  → `core/store.svelte.ts`（模块顶层导出的单例类：`$state` 字段 + getter 派生）
  → `ui/*.svelte`（薄绑定，只管渲染与 props）。不依赖 DOM 的纯函数放 `core/<topic>.ts`，在 node project 里单测。
- **全局状态住在 `$lib/ui/` 根层**（与单个工具无关的那几个）：`theme.svelte.ts`（三态主题，变量表在 `layout.css`）、
  `toast.svelte.ts`、`favorites.svelte.ts`。初始化只发生在 `+layout.svelte` 的 `onMount`，组件顶层不碰 `window` / `localStorage`。
- **`src/lib/` 分两层**：`ui/` 是控件原语 + 全站反馈层，`components/` 是工具通用组装件；
  提升门槛是「被两个以上工具用到」，单工具组件留在 `routes/<tool>/ui/`（`STRUCTURE §2 C`）。
- **唯一数据源 `src/lib/tools.ts`**：首页工具卡片 + 首页分类侧栏（两者都在 `routes/+page.svelte` 里渲染）
  - 工具页 `ToolMenu`，共**三处 UI 面、两个 import 点**。加工具改 `tools.ts` + README 工具列表 + 建路由即可，
    那两处组件都是数据驱动的，不需要逐处补代码。
- **服务端边界**：全站唯一端点是 `src/routes/http/proxy/+server.ts`（§4.3），其余一律纯前端。

## 5. 目录与档位 → 见独立文件 `docs/STRUCTURE.md`

**文件怎么摆、拆多细、什么算共用，都在 [`docs/STRUCTURE.md`](./docs/STRUCTURE.md)，不在本文件。**

本章只保留**入口约定**：

| 你要做什么                                                     | 查哪里                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| 新建 / 改造工具页，决定建哪些文件                              | `STRUCTURE §0` —— **先定档**（L0 / L1 / L2，默认 L1）                 |
| 看目录树长什么样                                               | `STRUCTURE §1` 目录形态                                               |
| 判断某文件该放工具目录 / `src/lib` / 站点级                    | `STRUCTURE §2` 摆放规则（A 就近 / B 工具内 / C `src/lib` / D 站点级） |
| 调某工具的业务参数（默认值 / 示例数据 / 档位 / 上限 / 存储键） | 该工具根目录的 `config.ts`；建它的门槛与边界见 `STRUCTURE §2 B`       |

## 6. Svelte 5 runes 约定

`vite.config.ts` 已对非 `node_modules` 文件强制开启 runes 模式。

- 用 `$state` / `$derived` / `$effect`；**禁止** `export let`、`$: `、`on:click`、`createEventDispatcher`、`<slot>`。
- 回调走 props（`onclick={...}`），内容插槽用 `children` + `{@render children()}`。
- **共享状态**：优先写成一个类，字段用 `$state`、派生值用 getter 或 `$derived`，模块顶层导出实例。
  这样组件里直接 `ws.selected` / `ws.visibleLogs` 读写，不需要为每个派生值导出 getter 函数再包 `$derived`。
- **模块顶层不允许导出 `$derived`**（会报 `derived_invalid_export`）。
- **`$effect` 只能在组件实例上下文使用**。全局定时器 / localStorage / 页面卸载清理写在 `+page.svelte`
  的 `<script>` 里（定义在 STRUCTURE §2，此处不重复），不要再开一个 `XxxEffects.svelte`。
- 局部 DOM 引用：`let el = $state<HTMLDivElement | null>(null)`。
- `$effect` 需要清理时返回清理函数（`return () => clearInterval(timer)`）。
- **派生值不要在模板里重复计算**：`{@const x = store.expensiveGetter()}` 写在 `{#each}` 内部会每行重算一遍。
  提到组件顶层 `const x = $derived(...)` 供所有行共用。
- **条件类名不要直接写在 class 属性里**（重要）：
  ```svelte
  <!-- 错：prettier 拆行后 {cond} 会被当成完整表达式提前闭合，? : 变成纯文本，整段静默失效 -->
  <div class="border p-3 {cond ? 'border-blue-500' : 'border-gray-200'}">

  <!-- 对：在脚本里算好 -->
  const cls = $derived(cond ? 'border border-blue-500 p-3' : 'border border-gray-200 p-3');
  <div class={cls}>
  ```
  这类失效不报错、类型检查也过，只能读渲染后的 `className` 发现（若看到 `false ?` 原文即为中招）。
- **`$state` 是深度代理**：直接对字段和数组做 `push` / 赋值会触发更新，但把 state 对象传给外部库、
  或要拿一份纯数据快照时用 `$state.snapshot(x)`，需要深拷贝再 `structuredClone($state.snapshot(x))`。
  不要把 `$state` 代理对象直接喂给 `JSON.stringify` 之外的第三方逻辑。
- **SSR 安全**：不要在组件顶层直接访问 `window` / `document` / `localStorage`。放进 `$effect` 或 `onMount`，并包 `try/catch`。
- **无上限增长的列表限制渲染条数**（渲染窗口 / 虚拟滚动）。`content-visibility: auto` 不减少 DOM 节点，不算解决方案。
- **keyed each 的 key 必须唯一**：不要用业务字段（如预设名）当 key，用自增 id。
- 导入本地文件带显式扩展名：`import { ws } from './websocket.svelte.ts'`。
- **不要用 `src/lib/index.ts` 做 barrel**：那是模板留下的空壳注释文件，全站 import 一律写全路径
  （`$lib/ui/Button/Button.svelte`、`$lib/utils/json.ts`），别往里加 re-export。

## 7. UI / 视觉规范 → 见独立文件 `docs/UI-STYLE.md`

**所有样式取值（颜色、尺寸、间距、圆角、焦点环、按钮档位、响应式断点、a11y 清单）都在
[`docs/UI-STYLE.md`](./docs/UI-STYLE.md)，不在本文件。**

本章只保留**入口约定与设计原则**，外加下方那张「写 UI 时的硬规则」表（那些是工具查不出来的），
具体数值一律查表：

| 你要做什么                         | 查哪里                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| 写任何 UI 之前                     | `UI-STYLE §0` —— 现有通用组件与样式常量的引用路径表，**先复用再手写** |
| 挑颜色 / 担心对比度                | `UI-STYLE §1` 颜色体系、`UI-STYLE §2` WCAG 对比度                     |
| 定尺寸 / 间距 / 圆角 / 阴影 / 边框 | `UI-STYLE §3-7`（度量集中区）                                         |
| 画卡片 / 按钮 / 输入框 / 焦点环    | `UI-STYLE §8-11`                                                      |
| 状态点、高亮、排版、空态           | `UI-STYLE §12-16`                                                     |
| 响应式与移动端封顶                 | `UI-STYLE §17`                                                        |
| 无障碍自查                         | `UI-STYLE §18`                                                        |

### 写 UI 时的硬规则（**照着写，别等检查**）

下面这些是**工具查不出来**的一类：`prettier` / `eslint` / `svelte-check` 都不会报，`axe` 也未必触发，
但写错了就是线上看得见的缺陷。每条都来自实测，细节在 `UI-STYLE` 对应节 —— 写之前先扫一遍这张表。

| 规则                                                              | 为什么 / 细节                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 条件类名在 `<script>` 里拼好，**不要写进 `class` 属性**           | 属性里的三元被 prettier 拆行后会变成纯文本（`false ? 'x' : ''` 直接显示出来），静态检查不报。§6         |
| **选中态也要写 hover**                                            | `SEG_ON` / `TAB_ON` / `LINE_ON` / `NAV_ON`、抽屉里 `aria-current="page"` 那条；口径对齐 `CHIP_ON`。§12  |
| **按下态（`:active`）全站统一，别自己加**                         | base 层已给 `filter: brightness(0.96)`；**不要用位移** —— 会被 `overflow-hidden` 的容器切掉按钮底边。§9 |
| 深色下新增颜色类，**必须同时进 `layout.css` 的重绑定表**          | 没登记的类不跟随主题，深色下就是一个亮斑。§1.1                                                          |
| 深底块补 `color-scheme: dark`（复用 `bg-gray-900` 即可）          | 否则浅色主题下块内的滚动条是浅灰的，压在深底上。§1.1                                                    |
| **`w-fit` 必须配 `max-w-full`**                                   | 内容宽的盒子会在 768 / 1024 两档撑破文档（`overflow-x-auto` 接不住无上限的盒子）。§17                   |
| 栅格 / 行向 flex 的子项带 `min-w-0`                               | 否则长内容撑开布局视口，手机端整页被缩小。§17                                                           |
| 面板里有 `absolute` 浮层（Dropdown 等）就 `Panel clip={false}`    | `overflow-hidden` 会把菜单裁掉，这种裁切 axe 查不出来。§8                                               |
| `opacity-60` 弱化的分组**必须同时标 `aria-disabled`**             | 半透明会把组内文字压到 3:1 以下，标了才按「当前不生效」判。§12                                          |
| `sr-only` 的直接父级必须带 `relative`                             | 它是 `absolute`，父级没有定位上下文会逃出滚动容器、把文档撑高。§18                                      |
| 可滚动区要能聚焦：`tabindex="0"` + `role="region"` + `aria-label` | 同一页多个滚动区**名字不能重复**（landmark 名唯一）。§18                                                |
| 图标一律 `aria-hidden="true"`                                     | `@lucide/svelte` 已自带，但显式写更稳（手写内联 SVG 尤其要写）。§18                                     |
| 动效时长走 `motionDuration()`（`$lib/ui/motion.svelte.ts`）       | Svelte 的 `transition:fly` 走 Web Animations API，CSS 的 reduced-motion 压不住它。§18.1                 |
| **焦点环是容器级的**：编辑区由 `EditorBox` 的 `focus-within` 表达 | 内部控件写 `focus:outline-none` 就行，自己再画一圈会和容器边框叠成更粗的一条。§10 / §11.1               |
| 触控目标 ≥ `h-6`（24px）；视觉做小用 `after` 伪元素扩热区         | 移动端主操作直接用 `Button size="lg"`（`h-11` = 44px）。§9 / §18                                        |
| 破坏性操作先 `await confirm.ask('…')`，**不要 `window.confirm`**  | 原生框的按钮文案由浏览器给（英文界面下是 OK / Cancel）、不跟随主题。组件在 `+layout.svelte` 挂一次。§19 |

**已就位的基建，别重复造**：「跳到主要内容」链接与 `<main id="toolv-main" tabindex="-1">` 在 `ToolShell` 里
（走 `ToolShell` 的页面都自带）；顶部 sticky 导航条的遮挡靠 `html { scroll-padding-top: 3.5rem }` 让开，
**不要再逐元素加 `scroll-mt-*`**。详见 `UI-STYLE §18.1`。

### 动手之前，先站到用户角度想一遍

规范管「写对」，这一条管「好用」—— 值不值得这么做，规范回答不了。改任何界面（版式、流程、加功能）之前，
先替**第一次用的人**过一遍下面几条，答不上来就别急着写：

- **一眼看得懂吗**：入口的名称 / 图标 / 空态，不解释也知道下一步点哪；少用圈内黑话。
- **能不能少点几下**：高频路径给默认值 / 记住上次 / 一键回填，别把选项全摊开让人每次重选。
- **主路径排在前面**：窄屏上也先把最常用的那条路露出来，次要配置往后放。
- **特殊状态有出口**：空态、筛无结果、输入非法、加载中，都要给出下一步而不是留一片空白。
- **危险操作别默认**：清空 / 覆盖 / 删除 / 发送要能回退或二次确认，不默认选中。
- **别替用户做决定**：能推断的就别问；推断不了又影响结果的，明确让他选。

想不清哪种更方便、或两种做法的维护成本相差很大时，按 §0.3 的格式**带上方案问用户**，不要默默替他选。
具体怎么落地（响应式、空态、a11y）仍查 `UI-STYLE §17 / §18`，组件能否复用查 `UI-STYLE §0`。

## 8. SEO 约定（每个工具页必做）

在 `<svelte:head>` 里补齐：

- `<title>` —— 格式 `<工具名> by 无情 | www.toolv.cn`
- `<meta name="description">`、`<meta name="keywords">`
- `og:title` / `og:description` / `og:type` / `og:url`（og:url 用绝对地址 `https://www.toolv.cn/<path>`）

站内链接一律用 `resolve()` from `'$app/paths'`，**不要硬编码路径**；
**工具清单里的路径例外：走 `$lib/tools` 的 `toolHref()`** —— `resolve()` 的入参是按路由逐个展开的
元组联合，工具数超过 25 个后 TS 就匹配不上（第 26 个工具 `/docker` 撞到的），转换已收在 `toolHref()` 里，
别在组件里改回 `resolve(tool.path)`。
新增工具时改 `src/lib/tools.ts`（首页卡片、分类侧栏、工具页菜单**三处 UI 面、两个 import 点**共用这一份数据；
后两处都是数据驱动的，不用逐处补代码），按 `README.md#工具列表` 更新条目与 📄 链接，并在首页按分类过一遍卡片。

> **页脚不列工具**：首页页脚只有品牌、开源链接与版权（`+page.svelte` 的 `footer` 槽），
> 所以没有「页脚导航」这回事 —— 别去找它，更别为了「同步」往页脚加一组工具链接。

## 9. 新增一个工具页的清单

1. 建 `src/routes/<tool>/`。
2. **先按 STRUCTURE §0 定档**（默认 L1：`+page.svelte` + `core/store.svelte.ts`），再决定文件形态：
   - L0：全部写在 `+page.svelte`（只有真正无状态时才用）；
   - L1：共享状态收进 `core/store.svelte.ts`；纯函数多、边界多时再拆 `core/<topic>.ts`（可单测，不依赖 DOM）；
   - L2：L1 + `ui/*.svelte` 拆面板。
     `ui/styles.ts` 的门槛见 STRUCTURE §0 硬约束第 2 条。
   - 业务参数（默认值 / 示例数据 / 档位 / 上限 / 存储键）多到散在 `core/` 与 `ui/` 里找不着时，
     按 `STRUCTURE §2 B` 建根层 `config.ts`；参数少就就近写，别先建空壳。
3. **写工具自己的 `README.md`（每个工具必填，随目录一起建）**：写什么、怎么组织一律见
   [`docs/TOOL-README.md`](./docs/TOOL-README.md) —— **本文件不复述**；
   首页工具列表里工具名后的 📄 就指向它，**新工具进列表时这条链接要一次接上**。
4. `+page.svelte` 组装 + SEO head（§8）；能静态化的加 `+page.ts` 开 `prerender`。
5. 同步首页卡片 / 分类侧栏 / 工具页菜单（同一份 `src/lib/tools.ts`，§8）。
6. 交互状态（开关、启停、筛选）要有可断言的纯逻辑入口，不要只靠 DOM 才能验证。
7. 测试按 §10 的「按需」原则补，不默认每个组件配一套。
8. 收尾按 §0.1 交付态：跑命令 + 过一遍 §12 的三层自查。

> 响应式自查（375 / 1280 无横向溢出）与 a11y 自查（axe 0 violations）**不在此单列** ——
> 它们在 §10 的验证表里，交付时统一走。

## 10. 测试规范

**测试按需写，不追求全覆盖**：纯逻辑单测按改动需要补；`*.svelte.test.ts` 只在用户明确要求时才写，`*.stories.svelte` 见下方「通用组件必须写 story」。仓库里已有的测试保持不删、继续维护。

**唯一必须写测试的情况**：改了共享状态（`core/store.svelte.ts` 的数据模型、派生、筛选、定时器逻辑）→ 补纯逻辑单测进 `*.test.ts`。这是「按需写测试」的真正落点。

| 类型          | 文件命名                         | 运行环境                                         |
| ------------- | -------------------------------- | ------------------------------------------------ |
| 纯逻辑 / 单元 | `src/**/*.{test,spec}.ts`        | server project（node）                           |
| 组件          | `src/**/*.svelte.{test,spec}.ts` | client project（Playwright chromium 真实浏览器） |
| Story         | `src/**/*.stories.svelte`        | storybook project，会被 vitest 一起跑            |

注意事项：

- **通用组件必须写 story**（`src/lib/ui/<Component>/<Component>.stories.svelte`、
  `src/lib/components/<Component>/<Component>.stories.svelte`），例外只有 story 跑不起来的组件；
  工具页里的组件不强制（见 STRUCTURE §2 C）。
- 测试文件就近放在被测代码旁边（同属 `src/routes/<tool>/`，通用组件在 `src/lib/ui/<Component>/` 或 `src/lib/components/<Component>/`）。vitest 的 include 是 `src/**`，story 的 glob 是 `src/**/*.stories.*`，都能自动收集，**不需要改任何配置**。
- **e2e 单独跑**：`pnpm test` 不含 e2e；`pnpm test:e2e` 只在用户明确要求时才跑（时机见 §0.1）。
- vitest 开启了 `expect.requireAssertions: true` —— **每个 test 至少要有一个断言**，否则失败。
- 组件测试跑真实浏览器，需要 Playwright chromium（含系统依赖）；缺依赖先装，不要改成 jsdom 糊过去。
- Storybook 的 a11y 检查默认是 `'todo'`（只提示不失败），别指望它兜底；无障碍问题要用 axe 实测（UI-STYLE §18）。
- 组件测试用 `vitest-browser-svelte` 的 `render`。

**跑单个测试**（vitest project = `client` / `server` / `storybook`，定义在 `vite.config.ts`）：

- 单文件：`pnpm exec vitest --run src/routes/<tool>/core/store.test.ts`
- 只跑某一类：`pnpm exec vitest --run --project server`（纯逻辑）/ `--project client`（组件）/ `--project storybook`
- `pnpm test` / `pnpm test:unit` 会同时跑三个 project，验单个改动时不要用它们。

### 改完怎么验证（分档，不要每次都上全套）

**本节只在 §0.1 的交付态执行。** 讨论态不验证——用户在反复调版式，每改一次就开浏览器量几何、注入 axe，纯粹是拖节奏。

判断标准只有一条：**这次改动有没有可能出现「类型检查过了但页面是坏的」**。没有就别开浏览器。

下表既是**怎么验**，也是**顺手自查哪些口径**（口径的唯一定义处在别处，本表只给指针）：

| 这次动了什么                                     | 怎么验（跑什么 / 开不开浏览器）                                            | 顺手自查（口径在别处）                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 纯文案 / 尺寸 / 间距 / 颜色微调                  | 只跑 `pnpm format && pnpm lint` + 类型检查（命令见 §3 坑 1），最多截一张图 | 对比度（小字一律 `-700`，`UI-STYLE §2`）、排版（`UI-STYLE §15`）                 |
| 新增 / 改动可点击元素（按钮、图标钮、链接）      | axe：起 dev server 注入 `axe-core` 跑 `wcag2a/aa`，要求 0 violations       | `aria-label`（带 `title`）+ 触控目标 ≥ `h-6`（`UI-STYLE §18`）                   |
| 加了 `sr-only` 元素                              | 同上（axe）                                                                | 父级必须带 `relative` —— 否则会逃出裁剪、把整页文档撑高（`UI-STYLE §18`）        |
| 动布局结构（栅格、面板封顶、滚动容器、换行策略） | Playwright 量一次几何（面板高、行高、左右留白）+ 375 / 1280 无横向溢出     | 响应式：手机端封顶、桌面交回栅格、状态切换不跳高（`UI-STYLE §17`）               |
| 新增元素外观 / 写了任何 class                    | 同上（量几何 + 截图）                                                      | Tailwind 工具类、无 `<style>` 块、焦点环统一（`UI-STYLE §1-16`）                 |
| 加了 / 改了列表                                  | Playwright 走一遍主流程                                                    | 长列表限制**渲染**条数 + key 用自增 id（§6）                                     |
| 动交互逻辑 / 数据模型 / 定时器 / 筛选            | Playwright 走一遍主流程，核对状态与 DOM，另跑 `pnpm test`                  | `$effect` 不写自己读的状态、全局副作用只在 `+page.svelte`（`STRUCTURE §2 B`）    |
| 改共享状态（store）                              | 补纯逻辑单测进 `*.test.ts`，并跑 `pnpm test` —— 「按需写测试」的落点       | 同上                                                                             |
| 改了工具清单 / 加了站内链接                      | 首页与工具页各看一眼，SSR 出的 HTML 里卡片在不在                           | 首页卡片 / 分类侧栏 / SEO head 一起改、站内链接走 `resolve()`（§8）              |
| 加了运行态文字 / 空态                            | axe（`aria-live` 有规则）                                                  | `role="status" aria-live="polite"`、空态与筛选无结果给不同文案（`UI-STYLE §18`） |

临时验证脚本一律放 `/tmp`，**不要建在仓库根目录**：会被 `prettier --check` / `eslint` 扫到报错，还可能误提交。
从 `/tmp` 跑脚本时 `import` 要写绝对路径（`/app/node_modules/playwright/index.mjs`）—— 那里解析不到包名；
`axe-core` 没有顶层依赖，从 `node_modules/.pnpm/axe-core@*/node_modules/axe-core/axe.min.js` 读源码再
`addScriptTag` 注入。

浏览器验证用的 dev server 不加新端口：**先探测 8000，用户常驻的那个活着就直接复用**（起法与理由见 §3）。

两条实测出来的硬口径（踩过才记下，别省）：

1. **注入 axe 之前要等 ≥300ms**：`transition-colors`（Tailwind 默认 150ms）跑着的时候
   `getComputedStyle` 拿到的是混合后的颜色，`color-contrast` 会报**假阳性**（蓝底白字的选中标签
   被判成不合格）。同一批用例两次跑「忽有忽无」基本就是这个原因。
2. **IDE 诊断（`read_lints`）不能替代 `svelte-check`**：有过 `.svelte.ts` 里读联合类型上不存在的字段，
   IDE 一直报 0 错、`svelte-check` 一跑就抓出来。改了 `.svelte` / `.svelte.ts` 要验类型，一律跑
   §3 坑 1 里那条一次性命令。

## 11. 构建与部署

- 部署到 Cloudflare Pages：`pnpm deploy`（生产）/ `pnpm deploy:preview`（preview 分支）。
- `wrangler.jsonc`：`name: www-toolv-cn`、`compatibility_date`、`nodejs_als` flag、`pages_build_output_dir: .svelte-kit/cloudflare`。
- `Env` 类型来自 `pnpm gen` 生成的 `worker-configuration.d.ts`（已纳入 git 跟踪）。**改动 Cloudflare 绑定后要重新生成并提交**。
- 本地预览用 `pnpm preview`（`wrangler pages dev`），不要用 `vite preview` —— 后者拿不到 `platform.env`。
- `.env` 只放 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，**不要提交密钥**。
- `.vscode/mcp.json` 已纳入 git 跟踪，**不要把 token 写进去**。
- 云开发环境与流水线在 `.cnb.yml` + `.ide/`（`init.sh` 装依赖、`docker-codebuddy.sh` 拉镜像起 CodeBuddy 容器、
  `docker-push-cnb.sh` 构建并推送镜像）；日常任务不要动，改动按 `ci(cnb)` 提交（`COMMIT.md` §0）。

## 12. 交付前自查（按严重度分三层，不要平均用力）

A 层不过不许交付，B 层写完顺手自查，C 层要在交付说明里交代。

> **这一节只在 §0.1 的交付态执行。** 讨论态下改代码是正常行为，不要拿这张表去束缚自己、也不要跑去跑命令；
> 但要**在写的时候就按 A/B 层的要求写**（比如别用 `{@html}` 渲用户输入、别写裸三元 class），
> 别等到交付态才回头改 —— 那已经晚了。

### A 层 —— 不过就别交付（会破坏承诺、带来安全或线上事故）

1. **纯前端**：没引服务端 API / 数据库，没把用户数据发到服务端；持久化只走 `localStorage` / `sessionStorage`（§4.1-4.5）。
2. **SSR / HTML 输出**：主要区块与空态在 SSR 的 HTML 里可见；没有整页 `csr = true`、没把内容包进 `{#if browser}`（§4.6）。
3. **XSS**：不用 `{@html}` 渲染用户输入；高亮走「分词 + `<span>` 上色」（分词与渲染见 `UI-STYLE §14`），必须用 `{@html}` 时先转义。
4. **条件类名**：class 属性里没有裸三元，渲染后的 `className` 里没有 `false ?` 原文（§6）。
5. **runes 反模式**：无 `export let`、`$: `、`on:`、`<slot>`、`createEventDispatcher`；`.svelte.ts` 顶层没导出 `$derived`（§6）。
6. **命令通过**：`pnpm format && pnpm lint` 全绿、`svelte-check` 全绿（`wrangler types --check` 在本机恒失败，按 §3 坑 1 绕开）；
   改了逻辑 / 共享状态时 `pnpm test` 也全绿；没提交 `.env`（§11）。

**门禁失败时怎么办**（三选一，不要默认自己改到底）：

- **报错属于本次改动** → 自己修，修完重跑。
- **报错与本次改动无关**（典型：§3 坑 1 的 `wrangler types` 过期、坑 2 的 Playwright 缺浏览器）→ 绕开它继续验
  （§3 坑 1 那条一次性命令），并在交付说明里注明绕过了什么。不要为了让命令变绿去改 `worker-configuration.d.ts` 或降级配置。
- **改法有两种以上、或修下去会牵动没要求改的文件** → 停手问，不要自己扩范围（§0.1 约束 2）。

### B 层 —— 按「这次动了什么」触发自查

**写完顺手自查，但只查这次真正碰到的那几条 —— 触发表（连怎么验）在 §10 的「改完怎么验证」，口径的唯一定义处在表里给的那些节，本节不复制。**

### C 层 —— 在交付说明里交代（让用户决定要不要调整）

7. **依赖**：为这次改动引入了什么依赖、体积代价（§4.5）。
8. **组件复用**：有没有把组件提升到 `src/lib/ui/`（原语）或 `src/lib/components/`（工具通用组装件）；
   提升到任一层都意味着必须配 `*.stories.svelte`（覆盖各 variant / 尺寸 / 禁用态）。
9. **测试**：这次写了哪些测试、哪些按「按需」原则故意没写。
10. **档位**：这次落在 L0 / L1 / L2 哪一档，为什么。若建了 `ui/styles.ts`，说明重复发生在哪几处。
11. **偏离**：有没有任何地方没按本文件执行，以及为什么。

## 13. 代码风格

- Prettier：**Tab 缩进、单引号、无尾逗号、printWidth 120**。改动后跑 `pnpm format`。
- 标识符、类型名、文件名用英文；**注释、文档、UI 文案用中文**。
- 只在逻辑不自解释的地方写注释，不要复述代码。
- 提交信息按 [`docs/COMMIT.md`](./docs/COMMIT.md)：`type(scope): 中文描述`；提交前按 COMMIT §7 过一遍文件清单与命令。

---

## 14. AI 工具与长期记忆（都在仓库里，别忽略）

**改 `.svelte` / `.svelte.ts` 时优先用现成的 Svelte 专家**：仓库自带子代理
`.codebuddy/agents/svelte-file-editor.agent.md`，以及 skill `.agents/skills/svelte-code-writer/`、
`.agents/skills/svelte-core-bestpractices/`（版本由根目录 `skills-lock.json` 锁定）——
它们会拉官方文档并用 autofixer 校验。Svelte MCP 与它们同源，**谁可用就用谁**：
遇 Svelte 话题先 `list-sections` 找章节、按 `use_cases` 用 `get-documentation` 拉取，
写完代码交付前用 `svelte-autofixer` 反复跑到不再返回问题，`playground-link` **仅在用户确认后**调用。
（当前环境没提供该 MCP 就跳过这一句。）

**长期记忆在 [`docs/MEMORY.md`](./docs/MEMORY.md)** —— 记**跨工具 / 环境 / 操作层面**的坑与口径；
**单个工具特有**的坑写在该工具 `README.md` 的 `## 踩过的坑`（规范见 `TOOL-README §2.1`）。
