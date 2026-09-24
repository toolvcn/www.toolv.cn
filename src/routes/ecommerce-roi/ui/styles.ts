// 电商 ROI 工具独有的 UI 样式常量。
// 版式常量（TOOLBAR / FOOTER_BAR / PANEL_HINT 等）是全站共用的，在 `$lib/ui/styles.ts`。
//
// 建这个文件的门槛（STRUCTURE §0 硬约束 2）：下面这几条在同一目录里重复 2 处以上 ——
// 字段网格 6 处、小节标题 8 处、小节标题行 4 处、11px 辅助小字 21 处（灰）/ 7 处（红）、
// 段标题 4 处、指标卡 3 处、指标数值 2 处、公式代入行 2 处、表格行 11 处、表格数值 7 处、
// 试算条 3 处、公式块 4 处。（按「出现过该常量的行数」数，不含 import 与本文件里的定义。）
// 原先还有「表单标签 11 处」与「字段单元格 11 处」两条：18 个数值字段抽进 NumberField 之后
// 各自只剩一处使用，按门槛收回组件内联，这里删掉。
// 计数是可数的，改完常量记得回来对一遍 —— 写错会让下一个人按错误的门槛决定「要不要再抽一层」。

/**
 * 一组字段的外壳。列数按「本面板实际有多宽」升档，不是按视口一路加宽：
 *   <640    1 列   手机，面板约 350px
 *   sm 640  2 列   页面还是单栏，面板吃满视口（内容区约 576px）
 *   md 768  3 列   同上，内容区约 704px，三列每格约 218px
 *   lg 1024 2 列   **回退**：三栏从 lg 生效，中栏被两侧栏挤到约 350px（每格约 151px）
 *   xl 1280 1 列   **再回退**：中栏又左右分成两列，输入面板 20rem，内容区约 288px
 *  2xl 1536 2 列   输入面板放宽到 24rem，内容区约 352px，两列每格约 168px
 *
 * 两处回退都因为**面板宽度不随视口单调递增**：lg 三栏生效、xl 中栏再分两列，都是变窄的档。
 * 一格放得下「退货能收回的货款（%）」这类 11 字标签（12px 字号约 132px）就够，故 150px 上下可以两列；
 * lg 那档是**最窄的 151px**，字段名之外还要放那枚填法交换按钮（50–62px，见 InputPanel 的
 * `MODE_SWAP_BTN`）—— 字段格里的东西一律按它来定尺寸，超出就折行。
 */
export const FIELD_GRID =
	'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2';

/** 面板内的小节标题：参数卡里分「成交 / 成本 / 退货」三块用 */
export const SECTION_TITLE = 'text-xs font-semibold text-gray-900';

/**
 * 小节标题行：左边标题、右边这一段的**组级**开关（现在只剩退货那三个率的填法）。
 *
 * **开关的摆放按作用范围定**：管一整组的放这里，只管一格的贴字段名右端
 * （`NumberField` 的 `labelExtra`：广告花费 / 订单数 / 商品成本三处）。
 * 原先漏了这一条 —— 管一格的开关也塞进标题行，看着位置整齐，实际离它管的那格隔了半屏。
 *
 * 而字段格确实放不下**分段按钮**：lg / 2xl 两档只有 150–167px，两枚按钮一放，
 * 数字就只剩几个字符（试过「贴输入框内部右端」，输入框被挤到放不下 34.95）。
 * 所以字段级那三处用的是一枚「当前填法 + 交换图标」的窄按钮（约 50–62px），
 * 不是两枚分段 —— 宽度账见 InputPanel 的 `MODE_SWAP_BTN`。
 * 标题行横跨整个字段网格（约 256–576px），放组级那个分段按钮绰绰有余（整盘 1 处、单件 1 处）。
 */
export const SECTION_HEAD = 'flex items-center justify-between gap-2';

/** 结果卡里一段的标题（比小节标题大一档）：「试算与下一步」「这笔钱怎么来的」「比率与口径」 */
export const SECTION_HEADING = 'text-sm font-semibold text-gray-900';

/** 11px 辅助小字：说明、脚注、公式旁注 */
export const NOTE_TEXT = 'text-[11px] leading-4 text-gray-600';

/** 11px 辅助小字的红字档：字段级错误（NumberField）与试算格那句「按 X 算」 */
export const NOTE_ERROR = 'text-[11px] leading-4 text-red-700';

/**
 * ② 段那种「一格前提 → 它产出的数」的浅底条（单件的假设投产比与规模试算、整盘的目标那条线）。
 * 单件与整盘两个组件的 ② 段共用这一条形态 —— README 里两处都叫它「试算条」。
 *
 * 与 `METRIC_CARD` 的分工：那条装的是**正式输入**，这条装的是**临时试算**（不进预设 / 快照 / CSV），
 * 底色浅一档就是为了在结果卡里跟参数卡区分开。
 */
export const TRIAL_BAR = 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2';

/**
 * 结果卡里的浅底容器：④ 的比率卡用它是「名称 + 大数字 + 公式代入」三行，
 * ② 段单件那三个定价数用它当三行列表的外壳（里面是 `TABLE_ROW`）。
 */
export const METRIC_CARD = 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5';

/** 指标卡的数值：等宽 + 定宽数字，几列并排时不会左右抖 */
export const METRIC_VALUE = 'font-mono text-lg leading-7 font-semibold tabular-nums text-gray-900';

/** 指标卡下方的公式代入行：等宽小字，能当场核对 */
export const METRIC_FORMULA = 'mt-0.5 font-mono text-[11px] leading-4 break-all text-gray-600';

/** 明细表的行：名称在左、数值在右，中间留空 */
export const TABLE_ROW = 'flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 last:border-b-0';

/** 明细表里「这是加回来的一项」用绿色，其余成本项用灰 */
export const TABLE_VALUE = 'shrink-0 font-mono text-xs tabular-nums text-gray-900';

/** 公式块：等宽、带底、可横向滚（长公式在窄屏不换行更好读） */
export const FORMULA_BLOCK =
	'overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-6 whitespace-pre text-gray-900';
