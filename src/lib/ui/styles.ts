// 跨工具共用的 UI 基础类名片段（$lib/ui 下各组件与各工具页用）。
// 完整类名串放在 .ts 里，Tailwind 照常收集；工具专属的样式常量仍留在各工具的 ui/styles.ts。
import type { JsonTokenKind } from '$lib/utils/json';

/** 焦点环：默认蓝 */
export const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
/** 焦点环：危险操作用红 */
export const FOCUS_RING_DANGER = 'focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none';
/** 禁用态：光标与透明度统一 */
export const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-40';

/** 输入框的基础外观（尺寸、内边距、字号由调用方补） */
export const INPUT_BASE = 'rounded-lg border border-gray-300 bg-white';
export const INPUT_FOCUS = 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none';

// ---------------------------------------------------------------------------------
// 工具页版式：顶部工具条 + 下方双栏编辑区（口径源自 json-formatter，被 5 个工具沿用）
//
// 结构固定三段，改一处全站生效：
//   ① 工具条卡片 TOOLBAR：若干 TOOLBAR_GROUP（TOOLBAR_LABEL 小标签 + 控件）+ 右侧操作（md:ml-auto）
//   ② 双栏里放 Panel 卡片，编辑区一律无边框（INPUT_TEXTAREA / OUTPUT_TEXTAREA）
//   ③ 每张卡片跟一条 FOOTER_BAR：输入卡放提示，输出卡放状态胶囊
//
// 同一行控件的**高度必须一致**（一律 h-8）：SEG_BTN / `Button size="sm"` / Dropdown size="sm"。
// 唯一的例外是工具内分组标题行的 SEG_BTN_QUIET（h-7，见下）——那行只有标题 + 开关，不跟工具条同排。
// ---------------------------------------------------------------------------------

/** 顶部工具条卡片：小屏纵向堆叠，md 起并排、控件底对齐，右侧操作 md:ml-auto 靠右 */
export const TOOLBAR =
	'flex shrink-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:flex-row md:flex-wrap md:items-end md:gap-4';

/** 工具条里的分组：小标签 + 控件竖排 */
export const TOOLBAR_GROUP = 'flex shrink-0 flex-col gap-1';

/** 分组的小标签 */
export const TOOLBAR_LABEL = 'text-xs font-medium text-gray-600';

/**
 * 工具条右侧的操作区（「示例 / 清空 / 复制输出」那一簇）。
 *
 * 与 `TOOLBAR` 的 `md:flex-row` 同一个断点：小屏跟着左侧分组一起换行、铺满整行，
 * md 起 `md:ml-auto` 甩到工具条右端。**全站 26 个工具页逐字相同的同一串**，
 * 从各页收进来之后，改一处分组间距 / 换行口径就是全站生效。
 *
 * `shrink-0` 与 `flex-wrap` 都不能省：`TOOLBAR` 是 `md:flex-wrap` 的，
 * 少了 shrink-0 时按钮会在窄工具条里被压扁（图标与文字挤在一起），
 * 少了 flex-wrap 时放不下的按钮会直接溢出卡片。
 */
export const TOOLBAR_ACTIONS = 'flex shrink-0 flex-wrap items-center gap-2 md:ml-auto';

// 分段按钮两档（`SegmentedControl` 的 tone）：基础部分逐字相同，只差高度、内边距与选中态。
// 高度**不放进基础里**：默认档 h-8 跟工具条其它控件齐平，轻档要矮一档（见下）。
//
// `whitespace-nowrap` 不能省：按钮高度是固定的（h-8 / h-7），文字一旦换行就**溢出按钮框**——
// http 的「请求构造」在 393px 的手机上，四个标签被挤成「请求 / 头」两行、还压到相邻按钮上。
// 窄到实在放不下时，让整行溢出（由调用方给横向滚动）也比文字挤出框强。
const SEG_BASE =
	'inline-flex flex-1 items-center justify-center gap-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none md:flex-none';

/** 分段选择按钮（默认档）：移动端均分撑满整行，md 起恢复自然宽度；选中实心蓝底，未选灰字 */
export const SEG_BTN = `${SEG_BASE} h-8 px-3`;
/**
 * 选中 / 未选两态。**选中态也要有 hover**：按钮组件（`Button` 的 primary）与 `CHIP_ON`
 * 都给了 `hover:bg-blue-700`，以前这里漏了，于是同一屏里「悬停在 chip 上有反馈、
 * 悬停在选中的分段按钮上毫无反应」—— 而「还能点一次」正是它最该给出的暗示。
 * 两个 hover 类都在 layout.css 的重绑定表里，深色态不用另写一版。
 */
export const SEG_ON = 'bg-blue-600 text-white hover:bg-blue-700';
export const SEG_OFF = 'text-gray-600 hover:bg-gray-50';

/**
 * 轻档：更矮更窄（`h-7` + `px-2.5`），给**小节标题行**那种一屏里同时出现好几处的地方用。
 *
 * 比默认档矮一档：它跟 12px 的小节标题同排，h-8 的按钮框比标题高出一倍，看着像这行是它在主导。
 * **只在小节标题行用**（目前只有 ecommerce-roi）—— 那行里别的控件（手机端的「收起」）
 * 也走 h-7，同一行不混高度（UI-STYLE §9）。
 */
export const SEG_BTN_QUIET = `${SEG_BASE} h-7 px-2.5`;
/**
 * 轻档的选中 / 未选：选中是**浅蓝底 + 蓝字**，不是实心蓝块。
 *
 * 理由：一屏里出现四五处时，实心蓝块会互相抢镜头 —— 控件比它自己那行 12px 的标题还响。
 * 浅底档把这个关系扳回来。对比度：blue-700 落在 blue-50 上，白底远高于 4.5:1（UI-STYLE §2）。
 */
export const SEG_ON_QUIET = 'bg-blue-50 text-blue-700 hover:bg-blue-100';
export const SEG_OFF_QUIET = 'text-gray-600 hover:bg-gray-50 hover:text-gray-900';

/**
 * 可切换的小 chip（h-7，多选一组的开关）：语言 chips、正则旗标 chips 共用。
 * 选中蓝底、未选白底灰描边，按下态由 `aria-pressed` 表达；`gap-1` 给内嵌图标 / 字母留位。
 * 边框取 `gray-300`（UI-STYLE §7 的「次级按钮边框」一档）—— http 的代码生成原先写成
 * `gray-200` + `text-gray-600`，跟 regex 的同一件控件岔开了，收进来时按 §7 统一。
 */
export const CHIP_ON =
	'inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';
export const CHIP_OFF =
	'inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/**
 * 「按钮长相，但不是 `<button>`」的样式串 —— 现在唯一的调用方是 base64 上传图片的 `<label>`
 * （file input 只能由 label / 程序触发，换不成 `<Button>`）。
 *
 * 真按钮一律用 `<Button size="sm">`（次级）/ `<Button size="sm" variant="primary">`（主操作）——
 * 本串与 Button 的 `SIZE_TEXT.sm` 逐字对齐（h-8 + px-2.5 + gap-1.5 + whitespace-nowrap），
 * 只多一条 `bg-white`（label 不自带背景语义）。
 * 手写 `<button class={ACTION_BTN}>` 曾经是工具条的默认写法，但它没有 `aria-label`，
 * 读屏只念到图标旁那两个字（「示例」「清空」）—— generator 四个工作区换到 `<Button>` 之后，
 * 主操作档那条常量（原 `ACTION_PRIMARY`）已无人引用，随之删掉，要主操作按钮就用 Button。
 *
 * `whitespace-nowrap` 与 `SEG_BTN` 同一条约定：高度固定，文字换行就会溢出按钮框。
 */
export const ACTION_BTN =
	'inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap';

// ---------------------------------------------------------------------------------
// 多工作区工具的标签条（UI-STYLE §8.2 收尾那条）
//
// 独立一行放在工具条之上，h-9：小屏标签均分整宽、sm 起收成自然宽度；
// 图标在窄屏放不下，各工具用 `hidden size-3.5 shrink-0 sm:block` 局部藏起来。
// ---------------------------------------------------------------------------------

/**
 * 标签条外壳（卡片式）：小屏撑满一行，sm 起贴内容宽。
 * **不带阴影** —— 阴影由 $lib/components/Tabs 按 variant 决定：标签条下方紧跟卡片时（crypto / 速查表）
 * 两层阴影叠着显脏，那种用 flat。
 *
 * `overflow-x-auto` 与按钮的 `min-w-fit` 是**一对**，一起改才成立：标签多到一行放不下时
 * （单位换算 15 个分类、速查表 10 张表）整条横向滚动，而不是把文字挤出按钮框。
 * 不能只留 `overflow-hidden` —— 那个只能裁，裁掉的部分用户够不着。
 *
 * **`max-w-full` 是后来补的，别删**：`sm:w-fit` 让标签条收成内容宽（标签少时不空出一大截），
 * 但 `w-fit` 没有上限 —— 10 张表那条在 768px 上宽 1000px、15 个分类那条宽 1138px，
 * 都比容器宽，于是**滚动的不是标签条而是整个文档**（768 / 1024 两档实测整页横向溢出 248 / 386px）。
 * 加上 `max-w-full` 之后盒子被压回容器宽，`overflow-x-auto` 才接得住，横向滚动回到条内；
 * 标签本来就放得下时它的宽度不变（fit-content < 容器宽），所以宽屏观感与从前逐像素一致。
 */
export const TAB_BAR =
	'flex w-full shrink-0 divide-x divide-gray-200 overflow-x-auto overflow-y-hidden rounded-lg border border-gray-200 bg-white sm:w-fit max-w-full';

/**
 * 标签条里的单个标签：小屏收缩内边距与字号。
 *
 * `min-w-fit` + `whitespace-nowrap` 管住「标签多」这一档：`flex-1` 仍然让小屏均分整宽
 * （≤5 个时与从前逐像素一致），但**按钮不会窄过自己的文字**，放不下就由上面的外壳横向滚动。
 * 没有 `min-w-fit` 时会退化成 `min-width: auto` 被内容撑开、再由 `overflow-hidden` 裁掉。
 */
export const TAB_BTN =
	'inline-flex h-9 min-w-fit flex-1 items-center justify-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none sm:flex-none sm:px-3 sm:text-sm';
/** 选中态同样要能 hover —— 与 `SEG_ON` 同一条口径 */
export const TAB_ON = 'bg-blue-600 text-white hover:bg-blue-700';
export const TAB_OFF = 'text-gray-600 hover:bg-gray-100';

/**
 * 标签内容区顶部的通栏工具条（计数 / 语言 chips + 右侧操作）。
 * 原先是 regex 与 http 各自的 `ui/styles.ts` 里逐字相同的两份，随 CodegenTab 一起收上来。
 */
export const TAB_TOOLBAR =
	'flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2';

// ---------------------------------------------------------------------------------
// 左侧参数预设面板（http 请求调试 / 电商 ROI 共用）
//
// 结构固定三段：① 标题行右侧放导出 / 导入；② 正文顶部一行「名称输入 + 保存」；
// ③ 下面是可滚动的预设列表，每条整行可点回填、右侧删除。
// 原先只在 http 的 ui/styles.ts 里，电商 ROI 要用同一套版式，故升到共享层（STRUCTURE §2 C）。
// ---------------------------------------------------------------------------------

/** 面板内操作按钮：保存（h-8，与 Input size="sm" 同高） */
export const PRESET_ACTION =
	'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/**
 * 标题行的小按钮（h-7 一档）：面板头部右侧的「导出 / 导入」、小节标题行右端的「展开 / 收起」都用它。
 *
 * 描边取 gray-200、字 gray-600 —— 比工具条的 `<Button size="sm">`（gray-300 描边 / gray-700 字）再轻一档：
 * 它贴在 12px 的小标题旁边，跟着工具条那一档的对比度走会喧宾夺主（UI-STYLE §7 / §9）。
 *
 * 名字原先是 `PRESET_HEADER_ACTION`（只在预设面板头部用），电商 ROI 的「展开 / 收起」收进来之后
 * 改名并泛化 —— 一个常量不该以它最早的调用方命名（UI-STYLE §0：两层通用组件的命名按语义，不按出处）。
 */
export const HEADER_BTN =
	'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/** 预设条目：整行可点应用；删除按钮由调用方绝对定位在条目内右下角（`group` 因此挂在 li 上，不在这里） */
export const PRESET_ROW =
	'flex w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/** 预设条目标题（名称） */
export const PRESET_NAME = 'min-w-0 truncate text-xs font-medium text-gray-900';

/** 徽章：小号、灰底（http 放请求方法，电商 ROI 放口径），跟在预设名称右侧 */
export const PRESET_BADGE = 'shrink-0 rounded bg-gray-100 px-1 font-mono text-[10px] font-semibold text-gray-700';

/** 卡片底部通栏脚注（提示 / 状态条） */
export const FOOTER_BAR = 'flex h-9 shrink-0 items-center border-t border-gray-200 px-3';

/** 面板标题右侧的补充小字（字符数这类） */
export const PANEL_HINT = 'text-xs text-gray-600';

/**
 * 列表顶部的搜索条：贴在面板正文最上面、通栏分隔线，左边搜索框 + 右边操作 / 计数。
 *
 * 收这一条的由来：cheatsheet 三张表、http 状态码标签、morse 速查、命令速查、/dns **五处各写一份**，
 * 其中 http 那份还多写了 `flex-wrap`。收敛时取**带 `flex-wrap` 的并集** —— 里面的搜索框是
 * `flex-1 min-w-0`，正常永远先被压缩、不会触发换行，所以对原先没写的那几处是无行为变化的；
 * 反过来漏了 `flex-wrap` 的，窄屏挤不下时会把控件压出容器。
 */
export const SEARCH_ROW = 'flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2';

/**
 * 搜索条里的输入框：`h-8` 跟同排的 `Button size="sm"` 齐平；**`pl-8` 是给调用方绝对定位的放大镜图标留位**。
 *
 * `font-mono` + `placeholder:font-sans` 是刻意的：搜的多半是标识符（状态码、命令、地址、AST 码点），
 * 等宽更好认；而占位符是中文句子，跟着变等宽会显得稀稀拉拉。
 * http 状态码标签原先没开等宽 —— 收敛时统一到这一份（数字在等宽下更整齐）。
 */
export const SEARCH_INPUT =
	'h-8 w-full rounded-lg border border-gray-300 bg-white pr-3 pl-8 font-mono text-xs text-gray-900 placeholder:font-sans placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none';

/**
 * 搜索条里那枚放大镜：绝对定位贴在 `SEARCH_INPUT` 左端 —— 上面 `pl-8` 就是给它留的位。
 *
 * `top-1/2 -translate-y-1/2` 对齐输入框的中线（输入框 h-8，图标 14px）；
 * `text-gray-500` 是装饰性图标的对比度下限那档（组件里配 `aria-hidden="true"` 一起用）。
 * 这份是六处搜索框（速查表三张表 / 命令速查 / http 状态码 / morse / dns）各自的同一段类名。
 */
export const SEARCH_ICON = 'absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-500';

/**
 * 面板正文里的滚动容器：**移动端限高 60vh、内部滚动，lg 起交给父级的栅格行**（父级必须是 flex 列）。
 *
 * 为什么移动端要限高：列表类面板（状态码 500+ 条、DNS 服务器几十条）不限高会把整页撑到几千 px，
 * 底下别的内容永远够不着。桌面端交给栅格是因为那时左右两栏各自在视口高度内分配，
 * 再压 60vh 反而会平白浪费半屏。
 * （同一思路还有 `EDITOR_INPUT`，那条给双栏编辑区，移动端 45vh。）
 */
export const PANEL_SCROLL = 'min-h-0 flex-1 overflow-y-auto max-lg:max-h-[60vh]';

// ---------------------------------------------------------------------------------
// 数据表（`<table>`，全站三处：速查表参考表、子网拆分、利息还款计划）
//
// 不加 `Table` 组件的原因：这三处的列数与列宽口径各不相同（参考表 2 列、子网 4 列、
// 还款计划 6 列），抽组件就得把列定义、对齐、数字列等一堆 prop 摆出来 ——
// 收益只剩「表头少写一串类名」。表头 / 表格这两条常量的重复是真的，先收它们。
// ---------------------------------------------------------------------------------

/** 数据表本体：撑满 + 允许横向滚动（外层 `overflow-x-auto`），小字号 */
export const DATA_TABLE = 'w-full min-w-[30rem] border-collapse text-left text-xs';

/** 表头单元格：11px 加粗灰字、不换行（列窄时宁可横向滚动，也不把表头折成两行） */
export const TABLE_TH = 'px-4 py-2 text-[11px] font-semibold whitespace-nowrap text-gray-600';

/** 列表里的分组小标题（速查表 / 状态码 / morse 按类别分段时的 `h3`） */
export const LIST_HEADING = 'px-4 pt-3 pb-1 text-xs font-semibold text-gray-600';

/**
 * 编辑区外框外侧的**间距**：与卡片边界留一圈，别让框贴着卡片边（直接贴会跟卡片自己的边框连成两条线）。
 * 框本体的边框 / 底色 / 聚焦环在 `$lib/components/EditorBox`（见 UI-STYLE §11.1）；
 * 双栏编辑区套 `<div class={EDITOR_FRAME_PAD}><EditorBox>…</EditorBox></div>`。
 * 用 `p-2` 而不是 `p-4`：框内编辑层已有自己的内边距，外层再给 16px 会把顶边到首行的距离翻倍。
 */
export const EDITOR_FRAME_PAD = 'flex min-h-0 flex-1 flex-col p-2';

/**
 * 双栏工具编辑区的**布局**（外观归 `$lib/components/EditorBox` 那层框）：移动端固定高、桌面填满框。
 * 高度与定位属于「放在页面哪儿」，每个工具不同，所以和那层框、和组件的外观分开写。
 */
export const EDITOR_INPUT = 'h-[45vh] min-h-56 md:h-auto md:min-h-0 md:flex-1';

/**
 * 只读输出区 textarea 的布局：绝对定位铺满外层容器，高度跟着卡片走。
 * 外层容器是 flex 项（`relative min-h-56 flex-1`），高度由布局决定；内层不 absolute 就撑不满。
 * 用法：`<Textarea mono readonly size="sm" class={EDITOR_OUTPUT} …>`（外观归 `EditorBox`）。
 */
export const EDITOR_OUTPUT = 'absolute inset-0';

/** 空态 / 错误态居中提示：放进 relative + 定高容器里盖住编辑区 */
export const OUTPUT_EMPTY =
	'absolute inset-0 flex items-center justify-center px-6 text-center text-xs leading-5 text-gray-600';

/**
 * 输出区 `<pre>`：绝对定位铺满外层容器（外层要 `relative min-h-56 flex-1`）。
 * json-formatter / json-to-ts / htaccess-to-nginx 的结果高亮、crypto 的结果都用它；走 <CodeView>
 * 时把这条当 class 传进去（CodeView 自己不管版式）。可聚焦滚动记得配 `tabindex="0" role="region" aria-label`。
 * 不写焦点环：这些输出都套在 `EditorBox` 里，聚焦转蓝由那一层的 `focus-within` 表达，
 * 内部再来一圈会和边框叠成更粗的一条。
 * 内边距 8px 写在这里、不由 `EditorBox` 统一压：sql 镜像层里也有 `<pre>`，框若去压它会错位。
 */
export const OUTPUT_PRE =
	'absolute inset-0 overflow-auto p-2 font-mono text-xs leading-5 whitespace-pre text-gray-900 focus-visible:outline-none sm:text-sm sm:leading-6';

/**
 * 深底代码块（`<pre><code>`）：跟全站的浅色面板反着来，一眼认出「这是生成的代码」。
 * regex 的代码生成与 http 的代码生成各有一块，原先各写一份（p-3 vs p-4），统一到 p-4
 * —— 跟 INPUT_TEXTAREA / OUTPUT_PRE 的内边距同档。
 * 可滚动区记得给 `tabindex="0" role="region" aria-label`（axe 的 scrollable-region-focusable）。
 */
export const CODE_BLOCK =
	'min-h-0 flex-1 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-xs leading-5 whitespace-pre text-gray-100';

// ---------------------------------------------------------------------------------
// 悬浮卡（挂在指针 / 焦点上的信息层：预设条目的参数卡、说明栏里的公式气泡）
//
// 只收「外壳」这一层 —— 定位坐标由调用方自己算（两处都是跟着条目走的 fixed），
// 宽度与字号也各留各的：参数卡是「一字段一行」的窄卡（w-64 / 11px），
// 公式气泡是一段说明文字（w-72 / 12px），这两处的差异是内容形态决定的，不该被统一。
// ---------------------------------------------------------------------------------

/**
 * 悬浮卡外壳：**固定定位 + `pointer-events-none`**。
 *
 * `fixed` 而不是 `absolute`：调用方多半挂在 `overflow-y-auto` 的列表里，
 * 绝对定位的卡一探出容器就被裁掉（参数一多就看不全）。
 * `pointer-events-none` 不可省：卡是跟着 hover 出来的，鼠标一进卡内 hover 就断、卡自己会闪。
 * 卡在视口边缘的翻边逻辑（右放不下翻左、下放不下上收）留在调用方 —— 那需要知道卡的宽高。
 */
export const HOVER_CARD = 'pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg';

// ---------------------------------------------------------------------------------
// 全站提示（toast，渲染在 $lib/ui/Toast/Toast.svelte）
//
// 定位内核在组件里（fixed 居中，bottom 默认 / top 给底部有输入区的页面）；
// 这里只放盒子外观，按 tone 二选一换底色。
// ---------------------------------------------------------------------------------

/** 提示盒子：胶囊形、深底白字 */
export const TOAST_BOX = 'rounded-full px-4 py-2 text-sm text-white shadow-lg';
/** 默认底色：深灰 + 一点透明，压在内容上仍看得清底下 */
export const TOAST_NEUTRAL = 'bg-gray-900/85';
/** 失败底色：红的 -700 一档，白字对比度够 */
export const TOAST_ERROR = 'bg-red-700';

// ---------------------------------------------------------------------------------
// 输出状态胶囊（渲染在 $lib/components/StatusPill/StatusPill.svelte）
//
// 每个工具的输出卡片底部都有一条「校验 / 进度 / 错误」运行态文字：
// 挂在 FOOTER_BAR 里、role="status" aria-live="polite" 给读屏播报，配色随三态走。
// 原先 14 个工具各写一份同样的类名串 + 各推一份三态三元，现在收成这里的两个常量 + 一个组件。
// ---------------------------------------------------------------------------------

/** 胶囊本体：撑满脚注宽度、小号加粗；文案长短随工具，要截断的由组件 truncate 开关加 */
export const STATUS_PILL = 'w-full rounded-lg px-3 py-1 text-xs font-medium';

/** 五档语义配色，全部 -50 底 + -700 字（白底上 ≥4.5:1） */
export const STATUS_PILL_TONE = {
	/** 中性：等待输入、无结果 */
	neutral: 'bg-gray-50 text-gray-600',
	/** 进行中：计算中、发送中 */
	info: 'bg-blue-50 text-blue-700',
	/** 成功：校验通过、转换完成 */
	ok: 'bg-emerald-50 text-emerald-700',
	/** 警告：结果可用但有降级（非 2xx 响应等） */
	warn: 'bg-amber-50 text-amber-700',
	/** 失败：语法错误、解析失败 */
	error: 'bg-red-50 text-red-700'
} as const;

/** 五档的联合类型，StatusPill 的 tone prop 用它 */
export type StatusTone = keyof typeof STATUS_PILL_TONE;

// ---------------------------------------------------------------------------------
// 小徽章配色（渲染在 $lib/components/Badge/Badge.svelte）
//
// 跟 StatusPill 那套的差别：徽章是贴在标题行 / 列表行里的静态标记，底色要更实一点
// （-100 vs -50），否则在同等字号下会显得发灰。neutral 因此不能共用。
// ---------------------------------------------------------------------------------

/** 五档语义配色：灰 / 蓝 / 绿 / 琥珀 / 红 */
export const BADGE_TONE = {
	neutral: 'bg-gray-100 text-gray-700',
	info: 'bg-blue-50 text-blue-700',
	ok: 'bg-emerald-50 text-emerald-700',
	warn: 'bg-amber-50 text-amber-700',
	error: 'bg-red-50 text-red-700'
} as const;

/** 五档的联合类型，Badge 的 tone prop 用它 */
export type BadgeTone = keyof typeof BADGE_TONE;

// ---------------------------------------------------------------------------------
// JSON 高亮配色（白底）
//
// 分词来自 `$lib/utils/json` 的 tokenizeJson / tokenizeSource，渲染在 $lib/components/CodeView
// （kind → 颜色的映射就是下面这份，由调用方当 classMap 传进去）。
// 三个白底工具（json-formatter / jwt-decoder / http）共用这一份；
// websocket 的日志面板渲染在带底色的行里，另有一份更深的配色（见 LogPanel，理由在那边注释）。
// ---------------------------------------------------------------------------------

/** 白底上全部 ≥4.5:1（-700 一档）；punct 是小字号标点，用 -500 也够 */
export const JSON_TOKEN_CLASS: Record<JsonTokenKind, string> = {
	key: 'text-blue-700',
	string: 'text-emerald-700',
	number: 'text-amber-700',
	literal: 'text-violet-700',
	punct: 'text-gray-500',
	plain: 'text-gray-900'
};
