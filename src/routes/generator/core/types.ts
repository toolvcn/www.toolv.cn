// 随机生成器的类型、字符集与词表。生成算法在 random.ts。
// 随机源可注入（RandomSource），单测用确定性序列断言，运行时走 crypto.getRandomValues。
//
// 可配置的业务参数（默认值 / 上下限 / 档位区间 / 强度切界）在**根层的 `config.ts`**，不在这里。
// 字符集与词表留在本文件：改它是改产出内容，不是改行为。

/** 32 位随机字供应器：要几个给几个 */
export type RandomSource = (wordCount: number) => Uint32Array;

/** 密码的字符集勾选项 + 可选自定义字符集 */
export interface PasswordOptions {
	length: number;
	lower: boolean;
	upper: boolean;
	digits: boolean;
	symbols: boolean;
	/** 追加到预设池的自定义字符（已去重、非空） */
	customCharset?: string;
	/** 排除肉眼易混淆的字符（0 O o 1 l I |） */
	avoidAmbiguous: boolean;
}

/** 随机数列表的选项 */
export interface NumberOptions {
	min: number;
	max: number;
	count: number;
	/** 小数位数，0 即整数 */
	decimals: number;
	/** 整数模式下去重（小数模式下忽略） */
	unique: boolean;
	sorted: boolean;
}

/** 假文的语言与粒度 */
export type LoremLang = 'latin' | 'zh';
export type LoremMode = 'sentences' | 'paragraphs';

export interface LoremOptions {
	lang: LoremLang;
	mode: LoremMode;
	count: number;
}

/** 生成结果：UUID / 密码逐行一条；随机数与假文是整块文本 */
export interface GenerateResult {
	lines: string[];
	text: string;
}

// ---------------------------------------------------------------- 字符集

export const CHAR_LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const CHAR_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CHAR_DIGITS = '0123456789';
/** 键盘常见符号，避开引号反斜杠这类复制粘贴容易出事的 */
export const CHAR_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~';
/** 肉眼易混淆字符：0 O o 1 l I | （大小写各留安全的） */
export const AMBIGUOUS_CHARS = '0Oo1lI|';

// ---------------------------------------------------------------- 假文词表

/** 经典 Lorem 词表（重复取词即可拼句，无需语法） */
export const LATIN_WORDS: ReadonlyArray<string> = [
	'lorem',
	'ipsum',
	'dolor',
	'sit',
	'amet',
	'consectetur',
	'adipiscing',
	'elit',
	'sed',
	'do',
	'eiusmod',
	'tempor',
	'incididunt',
	'ut',
	'labore',
	'et',
	'dolore',
	'magna',
	'aliqua',
	'enim',
	'ad',
	'minim',
	'veniam',
	'quis',
	'nostrud',
	'exercitation',
	'ullamco',
	'laboris',
	'nisi',
	'aliquip',
	'ex',
	'ea',
	'commodo',
	'consequat',
	'duis',
	'aute',
	'irure',
	'in',
	'reprehenderit',
	'voluptate',
	'velit',
	'esse',
	'cillum',
	'eu',
	'fugiat',
	'nulla',
	'pariatur',
	'excepteur',
	'sint',
	'occaecat',
	'cupidatat',
	'non',
	'proident',
	'sunt',
	'culpa',
	'qui',
	'officia',
	'deserunt',
	'mollit',
	'anim',
	'id',
	'est',
	'laborum'
];

/** 中文假文的常用字池：随机组词拼句，视觉上像中文正文即可 */
export const ZH_CHARS: ReadonlyArray<string> =
	'的一是了我不人在他有这上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼等体却加电主界门利海受听表德少克代员许稜先口由死安写性马光白或住难望教命花结乐色更拉东神记处让母父应直字场平报友关放至张认接告入笑内英军候民岁往何度山觉路带万男边风解叫任金快原吃妈变通师立象数四失满战远格士音轻目条呢病始达深完今提求清王化空业思切怎非找片罗钱吗语元喜曾离飞科言干流欢约各即指合反题必该论交终林请医晚制球决窢传画保读运及则房早院量苦火布品近坐产答星精视五连司巴奇管类未朋且婚台夜青北队久乎越观落尽形影红爸百令周吧识步希亚术留市半热送兴造谈容极随演收首根讲整式取照办强石古华諣拿计您装似足双妻尼转诉米称丽客南领节衣站黑刻统断福城故历惊脸选包紧争另建维绝树系伤示愿持千史谁准联妇纪基买志静阿诗独复痛消社算义竟确酒需单治卡幸兰念举仅钟怕共毛句息功官待究跟穿室易游程号居考突皮哪费倒价图具刚脑永歌响商礼细专黄块脚味灵改据般破引食仍存众注笔甚某沉血备习校默务土微娘须试怀料调广蜖苏显赛查密议底列富梦错座参八除跑亮假印设线温虽掉京初养香停际致阳纸李纳验助激够严证帝饭忘趣支春集丈木研班普导顿睡展跳获艺六波察群皇段急庭创区奥器谢弟店否害草排背止组州朝封睛板角况曲馆育忙质河续哥呼若推境遇雨标姐充围案伦护冷警贝著雪索剧啊船险烟依斗值帮汉慢佛肯闻唱沙局伴学春夏秋冬东南西北'.split(
		''
	);

/** 拉丁假文的经典起始（开启时第一句固定，一眼像 Lorem ipsum） */
export const LATIN_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';
