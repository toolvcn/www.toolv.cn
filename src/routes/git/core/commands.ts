// Git 命令速查的静态数据：分组元数据 + 命令表。**只有数据，没有逻辑** ——
// 占位符替换、搜索、分组与界面都在共用的 `$lib/utils/command-cheatsheet` 与
// `$lib/components/CommandCheatsheet`（docker / git / linux 三个工具共用那一套）。
//
// 模板里的 `{{变量名}}` 是可替换占位符，键名在 ../config.ts 的 VAR_DEFS 里定义。
// **只替换认得的键**：其它花括号（如 stash 的 `stash@{1}`）原样保留。
//
// 写数据时的三条口径（体检单测会拦下写错的）：
//   - `id` 全局唯一（keyed each 的 key 用它，不用命令文本 —— 文本会随变量变）；
//   - 模板里出现的 `{{xxx}}` 必须在 VAR_DEFS 里有定义，且每个定义都要被用到；
//   - 标了 `danger` 的必须写 `note`：危险命令要说明代价，否则徽章只是个红点。

import type { CheatsheetCommand, CheatsheetGroup } from '$lib/utils/command-cheatsheet';

/** 分组元数据，顺序即渲染顺序；chip 行与列表分节都用它 */
export const GIT_GROUPS: CheatsheetGroup[] = [
	{ id: 'setup', name: '起步与配置' },
	{ id: 'stage', name: '暂存与提交' },
	{ id: 'branch', name: '分支与合并' },
	{ id: 'remote', name: '远程与同步' },
	{ id: 'history', name: '历史与查看' },
	{ id: 'undo', name: '撤销与回退' },
	{ id: 'stash', name: '暂存工作区' },
	{ id: 'tag', name: '标签与发布' },
	{ id: 'advanced', name: '高级与排错' }
];

export const GIT_COMMANDS: CheatsheetCommand[] = [
	// ------------------------------------------------------------------ 起步与配置
	{
		id: 'g-config-name',
		group: 'setup',
		template: 'git config --global user.name "{{user}}"',
		desc: '设置全局提交用户名（没配过时第一次 commit 会被拦住）',
		keywords: ['配置用户名', 'user.name', '第一次用', 'setup', '签名'],
		variants: [{ label: '顺便配邮箱', template: 'git config --global user.email "{{email}}"' }],
		note: '只给当前仓库配就把 `--global` 换成 `--local`；三个作用域由近到远是 local > global > system，就近的说了算'
	},
	{
		id: 'g-config-list',
		group: 'setup',
		template: 'git config --list --show-origin',
		desc: '列出当前生效的全部配置，并标出每条来自哪个文件',
		keywords: ['查看配置', 'config list', '配置来自哪', 'origin', '排查配置'],
		note: '「我明明配了怎么不生效」先看这条：多半是同名配置被更近的作用域盖掉了'
	},
	{
		id: 'g-init',
		group: 'setup',
		template: 'git init',
		desc: '把当前目录初始化成一个 git 仓库（生成 `.git` 目录）',
		keywords: ['初始化仓库', 'init', '新建仓库', '本地建仓'],
		variants: [{ label: '指定默认分支名', template: 'git init -b {{branch}}' }],
		note: '`-b` 要 git 2.28+；不写就用 git 的默认分支名，跟随版本可能是 master 也可能是 main'
	},
	{
		id: 'g-clone',
		group: 'setup',
		template: 'git clone {{repo}}',
		desc: '把远程仓库完整克隆到本地同名目录',
		keywords: ['克隆', 'clone', '拉仓库', '下载代码', '拉代码'],
		featured: true,
		variants: [
			{ label: '指定目录', template: 'git clone {{repo}} {{dir}}' },
			{ label: '只拉最近一次提交', template: 'git clone --depth 1 {{repo}}' }
		],
		note: '`--depth 1` 是浅克隆，体积小得多，但历史不完整、也不能直接切老提交（要补全历史得 `git fetch --unshallow`）'
	},
	{
		id: 'g-clone-branch',
		group: 'setup',
		template: 'git clone -b {{branch}} {{repo}}',
		desc: '克隆时直接检出指定分支，不必先克隆再切换',
		keywords: ['克隆指定分支', 'clone -b', '拉某个分支', '只看一个分支'],
		note: '只写 `-b` 仍是完整克隆（所有分支都拉下来）；再加 `--single-branch` 才只拉这一个分支'
	},
	{
		id: 'g-alias',
		group: 'setup',
		template: 'git config --global alias.st status',
		desc: '给常用命令起别名，之后敲 `git st` 就等于 `git status`',
		keywords: ['别名', 'alias', '快捷命令', '简写', '偷懒'],
		variants: [
			{
				label: '一条好看的 log',
				template: 'git config --global alias.lg "log --oneline --graph --decorate --all"'
			}
		],
		note: '别名只是本机配置，不会跟着仓库走；换台机器要在那边重配一次'
	},

	// ------------------------------------------------------------------ 暂存与提交
	{
		id: 's-status',
		group: 'stage',
		template: 'git status',
		desc: '看工作区与暂存区各有哪些改动、当前在哪个分支',
		keywords: ['状态', 'status', '改了哪些', '待提交', '查看改动'],
		featured: true,
		variants: [{ label: '简短版', template: 'git status -sb' }],
		note: '红字是未暂存、绿字是已暂存；提交前扫一眼这条，能省掉大半「提交错东西」的后悔'
	},
	{
		id: 's-add-all',
		group: 'stage',
		template: 'git add .',
		desc: '把当前目录下的全部改动加入暂存区（含新增与删除）',
		keywords: ['暂存全部', 'add', '全部加入', '提交前', 'git add -A'],
		featured: true,
		note: '被 `.gitignore` 忽略的文件不会被带上；新版 git 里 `git add .` 与 `git add -A` 等价'
	},
	{
		id: 's-add-file',
		group: 'stage',
		template: 'git add {{file}}',
		desc: '只暂存指定的文件（想把提交拆小、只提这一部分时用）',
		keywords: ['暂存文件', 'add', '单个文件', '指定文件', '挑着提'],
		note: '通配也认，如 `git add "src/routes/*/README.md"`；路径带空格要加引号'
	},
	{
		id: 's-add-patch',
		group: 'stage',
		template: 'git add -p',
		desc: '交互式逐块挑选要暂存的改动（同一个文件也能只提一部分）',
		keywords: ['部分暂存', 'add -p', '挑块', '拆分提交', 'hunk', 'patch'],
		note: '每个 hunk 按键选择：`y` 暂存 / `n` 跳过 / `s` 再拆细 / `e` 手工编辑 / `q` 退出'
	},
	{
		id: 's-commit',
		group: 'stage',
		template: 'git commit -m "{{msg}}"',
		desc: '把暂存区的内容提交成一个新提交',
		keywords: ['提交', 'commit', '保存改动', '-m', '提交信息'],
		featured: true,
		variants: [{ label: '跳过暂存直接提交已跟踪文件', template: 'git commit -am "{{msg}}"' }],
		note: '`-a` 只自动暂存**已跟踪**文件的改动，新建的文件仍要先 `git add` 一次'
	},
	{
		id: 's-commit-amend',
		group: 'stage',
		template: 'git commit --amend --no-edit',
		desc: '把刚漏掉的文件补进上一次提交，提交信息不变',
		keywords: ['修补提交', 'amend', '漏文件', '改上次提交', '补提交'],
		danger: 'warn',
		variants: [{ label: '顺便改提交信息', template: 'git commit --amend -m "{{msg}}"' }],
		note: '**只对还没 push 的提交用**：amend 会换掉提交哈希，推送过的再 amend 就得强推'
	},
	{
		id: 's-diff',
		group: 'stage',
		template: 'git diff',
		desc: '看工作区相对暂存区的逐行改动',
		keywords: ['差异', 'diff', '改了哪几行', '对比改动', '看 diff'],
		featured: true,
		variants: [
			{ label: '已暂存的改动', template: 'git diff --staged' },
			{ label: '只看文件名', template: 'git diff --stat' }
		],
		note: '`git diff` 只含未暂存部分；已经 `git add` 过的改动要用 `--staged` 才看得到'
	},
	{
		id: 's-rm-cached',
		group: 'stage',
		template: 'git rm --cached {{file}}',
		desc: '让文件停止被 git 跟踪，但保留在磁盘上',
		keywords: ['停止跟踪', 'rm --cached', '不再跟踪', '误提交', '补 gitignore'],
		note: '典型场景：文件已经提交过才补 `.gitignore`，得先用这条让它退出跟踪，否则忽略规则对它无效'
	},
	{
		id: 's-restore-staged',
		group: 'stage',
		template: 'git restore --staged {{file}}',
		desc: '把文件移出暂存区，改动本身仍留在工作区',
		keywords: ['取消暂存', 'restore --staged', '撤出暂存区', 'unstage', '撤回 add'],
		note: '老教程里的 `git reset HEAD <文件>` 是同一件事的旧写法'
	},

	// ------------------------------------------------------------------ 分支与合并
	{
		id: 'b-list',
		group: 'branch',
		template: 'git branch',
		desc: '列出本地分支，当前分支前面带 `*`',
		keywords: ['分支列表', 'branch', '查看分支', '有哪些分支'],
		featured: true,
		variants: [
			{ label: '含远程分支', template: 'git branch -a' },
			{ label: '带最后一条提交', template: 'git branch -vv' }
		]
	},
	{
		id: 'b-create',
		group: 'branch',
		template: 'git switch -c {{branch}}',
		desc: '新建一个分支并立即切过去',
		keywords: ['新建分支', 'switch -c', 'checkout -b', '开分支', '创建分支'],
		featured: true,
		variants: [{ label: '老写法 checkout -b', template: 'git checkout -b {{branch}}' }],
		note: '`git switch` 是 git 2.23 引入的，只管切分支；`git checkout -b` 是等价的老写法（checkout 还兼管还原文件，容易混）'
	},
	{
		id: 'b-switch',
		group: 'branch',
		template: 'git switch {{branch}}',
		desc: '切换到已有分支',
		keywords: ['切换分支', 'switch', 'checkout', '换分支', '切过去'],
		variants: [{ label: '切回上一个分支', template: 'git switch -' }],
		note: '有未提交改动且和新分支冲突时会拦住你 —— 先 commit 或 `git stash` 再切'
	},
	{
		id: 'b-delete',
		group: 'branch',
		template: 'git branch -d {{branch}}',
		desc: '删除已经合并过的本地分支',
		keywords: ['删除分支', 'branch -d', '清理分支', '删掉分支'],
		danger: 'warn',
		variants: [{ label: '强制删（未合并的也删）', template: 'git branch -D {{branch}}' }],
		note: '`-d` 会拦住「还没合并」的分支，确认确实不要了再用 `-D`；删掉的提交并非立刻消失，还能从 `git reflog` 捞回来'
	},
	{
		id: 'b-merge',
		group: 'branch',
		template: 'git merge {{branch}}',
		desc: '把指定分支合并进当前分支',
		keywords: ['合并分支', 'merge', '并入', '合分支', '拉过来'],
		featured: true,
		variants: [
			{ label: '总是生成合并提交', template: 'git merge --no-ff {{branch}}' },
			{ label: '只允许快进', template: 'git merge --ff-only {{branch}}' }
		],
		note: '冲突时先编辑冲突文件、`git add` 后再 `git merge --continue`；想整个放弃就 `git merge --abort`'
	},
	{
		id: 'b-rebase',
		group: 'branch',
		template: 'git rebase {{branch}}',
		desc: '把当前分支的提交搬到目标分支之上，历史更平直',
		keywords: ['变基', 'rebase', '整理历史', '拉平', '同步上游'],
		danger: 'warn',
		variants: [{ label: '交互式重排 / 合并', template: 'git rebase -i {{commit}}' }],
		note: '**会改写提交哈希**：只对还没推到共享分支的本地提交用。`rebase -i` 里 `pick` / `squash` / `reword` / `drop` 可重排、合并、改信息'
	},
	{
		id: 'b-cherry-pick',
		group: 'branch',
		template: 'git cherry-pick {{commit}}',
		desc: '把某一个提交单独摘到当前分支（不等整条分支合并）',
		keywords: ['摘提交', 'cherry-pick', '挑提交', '热修复', '拣选'],
		variants: [{ label: '只应用不提交', template: 'git cherry-pick -n {{commit}}' }],
		note: '摘过来的是**一个新的、哈希不同的提交**（内容相同）；冲突处理与 merge 一样：解决后 `git add` + `git cherry-pick --continue`'
	},
	{
		id: 'b-rename',
		group: 'branch',
		template: 'git branch -m {{branch}}',
		desc: '重命名当前分支（不在分支上时要再给一个旧名参数）',
		keywords: ['重命名分支', 'branch -m', '改分支名', 'master 改 main'],
		note: '只改本地名字；远程那份要用 `push` 推新名 + `push --delete` 删旧名，别人才看不到旧分支'
	},
	{
		id: 'b-track',
		group: 'branch',
		template: 'git branch --set-upstream-to={{remote}}/{{branch}}',
		desc: '把本地分支与远程分支关联起来，之后 `git pull` / `git push` 可以不带参数',
		keywords: ['关联远程', 'upstream', '跟踪分支', 'set-upstream', '跟踪关系'],
		note: '关联关系存在本地配置里；`git branch -vv` 能看出每个分支在跟踪谁'
	},

	// ------------------------------------------------------------------ 远程与同步
	{
		id: 'r-list',
		group: 'remote',
		template: 'git remote -v',
		desc: '列出已配置的远程仓库及其地址（fetch / push 各一行）',
		keywords: ['远程列表', 'remote -v', '看远程', 'origin', '远程地址']
	},
	{
		id: 'r-add',
		group: 'remote',
		template: 'git remote add {{remote}} {{repo}}',
		desc: '给本地仓库添加一个远程地址',
		keywords: ['加远程', 'remote add', '关联仓库', '接远程'],
		note: '`origin` 只是约定俗成的名字；同一个仓库同时接 github / cnb / gitlab 很常见，起个能区分的名字即可'
	},
	{
		id: 'r-fetch',
		group: 'remote',
		template: 'git fetch {{remote}}',
		desc: '拉取远程更新到本地引用，但不动工作区与当前分支',
		keywords: ['拉取', 'fetch', '更新远程引用', '只看不合并', '同步远端'],
		featured: true,
		variants: [{ label: '顺手清理已删的远程分支', template: 'git fetch {{remote}} --prune' }],
		note: '想先看看远程有什么新东西、又不想动自己的工作区，用这条最稳；`--prune` 会删掉本地那些远程已不存在的分支引用'
	},
	{
		id: 'r-pull',
		group: 'remote',
		template: 'git pull',
		desc: '拉取远程更新并合并进当前分支（等于 fetch + merge）',
		keywords: ['拉取', 'pull', '更新代码', '同步', '拉到本地'],
		featured: true,
		variants: [
			{ label: '改成变基', template: 'git pull --rebase' },
			{ label: '只允许快进', template: 'git pull --ff-only' }
		],
		note: '当前分支没设关联时，要连同远程名与分支名一起写，例如 `git pull origin main`'
	},
	{
		id: 'r-push',
		group: 'remote',
		template: 'git push',
		desc: '把本地提交推到远程（分支已有关联时这么写最省事）',
		keywords: ['推送', 'push', '上传', '提交到远程', '推到远端'],
		featured: true,
		variants: [
			{ label: '首次推送并建立关联', template: 'git push -u {{remote}} {{branch}}' },
			{ label: '推所有标签', template: 'git push --tags' }
		],
		note: '`-u` 只在首次需要：它把本地分支和 `remote/branch` 关联起来，之后直接 `git push` 就行'
	},
	{
		id: 'r-push-force',
		group: 'remote',
		template: 'git push --force-with-lease',
		desc: '安全强推：远程被别人更新过就直接拒绝',
		keywords: ['强推', 'force', '改写历史', 'force-with-lease', '推不上去'],
		danger: 'destructive',
		variants: [{ label: '旧写法（会直接覆盖）', template: 'git push --force' }],
		note: '只有「自己刚 rebase / amend 过、且确认没人基于这个分支干活」时才强推。`--force` 无条件覆盖远程，`--force-with-lease` 能挡住别人刚推上去的提交'
	},
	{
		id: 'r-push-delete',
		group: 'remote',
		template: 'git push {{remote}} --delete {{branch}}',
		desc: '删除远程分支',
		keywords: ['删除远程分支', 'push --delete', '清理远程', '删远端分支'],
		danger: 'warn',
		note: '这里删的只是远程那个引用；本地分支还在，要一起删用 `git branch -d`'
	},
	{
		id: 'r-set-url',
		group: 'remote',
		template: 'git remote set-url {{remote}} {{repo}}',
		desc: '修改远程地址（仓库迁移、https 换 ssh 最常用）',
		keywords: ['改远程地址', 'set-url', '换仓库', '换协议', 'ssh 免密'],
		note: '从 https 换成 ssh 免密推送，就是改 `origin` 的地址；改完 `git remote -v` 核对一下'
	},

	// ------------------------------------------------------------------ 历史与查看
	{
		id: 'h-log',
		group: 'history',
		template: 'git log --oneline --graph --decorate --all',
		desc: '一行一条的提交图，带分支名与标签标记',
		keywords: ['提交历史', 'log', '看历史', '提交记录', '提交图'],
		featured: true,
		variants: [
			{ label: '最近 10 条', template: 'git log --oneline -10' },
			{ label: '带具体改动', template: 'git log -p' },
			{ label: '只看文件统计', template: 'git log --stat' }
		]
	},
	{
		id: 'h-log-file',
		group: 'history',
		template: 'git log --oneline -- {{file}}',
		desc: '只看某个文件的提交历史',
		keywords: ['文件历史', 'log 指定文件', '谁改的', '这个文件的改动'],
		note: '`--` 不能省：它把「文件名」和前面的分支 / 路径参数隔开，否则文件名会被当成分支名'
	},
	{
		id: 'h-log-author',
		group: 'history',
		template: 'git log --oneline --author="{{user}}"',
		desc: '只看某个人提交的记录',
		keywords: ['按人查', 'author', '谁提交的', '某人的提交']
	},
	{
		id: 'h-log-grep',
		group: 'history',
		template: 'git log --oneline --grep="{{msg}}"',
		desc: '按提交信息里的关键词找提交',
		keywords: ['搜提交信息', 'grep', '找提交', 'commit message', '搜关键字'],
		note: '默认区分大小写，加 `-i` 忽略；只想搜某人的再加 `--author`'
	},
	{
		id: 'h-show',
		group: 'history',
		template: 'git show {{commit}}',
		desc: '看某次提交的完整信息与逐行改动',
		keywords: ['查看提交', 'show', '某次提交', '改了啥', '看某个提交'],
		featured: true,
		variants: [
			{ label: '只看文件统计', template: 'git show --stat {{commit}}' },
			{ label: '看提交里的某个文件', template: 'git show {{commit}}:{{file}}' }
		],
		note: '`git show 提交:路径` 打印的是那次提交里该文件的整份内容，不是 diff'
	},
	{
		id: 'h-blame',
		group: 'history',
		template: 'git blame {{file}}',
		desc: '逐行标出最后改这行的人与提交',
		keywords: ['追责', 'blame', '谁写的', '哪次改的', '这行谁改的'],
		variants: [{ label: '只看前 20 行', template: 'git blame -L 1,20 {{file}}' }],
		note: '结果里带 `^` 的行是文件创建时就有的；大文件配 `-L` 限定范围，不然刷屏'
	},
	{
		id: 'h-reflog',
		group: 'history',
		template: 'git reflog',
		desc: '看本机 HEAD 的移动记录（reset / rebase 丢提交时的救命稻草）',
		keywords: ['reflog', '找回提交', 'reset 丢的', '撤销历史', '恢复误删'],
		featured: true,
		note: '默认保留 90 天。找到目标哈希后，`git branch <新分支名> <哈希>` 或 `git reset --hard <哈希>` 就能回去 —— 这也是删分支后的兜底'
	},
	{
		id: 'h-shortlog',
		group: 'history',
		template: 'git shortlog -sn',
		desc: '按提交数排名列出贡献者',
		keywords: ['贡献统计', 'shortlog', '谁提交最多', '排名', '统计']
	},

	// ------------------------------------------------------------------ 撤销与回退
	{
		id: 'u-restore',
		group: 'undo',
		template: 'git restore {{file}}',
		desc: '丢弃这个文件在工作区的改动，回到暂存区 / 提交里的样子',
		keywords: ['丢弃改动', 'restore', '还原文件', '反悔', '不要这些改动'],
		danger: 'destructive',
		note: '**手动改的内容会直接没，且这条撤销不了**；老写法是 `git checkout -- <文件>`'
	},
	{
		id: 'u-restore-all',
		group: 'undo',
		template: 'git restore .',
		desc: '丢弃所有未暂存的改动',
		keywords: ['丢弃全部', '还原所有', '不要了', '清空工作区', '重置'],
		danger: 'destructive',
		note: '只影响未暂存的改动；已经 `git add` 的内容不受影响，要一起丢先 `git restore --staged .`'
	},
	{
		id: 'u-reset-soft',
		group: 'undo',
		template: 'git reset --soft HEAD~1',
		desc: '撤销最近一次提交，改动退回暂存区（重新组织后再提交）',
		keywords: ['撤销提交', 'reset --soft', '退回暂存', '撤销上次 commit', '后悔提交'],
		featured: true,
		danger: 'warn',
		variants: [
			{ label: '退回工作区（不暂存）', template: 'git reset HEAD~1' },
			{ label: '退回并丢弃改动', template: 'git reset --hard HEAD~1' }
		],
		note: '`--soft` 保留暂存、默认（mixed）退回工作区、`--hard` **连同改动一起丢**。已经 push 的提交别用 reset，改用 `git revert`'
	},
	{
		id: 'u-revert',
		group: 'undo',
		template: 'git revert {{commit}}',
		desc: '生成一个「反向提交」来抵消某次提交，不改写历史',
		keywords: ['撤销某次提交', 'revert', '安全回退', '已推送', '回滚'],
		featured: true,
		variants: [{ label: '只应用不提交', template: 'git revert -n {{commit}}' }],
		note: '`revert` 不动已有历史，所以**推送过的提交也能安全撤销**；代价是历史里会多出一条提交'
	},
	{
		id: 'u-restore-source',
		group: 'undo',
		template: 'git restore --source={{commit}} -- {{file}}',
		desc: '把文件换成指定提交里的那份（旧版本内容覆盖到工作区）',
		keywords: ['取旧版本文件', 'restore --source', '恢复文件', '某个版本的文件', '回退文件'],
		note: '只改工作区、不自动暂存，可以放心看一眼再决定要不要 `git add`'
	},
	{
		id: 'u-clean',
		group: 'undo',
		template: 'git clean -fd',
		desc: '删除工作区里所有未跟踪的文件与目录',
		keywords: ['清理未跟踪', 'clean', '删除新建文件', '清干净', '删掉多余文件'],
		danger: 'destructive',
		variants: [{ label: '先预览会删什么', template: 'git clean -nd' }],
		note: '**`-f` 才是真的删、`-n` 只预览**。默认不动被 `.gitignore` 忽略的文件，加 `-x` 会连它们一起删（构建产物、本地配置都会没）'
	},
	{
		id: 'u-reset-remote',
		group: 'undo',
		template: 'git reset --hard {{remote}}/{{branch}}',
		desc: '把本地分支硬重置成远程的样子，彻底与远程一致',
		keywords: ['重置到远程', 'reset --hard origin', '本地跟上远程', '强制一致', '本地乱了'],
		danger: 'destructive',
		note: '**本地未推送的提交与未提交的改动都会没**；执行前先确认 `git status` 干净，或先 `git stash` 存一份'
	},

	// ------------------------------------------------------------------ 暂存工作区
	{
		id: 'st-save',
		group: 'stash',
		template: 'git stash push -m "{{msg}}"',
		desc: '把当前未提交的改动收进暂存栈，工作区恢复干净',
		keywords: ['暂存改动', 'stash', '临时保存', '切分支前', '先存起来'],
		featured: true,
		variants: [{ label: '连未跟踪文件一起收', template: 'git stash push -u -m "{{msg}}"' }],
		note: '默认只收已跟踪文件的改动；新建的文件要加 `-u`（untracked）才会一起收进 stash'
	},
	{
		id: 'st-list',
		group: 'stash',
		template: 'git stash list',
		desc: '列出暂存栈里的每一条',
		keywords: ['stash 列表', '看暂存栈', '有哪些 stash', '存了几条'],
		featured: true,
		note: '每条前面是 `stash@{n}`，越新的 n 越小；这串名字可以直接填进 `pop` / `apply` / `show`'
	},
	{
		id: 'st-pop',
		group: 'stash',
		template: 'git stash pop',
		desc: '取出最近一条 stash 应用回来，并从栈里删掉它',
		keywords: ['恢复 stash', 'pop', '取出改动', '把暂存拿回来'],
		featured: true,
		variants: [
			{ label: '指定某一条', template: 'git stash pop stash@{1}' },
			{ label: '取出但保留栈记录', template: 'git stash apply' }
		],
		note: '`pop` 取完就删（失败时不删）；只想试一下、不确定要不要保留，用 `apply`'
	},
	{
		id: 'st-show',
		group: 'stash',
		template: 'git stash show -p',
		desc: '看最近一条 stash 里的具体改动',
		keywords: ['查看 stash', 'stash show', '暂存了什么', '看存的内容'],
		variants: [{ label: '只看文件名', template: 'git stash show --stat' }],
		note: '默认只列文件、不显示 diff，加 `-p` 才展开逐行改动'
	},
	{
		id: 'st-drop',
		group: 'stash',
		template: 'git stash drop',
		desc: '丢掉最近一条 stash',
		keywords: ['删除 stash', 'drop', '不要了', '清理暂存栈'],
		danger: 'warn',
		note: '被 drop 的 stash 不在任何分支上，只能用 `git reflog` 或 `git fsck --unreachable` 试着找回'
	},
	{
		id: 'st-branch',
		group: 'stash',
		template: 'git stash branch {{branch}}',
		desc: '用最近一条 stash 新建分支，并在新分支上把它应用出来',
		keywords: ['stash 建分支', 'stash branch', '从暂存开分支', 'stash 冲突'],
		note: '典型场景：stash 里的改动和切过去的分支冲突，这条比直接 `pop` 省事 —— 应用完 stash 会自动出栈'
	},

	// ------------------------------------------------------------------ 标签与发布
	{
		id: 't-create',
		group: 'tag',
		template: 'git tag {{tag}}',
		desc: '在当前提交打一个轻量标签',
		keywords: ['打标签', 'tag', '版本标记', '发布', 'v1.0.0'],
		variants: [{ label: '带说明的附注标签', template: 'git tag -a {{tag}} -m "release {{tag}}"' }],
		note: '轻量标签只是一个指向提交的引用；要写说明、要挂签名就用 `-a`（附注标签），发布版本建议用后者'
	},
	{
		id: 't-list',
		group: 'tag',
		template: 'git tag -n',
		desc: '列出所有标签，并带上每个标签的说明',
		keywords: ['标签列表', 'tag -n', '有哪些版本', '版本列表'],
		featured: true,
		variants: [{ label: '按版本号倒序', template: 'git tag -n --sort=-v:refname' }],
		note: '`--sort=-v:refname` 按版本号语义排序，`v1.10.0` 会正确排在 `v1.9.0` 前面（字典序会排反）'
	},
	{
		id: 't-describe',
		group: 'tag',
		template: 'git describe --tags',
		desc: '描述当前提交离最近的标签有多远，常用于生成版本号',
		keywords: ['describe', '离标签多远', '版本号', '生成版本'],
		variants: [{ label: '只给最近的标签名', template: 'git describe --tags --abbrev=0' }],
		note: '输出形如 `v1.0.0-5-g31d037b`：距最近标签 5 个提交、当前提交短哈希；CI 里常拿它当版本串'
	},
	{
		id: 't-push',
		group: 'tag',
		template: 'git push {{remote}} {{tag}}',
		desc: '把某个标签推到远程',
		keywords: ['推送标签', 'push tag', '发布版本', '标签上传'],
		featured: true,
		variants: [{ label: '一次推所有标签', template: 'git push --tags' }],
		note: '`git push` **不会**顺手推标签，得显式推；一次推全部标签可能带上本地实验用的标签，注意筛选'
	},
	{
		id: 't-delete',
		group: 'tag',
		template: 'git tag -d {{tag}}',
		desc: '删除本地标签',
		keywords: ['删除标签', 'tag -d', '撤销版本标记', '删版本'],
		danger: 'warn',
		variants: [{ label: '删远程那份', template: 'git push {{remote}} --delete {{tag}}' }],
		note: '本地与远程的标签是**两份**，要分别删；`push --delete` 删的是远程那份'
	},

	// ------------------------------------------------------------------ 高级与排错
	{
		id: 'a-worktree',
		group: 'advanced',
		template: 'git worktree add {{dir}} {{branch}}',
		desc: '把另一个分支检出到独立目录，同一仓库同时开两个分支干活',
		keywords: ['多目录', 'worktree', '同时开两个分支', '并行开发', '不用 clone 第二份'],
		note: '比再 clone 一份省磁盘、共享同一套对象库；用完 `git worktree remove <目录>` 收尾，别直接 `rm -rf`'
	},
	{
		id: 'a-submodule',
		group: 'advanced',
		template: 'git submodule update --init --recursive',
		desc: '补齐子模块内容（仓库带 submodule 时克隆后必跑）',
		keywords: ['子模块', 'submodule', '拉不全', '空目录', 'submodule 没内容'],
		featured: true,
		note: '子模块目录克隆后是空的、只有一个 gitlink，就是这个命令没跑；clone 时加 `--recurse-submodules` 可免这步'
	},
	{
		id: 'a-bisect',
		group: 'advanced',
		template: 'git bisect start',
		desc: '开始二分查找：定位是哪次提交引入了 bug',
		keywords: ['二分', 'bisect', '找坏提交', '定位 bug', '哪次改坏的'],
		variants: [
			{ label: '标记当前是坏的', template: 'git bisect bad' },
			{ label: '标记某次是好的', template: 'git bisect good {{commit}}' }
		],
		note: '流程：`start` → 标一个 `good` 与一个 `bad` → git 自动切到中间提交，反复标 good / bad → 查完 `git bisect reset` 回到原分支'
	},
	{
		id: 'a-gc',
		group: 'advanced',
		template: 'git gc --prune=now',
		desc: '清理并压缩仓库对象，回收 `.git` 占用的空间',
		keywords: ['清理仓库', 'gc', '.git 太大', '瘦身', '回收空间'],
		danger: 'warn',
		note: '`--prune=now` 会**立刻**清掉不可达对象 —— 刚 `reset --hard` 丢掉的提交会彻底找不回；不确定就先不加这个参数'
	},
	{
		id: 'a-fsck',
		group: 'advanced',
		template: 'git fsck --lost-found',
		desc: '扫描丢失的对象，把找到的悬空内容写进 `.git/lost-found/`',
		keywords: ['找回', 'fsck', 'lost-found', '恢复提交', '误删恢复'],
		note: '兜底比 `git reflog` 更底层（reflog 过期后还能试它），代价是只得到一堆哈希，要自己 `git show` 认领'
	},
	{
		id: 'a-check-ignore',
		group: 'advanced',
		template: 'git check-ignore -v {{file}}',
		desc: '查一个文件是被哪条 `.gitignore` 规则忽略的',
		keywords: ['为什么被忽略', 'check-ignore', 'gitignore 不生效', '忽略规则', '排查 gitignore'],
		note: '输出会带「文件:行号:模式」，一眼看出是哪一层 gitignore 命中的；没被忽略则什么都不输出'
	},
	{
		id: 'a-archive',
		group: 'advanced',
		template: 'git archive --format=zip -o release.zip {{tag}}',
		desc: '把某个标签对应的代码打包成 zip（不含 `.git` 目录）',
		keywords: ['打包源码', 'archive', '导出代码', '发布包', '导出 zip'],
		note: '导出的就是那份快照、与工作区无关；比 `git clone` 再删 `.git` 干净，适合交付源码包'
	}
];
