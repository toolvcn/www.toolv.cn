// 随机生成器的**可配置参数**：四个标签的默认值、各自的上下限、假文的档位区间与强度切界。
// 要调这一页的行为（比如把密码长度从 64 放宽到 128），改这里就够了 —— 不必去 core/ 与 ui/ 里翻。
//
// 边界（免得这个文件越长越杂，也免得下一个人不知道某样东西该不该放进来）：
//   - 只放**业务数值与开关**。选项类型在 `core/types.ts`；字符集与假文词表是**语料**，
//     改它是改产出内容而不是改行为，留在 `core/types.ts`；界面文案（按钮 / 提示句）在各 `ui/` 组件
//     —— 都不进这里。
//   - 界面里那几个区间（「数量要是 1-10000 的整数」「长度要是 4-64 的整数」）**文案留在 ui、数字从这里拼**：
//     文案归文案，数字只此一处，改上限才不会漏改提示句。
//   - 纯数据、不碰 DOM：`core/*` 与 `ui/*` 都能读，node 环境的单测也能直接用。
//
// 放在工具根目录（不在 `core/` 下）：它是**面向人的调参入口**，跟 `+page.svelte` 同级最好找；
// 与 STRUCTURE §1「逻辑进 core/」的偏离是有意的，理由是「让人一眼看到去哪改」。

// ---------------------------------------------------------------- 默认值

/** 以下都是字符串：跟输入框绑定的就是字符串，别在这里转数字再让 ui 转回去 */
export const DEFAULT_UUID_COUNT = '5';
export const DEFAULT_PASS_LENGTH = '16';
export const DEFAULT_PASS_COUNT = '3';
export const DEFAULT_NUM_MIN = '1';
export const DEFAULT_NUM_MAX = '100';
export const DEFAULT_NUM_COUNT = '10';
export const DEFAULT_NUM_DECIMALS = '0';
export const DEFAULT_LOREM_COUNT = '3';

// ---------------------------------------------------------------- 上限与区间

/**
 * 所有 Tab 的数量上限：**10000 是硬上限**，超过即判非法、生成按钮直接禁用。
 *
 * 这一页的数量按「两层」管：`COUNT_WARN` 的二次确认挡手滑，这里的硬上限挡
 * 「点掉 confirm 再填 10 万」——生成是同步的，会卡住主线程出几秒白屏。
 * 10000 条 UUID / 密码在手机上仍是秒级，日常拿不到这个数，但机器能守住。
 * 四个面板的提示句都写成「数量要是 1-10000 的整数」，**数字从这里取**（只此一处）。
 */
export const COUNT_MAX = 10000;

/** 数量下限：正整数，0 与负数都判非法 */
export const COUNT_MIN = 1;

/** 二次确认阈值：数量在 (COUNT_WARN, COUNT_MAX] 之间时，生成前弹 confirm 提醒可能卡顿 */
export const COUNT_WARN = 500;

/** 快捷数量档位：给数量右侧的一键填入按钮用 */
export const QUICK_COUNTS: ReadonlyArray<number> = [10, 50, 100, 500];

/** UUID 批量上限 */
export const MAX_UUID_COUNT = COUNT_MAX;

/** 密码长度区间：下限 4 = 四类字符各保底一个所需的最小长度 */
export const PASS_LENGTH_MIN = 4;
export const PASS_LENGTH_MAX = 64;

/** 密码批量上限 */
export const MAX_PASS_COUNT = COUNT_MAX;

/** 随机数范围：±10 亿。再大浮点取整已经不稳，也超出了「抽个数」的用途 */
export const NUM_VALUE_MIN = -1e9;
export const NUM_VALUE_MAX = 1e9;

/** 随机数批量上限 */
export const MAX_NUM_COUNT = COUNT_MAX;

/** 小数位区间：0 即整数；6 位是 toFixed 能给的位数上限 */
export const DECIMALS_MIN = 0;
export const DECIMALS_MAX = 6;

/** 假文批量上限（句子模式下是句数，段落模式下是段数） */
export const MAX_LOREM_COUNT = COUNT_MAX;

// ---------------------------------------------------------------- 假文的档位区间

/** 一句拉丁假文的词数区间：短了不像句子，长了读着累 */
export const LATIN_WORDS_PER_SENTENCE = { min: 6, max: 14 };

/** 一句中文假文的字数区间 */
export const ZH_CHARS_PER_SENTENCE = { min: 10, max: 28 };

/** 一个段落的句子数区间 */
export const SENTENCES_PER_PARAGRAPH = { min: 3, max: 6 };

// ---------------------------------------------------------------- 强度档位

/**
 * 密码强度的五档：按熵（bits）切界。
 * 阈值是参数、档位名跟着档位走（不是界面文案），所以整表放这里而不拆开。
 */
export const STRENGTH_LEVELS: ReadonlyArray<{ min: number; label: string }> = [
	{ min: 0, label: '极弱' },
	{ min: 28, label: '弱' },
	{ min: 36, label: '中等' },
	{ min: 60, label: '强' },
	{ min: 128, label: '极强' }
];
