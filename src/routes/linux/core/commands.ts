// Linux 命令速查的静态数据：分组元数据 + 命令表。**只有数据，没有逻辑** ——
// 占位符替换、搜索、分组与界面都在共用的 `$lib/utils/command-cheatsheet` 与
// `$lib/components/CommandCheatsheet`（docker / git / linux 三个工具共用那一套）。
//
// 模板里的 `{{变量名}}` 是可替换占位符，键名在 ../config.ts 的 VAR_DEFS 里定义。
// **只替换认得的键**：别的花括号原样保留。
//
// 写数据时的三条口径（体检单测会拦下写错的）：
//   - `id` 全局唯一（keyed each 的 key 用它，不用命令文本 —— 文本会随变量变）；
//   - 模板里出现的 `{{xxx}}` 必须在 VAR_DEFS 里有定义，且每个定义都要被用到；
//   - 标了 `danger` 的必须写 `note`：危险命令要说明代价，否则徽章只是个红点。

import type { CheatsheetCommand, CheatsheetGroup } from '$lib/utils/command-cheatsheet';

/** 分组元数据，顺序即渲染顺序；chip 行与列表分节都用它 */
export const LINUX_GROUPS: CheatsheetGroup[] = [
	{ id: 'file', name: '文件与目录' },
	{ id: 'search', name: '查找与搜索' },
	{ id: 'view', name: '查看与编辑' },
	{ id: 'text', name: '文本处理' },
	{ id: 'perm', name: '权限与属主' },
	{ id: 'proc', name: '进程与作业' },
	{ id: 'system', name: '系统与资源' },
	{ id: 'net', name: '网络与传输' },
	{ id: 'archive', name: '压缩与归档' }
];

export const LINUX_COMMANDS: CheatsheetCommand[] = [
	// ------------------------------------------------------------------ 文件与目录
	{
		id: 'f-ls',
		group: 'file',
		template: 'ls -alh {{path}}',
		desc: '列出目录内容，含隐藏文件、大小用人类可读单位',
		keywords: ['列出文件', 'ls', '看目录', '有什么文件', '隐藏文件'],
		featured: true,
		variants: [
			{ label: '按修改时间倒序', template: 'ls -alht {{path}}' },
			{ label: '只看目录本身的权限', template: 'ls -ld {{path}}' }
		],
		note: '`-a` 带隐藏文件（`.` 开头）、`-l` 长格式、`-h` 人类可读、`-t` 按时间排；`-ld` 是只看目录这一项而不展开它'
	},
	{
		id: 'f-cd',
		group: 'file',
		template: 'cd {{path}}',
		desc: '切换到指定目录',
		keywords: ['切换目录', 'cd', '进目录', '换目录'],
		variants: [
			{ label: '回上一个目录', template: 'cd -' },
			{ label: '回主目录', template: 'cd ~' }
		],
		note: '路径里有空格要加引号；`cd -` 依赖 shell 的目录栈，脚本里不一定可用'
	},
	{
		id: 'f-pwd',
		group: 'file',
		template: 'pwd',
		desc: '打印当前所在目录的绝对路径',
		keywords: ['当前目录', 'pwd', '我在哪', '绝对路径'],
		note: '配合软链接时用 `pwd -P` 拿真实路径而不是链接路径'
	},
	{
		id: 'f-mkdir',
		group: 'file',
		template: 'mkdir -p {{path}}',
		desc: '建目录，父目录不存在时一并创建',
		keywords: ['建目录', 'mkdir', '新建文件夹', '-p'],
		featured: true,
		note: '`-p` 让「父目录不存在」不报错、已存在也不报错 —— 脚本里几乎总是要加'
	},
	{
		id: 'f-touch',
		group: 'file',
		template: 'touch {{file}}',
		desc: '建一个空文件；文件已存在时只把修改时间更新到现在',
		keywords: ['建文件', 'touch', '空文件', '更新时间戳'],
		featured: true
	},
	{
		id: 'f-cp',
		group: 'file',
		template: 'cp -r {{src}} {{path}}',
		desc: '递归复制目录（含其中的所有内容）',
		keywords: ['复制', 'cp', '拷贝目录', '-r', '复制目录'],
		featured: true,
		variants: [{ label: '大目录用 rsync（带进度）', template: 'rsync -avh --progress {{src}}/ {{path}}/' }],
		note: '拷目录**必须**加 `-r`（递归），否则报 `omitting directory`；想连权限与时间戳一起保留就加 `-a`，备份场景用 `-a` 更稳'
	},
	{
		id: 'f-mv',
		group: 'file',
		template: 'mv {{src}} {{path}}',
		desc: '移动文件 / 目录，目标写新名字就是重命名',
		keywords: ['移动', '重命名', 'mv', '改名', '挪文件'],
		note: '同一分区内只是改指针、瞬间完成；跨分区是复制再删，大目录会慢一截'
	},
	{
		id: 'f-rm',
		group: 'file',
		template: 'rm -rf {{path}}',
		desc: '递归强制删除目录，不逐项提示',
		keywords: ['删除目录', 'rm', '强制删除', '删干净', '删文件夹'],
		danger: 'destructive',
		variants: [
			{ label: '删单个文件（不递归）', template: 'rm -f {{file}}' },
			{ label: '动手前先看看是什么', template: 'ls -ld {{path}}' }
		],
		note: '**不可恢复、不进回收站**。`-r` 递归、`-f` 不确认；路径里多打一个空格就是事故，先 `ls -ld` 确认再删。`:(){ :|:& };:` 那种恶意字符串别往 shell 里粘'
	},
	{
		id: 'f-ln',
		group: 'file',
		template: 'ln -s {{src}} {{path}}',
		desc: '建软链接（类似 Windows 快捷方式）',
		keywords: ['软链接', 'ln -s', '快捷方式', '符号链接', 'symlink'],
		note: '**源路径写绝对路径**，否则从别的目录访问会断链；`-s` 是软链接，不加是硬链接（不能跨分区、不能指向目录）'
	},

	// ------------------------------------------------------------------ 查找与搜索
	{
		id: 'q-find-name',
		group: 'search',
		template: 'find {{path}} -name "*.log"',
		desc: '在指定目录下递归按文件名查找',
		keywords: ['找文件', 'find', '按名字找', '递归查找', '模糊匹配'],
		featured: true,
		variants: [
			{ label: '按名字片段找', template: 'find {{path}} -name "*{{pattern}}*"' },
			{ label: '按修改时间找', template: 'find {{path}} -type f -mtime -{{days}}' }
		],
		note: '`-name` 区分大小写（`-iname` 忽略大小写）；模式要加引号，否则 shell 会先替你展开通配符、结果完全不同'
	},
	{
		id: 'q-find-size',
		group: 'search',
		template: 'find {{path}} -type f -size +100M',
		desc: '找出大于 100MB 的文件（磁盘满了先跑这条）',
		keywords: ['大文件', 'find size', '磁盘满了', '哪个文件大', '占空间'],
		note: '`+100M` 是「大于」，`-100M` 是「小于」；`-type f` 只看普通文件，不然目录也会被算进来'
	},
	{
		id: 'q-find-delete',
		group: 'search',
		template: 'find {{path}} -type f -mtime +{{days}} -delete',
		desc: '删除指定天数以前修改过的文件（清理老日志 / 老备份）',
		keywords: ['批量删除', 'find delete', '清理老文件', '按时间删', '过期清理'],
		danger: 'destructive',
		variants: [{ label: '先只列出来看看', template: 'find {{path}} -type f -mtime +{{days}}' }],
		note: '**先把 `-delete` 去掉跑一遍**，确认列出的正是要删的那批再加回去；`-delete` 必须放在整个表达式最后'
	},
	{
		id: 'q-locate',
		group: 'search',
		template: 'locate {{pattern}}',
		desc: '从预建索引里秒查路径（比 find 快得多）',
		keywords: ['locate', '秒查', '快速查找', '索引', '找不到文件'],
		note: '索引由 `updatedb` 定期重建，刚建的文件可能查不到；没装就 `sudo apt install mlocate`（或 `plocate`）'
	},
	{
		id: 'q-which',
		group: 'search',
		template: 'which {{pattern}}',
		desc: '查一个命令的可执行文件在哪',
		keywords: ['命令在哪', 'which', '可执行文件', '命令路径', '装哪了'],
		variants: [{ label: '连源码与手册一起找', template: 'whereis {{pattern}}' }],
		note: '找不到多半是没进 `PATH`（或根本没装）；已定义的 shell 别名 / 函数 `which` 看不出来，用 `type -a` 更准'
	},
	{
		id: 'q-grep',
		group: 'search',
		template: 'grep -rn "{{pattern}}" {{path}}',
		desc: '在目录下递归搜索文本内容，打出文件名与行号',
		keywords: ['搜内容', 'grep', '找文本', '递归搜索', '行号', '在哪定义'],
		featured: true,
		variants: [
			{ label: '忽略大小写', template: 'grep -rni "{{pattern}}" {{path}}' },
			{ label: '只列文件名', template: 'grep -rl "{{pattern}}" {{path}}' }
		],
		note: '`-r` 递归、`-n` 带行号、`-i` 忽略大小写、`-l` 只出文件名。只想确认「哪些文件提到了」用 `-l`，比 `-n` 快很多'
	},
	{
		id: 'q-xargs',
		group: 'search',
		template: 'grep -rl "{{pattern}}" {{path}} | xargs wc -l',
		desc: '把上一条命令输出的每一行当参数接着处理',
		keywords: ['管道批处理', 'xargs', '批量执行', '接参数', '批量处理'],
		note: '文件名带空格时用 `xargs -0` 配 `find -print0`；不加 `-0` 保护就 `xargs rm`，遇到带空格的名字会删错对象'
	},

	// ------------------------------------------------------------------ 查看与编辑
	{
		id: 'v-cat',
		group: 'view',
		template: 'cat {{file}}',
		desc: '把文件内容整个打印出来',
		keywords: ['看文件', 'cat', '打印内容', '查看文本'],
		featured: true,
		variants: [
			{ label: '带行号', template: 'cat -n {{file}}' },
			{ label: '看前 20 行', template: 'head -n 20 {{file}}' }
		],
		note: '文件很大时别用 `cat`（会刷屏到崩溃），用 `less`；`cat` 也常用来拼文件，如 `cat a.log b.log > all.log`'
	},
	{
		id: 'v-less',
		group: 'view',
		template: 'less {{file}}',
		desc: '分页查看大文件：`/` 搜词、`g` / `G` 跳首尾、`q` 退出',
		keywords: ['分页查看', 'less', '大文件', '翻页', '打开日志'],
		featured: true,
		note: '`less` 按需读取、不会把整个文件读进内存，几百 MB 的日志用它才不卡；`less +F` 相当于 `tail -f`'
	},
	{
		id: 'v-tail',
		group: 'view',
		template: 'tail -n 100 {{file}}',
		desc: '看文件末尾 100 行',
		keywords: ['看末尾', 'tail', '最后几行', '日志尾巴', '最新日志'],
		featured: true,
		variants: [
			{ label: '实时跟踪新增', template: 'tail -f {{file}}' },
			{ label: '跟着轮转继续看', template: 'tail -F {{file}}' }
		],
		note: '`-f` 会一直挂着看新增内容、`Ctrl+C` 退出；日志被轮转（改名后新建）时要用 `-F`，`-f` 会跟丢'
	},
	{
		id: 'v-wc',
		group: 'view',
		template: 'wc -l {{file}}',
		desc: '统计行数',
		keywords: ['统计行数', 'wc', '多少行', '计数'],
		variants: [
			{ label: '统计字节数', template: 'wc -c {{file}}' },
			{ label: '统计单词数', template: 'wc -w {{file}}' }
		],
		note: '`wc -l` 数是**换行符**个数，最后一行没有换行符时结果会少 1，这是最常见的「行数对不上」原因'
	},
	{
		id: 'v-sed-lines',
		group: 'view',
		template: "sed -n '10,20p' {{file}}",
		desc: '只打印第 10 到 20 行（按行号截取，不必先知道文件多大）',
		keywords: ['打印指定行', 'sed -n', '某几行', '截取行', '看中间几行'],
		variants: [{ label: '只看第 5 行', template: "sed -n '5p' {{file}}" }],
		note: '`-n` 关掉默认的整行输出，`p` 才是「打印这一行」；不写 `-n` 会把全文打一遍再重复这两行'
	},
	{
		id: 'v-diff',
		group: 'view',
		template: 'diff -u {{file}} {{path}}',
		desc: '逐行比较两个文件的差异',
		keywords: ['比较文件', 'diff', '对比', '差异', '文件不同'],
		variants: [{ label: '只报有没有不同', template: 'diff -q {{file}} {{path}}' }],
		note: '`-u` 输出统一格式（带上下文、跟 `git diff` 同一套）；只想知道「一不一样」用 `-q`，它只回一行结论'
	},
	{
		id: 'v-vim',
		group: 'view',
		template: 'vim {{file}}',
		desc: '用 vim 打开文件编辑',
		keywords: ['编辑文件', 'vim', '改文件', '编辑器', '改配置'],
		variants: [{ label: '用 nano（新手友好）', template: 'nano {{file}}' }],
		note: 'vim 里按 `i` 进入插入、`Esc` 退回、`:wq` 保存退出、`:q!` 不保存强退（卡住了先狂按 `Esc` 再输 `:q!`）；nano 是 `Ctrl+O` 保存、`Ctrl+X` 退出'
	},

	// ------------------------------------------------------------------ 文本处理
	{
		id: 'x-sort',
		group: 'text',
		template: 'sort {{file}}',
		desc: '按字典序排每一行',
		keywords: ['排序', 'sort', '按行排', '整理输出'],
		featured: true,
		variants: [
			{ label: '排序并去重', template: 'sort -u {{file}}' },
			{ label: '按数字大小排', template: 'sort -n {{file}}' },
			{ label: '按第二列排', template: 'sort -k2 {{file}}' }
		],
		note: '默认按字符串排，所以 `10` 会排在 `9` 前面；按数值排要加 `-n`，倒序加 `-r`'
	},
	{
		id: 'x-uniq',
		group: 'text',
		template: 'sort {{file}} | uniq -c | sort -rn',
		desc: '统计每行出现次数并按次数倒序（「谁最多」的标准套路）',
		keywords: ['去重统计', 'uniq -c', '出现次数', '算频率', 'top', '统计重复'],
		featured: true,
		note: '`uniq` 只合并**相邻**的重复行，所以前面必须先 `sort`；`-c` 计数、`-rn` 按数字倒序，最上面那条就是出现最多的'
	},
	{
		id: 'x-cut',
		group: 'text',
		template: 'cut -d "," -f 1 {{file}}',
		desc: '按分隔符取第几列（这里取逗号分隔的第一列）',
		keywords: ['取列', 'cut', '按分隔符切', 'CSV 取列', '提取字段'],
		featured: true,
		variants: [{ label: '取第一列与第三列', template: 'cut -d "," -f 1,3 {{file}}' }],
		note: '`-d` 指定分隔符、`-f` 指定第几个字段；`cut` 只认**单字符**分隔符，多字符或要条件判断就交给 `awk`'
	},
	{
		id: 'x-tr',
		group: 'text',
		template: "tr 'A-Z' 'a-z' < {{file}}",
		desc: '按字符做替换或删除（这里把大写字母都变小写）',
		keywords: ['字符替换', 'tr', '大小写转换', '删除字符', '转换'],
		variants: [{ label: '删掉 Windows 回车符', template: "tr -d '\\r' < {{file}}" }],
		note: '`tr` 只按字符一一对应地换、不认单词；处理 Windows 换行（`\\r\\n`）时 `tr -d "\\r"` 是最常见的用法'
	},
	{
		id: 'x-sed-replace',
		group: 'text',
		template: "sed -i 's/{{pattern}}/replace/g' {{file}}",
		desc: '把文件里的匹配文本批量替换（**直接改原文件**）',
		keywords: ['批量替换', 'sed -i', '替换文本', '改文件内容', '原地修改'],
		danger: 'warn',
		variants: [{ label: '先预览、不动文件', template: "sed 's/{{pattern}}/replace/g' {{file}}" }],
		note: '`-i` 是**原地修改，改错了没有撤销**。先跑不带 `-i` 的版本看输出确认，或先 `cp` 一份备份；macOS 的 `sed -i` 要写成 `-i ""`'
	},
	{
		id: 'x-awk',
		group: 'text',
		template: "awk '{print $1}' {{file}}",
		desc: '按空白切分后取第几列（这里取第一列）',
		keywords: ['取列', 'awk', '按空格切', '提取字段', '过滤行'],
		variants: [
			{ label: '按逗号切取第二列', template: "awk -F, '{print $2}' {{file}}" },
			{ label: '打印行号与第一列', template: "awk '{print NR, $1}' {{file}}" }
		],
		note: "`awk` 默认按连续空白切分，`$1` 是第一列、`$0` 是整行；`-F` 换分隔符。要按条件筛行写 `awk '$2 > 100'`"
	},
	{
		id: 'x-jq',
		group: 'text',
		template: "jq '.items[] | .name' {{file}}",
		desc: '从 JSON 文件里格式化输出并提取字段',
		keywords: ['解析 json', 'jq', '取字段', '格式化 json', '处理接口返回'],
		variants: [{ label: '压成一行', template: 'jq -c . {{file}}' }],
		note: '`jq` 不是所有系统自带，装一下：`apt install jq` / `brew install jq`；`.items[]` 遍历数组、`|` 把上一步结果接着处理'
	},
	{
		id: 'x-paste',
		group: 'text',
		template: 'paste -d "," {{file}} {{path}}',
		desc: '把两个文件按行并排合并成一列',
		keywords: ['合并文件', 'paste', '并排拼接', '按行合并', '两列合一'],
		note: '`-d` 指定连接符。它**不是**按内容对齐，只是第 n 行接第 n 行；两边行数不等时短的那边留空'
	},

	// ------------------------------------------------------------------ 权限与属主
	{
		id: 'p-chmod-add',
		group: 'perm',
		template: 'chmod +x {{file}}',
		desc: '给文件加上可执行权限（脚本「Permission denied」时跑这条）',
		keywords: ['加执行权限', 'chmod +x', '脚本跑不了', '权限不足', 'Permission denied'],
		featured: true,
		variants: [{ label: '递归给目录下所有脚本', template: 'chmod -R +x {{path}}' }],
		note: '`+x` 是「所有人都可执行」；要精确控制用八进制，如 `chmod 755`。`-R` 递归时对目录也会加执行位，通常正是想要的'
	},
	{
		id: 'p-chmod-num',
		group: 'perm',
		template: 'chmod 644 {{file}}',
		desc: '用八进制设置权限（644 = 属主读写、其他人只读）',
		keywords: ['权限数字', 'chmod 644', 'chmod 755', '八进制权限', '改权限'],
		featured: true,
		variants: [
			{ label: '目录与脚本常用 755', template: 'chmod 755 {{path}}' },
			{ label: '递归改整个目录', template: 'chmod -R 755 {{path}}' }
		],
		note: '三个数字依次是**属主 / 属组 / 其他人**：4 读、2 写、1 执行，相加即得。文件 644、目录与脚本 755 是最常见的两档'
	},
	{
		id: 'p-chown',
		group: 'perm',
		template: 'chown -R {{user}}:{{user}} {{path}}',
		desc: '把目录及内容的属主与属组一起改掉',
		keywords: ['改属主', 'chown', '改所有者', '部署权限', '属组'],
		variants: [{ label: '只改属主', template: 'chown {{user}} {{path}}' }],
		note: '需要 root（前面加 `sudo`）；`-R` 递归、冒号后面是属组。目录权限不对时**先确认属主再改权限**，顺序反了还得再改一次'
	},
	{
		id: 'p-sudo',
		group: 'perm',
		template: 'sudo -u {{user}} whoami',
		desc: '以指定用户的身份执行一条命令',
		keywords: ['切换用户执行', 'sudo -u', '以某人身份跑', '借身份'],
		note: '`sudo -u` 只借用户身份、环境变量基本不动；要连环境一起换用 `sudo -iu`（`-i` 相当于登录一次）'
	},
	{
		id: 'p-id',
		group: 'perm',
		template: 'id {{user}}',
		desc: '看用户的 uid / gid 与所属的全部组',
		keywords: ['查看用户', 'id', 'uid', 'gid', '用户组', '所属组'],
		note: '不传用户名就是看当前用户；用户改过组之后要重新登录（或 `newgrp`）才生效'
	},
	{
		id: 'p-umask',
		group: 'perm',
		template: 'umask',
		desc: '看新建文件 / 目录的默认权限掩码',
		keywords: ['默认权限', 'umask', '新文件权限', '权限掩码'],
		note: '输出如 `0022`：新建目录得到 `777 - 022 = 755`、文件得到 `666 - 022 = 644`。它是「扣掉哪些位」而不是「给哪些位」'
	},

	// ------------------------------------------------------------------ 进程与作业
	{
		id: 'o-ps-aux',
		group: 'proc',
		template: 'ps aux',
		desc: '列出所有进程（用户、PID、CPU / 内存占用、启动命令）',
		keywords: ['进程列表', 'ps aux', '看进程', '谁在跑', '占用高'],
		variants: [
			{ label: '按内存占用前 10', template: 'ps aux --sort=-%mem | head -n 10' },
			{ label: '按 CPU 占用前 10', template: 'ps aux --sort=-%cpu | head -n 10' }
		],
		note: '第二列是 PID（后面 `kill` / `top -p` 都要它）；`STAT` 里的 `Z` 是僵尸进程、`D` 一般是卡在磁盘 IO'
	},
	{
		id: 'o-ps-grep',
		group: 'proc',
		template: 'ps aux | grep "{{pattern}}"',
		desc: '按关键词过滤进程，找 PID 最常用的一条',
		keywords: ['找进程', 'ps grep', '查进程', '找 pid', '进程还在吗'],
		featured: true,
		note: '`grep` 自己也会出现在结果里（就是那条 `grep 关键词`），真进程通常看上一行；想更准用 `pgrep -af 关键词`，它不会把自己列进来'
	},
	{
		id: 'o-top',
		group: 'proc',
		template: 'top -p {{pid}}',
		desc: '实时盯着指定进程的资源占用',
		keywords: ['实时监控', 'top', '进程占用', '-p', '看着它跑'],
		variants: [{ label: '更友好的界面', template: 'htop' }],
		note: '`top` 里按 `M` 按内存排序、`P` 按 CPU 排序、`q` 退出；`htop` 需另外安装，能直接鼠标点、按树形看父子进程'
	},
	{
		id: 'o-kill',
		group: 'proc',
		template: 'kill {{pid}}',
		desc: '给进程发 SIGTERM，请它自己收尾退出（优雅停止）',
		keywords: ['结束进程', 'kill', '停进程', '杀进程', '关掉服务'],
		featured: true,
		variants: [{ label: '强制杀（SIGKILL）', template: 'kill -9 {{pid}}' }],
		note: '先 `kill` 给它机会保存与关闭连接；`kill -9` 立刻强杀、来不及清理，可能留下锁文件或半截数据，留作最后手段'
	},
	{
		id: 'o-pkill',
		group: 'proc',
		template: 'pkill -f "{{pattern}}"',
		desc: '按命令行的关键词批量结束进程',
		keywords: ['批量结束', 'pkill', '按名字杀', '杀掉全部', '批量杀进程'],
		danger: 'warn',
		variants: [{ label: '先看看会杀谁', template: "pgrep -af '{{pattern}}'" }],
		note: '`-f` 匹配整条命令行（不加只匹配进程名）。**先用 `pgrep -af` 确认命中范围**再动手 —— 匹配太宽会把不该杀的（甚至当前 ssh 会话）一起杀掉'
	},
	{
		id: 'o-jobs',
		group: 'proc',
		template: 'jobs -l',
		desc: '列出当前 shell 的后台作业与它们的 PID',
		keywords: ['后台任务', 'jobs', '作业列表', '挂起的任务', '前台后台'],
		variants: [
			{ label: '把作业调回前台', template: 'fg %1' },
			{ label: '让挂起的作业转后台继续', template: 'bg %1' }
		],
		note: '`%1` 是**作业号**（`jobs` 输出里方括号中那个），跟 PID 不是一回事；`Ctrl+Z` 会把当前前台进程挂起成作业'
	},
	{
		id: 'o-nohup',
		group: 'proc',
		template: 'nohup ./run.sh > out.log 2>&1 &',
		desc: '让命令在关掉终端后继续跑，输出重定向到日志',
		keywords: ['后台运行', 'nohup', '关终端不停', '守护进程', '断开终端'],
		variants: [{ label: '跟着看输出', template: 'tail -f out.log' }],
		note: '`nohup` 挡 SIGHUP、末尾 `&` 放进后台。**不重定向的话默认写 `nohup.out`**；真要长期守护服务，用 `systemd` 而不是 nohup'
	},
	{
		id: 'o-lsof',
		group: 'proc',
		template: 'lsof -i :{{port}}',
		desc: '查端口被哪个进程占用（「Address already in use」时跑它）',
		keywords: ['端口占用', 'lsof', '谁占了端口', '端口被占', '起不来'],
		featured: true,
		variants: [{ label: '找出被删但仍占空间的文件', template: 'lsof | grep deleted' }],
		note: '「端口起不来 / 启动即退出」先跑这条；`ss -tulnp` 也能看监听，但 `lsof` 连打开的文件、连接、目录都能查（没装就 `apt install lsof`）'
	},

	// ------------------------------------------------------------------ 系统与资源
	{
		id: 'y-df',
		group: 'system',
		template: 'df -h',
		desc: '看各挂载点的磁盘使用率与剩余空间',
		keywords: ['磁盘空间', 'df -h', '硬盘满了', '剩余空间', '磁盘满了'],
		featured: true,
		variants: [{ label: '只看某个路径所在分区', template: 'df -h {{path}}' }],
		note: '`-h` 用 K / M / G 人类可读。`Use%` 到 100% 时写文件会直接失败，先看这条，再用 `du` 找出是哪个目录吃掉的'
	},
	{
		id: 'y-du',
		group: 'system',
		template: 'du -sh {{path}}',
		desc: '统计目录的总占用（只给一行汇总）',
		keywords: ['目录大小', 'du -sh', '占了多大', '找大目录', '哪个目录大'],
		featured: true,
		variants: [{ label: '展开各子目录并排序', template: 'du -h --max-depth=1 {{path}} | sort -hr' }],
		note: '`-s` 只出汇总、`-h` 人类可读；不带 `-s` 会把每个子目录都列一遍，大目录能刷屏几千行'
	},
	{
		id: 'y-free',
		group: 'system',
		template: 'free -h',
		desc: '看内存与 swap 的使用情况',
		keywords: ['内存', 'free -h', '内存占用', '剩余内存', 'swap', '内存不够'],
		featured: true,
		variants: [{ label: '每秒刷新一次', template: 'free -h -s 1' }],
		note: '看 `available` 那一列才是「还能分给新进程的」；`buff/cache` 占着内存不代表不够用，它会被回收'
	},
	{
		id: 'y-uname',
		group: 'system',
		template: 'uname -a',
		desc: '看内核版本与系统架构',
		keywords: ['系统版本', 'uname', '内核', '架构', 'arm 还是 x86'],
		variants: [{ label: '看发行版与版本号', template: 'cat /etc/os-release' }],
		note: '`uname` 给的是**内核**信息；要判断是 Ubuntu 还是 CentOS、什么版本号，得看 `/etc/os-release`'
	},
	{
		id: 'y-uptime',
		group: 'system',
		template: 'uptime',
		desc: '看开机时长与 1 / 5 / 15 分钟平均负载',
		keywords: ['运行时长', 'uptime', '负载', 'load average', '重启过没'],
		note: '负载要**和 CPU 核数比着看**：8 核跑在 8 左右算满载，跑到 16 就是明显排队了。`nproc` 看核数'
	},
	{
		id: 'y-date',
		group: 'system',
		template: 'date',
		desc: '看当前系统时间与时区',
		keywords: ['时间', 'date', '时区', '当前时间', '时间不对'],
		variants: [
			{ label: '输出秒级时间戳', template: 'date +%s' },
			{ label: '按格式输出', template: "date '+%Y-%m-%d %H:%M:%S'" }
		],
		note: '服务器时间不对（容器里尤其常见）会连带影响证书校验、日志对齐与定时任务，排查异常先 `date` 一下'
	},
	{
		id: 'y-systemctl',
		group: 'system',
		template: 'systemctl status {{service}}',
		desc: '看服务状态、最近日志与开机自启设置',
		keywords: ['服务状态', 'systemctl', '服务没起来', '开机自启', 'service', '重启服务'],
		variants: [
			{ label: '重启服务', template: 'systemctl restart {{service}}' },
			{ label: '看服务日志末 100 行', template: 'journalctl -u {{service}} -n 100' },
			{ label: '设为开机自启', template: 'systemctl enable {{service}}' }
		],
		note: '`active (running)` 才算正常；改了 unit 文件要 `systemctl daemon-reload` 再 restart。老系统（无 systemd）用 `service 名字 status`'
	},

	// ------------------------------------------------------------------ 网络与传输
	{
		id: 'n-curl',
		group: 'net',
		template: 'curl -i {{host}}',
		desc: '发一个请求并打印响应头与正文',
		keywords: ['发请求', 'curl', '测接口', '看响应', '调接口'],
		featured: true,
		variants: [
			{ label: '只显示响应头', template: 'curl -I {{host}}' },
			{
				label: '跟随跳转并只报状态码与耗时',
				template: 'curl -L -w "\\n%{http_code} %{time_total}s\\n" -o /dev/null -s {{host}}'
			}
		],
		note: '`-i` 连响应头一起打印、`-I` 只发 HEAD；连不上或怀疑证书时加 `-v`，TLS 握手与请求头都能看到'
	},
	{
		id: 'n-wget',
		group: 'net',
		template: 'wget {{host}}',
		desc: '下载文件到当前目录',
		keywords: ['下载', 'wget', '拉文件', '下载不了'],
		variants: [{ label: '断点续传', template: 'wget -c {{host}}' }],
		note: '大文件用 `-c` 续传（断了接着下）；`wget -O 文件名 地址` 可指定保存名，`curl -O` 是另一套等价写法'
	},
	{
		id: 'n-ping',
		group: 'net',
		template: 'ping {{host}}',
		desc: '测网络连通性与往返延迟',
		keywords: ['连通性', 'ping', '延迟', '通不通', '网络通吗'],
		variants: [{ label: '只 ping 4 次', template: 'ping -c 4 {{host}}' }],
		note: '默认会一直 ping 下去，`Ctrl+C` 停；要固定次数用 `-c`。ping 不通也可能是对方禁了 ICMP，不代表服务不可用'
	},
	{
		id: 'n-ss',
		group: 'net',
		template: 'ss -tulnp',
		desc: '列出正在监听的 TCP / UDP 端口及对应进程',
		keywords: ['端口监听', 'ss', '看端口', '服务在听吗', 'tulnp', '监听端口'],
		featured: true,
		variants: [{ label: '只看某个端口', template: 'ss -tulnp | grep ":{{port}}"' }],
		note: '参数：`t`/`u` 是 TCP / UDP、`l` 只看监听、`n` 不解析域名、`p` 显示进程。老系统把 `ss` 换成 `netstat`（参数一样）'
	},
	{
		id: 'n-ip',
		group: 'net',
		template: 'ip addr',
		desc: '看本机所有网卡与它们的 IP 地址',
		keywords: ['ip 地址', 'ip addr', '网卡', 'ifconfig', '本机 ip'],
		variants: [{ label: '看路由表与默认网关', template: 'ip route' }],
		note: '新系统用 `ip`（`ifconfig` 属于已废弃的 net-tools，不少发行版默认不装）；`ip -br addr` 输出更紧凑'
	},
	{
		id: 'n-dig',
		group: 'net',
		template: 'dig {{host}}',
		desc: '查域名解析出的 IP 与应答详情',
		keywords: ['dns 解析', 'dig', '解析对不对', '域名', '域名解析'],
		variants: [
			{ label: '只给答案行', template: 'dig +short {{host}}' },
			{ label: '查邮件记录', template: 'dig {{host}} MX' }
		],
		note: '`+short` 只出答案、脚本里好用。域名打不开先确认**解析出来的 IP 对不对**，再排查网络与端口'
	},
	{
		id: 'n-ssh',
		group: 'net',
		template: 'ssh {{user}}@{{host}}',
		desc: '登录远程主机',
		keywords: ['登录服务器', 'ssh', '远程连接', '连服务器', '登机器'],
		variants: [
			{ label: '指定端口', template: 'ssh -p {{port}} {{user}}@{{host}}' },
			{ label: '登录并只跑一条命令', template: 'ssh {{user}}@{{host}} "df -h"' }
		],
		note: '首次连接会问是否信任主机指纹，输 `yes` 才写入 `known_hosts`；换过机器后提示指纹变了，要先删掉旧记录（`ssh-keygen -R 主机`）'
	},
	{
		id: 'n-scp',
		group: 'net',
		template: 'scp {{src}} {{user}}@{{host}}:{{path}}',
		desc: '把本地文件 / 目录拷到远程主机',
		keywords: ['传文件', 'scp', '上传下载', '拷到服务器', '传目录'],
		variants: [
			{ label: '从远程拷回来', template: 'scp {{user}}@{{host}}:{{path}} .' },
			{ label: '大目录用 rsync（可续传）', template: 'rsync -avzh --progress {{src}}/ {{user}}@{{host}}:{{path}}/' }
		],
		note: '拷**目录**要加 `-r`。大目录或网络不稳时优先 `rsync`：断点续传、只传变化的部分，`scp` 每次都从头传'
	},

	// ------------------------------------------------------------------ 压缩与归档
	{
		id: 'z-tar-c',
		group: 'archive',
		template: 'tar czf {{archive}} {{src}}',
		desc: '把目录打包成 tar.gz',
		keywords: ['压缩', 'tar', '打包', 'tar.gz', '备份', '打个包'],
		featured: true,
		variants: [{ label: '不解压先看包内容', template: 'tar tzf {{archive}}' }],
		note: '`c` 创建、`z` gzip、`f` 指定文件名（`f` 要放最后紧跟包名）。**先 `cd` 到父目录再打包**，否则包里会带上整条路径'
	},
	{
		id: 'z-tar-x',
		group: 'archive',
		template: 'tar xzf {{archive}}',
		desc: '解压 tar.gz 到当前目录',
		keywords: ['解压', 'tar xzf', '解包', 'untar', '解开压缩包'],
		featured: true,
		variants: [
			{ label: '解到指定目录', template: 'tar xzf {{archive}} -C {{path}}' },
			{ label: '解 .tar.bz2', template: 'tar xjf {{archive}}' }
		],
		note: '`x` 解开、`z` gzip、`-C` 指定目标目录（目录要先存在）。来源不明的包先 `tar tzf` 看一眼清单再解'
	},
	{
		id: 'z-zip',
		group: 'archive',
		template: 'zip -r {{archive}} {{src}}',
		desc: '压缩成 zip（要发给 Windows 用户时用）',
		keywords: ['zip 压缩', '打包 zip', '发给 windows', '压缩文件'],
		variants: [{ label: '解压 zip', template: 'unzip {{archive}}' }],
		note: '`-r` 递归加目录必须写，不然只会加个空目录；`unzip -l 包名` 可先看清单。zip / unzip 不是所有系统自带'
	},
	{
		id: 'z-gzip',
		group: 'archive',
		template: 'gzip -k {{file}}',
		desc: '把单个文件压缩成 `.gz` 并保留原文件',
		keywords: ['gzip', '压缩单文件', '.gz', '压缩日志'],
		variants: [{ label: '解开 .gz', template: 'gunzip {{file}}.gz' }],
		note: '`-k` 是保留原文件（不加它原文件会被删掉）；gzip 只压单个文件、**不带归档**，压目录要先用 `tar`'
	},
	{
		id: 'z-zstd',
		group: 'archive',
		template: 'tar --zstd -cf {{archive}} {{src}}',
		desc: '用 zstd 压缩（压缩率相近时比 gzip 快不少）',
		keywords: ['zstd', '快速压缩', 'tar zst', '压缩很快'],
		variants: [{ label: '解开 zst 包', template: 'tar --zstd -xf {{archive}}' }],
		note: '需要较新的 tar（GNU tar 1.31+）与 `zstd` 命令；大目录备份、临时归档优先用它，解压也要加 `--zstd`'
	},
	{
		id: 'z-find-tar',
		group: 'archive',
		template: 'find {{path}} -name "*.log" -print0 | xargs -0 tar czf {{archive}}',
		desc: '把搜到的一批文件一起打包压缩',
		keywords: ['批量打包', 'find 打包', '按条件打包', '日志归档', '归档'],
		note: '`-print0` + `xargs -0` 是为了兼容文件名里的空格；动手前先把 `| xargs …` 那半段去掉，确认文件列表对不对'
	}
];
