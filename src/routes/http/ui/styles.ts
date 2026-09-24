// HTTP 请求调试的 UI 样式常量。通用 Button / Dropdown / Input 与版式常量都在 $lib/ui。
//
// 这里原先抄着一份 `$lib/ui/styles.ts` 的副本（TOOLBAR / ACTION_BTN / OUTPUT_PRE / OUTPUT_EMPTY …），
// 而且已经跟共享版岔开了 —— ACTION_BTN 少了 `disabled:cursor-not-allowed disabled:opacity-40`，
// 模板里到处手补。那些已全部删掉改引共享版。现在只剩三条真的属于本工具：
//
//   ① 请求配置标签页里的编辑区（请求头 / 请求体）。**不能沿用 `EDITOR_INPUT`** —— 那是左右双栏
//      工具的「移动端 45vh、桌面 flex-1」，而这里移动端也是页面流里的一个标签页，
//      给固定 min-h 才不会塌。
//   ② 导入区的粘贴框：与 cURL 编辑区同档（它就是那个位置）。
//   ③ 导入 / 导出标签里的生成结果区。
//   ④ 结果面的底色与响应体显示区的外层容器（见下）。
//
// 另外两处随版式换掉的：
//   - 响应体的视图切换（美化 / 原始 / 预览）与两个标签条都改用 `$lib/components/SegmentedControl`
//     的 quiet 档，原先手写的 VIEW_BTN 三条常量随之删除 —— 一屏里同时出现好几处分段按钮时
//     实心蓝块会互相抢镜头（UI-STYLE §12.1）。
//   - 响应面板不再有底栏：结果与运行态合一，挂在面板标题行（原先的 RESPONSE_FOOTER 已删）。

/** 请求配置标签页里的编辑区（请求头 / 请求体）：盒状 Textarea，撑满标签页 */
export const PANEL_EDITOR = 'min-h-40 flex-1';

// ------------------------------------------------------------ 左栏的工作区导航
//
// 三个工作区标签**竖着排在左栏**（参数预设上方），不再横在主区顶上 —— 横排那条标签栏
// 占掉主区一整条 48px 的高度，而左栏 16rem 空着正好装得下。移动端左栏是整页宽，
// 竖排反而白占纵向空间，所以那里退回一排横排（`max-lg:flex-row`）。
//
// 没有复用 `$lib/components/Tabs`：它三个 variant（card / flat / line）全是横排，
// 加一个竖排 variant 只为了这一处不合算（`STRUCTURE §2 C` 的共用门槛）。
// 视觉参数（h-9、text-xs、实心蓝选中态）与全站标签口径对齐，改标签样式时两处一起看。

/** 导航卡片外壳：与 TOOLBAR / Panel 同一套外观，只是高度由内容决定 */
export const NAV_CARD = 'shrink-0 rounded-xl border border-gray-200 bg-white p-2 shadow-sm';
/** 按钮列表：桌面竖排，移动端一排横排并均分整宽 */
export const NAV_LIST = 'flex flex-col gap-1 max-lg:flex-row';
/** 单个标签：图标 + 文字；移动端均分整宽并居中 */
export const NAV_BTN =
	'flex h-9 min-w-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none max-lg:flex-1 max-lg:justify-center';
/** 选中态同样给 hover（`SEG_ON` / `TAB_ON` 同一条口径）：这几个标签排在这里，
 *  悬停到当前那个时毫无反馈，会让人以为它已经不可点 */
export const NAV_ON = 'bg-blue-600 text-white hover:bg-blue-700';
export const NAV_OFF = 'text-gray-700 hover:bg-gray-50';

/** 导入区的粘贴框：移动端固定高、桌面填满上半块 */
export const IMPORT_EDITOR = 'h-[45vh] min-h-56 md:h-auto md:min-h-0 md:flex-1';

/**
 * 生成结果区：**浅底**代码块，与「代码生成」标签那块深底 CODE_BLOCK 有意区分 ——
 * 深底表示「这是写进代码库的代码」，这里只是要搬走的文本，别跟着染成深底。
 * 可滚动区记得配 `tabindex="0" role="region" aria-label`。
 */
export const GENERATED_PRE =
	'min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5 whitespace-pre text-gray-900 max-lg:max-h-[45vh]';

/**
 * 结果面的底色：响应面板「标签行以下」那两块（**响应体 / 响应头**）共用这一档。
 *
 * 为什么是 gray-100 而不是 gray-50：gray-50 只有 2% 灰，压在白卡上等于没铺（第一版用的就是它，
 * 反馈「不够明显」）。gray-100 是常见的「代码块底」档，一眼看得出结果区从哪儿开始；
 * 与请求构造那一侧也形成明确对照 —— **请求 = 白底编辑区，响应 = 浅灰结果面**。
 *
 * 「状态码」那块**刻意不铺**：它是参考手册而不是结果正文，而且它里面的 1xx 徽章本身
 * 就是 `bg-gray-100`（`BADGE_TONE.neutral`），铺上去徽章会跟底色糊在一起。
 *
 * 一处已知取舍：共享的 `JSON_TOKEN_CLASS` 是按白底定的（那份注释写着「白底上全部 ≥4.5:1」），
 * 搬到 gray-100 上只有标点那一档（`punct` = gray-500）从 4.83 降到 4.39。标点不是正文，
 * 且那套配色是 json-formatter / jwt-decoder / 本工具三处共用 —— 不为这一处去改它。
 */
export const RESULT_SURFACE = 'bg-gray-100';

/**
 * 响应体显示区的外层容器（响应面板「响应体」标签下那一整块）。
 *
 * 底色挂在**外层容器**上而不是 `<pre>` 上：空态 / 错误态 / HTML 预览三者也在这个容器里，
 * 底色跟着容器走，切状态时这块面不会忽白忽灰（UI-STYLE §17 不跳变）。
 * 也**不能直接给共享的 `OUTPUT_PRE` 加底色**：json-formatter 也用它，那边的输出区本身就是整张卡片。
 */
export const RESPONSE_BODY_PANE = `relative min-h-56 flex-1 ${RESULT_SURFACE} md:min-h-0`;

/**
 * 结果区正文与左侧行号槽的**共同排版**：字体、行高、上下内边距必须逐字一致，
 * 否则行号会逐行错开（`sm` 那一档容易漏 —— 只改一边就会在宽屏上歪）。
 * 抽成一个常量正是为了让这条约束只有一处。
 */
const BODY_LINE = 'py-4 font-mono text-xs leading-5 whitespace-pre sm:text-sm sm:leading-6';

/**
 * 左侧行号槽：`sticky left-0` 钉在左边缘 —— 横向滚动看长行时行号不跟着跑。
 * 底色必须**不透明**（与结果面同色）：滚到底下的正文要从它后面过，半透明会透出来。
 * `select-none`：框选正文时不该把行号一起复制走。
 */
// 行号的颜色：gray-500 落在 RESULT_SURFACE（gray-100）上只有 4.39:1，差 0.11 就到 4.5:1，
// axe 会判一条 serious。行号虽是装饰（整槽 aria-hidden），但它是要看清的东西，所以提到 gray-600（约 7:1）
export const LINE_GUTTER = `sticky left-0 z-10 shrink-0 select-none border-r border-gray-200 ${RESULT_SURFACE} pr-2 pl-3 text-right text-gray-600 ${BODY_LINE}`;

/** 正文：宽度由内容决定（外层 `flex w-max` + 横向滚动），所以这里不写 `flex-1` / `min-w-0` */
export const LINE_BODY = `pr-4 pl-3 text-gray-900 ${BODY_LINE}`;

// 高亮配色不再在这里：全站共用 $lib/ui/styles.ts 的 JSON_TOKEN_CLASS。

// 参数预设面板的版式常量（PRESET_ACTION / HEADER_BTN / PRESET_ROW / PRESET_NAME /
// PRESET_BADGE）已提到 $lib/ui/styles.ts —— 电商 ROI 用了同一套版式，
// 留在工具目录里迟早会像上面那份副本一样岔开。这里只 import，不再定义。

// 工作区标签已从 $lib/components/Tabs 换成上面那套**竖排导航**（工具自己的一份）——
// 横排标签条要把主区顶部整条 48px 吃掉，竖起来塞进左栏更划算。`Tabs` 现在本工具已不用。
// 代码生成标签页已提到 $lib/components/CodegenTab（regex 用同一件）。
// 状态徽章与状态码分类徽章走 $lib/components/Badge。
