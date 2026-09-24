// 正则测试的类型、开关元数据与常用表达式 / 速查表数据。纯数据，不含逻辑。

/** 中央工作区的标签：测试文本 / 匹配详情 / 文本替换 / 代码生成 / 正则图解 */
export type WorkspaceTab = 'text' | 'matches' | 'replace' | 'code' | 'diagram';

/** 一条 flag 开关的展示信息 */
export interface FlagOption {
	flag: string;
	label: string;
	description: string;
}

/** 文本替换的一次完整结果 */
export interface ReplaceResult {
	/** 正则非法时的错误消息（其余字段为空壳） */
	error: string | null;
	/** 替换后的整段文本 */
	output: string;
	/** 实际替换了多少处 */
	count: number;
}

/** 六个常用 flag，顺序即界面展示顺序 */
export const FLAG_OPTIONS: ReadonlyArray<FlagOption> = [
	{ flag: 'g', label: '全局', description: '找出全部匹配；不勾只找第一个' },
	{ flag: 'i', label: '忽略大小写', description: '匹配时不区分大小写' },
	{ flag: 'm', label: '多行', description: '^ 和 $ 逐行生效' },
	{ flag: 's', label: 'dotAll', description: '点号也能匹配换行符' },
	{ flag: 'u', label: 'Unicode', description: '按 Unicode 码点处理， surrogate 对算一个字符' },
	{ flag: 'y', label: '粘性', description: '只从 lastIndex 处匹配，常用于分词' }
];

/** 一个捕获组的取值：name 是「1」这类编号或命名组的名字 */
export interface MatchGroup {
	name: string;
	value: string;
	/** 组存在但未参与匹配（如 (a)?b 匹配 b）时为 true */
	empty: boolean;
}

/** 单个匹配：位置、完整文本与捕获组 */
export interface MatchItem {
	index: number;
	text: string;
	groups: MatchGroup[];
}

/** 高亮分词的一段：matchIndex 为 null 是未匹配文本，否则是第几个匹配（用于交替配色） */
export interface Token {
	text: string;
	matchIndex: number | null;
}

/** 一次测试的完整结果 */
export interface TestResult {
	/** 正则非法时的错误消息（其余字段为空壳） */
	error: string | null;
	matches: MatchItem[];
	tokens: Token[];
	/** 命中 MAX_MATCHES 上限后被截断 */
	truncated: boolean;
}

// 默认示例与匹配上限在 `../config.ts`（STRUCTURE §2 B：可配置的业务参数集中到工具根目录）

/** 常用正则：点击填入 pattern（不含分隔符，按字面理解） */
export interface Preset {
	label: string;
	pattern: string;
	note: string;
	/** 这条要配特定旗标才成立时一并带上（如行首空白要 gm） */
	flags?: string;
}

export interface PresetGroup {
	title: string;
	items: Preset[];
}

/** 常用正则表达式，按场景分组；没有万能表达式，note 里写清它的边界 */
export const PRESET_GROUPS: ReadonlyArray<PresetGroup> = [
	{
		title: '联系方式',
		items: [
			{ label: '邮箱', pattern: '[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}', note: '常见邮箱地址' },
			{ label: '手机号', pattern: '1[3-9]\\d{9}', note: '大陆 11 位手机号' },
			{ label: '座机', pattern: '0\\d{2,3}-?\\d{7,8}', note: '区号 + 号码，连字符可选' },
			{
				label: '身份证',
				pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
				note: '18 位，末位可为 X；不校验校验位'
			},
			{ label: '邮政编码', pattern: '[1-9]\\d{5}(?!\\d)', note: '6 位数字，首位非 0' },
			{ label: 'QQ 号', pattern: '[1-9]\\d{4,10}', note: '5-11 位，首位非 0' },
			{ label: '微信号', pattern: '[a-zA-Z][a-zA-Z0-9_-]{5,19}', note: '字母开头，6-20 位' },
			{ label: '银行卡号', pattern: '\\d{16,19}', note: '16-19 位数字（不校验 Luhn）' },
			{ label: '中文姓名', pattern: '[\\u4e00-\\u9fa5·]{2,10}', note: '2-10 个汉字，含间隔号' }
		]
	},
	{
		title: '网络与地址',
		items: [
			{ label: 'URL', pattern: 'https?://[^\\s]+', note: 'http / https 链接' },
			{
				label: '域名',
				pattern: '(?:[a-z0-9-]+\\.)+[a-z]{2,}',
				note: '含子域名，不区分大小写',
				flags: 'gi'
			},
			{
				label: 'IPv4',
				pattern: '(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)',
				note: '四段都校验 0-255'
			},
			{ label: 'IPv6', pattern: '(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}', note: '完整八段写法' },
			{ label: 'MAC 地址', pattern: '(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}', note: '冒号分隔六段' },
			{
				label: '端口号',
				pattern: '0*(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])',
				note: '1-65535'
			},
			{ label: 'CIDR', pattern: '(?:\\d{1,3}\\.){3}\\d{1,3}/(?:[0-2]?\\d|3[0-2])', note: 'IPv4 CIDR 表示法' }
		]
	},
	{
		title: '时间与数字',
		items: [
			{
				label: '日期',
				pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])',
				note: 'YYYY-MM-DD，含月份与日期范围'
			},
			{ label: '时间', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?', note: 'HH:mm 或 HH:mm:ss' },
			{ label: '日期时间', pattern: '\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}', note: '日期 + 时间，空格或 T 分隔' },
			{ label: '整数', pattern: '[-+]?\\d+', note: '带正负号' },
			{ label: '小数', pattern: '[-+]?\\d*\\.\\d+', note: '必须带小数点' },
			{ label: '科学计数', pattern: '[-+]?\\d+(?:\\.\\d+)?[eE][-+]?\\d+', note: '如 1.23e-4' },
			{ label: '百分比', pattern: '[\\d.]+%', note: '整数或小数后跟百分号' },
			{ label: '金额', pattern: '¥?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?', note: '千分位 + 两位小数' },
			{
				label: 'HEX 颜色',
				pattern: '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b',
				note: '3 / 4 / 6 / 8 位十六进制'
			},
			{
				label: 'RGB 颜色',
				pattern: 'rgba?\\((?:\\d{1,3},\\s*){2,3}\\d{1,3}(?:,\\s*[\\d.]+)?\\)',
				note: 'rgb() / rgba()'
			}
		]
	},
	{
		title: '开发常用',
		items: [
			{
				label: 'UUID',
				pattern: '[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}',
				note: '8-4-4-4-12 形状',
				flags: 'gi'
			},
			{ label: 'JWT', pattern: 'eyJ[\\w-]*\\.[\\w-]*\\.[\\w-]*', note: '三段 Base64URL' },
			{
				label: 'Base64',
				pattern: '(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?',
				note: '标准字母表，带 = 填充'
			},
			{ label: 'HTML 标签', pattern: '</?([a-zA-Z][\\w-]*)\\b[^>]*>', note: '第 1 组即标签名' },
			{ label: 'HTML 注释', pattern: '<!--[\\s\\S]*?-->', note: '非贪婪，可跨行' },
			{ label: '命名分组', pattern: '(?<year>\\d{4})-(?<month>\\d{2})', note: '演示 (?<名字>…) 的写法' },
			{ label: 'SQL 字符串', pattern: "'(?:[^']|'')*'", note: "单引号包裹，'' 转义" },
			{ label: 'Markdown 标题', pattern: '^#{1,6}\\s+.+', note: '# 到 ###### 开头', flags: 'gm' },
			{ label: '代码注释', pattern: '(?://|#)(?!--).*', note: '单行注释 // 或 #，不含 shebang' },
			{ label: '代码块注释', pattern: '/\\*[\\s\\S]*?\\*/', note: '/* ... */ 多行注释' }
		]
	},
	{
		title: '文本处理',
		items: [
			{ label: '中文字符', pattern: '[\\u4e00-\\u9fa5]', note: '常用汉字区间' },
			{ label: '重复单词', pattern: '\\b(\\w+)\\s+\\1\\b', note: '反向引用：连续重复的同一个词' },
			{ label: '行首空白', pattern: '^\\s+', note: '每行开头，需 m 旗标', flags: 'gm' },
			{ label: '行尾空白', pattern: '\\s+$', note: '每行结尾，需 m 旗标', flags: 'gm' },
			{
				label: '用户名',
				pattern: '^[a-zA-Z][a-zA-Z0-9_]{3,15}$',
				note: '字母开头 4-16 位，逐行匹配',
				flags: 'gm'
			},
			{
				label: '强密码',
				pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,20}$',
				note: '大小写 + 数字 + 符号，8-20 位',
				flags: 'gm'
			},
			{
				label: '车牌号',
				pattern: '[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5}',
				note: '大陆车牌（含新能源）'
			},
			{ label: '空白行', pattern: '^\\s*$', note: '整行只有空白', flags: 'gm' },
			{ label: '连续空白', pattern: '[ \\t]{2,}', note: '两个以上空格或制表符' },
			{ label: '首尾空白', pattern: '^\\s+|\\s+$', note: 'trim 掉首尾空白', flags: 'gm' }
		]
	}
];

/**
 * 一条本地保存的表达式（`ui/PresetCard.svelte` 的「我的保存」一组）。
 * id 只在运行期内递增，落盘时去掉 —— 存的是「名字 + 表达式 + 修饰符」三件套。
 * input 是可选的第四件：存了测试文本的条目点击时会连同测试文本一起还原。
 */
export interface SavedPreset {
	id: number;
	name: string;
	pattern: string;
	flags: string;
	/**
	 * 一并存下来的测试文本。**没有这个字段**（含旧数据）代表这条没存文本，
	 * 点击时保持当前测试文本不动 —— 判断一律写 `input !== undefined`，不能用真假值，
	 * 空字符串也是有意义的（当时确实存了一段空文本）。
	 */
	input?: string;
}

/** 速查表一条：token 是显示文本，insert 是点一下真正插进正则栏的内容（省略同 token） */
export interface CheatItem {
	token: string;
	desc: string;
	/** 占位符写法（如 (?<name>…)）要给出可直接用的插入文本 */
	insert?: string;
	/** 修饰符条目：点一下是切换修饰符，不往正则栏插文本 */
	flag?: string;
}

/** 速查表的一组 */
export interface CheatGroup {
	title: string;
	items: CheatItem[];
}

/** 正则速查表：点语法插到光标处，点旗标直接切换。说明控制在 8 个字左右，栏窄也能一行放下 */
export const CHEAT_GROUPS: ReadonlyArray<CheatGroup> = [
	{
		title: '字符类',
		items: [
			{ token: '.', desc: '任意字符（s 下含换行）' },
			{ token: '\\d', desc: '数字 0-9' },
			{ token: '\\D', desc: '非数字' },
			{ token: '\\w', desc: '字母数字下划线' },
			{ token: '\\W', desc: '非单词字符' },
			{ token: '\\s', desc: '空白字符' },
			{ token: '\\S', desc: '非空白' },
			{ token: '[\\s\\S]', desc: '任意字符含换行' },
			{ token: '[abc]', desc: 'a 或 b 或 c' },
			{ token: '[^abc]', desc: '不是 a/b/c' },
			{ token: '[a-z]', desc: 'a 到 z 的范围' },
			{ token: '[\\u4e00-\\u9fa5]', desc: '一个中文字符' },
			{ token: '\\p{L}', desc: '任意文字（需 u）' },
			{ token: '[\\b]', desc: '退格符' }
		]
	},
	{
		title: '锚点与边界',
		items: [
			{ token: '^', desc: '开头（m 下每行首）' },
			{ token: '$', desc: '结尾（m 下每行尾）' },
			{ token: '\\b', desc: '单词边界' },
			{ token: '\\B', desc: '非单词边界' },
			{ token: '^\\s*$', desc: '空行（需 m 旗标）' }
		]
	},
	{
		title: '量词',
		items: [
			{ token: '*', desc: '0 次或多次' },
			{ token: '+', desc: '1 次或多次' },
			{ token: '?', desc: '0 或 1 次' },
			{ token: '{3}', desc: '恰好 3 次' },
			{ token: '{2,}', desc: '至少 2 次' },
			{ token: '{1,3}', desc: '1 到 3 次' },
			{ token: '*?', desc: '惰性匹配' },
			{ token: '+?', desc: '惰性的 1 次以上' },
			{ token: '{1,3}?', desc: '惰性区间' },
			{ token: '*+', desc: '占有优先（不支持会报错）' }
		]
	},
	{
		title: '分组与引用',
		items: [
			{ token: '(…)', desc: '捕获组', insert: '()' },
			{ token: '(?:…)', desc: '非捕获组', insert: '(?:)' },
			{ token: '(?<name>…)', desc: '命名捕获组', insert: '(?<name>)' },
			{ token: '\\1', desc: '引用第 1 个组' },
			{ token: '\\k<name>', desc: '引用命名组' },
			{ token: 'a|b', desc: '或者', insert: '|' }
		]
	},
	{
		title: '断言',
		items: [
			{ token: '(?=…)', desc: '后面是…', insert: '(?=)' },
			{ token: '(?!…)', desc: '后面不是…', insert: '(?!)' },
			{ token: '(?<=…)', desc: '前面是…', insert: '(?<=)' },
			{ token: '(?<!…)', desc: '前面不是…', insert: '(?<!)' }
		]
	},
	{
		title: '修饰符',
		items: [
			{ token: 'g', desc: '找全部匹配', flag: 'g' },
			{ token: 'i', desc: '忽略大小写', flag: 'i' },
			{ token: 'm', desc: '^$ 逐行生效', flag: 'm' },
			{ token: 's', desc: '点号匹配换行', flag: 's' },
			{ token: 'u', desc: '按码点处理', flag: 'u' },
			{ token: 'y', desc: '从 lastIndex 起', flag: 'y' },
			{ token: 'd', desc: '每组起止位置', flag: 'd' },
			{ token: 'v', desc: 'Unicode 集合运算', flag: 'v' }
		]
	},
	{
		title: '转义与替换',
		items: [
			{ token: '\\\\', desc: '反斜杠' },
			{ token: '\\.', desc: '点号' },
			{ token: '\\t', desc: '制表符' },
			{ token: '\\n', desc: '换行符' },
			{ token: '\\u{1F600}', desc: '按码点写（需 u）' },
			{ token: '$1', desc: '替换：第 1 组' },
			{ token: '$<name>', desc: '替换：命名组' },
			{ token: '$&', desc: '替换：整段匹配' },
			{ token: '$`', desc: '替换：匹配前的文本' },
			{ token: "$'", desc: '替换：匹配后的文本' }
		]
	}
];
