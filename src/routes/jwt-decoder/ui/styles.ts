// JWT 解码工具独有的 UI 样式常量。
// 版式常量（TOOLBAR / FOOTER_BAR / OUTPUT_EMPTY / PANEL_HINT 等）是 5 个工具共用的，
// 已提升到 `$lib/ui/styles.ts`，高亮配色也一并提到那边的 JSON_TOKEN_CLASS，
// 这里只留本工具独有的原文输入、JSON 排版与声明表。

/**
 * JWT 原文编辑区的**布局**（外观归 `EditorBox`）：
 * 移动端定高不撑卡片（堆叠时页面别太长）；lg 起与验签卡并排、两块等高，
 * 这里改吃满卡片高度，免得卡片底部空一块。break-all 因为 token 是无空格长串，
 * 不断行会撑出横向滚动。
 */
export const TOKEN_TEXTAREA = 'h-28 min-h-0 break-all md:h-24 lg:h-auto lg:flex-1';

/**
 * Header / Payload 的 JSON 展示块外层。
 * **lg 以下（页面自然流）**：`min-h-40` 给空态留出一块高度，`max-h-[45vh]` 让长内容在块内滚
 * —— 堆叠时内容长会把整页撑得很长。
 * **lg 起（满屏版式）**：卡片高度由栅格分配，`min-h-0` 交出去；上限放到 60vh
 * （与 `PANEL_SCROLL` 同档）—— 封顶是给「内容很长」用的，同时避免高视口下把卡片拉成空壳：
 * 短内容时这块跟着卡片长，长内容时在块内滚、页面不被撑长。
 * 两块共用；可聚焦滚动的 tabindex / role 由调用方给。
 */
export const JSON_BOX = 'relative min-h-40 max-h-[45vh] flex-1 overflow-y-auto lg:min-h-0 lg:max-h-[60vh]';

/**
 * Header / Payload 的 JSON 展示块：交给 $lib/components/CodeView 渲染，版式在这里给。
 * 跟原文 textarea 同款 p-4 + 等宽，两个区块上下对齐。
 */
export const JSON_PRE = 'p-4 font-mono text-xs leading-5 whitespace-pre text-gray-900 sm:text-sm sm:leading-6';

/**
 * 注册声明表的外层滚动容器（行间分隔线由内层 `<dl>` 的 divide 给，最后一行不会多出一条线）；
 * 声明最多 7 条，封顶口径与 `JSON_BOX` 一致：移动端 45vh、lg 起 60vh，超出的自己滚。
 */
export const CLAIM_LIST = 'min-h-0 max-h-[45vh] flex-1 overflow-y-auto lg:max-h-[60vh]';

/**
 * 声明表的一行：左标签右值，值过长时换行而不是把标签挤走；
 * 行尾的状态徽章（有效中 / 已过期）由 `<Badge>` 给，不在这里定色。
 */
export const CLAIM_ROW = 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2';

/**
 * 验签卡的密钥输入区：共享密钥是一行长串、PEM 公钥是多行，都给固定高度不撑卡片；
 * break-all 因为两者都可能是不含空格的长串（Base64 密钥）。
 */
export const VERIFY_KEY_TEXTAREA = 'h-20 min-h-0 break-all';

/** 验签卡里的说明行：比正文弱一档、比占位符强，多行说明要留出行距 */
export const VERIFY_HINT = 'text-xs leading-5 text-gray-600';

/** 结论区的一行：左标签右徽章，标签不被长值挤走 */
export const VERIFY_ROW = 'flex items-center justify-between gap-3';

/** 结论区本体：三行结论 + 一句说明，纵向排开 */
export const VERIFY_RESULT = 'flex min-w-0 flex-col gap-2';
