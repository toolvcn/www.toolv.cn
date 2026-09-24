// 正则测试的 UI 样式常量。Button 在 $lib/ui（含焦点环、禁用态）。

/** 正则输入条：斜杠 + 表达式 + 旗标后缀，整条看起来就是一个 /…/g */
export const PATTERN_BOX_OK =
	'flex h-11 w-full items-center rounded-lg border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:outline-none';
export const PATTERN_BOX_INVALID =
	'flex h-11 w-full items-center rounded-lg border border-red-400 bg-white focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:outline-none';
/** 前后的 / 与旗标后缀：纯装饰，但能提示「不用自己写分隔符」 */
export const PATTERN_DELIMITER = 'shrink-0 px-2.5 font-mono text-base text-gray-500';
export const PATTERN_INPUT =
	'min-w-0 flex-1 bg-transparent font-mono text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none';

/** 旗标 / 片段小按钮里嵌的字母：扫读时先认字母再认中文（chip 本体在 $lib/ui/styles.ts 的 CHIP_ON / CHIP_OFF） */
export const TOGGLE_KEY = 'font-mono text-sm';

/**
 * 编辑区与镜像层的共用排版。两层必须逐字对齐（字体、行高、内边距、断行规则、
 * 滚动条占位），差一点高亮就会飘。
 * scrollbar-gutter: stable —— 让两层同时预留（或同时不预留）滚动条宽度。
 * 内边距 8px：两层共用这一条，改一处两边同步；与 `EditorBox` 框内其它编辑层同档。
 * 外框在 `$lib/components/EditorBox`（边框 / 底色 / 聚焦转蓝），这里只管编辑器内部排版。
 */
export const EDITOR_TYPE =
	'w-full p-2 font-mono text-sm leading-6 break-words break-all whitespace-pre-wrap [scrollbar-gutter:stable]';
/** 真正的输入层：文字透明，看到的字来自镜像层；光标与选区仍然可见 */
export const EDITOR_INPUT =
	EDITOR_TYPE +
	' relative h-full resize-none bg-transparent text-transparent caret-gray-900 placeholder:text-gray-500 focus:outline-none';
/** 只读镜像层：同样的排版，只负责上色 */
export const EDITOR_MIRROR = EDITOR_TYPE + ' pointer-events-none absolute inset-0 overflow-hidden text-gray-900';

/** 条目本体：移动端是 chip（h-8），桌面竖排成两行（标签 + 说明） */
const ITEM_BASE =
	'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none max-lg:w-auto lg:h-auto lg:flex-col lg:items-start lg:gap-0.5 lg:py-2';
/** 片段条目 */
export const PRESET_ITEM = `${ITEM_BASE} w-full border-gray-300 hover:bg-gray-50`;
/** 当前正则与片段一致时的高亮：只做视觉提示，不是开关，所以不用 aria-pressed */
export const PRESET_ITEM_CURRENT = `${ITEM_BASE} w-full border-blue-300 bg-blue-50 hover:bg-blue-100`;
/**
 * 已保存条目：同一套版式，桌面改成可伸可缩（删除按钮绝对定位在条目右下角）。
 * `lg:flex-1` 而不是 `flex-1`：移动端是 chip，宽度得跟着内容走，
 * 给了 basis:0 的 flex-1 会在这种「宽度由内容决定」的容器里被压成 0。
 * `lg:pr-7` 给右下角的删除按钮留位，避免两行文字从它下面穿过去。
 */
export const SAVED_ITEM = `${ITEM_BASE} min-w-0 border-gray-300 hover:bg-gray-50 lg:flex-1 lg:pr-7`;
export const SAVED_ITEM_CURRENT = `${ITEM_BASE} min-w-0 border-blue-300 bg-blue-50 hover:bg-blue-100 lg:flex-1 lg:pr-7`;
export const PRESET_LABEL = 'text-xs font-medium text-gray-900';
export const PRESET_NOTE = 'hidden text-[11px] leading-4 text-gray-600 lg:block';
/** 已保存条目的两行：名称可能是表达式本体（很长），必须能截断 */
export const SAVED_LABEL = 'max-w-full truncate text-xs font-medium text-gray-900';
export const SAVED_NOTE = 'hidden max-w-full truncate font-mono text-[11px] leading-4 text-gray-600 lg:block';

/** 匹配高亮的交替底色：相邻匹配一眼分得开 */
export const HIGHLIGHT_EVEN = 'rounded bg-blue-100 text-gray-900';
export const HIGHLIGHT_ODD = 'rounded bg-amber-100 text-gray-900';

/** 匹配行的行号徽标 */
export const MATCH_BADGE =
	'inline-flex h-6 shrink-0 items-center rounded bg-gray-100 px-1.5 text-xs font-semibold text-gray-600 tabular-nums';
/** 捕获组小标签 */
export const GROUP_CHIP =
	'inline-flex max-w-full items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-xs';

/** 速查表：一组（标题 + 若干条），组间用细线分开 */
export const CHEAT_GROUP = 'flex min-w-0 flex-col gap-1.5 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0';
export const CHEAT_TITLE = 'px-1.5 pb-0.5 text-xs font-semibold text-gray-600';
/** 分组标题后面跟的条数：同一行、不加粗、浅一档，不跟标题抢镜头 */
export const CHEAT_COUNT = 'ml-1 font-normal text-gray-500';

/**
 * 速查表条目：**一行两条**（右栏只有 21rem，七组 57 条单行铺开要滚很久），
 * 所以条目内部改成上下两行 —— token 一行、说明一行。
 * 不继续横排（token 左 + 说明右）是因为两列后每条只有 ~150px 宽，
 * 减去 token 与间距，说明只剩三四个字，等于没有。
 */
export const CHEAT_ITEM =
	'flex w-full flex-col items-start gap-0.5 rounded-lg border border-gray-200 px-2 py-1.5 text-left hover:border-blue-300 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-colors';
/** token：占满自己那一行，超长截断（完整文本在 title 里） */
export const CHEAT_TOKEN = 'max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-900';
/** 修饰符条目开启时：整块 token 变蓝，配合 aria-pressed 表达开关 */
export const CHEAT_TOKEN_ON = 'max-w-full truncate rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[11px] text-white';
export const CHEAT_DESC = 'w-full truncate text-[11px] text-gray-600';

// 工作区标签条已提到 $lib/components/Tabs（variant="line"），WS_TAB 那条常量随之删除。
// 各标签内容区顶部的通栏工具条（TAB_TOOLBAR）已提到 $lib/ui/styles.ts —— http 的代码生成
// 与 cURL 两个标签用同一串，原是两工具各一份逐字相同的副本。
// 代码生成标签页已提到 $lib/components/CodegenTab（与 http 共用一件）。

// 文本替换输入框已改用 $lib/ui/Input（mono + 默认 md 档）。

// 深底代码块已提到 $lib/ui/styles.ts 的 CODE_BLOCK（regex 与 http 各有一块，原先是两份）。

// ------------------------------------------------------------ 正则图解

/** 图解里字面量的小片 */
export const DIAG_LITERAL =
	'inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-900';
/** 转义序列：token 蓝色，说明小字跟在后面 */
export const DIAG_ESCAPE =
	'inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700';
/** 锚点 ^ $ */
export const DIAG_ANCHOR =
	'inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-700';
/** 反向引用 */
export const DIAG_BACKREF =
	'inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 font-mono text-xs text-purple-700';
/** 点号：一个小圆点 */
export const DIAG_DOT =
	'inline-flex size-4 items-center justify-center rounded-full bg-gray-200 font-mono text-[10px] font-bold text-gray-700';
/** 字符类盒：token 原样显示（自带方括号） */
export const DIAG_CLASS =
	'inline-flex items-center rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700';
/** 组盒子：捕获（含命名）绿边 / 非捕获灰边 / 正向环视蓝虚线 / 负向环视红虚线 */
export const DIAG_GROUP_CAPTURE =
	'inline-flex flex-col items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5';
export const DIAG_GROUP_NONCAPTURE =
	'inline-flex flex-col items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5';
export const DIAG_GROUP_LOOK =
	'inline-flex flex-col items-center gap-1 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-2 py-1.5';
export const DIAG_GROUP_LOOK_NEG =
	'inline-flex flex-col items-center gap-1 rounded-lg border border-dashed border-red-300 bg-red-50 px-2 py-1.5';
/** 组角标：说明这组是捕获还是环视 */
export const DIAG_GROUP_LABEL = 'text-[10px] font-semibold tracking-wide';
/** 量词角标：深底小字挂在节点右上角 */
export const DIAG_QUANT =
	'absolute -right-2 -top-2 rounded bg-gray-900 px-1 font-mono text-[10px] leading-4 text-white';
/** 图解的说明小字（如「数字」） */
export const DIAG_NOTE = 'text-[10px] text-gray-600';
