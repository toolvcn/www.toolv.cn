# 长期记忆（www.toolv.cn）

> **只记跨工具 / 环境 / 操作层面**的东西；**单个工具特有**的坑写在该工具 `README.md` 的 `## 踩过的坑`
> （规范见 `TOOL-README §2.1`）。规范文档本身的分工见下面「规范文档的结构约定」。

## 环境口径（先看这条：标了环境的只在该环境成立）

**维护者本机 = Windows + PowerShell**；容器 / CNB 云开发 = Linux + `sh`。没标环境的条目跨环境通用。

> 三条环境事实 —— `pnpm check` 的 `wrangler types --check` 恒失败与验类型的一次性命令、`pnpm test` 的
> Playwright 噪音、无 git 身份时的提交写法 —— **只在 [`AGENTS.md`](../AGENTS.md) §3「本机已知的三个坑」里定义**，
> 本记忆只留指针（2026-09-21 去重，别在记忆里再抄一份）。

- **`read_lints` 不能替代 `svelte-check`**（跨环境）：曾在一个 `.svelte.ts` 里对联合类型直接读 `row.enabled`
  （只有一支有这个字段），IDE 诊断一直报 0 错，`svelte-check` 一跑就抓出来。
  口径：改了 `.svelte` / `.svelte.ts` 要验类型，一律跑 `pnpm exec svelte-check --tsconfig ./tsconfig.json`。
- **在 IDE 里直接跑 vitest 拿不到输出**（维护者本机）：命令被当成「常驻服务流」，只回一行 vite 插件横幅。
  绕法：重定向到文件再读、读完删掉 ——
  `pnpm exec vitest --run <file> 2>&1 | Out-File -FilePath vitest-out.txt -Encoding utf8`（`-Encoding utf8` 必给）。
  另：PowerShell 没有 `tail`；多条命令用 `;` 分隔而不是 `&&`。
- **想在手机视口下真看页面**（维护者本机，靠本机已装的 Edge，不用下载浏览器）：
  `pnpm exec playwright screenshot --channel msedge --device "Pixel 5" --full-page --wait-for-timeout 2500 <url> out.png`
  （`--device "iPhone …"` 会指定 webkit 引擎、与 `--channel msedge` 冲突，用 Chromium 系机型或 `--viewport-size`）。
  要看**交互后**的状态或量尺寸（溢出 / 顺序 / 元素框）就写个临时 `*.mjs` 用 `playwright` 包跑，**用完删掉**。
- **判「手机上整页被缩小」要用 `window.innerWidth > screen.width`**（跨环境）：那表示布局视口被内容撑宽；
  **不要用 `scrollWidth > innerWidth`** —— 被撑宽之后两者相等，这么量会漏判。病根通常是 **grid / 行向 flex 的
  子项缺 `min-w-0`**（`min-width: auto` 等于最小内容宽度，`whitespace-pre` 的代码块会把轨道撑开）。
- **判横向溢出 / 文字被挤出框**（跨环境）：`document.documentElement.scrollWidth > innerWidth` = 横向溢出；
  按钮 `scrollWidth/scrollHeight` 超过 `clientWidth/clientHeight` = 文字被挤出框 —— **只看元素高度看不出来**，
  得量 `scrollHeight`。
- **Playwright chromium 是可用的**（跨环境，含本容器）：storybook 与组件测试都跑得起来，`~/.cache/ms-playwright`
  空是正常的（浏览器在 `PLAYWRIGHT_BROWSERS_PATH`，见 `AGENTS.md` §3 坑 2）。临时脚本从 `/tmp` 跑时
  `import` 要写绝对路径 `/app/node_modules/playwright/index.mjs`（`/tmp` 下解析不到包名）。
- **`pnpm test` 的 storybook 项目带载时会随机超时，不是回归**（跨环境）：判据是**失败集合每轮都不一样 + 单跑必过**
  （默认 15s `testTimeout` 在大量文件并行、机器带载时不够用）。要一次全绿就
  `pnpm exec vitest --run --project storybook --testTimeout=60000`。
- **注入 axe 之前要等过渡结束**（跨环境）：`transition-colors`（Tailwind 默认 150ms）跑着时 `getComputedStyle`
  拿到的是**混合后的颜色**，axe 的 `color-contrast` 会报假阳性。确诊记录：单独跑那条规则、把等待从 120ms 拉到
  400ms 后报警消失；同一批用例两次跑「忽有忽无」基本就是这个原因。
  **口径（唯一定义处）在 `AGENTS.md` §10「改完怎么验证」的硬口径 1**，此处只记事故。

## 提交与仓库操作

- **改 `README.md` 工具列表的单元格要按显示宽度自己补空格**：那张表是 prettier 按「每列最大显示宽度（汉字算 2）」
  对齐的，塞进一个比列最大值更宽的单元格，`pnpm format` 会把**整张表**重排成一个大 hunk，真改动就被淹了。
  做法：先量出该列当前最大宽度（`[...s].reduce((n,c)=>n+(c.codePointAt(0)>0x2e80?2:1),0)`），把新文案压到不超过它；
  要换文案就按「字段总宽度不变」重排那一行。**`AGENTS.md` / `docs/*.md` 里的表同理。**
- `pnpm format` 会把全仓库文件标成 M（`core.autocrlf=true` 的行尾 / 缓存假象），但 `git diff --stat` 只列真有
  内容改动的文件 —— 提交前用 `--cached --stat` 复核一遍，按目录 `git add` 就不会把无关文件带进去。
- 规范在 `docs/COMMIT.md`：中文主题行 `type(scope): 动词开头`，正文写动机，不写文件清单，不加 AI 署名。
- 默认不 push，除非用户明确要求。

## 规范文档的结构约定

- 分工：**`AGENTS.md` 走路由**（顶部有任务路由表，**不要通读**）、`STRUCTURE.md` 文件放哪、`UI-STYLE.md` 长什么样、
  `COMMIT.md` 怎么提、`TOOL-README.md` 工具 README 怎么写；`EXTERNAL-LINKS.md` 只是外部站点清单，不是规范。
- **唯一定义处原则**：一条判断标准只在一处写全（`ui/styles.ts` 门槛只在 `STRUCTURE §0` 硬约束 2、组件清单只在
  `UI-STYLE §0`），其余地方只给指向 —— 复述必烂。
- **现状数字不进规范**：工具数量、组件数量、「某形态有 N 处」这类会随代码变化，只作说明、不作判据。**本记忆同样不记。**
- **「踩过的坑」按作用域分家**：本工具特有 → 该工具 `README.md` 的 `## 踩过的坑`；跨工具 / 环境 / 操作层面 → 本文件
  （规范见 `TOOL-README §2.1`）。
- 每轮回复末尾留一行状态回执（`— 讨论态：未跑命令…`）；用户说「收尾」才切交付态。

## 工具目录下的 config.ts

- **完整定义在 [`docs/STRUCTURE.md`](./STRUCTURE.md) §2 B**（目录树 §1 里也有 `[可选]` 一行），此处不重复 ——
  要改规则去那里改。这里只留两句操作口径：
- 判据两条：**同一个数散在 `core/` 与 `ui/` 两边**，或**同一个数被三处引用**。参数少的小工具继续就近写，
  不要为「统一」先建空壳（KPI 是「改一个数要不要翻三个文件」）。
- 操作提醒（`AGENTS.md` §0.2「中等」档第 ⑤ 步）：调某工具的默认值 / 示例 / 档位 / 上限 / 存储键之前，
  **先看它根目录有没有 `config.ts`**，有就改那里，别去 `core/` 里翻。

## 跨工具的 UI 坑（规则在 `UI-STYLE`，这里只记事故与判据）

- **浮层被裁：`clip={false}` 只管卡片那一层，滚动容器照样裁**。`Dropdown` 的菜单 `absolute` 挂在卡内，
  任何 `overflow != visible` 的祖先都会裁掉它：卡片自己给 `clip={false}`；**卡内的 `overflow-y-auto` / `overflow-auto`
  是另一个裁剪上下文，`clip={false}` 管不到**。修法是把带浮层的那一行**提到滚动区之外**（`shrink-0` 固定行），
  不要为了露出菜单去掉滚动（长内容会溢出卡片，更糟）。规则见 `UI-STYLE §8` 的 `clip` 一条。
  **这类裁切 axe 查不出来**（元素在 DOM 里、只是看不见）；不过 **Playwright 点它会报 `subtree intercepts pointer events`
  并写清是谁挡的** —— 脚本里只要点过浮层，这就是自动发现的办法。
- **全屏一律走原生 `requestFullscreen`，不要自绘遮罩**（`/clock` 先例）：`el.requestFullscreen()` +
  `fullscreenchange` 同步一个布尔 + 被拒时提示按 F11；自绘 `fixed inset-0` 等于自己补焦点陷阱 / `inert` / 滚动锁定，
  那才是这个功能全部的复杂度。
  - **别各接一套**：按钮是 `$lib/components/FullscreenButton`，接线只有一处 —— `Panel` 的 `fullscreen` prop
    （`EditorPane` 只是把它转交给 `Panel`，双栏工具的编辑面板照旧加 `EditorPane` 的 `fullscreen`）。
    别在工具里再写一遍 `bind:ref` + 布尔 + 类名切换；`/http` 因为还多一个「进全屏前先展开收起的面板」才自己接。
    全屏的是整张卡片，`Panel` 内部把高度策略整体换成 `h-dvh w-full`。
  - **同一页多个元素都能全屏时，`fullscreenchange` 里必须比对身份**（`document.fullscreenElement === target()`）——
    只看 `!== null` 会把另一个面板也点亮成「已全屏」。
  - **必须给 `h-dvh`（+ `w-full`），不能给 `h-full`** —— 全屏元素的父级高度是 `auto`，百分比高度不成立。
    把元素原有的 `flex-1` / `max-h-*` 换成一份**独立类名**，比用 `max-h-none` 覆盖稳（同变体下两条 class 谁生效
    取决于 Tailwind 的产物顺序，不好预测）。
  - 状态一律用 `fullscreenchange` 同步，别只靠自家按钮记账（用户按 Esc 或用系统 UI 退出要能反应）。
- **固定高度的分段按钮里文字不许换行**：`$lib/ui/styles.ts` 的 `SEG_BASE` 已带 `whitespace-nowrap` ——
  没有它时，固定高度（如 28px）的分段按钮在窄屏会把文字折成两行、**溢出按钮框压到相邻按钮上**
  （元素高度不变，所以只量高度看不出来，得量 `scrollHeight`）。
- **窄屏「一组 chips + 右侧图标按钮」的空白行**：包裹层（`role="group"`）是工具条的 flex 子项，自己按内容换行时
  会吃满整行 → 右侧按钮被挤到下一行。处置：窄屏 `max-md:contents` + 工具条 `max-md:justify-start`（缺后者会被
  `justify-between` 把每行拉到两端）。
- **窄屏按行排的栅格要加 `content-start`**：`align-content` 默认 `stretch`，会把内容没占满的高度分摊给 `auto` 行，
  于是「高度该由内容决定」的卡片被撑高（看着就是「选择下面多出一块白」）。
- **不适用的选项别用原生 `disabled` 灰掉**：disabled 控件收不到鼠标事件，挂在它上面的 `title` 永远弹不出来，
  用户只看到一颗灰按钮、只能猜「是不是坏了」。处置：**可点 + 点击弹说明**；且高亮要读「实际显示的那一档」，
  不能读状态里的旧值（否则会出现「灰掉的按钮还挂着选中态」）。
- **「点速查表一行插入」有两种语义，别互抄**：`/morse`、`/regex` 插的是**行内片段**（字符 / 摩斯码 / 正则 token），
  落在光标 `[start, end)` 处；`/htaccess-to-nginx` 插的是**整条配置指令** —— `.htaccess` 与 nginx 都是一行一条，
  接在行中间会拼出跑不起来的配置（`RewriteBase /RewriteCond %{HTTPS} off`），所以一律**另起一行**
  （光标所在行是空白就写进那一行）。三处的骨架相同（读光标 → 纯函数算 → 写回光标），但 `insert*` 的落点规则不同，
  照抄会把配置写坏。新加快捷插入时先问一句：**插进去的是「一行」还是「一个片段」**。
- **堆叠的面板不要都 `flex-1`**：`fill` 版式下容器高度是确定的，三块面板平分时编辑框会被压到不可用（移动端尤其）。
  后加的那一块（速查表 / 说明面板）改成**定高带子**（`max-xl:h-80` + `flex-none`，内部 `overflow-y-auto` 自滚），
  `xl` 起再切成右侧定宽栏（`xl:w-96`）—— 三列只从 `xl` 起，按 `UI-STYLE §17` 的断点节奏（`lg` 管栅格与高度策略、
  `xl` 管三列）。
- **工具页文案有两份，只有 `+page.svelte` 那份过 Svelte 解析**：同一段介绍同时写在 `lib/tools.ts`（首页卡片）
  与 `src/routes/<tool>/+page.svelte`（页内 SEO），**前者是 JS 字符串、后者是 Svelte 属性值**。
  于是文案里写了 `%{VARIABLE}` 这类花括号时，`.ts` 安然无恙、`.svelte` 直接解析失败
  （`Unexpected character '…'`，dev server 上整页白屏，`svelte-check` 会按行列号指到那个属性）。
  处置：属性值里写 HTML 实体 `&#123;` / `&#125;`（先例 `TabShell.stories.svelte`）。
  **改文案两处一起改，且只有 `.svelte` 那份需要转义** —— 别因为 `.ts` 那份看着没事就以为全对。
- **多行片段做 `line-clamp` 预览时必须配 `whitespace-pre-line`**：`line-clamp-2` 只管「超过两行就省略」，
  它**不会**把字符串里的 `\n` 变回换行 —— 少了 `pre-line`，`if ($scheme != "https") {\n    return …\n}` 这种片段
  会挤成一行，于是「取前两行做预览」等于白取。同理，**原生 `title` tooltip 不认 `\n`**：写 `\n` 只是看着对，
  渲染出来还是空格，要把写法与说明拼进 tooltip 就用分隔符连（`/htaccess-to-nginx` 用 `·`）。
