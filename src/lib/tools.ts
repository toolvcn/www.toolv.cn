import {
	Activity,
	ArrowRightLeft,
	Banknote,
	Binary,
	Braces,
	Calculator,
	CalendarDays,
	CaseSensitive,
	CircleCheckBig,
	Clock,
	Clock3,
	Code,
	Columns2,
	Container,
	Database,
	Dices,
	Diff,
	FileCode,
	FileText,
	Gauge,
	GitBranch,
	Hash,
	Hourglass,
	KeyRound,
	Languages,
	Layers,
	Link,
	ListChecks,
	Lock,
	Monitor,
	Network,
	Palette,
	Percent,
	PictureInPicture,
	Radio,
	Regex,
	RotateCw,
	Ruler,
	Send,
	Server,
	ShieldCheck,
	ShoppingCart,
	SquareTerminal,
	Table,
	Terminal,
	TrendingUp,
	Zap
} from '@lucide/svelte';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { LucideIcon } from '@lucide/svelte';

/** 已上线工具的站内路径。写成字面量联合，resolve(tool.path) 才能过类型检查 */
export type ToolPath =
	| '/http'
	| '/websocket'
	| '/json-formatter'
	| '/base64'
	| '/hash-calculator'
	| '/url-encoder'
	| '/html-entity'
	| '/morse'
	| '/crypto'
	| '/case-converter'
	| '/text-diff'
	| '/jwt-decoder'
	| '/rmb-uppercase'
	| '/timestamp-converter'
	| '/radix-converter'
	| '/text-tools'
	| '/json-to-ts'
	| '/csv-json'
	| '/date-calculator'
	| '/calculator'
	| '/interest-calculator'
	| '/subnet-calculator'
	| '/cheatsheet'
	| '/color-converter'
	| '/regex'
	| '/unit-converter'
	| '/generator'
	| '/device-info'
	| '/ecommerce-roi'
	| '/clock'
	| '/docker'
	| '/git'
	| '/linux'
	| '/htaccess-to-nginx'
	| '/sql'
	| '/dns';

/**
 * 工具路径 → 站内 href（带 base 前缀）。
 *
 * 为什么不直接在组件里写 `resolve(tool.path)`：`resolve()` 的入参是按路由**逐个展开的元组联合**，
 * TS 只在联合成员数不超过 25 时能完成匹配 —— 工具数涨到 26（新增 `/docker` 那次）起就报
 * 「Argument of type '[ToolPath]' is not assignable to parameter of type ...」。这个上限来自 TS 本身，
 * 绕不开，所以转换收在这一处：类型上借用 `/`（静态路由），**运行时传的仍是真实路径**，
 * 而 resolve 只做「base 前缀拼接」这一件事，取哪个静态路由当类型都一样。
 *
 * 返回类型是 `ResolvedPathname`，所以组件里可以直接把它绑到 `href`
 * （满足 eslint 的 `svelte/no-navigation-without-resolve`，不必在调用点再包一层）。
 */
export function toolHref(path: ToolPath): ResolvedPathname {
	return resolve(path as '/');
}

/** 工具卡片上的一个标签（图标 + 短文案） */
export interface ToolTag {
	icon: LucideIcon;
	label: string;
}

export interface Tool {
	name: string;
	path: ToolPath;
	icon: LucideIcon;
	desc: string;
	tags: ToolTag[];
	/** 星标：功能特别完整、值得优先展示的工具 */
	featured?: boolean;
}

export interface ToolCategory {
	id: string;
	name: string;
	icon: LucideIcon;
	tools: Tool[];
}

/** 首页工具卡片、分类侧栏与工具页菜单的同一份数据源；分类口径与 README 工具列表一致 */
export const TOOL_CATEGORIES: ToolCategory[] = [
	{
		id: 'network',
		name: '网络调试',
		icon: Radio,
		tools: [
			{
				name: 'HTTP 请求调试',
				path: '/http',
				featured: true,
				icon: Send,
				desc: '方法 / URL / Headers / Body 构造请求并查看响应，cURL 命令与表单双向互转，HTTP 状态码速查；默认本地发送，可选服务器代发测速。',
				tags: [
					{ icon: Send, label: '请求发送' },
					{ icon: Terminal, label: 'cURL 互转' },
					{ icon: ListChecks, label: '状态码速查' }
				]
			},
			{
				name: 'WebSocket 在线调试',
				path: '/websocket',
				featured: true,
				icon: Activity,
				desc: '多连接并行管理、实时消息收发监控、JSON 高亮、定时发送、自动发送，一条连接一条日志，调试更高效。',
				tags: [
					{ icon: Radio, label: '多连接' },
					{ icon: Gauge, label: '延迟检测' },
					{ icon: Zap, label: '定时发送' }
				]
			}
		]
	},
	{
		id: 'format',
		name: '格式与校验',
		icon: CircleCheckBig,
		tools: [
			{
				name: '正则表达式测试',
				path: '/regex',
				featured: true,
				icon: Regex,
				desc: '实时匹配高亮、分组捕获逐条列出、八个常用片段一键填入，执行有界不挂死。',
				tags: [
					{ icon: Regex, label: '实时高亮' },
					{ icon: Layers, label: '分组捕获' },
					{ icon: Zap, label: 'SSR 首屏' }
				]
			},

			{
				name: 'JSON 格式化',
				path: '/json-formatter',
				featured: true,
				icon: Braces,
				desc: '格式化、压缩、校验 JSON 数据，语法高亮上色与错误行列定位，一行粘贴即时出结果。',
				tags: [
					{ icon: Braces, label: '格式化' },
					{ icon: Gauge, label: '压缩' },
					{ icon: Zap, label: '实时校验' }
				]
			}
		]
	},
	{
		id: 'codec',
		name: '编解码',
		icon: Binary,
		tools: [
			{
				name: 'Base64 编解码',
				path: '/base64',
				icon: Binary,
				desc: '文本与 Base64 互转，支持 URL-safe 模式与图片转 Data URL 预览，一键切换方向、复制结果。',
				tags: [
					{ icon: Binary, label: '文本互转' },
					{ icon: Gauge, label: 'URL-safe' },
					{ icon: Zap, label: '图片预览' }
				]
			},
			{
				name: 'URL 编解码',
				path: '/url-encoder',
				icon: Link,
				desc: '组件 / 整链两种编码策略，解码带非法字符定位；查询字符串与参数表格双向转换，改表即合成新串。',
				tags: [
					{ icon: Link, label: '编码解码' },
					{ icon: Gauge, label: '查询字符串' },
					{ icon: Zap, label: '参数表编辑' }
				]
			},
			{
				name: 'HTML 实体编解码',
				path: '/html-entity',
				icon: Code,
				desc: '命名实体与数字实体互转，转义范围与实体形式可调，解码宽容处理坏实体，写转义字符更省心。',
				tags: [
					{ icon: Code, label: '命名实体' },
					{ icon: Gauge, label: '数字实体' },
					{ icon: Zap, label: '范围可调' }
				]
			},
			{
				name: 'JWT 解码',
				path: '/jwt-decoder',
				icon: KeyRound,
				desc: '粘贴 token 即解出 Header 与 Payload，JSON 语法高亮，注册声明转本地时间并提示过期状态；可按 HS/RS 六档本地验签，密钥只在内存不落盘。',
				tags: [
					{ icon: KeyRound, label: '语法高亮' },
					{ icon: ShieldCheck, label: '本地验签' },
					{ icon: Zap, label: '过期提示' }
				]
			},
			{
				name: '摩斯密码速查与加解密',
				path: '/morse',
				icon: Radio,
				desc: '54 条摩斯码（字母 / 数字 / 标点）速查表点行插入，与文本双向实时转换，缺分隔符的不规范摩斯按最长匹配自动分词；点划与字母 / 词分隔符都能改，解不出的片段会在底栏点名。',
				tags: [
					{ icon: Radio, label: '54 条速查' },
					{ icon: ArrowRightLeft, label: '双向互转' },
					{ icon: Zap, label: '自动分词' }
				]
			}
		]
	},
	{
		id: 'crypto',
		name: '加解密',
		icon: ShieldCheck,
		tools: [
			{
				name: '加解密工具箱',
				path: '/crypto',
				icon: Lock,
				desc: 'AES-128 / 192 / 256（CBC / GCM / CTR，密钥与 IV 可设）、RSA 密钥生成与加解密签名验签（PKCS#8 / SPKI，与 openssl 通用）、HMAC 生成器，加上凯撒与维吉尼亚古典密码，五个工作区一页切换；全程走浏览器原生 WebCrypto，密钥与内容不离开本机。',
				tags: [
					{ icon: KeyRound, label: 'AES / RSA / HMAC' },
					{ icon: RotateCw, label: '古典密码' },
					{ icon: ShieldCheck, label: '本地计算' }
				]
			}
		]
	},
	{
		id: 'convert',
		name: '转换',
		icon: ArrowRightLeft,
		tools: [
			{
				name: 'JSON 转 TypeScript',
				path: '/json-to-ts',
				icon: FileCode,
				desc: '粘贴 JSON 样例自动生成 interface，对象数组合并、缺失键标可选，嵌套命名可读，根名与 export 可调。',
				tags: [
					{ icon: FileCode, label: '实时生成' },
					{ icon: Gauge, label: '可选键推导' },
					{ icon: Zap, label: '错误行列' }
				]
			},
			{
				name: 'CSV ↔ JSON 转换',
				path: '/csv-json',
				featured: true,
				icon: Table,
				desc: 'CSV 与 JSON 双向互转，RFC 4180 引号转义完整支持，分隔符可换，值类型自动推断，键并集补空。',
				tags: [
					{ icon: Table, label: '双向互转' },
					{ icon: Braces, label: '引号转义' },
					{ icon: Zap, label: '类型推断' }
				]
			},
			{
				name: '时间戳转换',
				path: '/timestamp-converter',
				icon: Clock3,
				desc: '秒 / 毫秒时间戳与本地时间互转，打开就填当前时间，自动识别单位，支持 1970 年之前；可填两个时间戳对比差值，附多时区世界时钟对照。',
				tags: [
					{ icon: Clock3, label: '互转' },
					{ icon: Gauge, label: '世界时钟' },
					{ icon: Zap, label: '一键现在' }
				]
			},
			{
				name: '进制转换',
				path: '/radix-converter',
				icon: Binary,
				desc: '二进制、八进制、十进制、十六进制、三十六进制五种进制实时互转，BigInt 运算，任意大整数不丢精度。',
				tags: [
					{ icon: Binary, label: '0b 0x' },
					{ icon: Gauge, label: '5 种进制' },
					{ icon: Zap, label: '任意大整数' }
				]
			},
			{
				name: '颜色转换',
				path: '/color-converter',
				icon: Palette,
				desc: 'HEX / RGB / HSL 互转，透明度写法照收；内置 WCAG 对比度检查，AA / AAA 四档判定。',
				tags: [
					{ icon: Palette, label: '三种格式' },
					{ icon: ShieldCheck, label: '对比度检查' },
					{ icon: Zap, label: '实时解析' }
				]
			},
			{
				name: '单位换算',
				path: '/unit-converter',
				icon: Ruler,
				desc: '长度 / 面积 / 体积 / 重量 / 温度 / 速度 / 时间 / 角度 / 力 / 压力 / 功率 / 密度 / 能量 / 数据大小 / CSS 长度十五类实时互转，输入一次全部单位同时出结果；数据大小并列 KB 与 KiB 两种口径，rem 跟随根字号。',
				tags: [
					{ icon: Ruler, label: '十五类单位' },
					{ icon: Gauge, label: 'KB/KiB 口径' },
					{ icon: Zap, label: '实时换算' }
				]
			},
			{
				name: '命名风格转换',
				path: '/case-converter',
				icon: CaseSensitive,
				desc: 'camel、snake、kebab、Pascal、常量等七种命名风格互转，自动分词、识别缩写，逐行一键复制。',
				tags: [
					{ icon: CaseSensitive, label: '7 种风格' },
					{ icon: Gauge, label: '缩写识别' },
					{ icon: Zap, label: '逐行复制' }
				]
			},
			{
				name: '人民币大写',
				path: '/rmb-uppercase',
				icon: Banknote,
				desc: '数字金额一键转中文大写，按票据填写规范输出，支持千分位逗号、小数四舍五入与负数金额。',
				tags: [
					{ icon: Banknote, label: '票据规范' },
					{ icon: Gauge, label: '四舍五入' },
					{ icon: Zap, label: '实时转换' }
				]
			}
		]
	},
	{
		id: 'text',
		name: '文本处理',
		icon: FileText,
		tools: [
			{
				name: '文本统计与清理',
				path: '/text-tools',
				icon: FileText,
				desc: '字符、字数、行数、字节多口径实时统计；去重、去空行、排序等行级清理一键勾选，写回再调不丢原文。',
				tags: [
					{ icon: FileText, label: '10 项口径' },
					{ icon: Gauge, label: '流水线清理' },
					{ icon: Zap, label: '实时刷新' }
				]
			},
			{
				name: '文本对比',
				path: '/text-diff',
				icon: Diff,
				desc: '左右两栏逐行对比，新增标绿、删除标红；并排与合并两种视图，可忽略大小写、行首尾空白与空行，粘贴即出结果。',
				tags: [
					{ icon: Diff, label: '行级高亮' },
					{ icon: Columns2, label: '并排 / 合并' },
					{ icon: Zap, label: '实时对比' }
				]
			}
		]
	},
	{
		id: 'generator',
		name: '生成器',
		icon: Dices,
		tools: [
			{
				name: '随机生成器',
				path: '/generator',
				featured: true,
				icon: Dices,
				desc: 'UUID v4、强随机密码（熵强度分档）、随机数与中英占位假文，加密级随机本地生成。',
				tags: [
					{ icon: Dices, label: '四类一页' },
					{ icon: ShieldCheck, label: '加密级随机' },
					{ icon: Zap, label: '批量复制' }
				]
			}
		]
	},
	{
		id: 'calc',
		name: '计算与查询',
		icon: Calculator,
		tools: [
			{
				name: '哈希计算',
				path: '/hash-calculator',
				icon: Hash,
				desc: '计算 MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 摘要，结果实时同步、逐条可复制；MD5 为本地自实现（WebCrypto 不提供），MD5 与 SHA-1 两行标出「已不安全」，其余走 WebCrypto，全部纯本地算。',
				tags: [
					{ icon: Hash, label: 'MD5 / SHA' },
					{ icon: Gauge, label: '五种算法' },
					{ icon: Zap, label: '实时计算' }
				]
			},
			{
				name: '日期计算',
				path: '/date-calculator',
				icon: CalendarDays,
				desc: '日期差与周月年换算、日期加减天周月年（可跳过周末）、区间工作日统计，月末自动钳制。',
				tags: [
					{ icon: CalendarDays, label: '三合一' },
					{ icon: Gauge, label: '工作日口径' },
					{ icon: Zap, label: '实时计算' }
				]
			},
			{
				name: '科学计算器',
				path: '/calculator',
				icon: Calculator,
				desc: '表达式求值：括号、幂运算与隐式乘法，三角函数可在角度制与弧度制之间切换，带 pi / e 常量与 ln / log / 开方等函数；结果实时算、可复制，最近 20 条历史只存本机。',
				tags: [
					{ icon: Calculator, label: '表达式求值' },
					{ icon: RotateCw, label: '角度 / 弧度' },
					{ icon: Zap, label: '实时计算' }
				]
			},
			{
				name: '利率计算器',
				path: '/interest-calculator',
				icon: Percent,
				desc: '贷款按等额本息 / 等额本金算月供、总利息与逐期还款计划，两种方式直接比出利息差；存款按单利 / 复利（按年 / 按季 / 按月）算到期本息与实际年化；纯本地计算。',
				tags: [
					{ icon: Percent, label: '等额本息 / 本金' },
					{ icon: Layers, label: '还款计划' },
					{ icon: Zap, label: '实时计算' }
				]
			},
			{
				name: '子网掩码计算器',
				path: '/subnet-calculator',
				icon: Network,
				desc: '输入地址或 CIDR（也支持点分掩码写法），一次给出网络地址、广播地址、子网掩码、反掩码、可用范围与可用主机数，并按目标前缀把网段切成等长子网；纯本地计算，不联网。',
				tags: [
					{ icon: Network, label: 'CIDR 解析' },
					{ icon: Layers, label: '子网划分' },
					{ icon: Zap, label: '实时计算' }
				]
			},
			{
				name: '速查表',
				path: '/cheatsheet',
				icon: ListChecks,
				desc: 'MIME 类型与扩展名双向查询、ASCII 码表、HTTP 请求头、常见端口、User-Agent 片段、特殊符号（Unicode 与 HTML 实体）、Android 权限、世界区号、中国历史朝代，九张表一页切换；每张表都能搜索、点行尾一键复制。',
				tags: [
					{ icon: FileCode, label: '九张速查表' },
					{ icon: Binary, label: 'MIME / ASCII' },
					{ icon: Zap, label: '点选复制' }
				]
			},
			{
				name: '悬浮时钟 · 计时器',
				path: '/clock',
				icon: Clock,
				desc: '大字号数字时钟、倒计时、秒表与文字牌四合一：背景色带不透明度可拉到全透明，文字色、字体与描边自由配；画面可整块旋转到任意角度或水平翻转，支持画中画置顶小窗、独立窗口与全屏摆放，配置可整份写进地址。',
				tags: [
					{ icon: PictureInPicture, label: '悬浮小窗' },
					{ icon: Hourglass, label: '倒计时 / 秒表' },
					{ icon: Palette, label: '透明背景' }
				]
			}
		]
	},
	{
		id: 'ops',
		name: '运维',
		icon: Container,
		tools: [
			{
				name: 'Docker 命令速查',
				path: '/docker',
				icon: Container,
				desc: '容器 / 镜像 / 构建 / 网络 / 卷 / 日志排查 / 资源 / 清理 / Compose 九类常用命令，填一次容器 ID / 名称（还可展开镜像、端口、卷等变量），示例命令自动替换，一键复制即用。',
				tags: [
					{ icon: Container, label: '九类命令' },
					{ icon: Terminal, label: '填值即换' },
					{ icon: Zap, label: '一键复制' }
				]
			},
			{
				name: 'Git 命令速查',
				path: '/git',
				icon: GitBranch,
				desc: '起步配置 / 暂存提交 / 分支合并 / 远程同步 / 历史查看 / 撤销回退 / stash / 标签发布 / 高级排错九类常用命令，填一次分支名（还可展开远程、文件路径、提交引用等变量），示例命令自动替换，一键复制即用。',
				tags: [
					{ icon: GitBranch, label: '九类命令' },
					{ icon: ShieldCheck, label: '危险标注' },
					{ icon: Zap, label: '一键复制' }
				]
			},
			{
				name: 'Linux 命令速查',
				path: '/linux',
				icon: SquareTerminal,
				desc: '文件目录 / 查找搜索 / 查看编辑 / 文本处理 / 权限属主 / 进程作业 / 系统资源 / 网络传输 / 压缩归档九类常用命令，填一次路径（还可展开文件名、关键词、端口、服务名等变量），示例命令自动替换，一键复制即用。',
				tags: [
					{ icon: SquareTerminal, label: '九类命令' },
					{ icon: ShieldCheck, label: '危险标注' },
					{ icon: Zap, label: '一键复制' }
				]
			},
			{
				name: 'htaccess ↔ Nginx 互转',
				path: '/htaccess-to-nginx',
				icon: FileCode,
				desc: '.htaccess 与 nginx 配置双向互转：RewriteCond + RewriteRule 与 if + rewrite 互为映射，正向自动补、反向自动去 RewriteBase 前缀，Redirect / Header / ErrorDocument / Options 等逐条对应，还能把输出搬回输入框来回核对；旁边一张参数速查表列出常用指令、标记与变量，点一行就把写法插进输入框；两边做不到的（php_value、proxy_pass 等）不会被悄悄丢掉，就地标出来并说明怎么改。',
				tags: [
					{ icon: ArrowRightLeft, label: '双向互转' },
					{ icon: ListChecks, label: '指令对照' },
					{ icon: ShieldCheck, label: '缺项标出' }
				]
			},
			{
				name: '公共 DNS 速查',
				path: '/dns',
				icon: Server,
				desc: '国内外 21 家公共 DNS 一页看完：阿里云、腾讯 DNSPod、114DNS 三个版本、百度、360、CNNIC、清华 TUNA、中科大，以及 Google、Cloudflare 1.1.1.1、Quad9、OpenDNS、AdGuard 等，逐家列出 IPv4 / IPv6 / DoH / DoT 地址并附官方配置说明页；点任意一行即切换、右侧直接给 Windows / macOS / Linux 更换 DNS 的命令（含查网卡名与还原），逐条一键复制，另附为什么要换 DNS。只做查阅 —— 不解析、不测速、不联网。',
				tags: [
					{ icon: Server, label: '21 家服务' },
					{ icon: Network, label: 'IPv6 / DoH / DoT' },
					{ icon: ShieldCheck, label: '只查不测速' }
				]
			}
		]
	},
	{
		id: 'database',
		name: '数据库',
		icon: Database,
		tools: [
			{
				name: 'SQL 速查表',
				path: '/sql',
				icon: Database,
				desc: '查询 / 筛选排序 / 聚合分组 / 连接 / 子查询与 CTE / 建表改表 / 索引与性能 / 事务与锁 / 排错九类常用语句，填一次表名（还可展开字段、条件、排序、关联表、索引名、schema 等变量），示例值自动替换、一键复制；另带词法高亮的编辑器，写好的语句可存成本地片段并导出备份。不连库、不执行、不上传。',
				tags: [
					{ icon: Database, label: '九类语句' },
					{ icon: Table, label: '填值即换' },
					{ icon: Zap, label: '本地片段' }
				]
			}
		]
	},
	{
		id: 'browser',
		name: '浏览器信息',
		icon: Monitor,
		tools: [
			{
				name: '浏览器信息 & UA 解析',
				path: '/device-info',
				icon: Monitor,
				desc: '浏览器与版本、渲染引擎、操作系统、设备类型、屏幕与 DPR、时区与网络、存储配额、电池与手柄、摄像头与麦克风、权限状态、TTFB / FCP / LCP 一屏看完；当前 UA 与任意 UA 串都能解析，附能力探测与 JSON 导出，全部本地读取。',
				tags: [
					{ icon: Monitor, label: '设备信息' },
					{ icon: Languages, label: 'UA 解析' },
					{ icon: ShieldCheck, label: '本地读取' }
				]
			}
		]
	},
	{
		id: 'ecommerce',
		name: '电商运营',
		icon: ShoppingCart,
		tools: [
			{
				name: '电商 ROI 计算',
				path: '/ecommerce-roi',
				featured: true,
				icon: TrendingUp,
				desc: '一次算出广告 ROAS、扣退货 ROAS、广告 ROI、生意 ROI 与保本 ROAS，并反推广告费上限；退款按未发货 / 在途 / 签收后三类分别计价（未发货的不承担货值与运费、在途件原封按能再卖算），公式与口径全部公开可核对。',
				tags: [
					{ icon: TrendingUp, label: '四种口径' },
					{ icon: ShoppingCart, label: '退货损耗' },
					{ icon: Calculator, label: '保本 ROAS' }
				]
			}
		]
	}
];

export const TOOL_COUNT = TOOL_CATEGORIES.reduce((n, c) => n + c.tools.length, 0);
