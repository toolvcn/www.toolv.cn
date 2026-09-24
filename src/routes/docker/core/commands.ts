// Docker 命令速查的静态数据：分组元数据 + 命令表。**只有数据，没有逻辑** ——
// 占位符替换、搜索、分组与界面都在共用的 `$lib/utils/command-cheatsheet` 与
// `$lib/components/CommandCheatsheet`（docker / git / linux 三个工具共用那一套）。
//
// 模板里的 `{{变量名}}` 是可替换占位符，键名在 ../config.ts 的 VAR_DEFS 里定义。
// **只替换认得的键**：Go 模板那种 `{{.State.Status}}`（键名带点 / 空格 / 首字母大写）原样保留 ——
// 所以 `docker inspect -f` 这类命令能直接写进模板，不用转义。

import type { CheatsheetCommand, CheatsheetGroup } from '$lib/utils/command-cheatsheet';

/** 分组元数据，顺序即渲染顺序；chip 行与列表分节都用它 */
export const DOCKER_GROUPS: CheatsheetGroup[] = [
	{ id: 'container', name: '容器' },
	{ id: 'image', name: '镜像' },
	{ id: 'build', name: '构建' },
	{ id: 'network', name: '网络' },
	{ id: 'volume', name: '卷与数据' },
	{ id: 'log', name: '日志与排查' },
	{ id: 'resource', name: '资源与状态' },
	{ id: 'clean', name: '清理' },
	{ id: 'compose', name: 'Compose 与仓库' }
];

export const DOCKER_COMMANDS: CheatsheetCommand[] = [
	// ------------------------------------------------------------------ 容器
	{
		id: 'c-run-detached',
		group: 'container',
		template: 'docker run -d --name {{name}} -p {{port}} {{image}}',
		desc: '后台跑一个容器：起名、映射端口，返回容器 ID',
		keywords: ['启动容器', 'run', '后台', '端口映射', '新容器'],
		featured: true,
		variants: [{ label: '加环境变量', template: 'docker run -d --name {{name}} -p {{port}} -e {{env}} {{image}}' }],
		note: '`-d` 后台运行；想让容器随宿主重启自启再加 `--restart unless-stopped`'
	},
	{
		id: 'c-run-temporary',
		group: 'container',
		template: 'docker run --rm -it {{image}} /bin/sh',
		desc: '前台跑一个用完即删的临时容器，直接进它的 shell',
		keywords: ['临时容器', 'run', 'rm', '交互', 'shell', '试一下'],
		featured: true,
		variants: [{ label: '/bin/bash', template: 'docker run --rm -it {{image}} /bin/bash' }],
		note: '`--rm` = 退出后自动删除；`-it` 缺一不可，少了 `t` 就没有 TTY、shell 会立刻退出'
	},
	{
		id: 'c-ps',
		group: 'container',
		template: 'docker ps',
		desc: '列出正在运行的容器（ID、镜像、端口、状态）',
		keywords: ['查看容器', '列表', 'ps', '运行中', '状态'],
		featured: true,
		variants: [{ label: '含已停止', template: 'docker ps -a' }],
		note: '第一列那个 ID 就是所有命令里的 `{{container}}`；加了 `-a` 连已退出的也列出来'
	},
	{
		id: 'c-start',
		group: 'container',
		template: 'docker start {{container}}',
		desc: '启动一个已停止的容器（保留原来的文件改动）',
		keywords: ['启动', 'start', '开工', '恢复'],
		featured: true
	},
	{
		id: 'c-stop',
		group: 'container',
		template: 'docker stop {{container}}',
		desc: '优雅停止容器：先发 SIGTERM，10 秒后仍在跑就 SIGKILL',
		keywords: ['停止', 'stop', '关闭', '关掉容器'],
		featured: true,
		variants: [{ label: '立即杀', template: 'docker kill {{container}}' }],
		note: '`docker kill` 直接发 SIGKILL，不做优雅退出，可能丢数据'
	},
	{
		id: 'c-restart',
		group: 'container',
		template: 'docker restart {{container}}',
		desc: '重启容器（等于 stop 再 start）',
		keywords: ['重启', 'restart', '重载']
	},
	{
		id: 'c-rm',
		group: 'container',
		template: 'docker rm {{container}}',
		desc: '删除一个**已停止**的容器',
		keywords: ['删除容器', 'rm', '移除'],
		danger: 'warn',
		variants: [{ label: '强制删运行中的', template: 'docker rm -f {{container}}' }],
		note: '容器里没挂出来（没用 `-v` / 绑定挂载）的数据会一起没；运行中的容器必须加 `-f`'
	},
	{
		id: 'c-exec-shell',
		group: 'container',
		template: 'docker exec -it {{container}} /bin/bash',
		desc: '进入正在运行的容器，开一个交互式 shell',
		keywords: ['进入容器', 'exec', 'bash', 'shell', '终端', '登进去'],
		featured: true,
		variants: [{ label: '/bin/sh', template: 'docker exec -it {{container}} /bin/sh' }],
		note: '容器必须是**运行中**的；alpine 这类精简镜像没有 bash，用 `/bin/sh`'
	},
	{
		id: 'c-exec-cmd',
		group: 'container',
		template: 'docker exec {{container}} ls -al /',
		desc: '在容器里执行一条命令，结果直接打到当前终端',
		keywords: ['exec', '执行命令', '容器内执行', '不进容器'],
		note: '不带 `-it` 更省事，适合脚本里取一条容器内的信息'
	},
	{
		id: 'c-cp-out',
		group: 'container',
		template: 'docker cp {{container}}:{{containerPath}} ./',
		desc: '把容器里的文件 / 目录拷到本机当前目录',
		keywords: ['拷文件', 'cp', '复制出来', '导出文件', '下载']
	},
	{
		id: 'c-cp-in',
		group: 'container',
		template: 'docker cp ./ {{container}}:{{containerPath}}',
		desc: '把本机文件 / 目录拷进容器',
		keywords: ['拷进去', 'cp', '上传文件', '放进容器']
	},
	{
		id: 'c-inspect',
		group: 'container',
		template: 'docker inspect {{container}}',
		desc: '看容器的完整配置 JSON：挂载、网络、环境变量、状态都在里面',
		keywords: ['详情', 'inspect', '配置', 'json', '查ip'],
		featured: true
	},
	{
		id: 'c-port',
		group: 'container',
		template: 'docker port {{container}}',
		desc: '查看容器的端口映射关系',
		keywords: ['端口', 'port', '映射', '宿主机端口']
	},
	{
		id: 'c-rename',
		group: 'container',
		template: 'docker rename {{container}} {{name}}',
		desc: '给容器改名（不必停容器）',
		keywords: ['改名', 'rename', '重命名']
	},
	{
		id: 'c-pause',
		group: 'container',
		template: 'docker pause {{container}}',
		desc: '冻结容器里的所有进程（不释放内存，比 stop 更轻）',
		keywords: ['暂停', 'pause', '冻结'],
		variants: [{ label: '恢复', template: 'docker unpause {{container}}' }]
	},
	{
		id: 'c-top',
		group: 'container',
		template: 'docker top {{container}}',
		desc: '看容器内正在运行的进程（宿主视角的 PID）',
		keywords: ['进程', 'top', 'ps', '谁在跑']
	},
	{
		id: 'c-commit',
		group: 'container',
		template: 'docker commit {{container}} {{image}}',
		desc: '把容器当前的文件系统提交成一个新镜像',
		keywords: ['提交', 'commit', '保存成镜像', '快照'],
		note: '调试时的临时手段；正式做法是改 Dockerfile 重新 `docker build`'
	},
	{
		id: 'c-diff',
		group: 'container',
		template: 'docker diff {{container}}',
		desc: '列出容器相对镜像改了哪些文件（A 新增 / C 修改 / D 删除）',
		keywords: ['diff', '改动', '文件变化', '排错']
	},

	// ------------------------------------------------------------------ 镜像
	{
		id: 'i-ls',
		group: 'image',
		template: 'docker images',
		desc: '列出本地镜像：仓库、标签、镜像 ID、体积',
		keywords: ['镜像列表', 'images', '本地镜像', '查看镜像'],
		featured: true,
		note: '同一仓库的多个标签会共享镜像 ID；`docker images -a` 连中间层一起列'
	},
	{
		id: 'i-pull',
		group: 'image',
		template: 'docker pull {{image}}',
		desc: '从仓库拉取镜像（不写标签默认拉 latest）',
		keywords: ['拉取', 'pull', '下载镜像'],
		featured: true,
		note: '生产上尽量写死标签（`nginx:1.27`），`latest` 会漂移'
	},
	{
		id: 'i-rmi',
		group: 'image',
		template: 'docker rmi {{image}}',
		desc: '删除本地镜像',
		keywords: ['删除镜像', 'rmi', '移除'],
		danger: 'warn',
		variants: [{ label: '强制删', template: 'docker rmi -f {{image}}' }],
		note: '有容器（含已停止的）在用这个镜像时删不掉，得先删容器或加 `-f`'
	},
	{
		id: 'i-tag',
		group: 'image',
		template: 'docker tag {{image}} {{repo}}:v1',
		desc: '给镜像打一个新标签，指向同一个镜像 ID（不复制文件）',
		keywords: ['打标签', 'tag', '重命名镜像', '版本']
	},
	{
		id: 'i-history',
		group: 'image',
		template: 'docker history {{image}}',
		desc: '看镜像的分层构建历史，排查「哪一层把镜像撑大了」',
		keywords: ['history', '分层', '体积', '哪一层大', '构建历史']
	},
	{
		id: 'i-inspect',
		group: 'image',
		template: 'docker inspect {{image}}',
		desc: '看镜像的元信息：架构、环境变量、入口命令、层摘要',
		keywords: ['inspect', '镜像详情', '架构', 'entrypoint']
	},
	{
		id: 'i-save',
		group: 'image',
		template: 'docker save -o image.tar {{image}}',
		desc: '把镜像导出成一个 tar 文件（可离线拷到别的机器）',
		keywords: ['导出镜像', 'save', '离线', 'tar', '内网'],
		variants: [{ label: '导入镜像', template: 'docker load -i image.tar' }],
		note: '`save` / `load` 搬的是镜像；`export` / `import` 搬的是容器文件系统，两者不能混用'
	},

	// ------------------------------------------------------------------ 构建
	{
		id: 'b-build',
		group: 'build',
		template: 'docker build -t {{image}} .',
		desc: '用当前目录的 Dockerfile 构建镜像并打标签',
		keywords: ['构建', 'build', '打包镜像', 'dockerfile'],
		featured: true,
		variants: [
			{ label: '不用缓存', template: 'docker build --no-cache -t {{image}} .' },
			{ label: '指定 Dockerfile', template: 'docker build -f Dockerfile.prod -t {{image}} .' }
		],
		note: '结尾那个 `.` 是构建上下文目录，不是 Dockerfile 路径；`--no-cache` 能排除缓存干扰但慢得多'
	},
	{
		id: 'b-build-arg',
		group: 'build',
		template: 'docker build -t {{image}} --build-arg {{env}} .',
		desc: '构建时给 Dockerfile 里的 ARG 传一个值',
		keywords: ['build-arg', '构建参数', 'ARG', '传参'],
		note: '`ARG` 只是构建期变量，要传进运行期得再写 `ENV`；别用它传密码（会留在镜像历史里）'
	},
	{
		id: 'b-buildx-platform',
		group: 'build',
		template: 'docker buildx build --platform linux/amd64,linux/arm64 -t {{repo}}:v1 --push .',
		desc: '一次构建多个 CPU 架构的镜像并直接推送到仓库',
		keywords: ['多平台', 'buildx', 'arm64', '跨架构', 'mac m1'],
		note: '需要 Buildx 与 `docker buildx create --use` 建好的 builder，且只能 `--push` 或 `--load` 单平台'
	},

	// ------------------------------------------------------------------ 网络
	{
		id: 'n-ls',
		group: 'network',
		template: 'docker network ls',
		desc: '列出所有网络（默认的 bridge / host / none 与自定义的）',
		keywords: ['网络列表', 'network', '查看网络', 'bridge'],
		featured: true
	},
	{
		id: 'n-create',
		group: 'network',
		template: 'docker network create {{network}}',
		desc: '建一个自定义桥接网络，容器之间可用名字互相访问',
		keywords: ['建网络', 'network create', '桥接', '自定义网络'],
		note: '只有自定义网络才有内置 DNS；默认 bridge 上的容器只能靠 IP 互访'
	},
	{
		id: 'n-inspect',
		group: 'network',
		template: 'docker network inspect {{network}}',
		desc: '看网络里连了哪些容器、各自的 IP 与网关',
		keywords: ['network inspect', '网络详情', '容器ip', '子网']
	},
	{
		id: 'n-connect',
		group: 'network',
		template: 'docker network connect {{network}} {{container}}',
		desc: '把一个运行中的容器接进指定网络（可同时接多个）',
		keywords: ['接入网络', 'connect', '连网络', '加网络'],
		variants: [{ label: '断开', template: 'docker network disconnect {{network}} {{container}}' }]
	},
	{
		id: 'n-rm',
		group: 'network',
		template: 'docker network rm {{network}}',
		desc: '删除网络',
		keywords: ['删除网络', 'network rm', '移除网络'],
		danger: 'warn',
		note: '还有容器连着时删不掉，先 `disconnect` 或删容器'
	},

	// ------------------------------------------------------------------ 卷与数据
	{
		id: 'v-ls',
		group: 'volume',
		template: 'docker volume ls',
		desc: '列出所有数据卷',
		keywords: ['卷列表', 'volume', '数据卷', '查看卷'],
		featured: true
	},
	{
		id: 'v-create',
		group: 'volume',
		template: 'docker volume create {{volume}}',
		desc: '建一个命名卷（比绑定挂载更好移植）',
		keywords: ['建卷', 'volume create', '数据卷', '命名卷']
	},
	{
		id: 'v-inspect',
		group: 'volume',
		template: 'docker volume inspect {{volume}}',
		desc: '看卷在宿主机上的真实路径与挂载点',
		keywords: ['volume inspect', '卷详情', '宿主机路径', '数据在哪']
	},
	{
		id: 'v-run-named',
		group: 'volume',
		template: 'docker run -d --name {{name}} -v {{volume}}:{{containerPath}} {{image}}',
		desc: '把命名卷挂进容器（数据留在卷里，容器删了数据还在）',
		keywords: ['挂载卷', '挂数据卷', '持久化', '-v', 'volume mount'],
		featured: true
	},
	{
		id: 'v-run-bind',
		group: 'volume',
		template: 'docker run -d --name {{name}} -v {{hostPath}}:{{containerPath}} {{image}}',
		desc: '把宿主机目录绑定挂载进容器（改代码立刻生效，开发常用）',
		keywords: ['绑定挂载', 'bind mount', '挂目录', '改代码生效', '开发挂载'],
		note: '宿主目录必须写**绝对路径**；路径不存在时 docker 会自建一个目录而不是报错'
	},
	{
		id: 'v-backup',
		group: 'volume',
		template:
			'docker run --rm -v {{volume}}:/data -v "$(pwd)":/backup {{image}} tar czf /backup/{{volume}}.tar.gz -C /data .',
		desc: '把卷打包成一个 tar.gz 存到当前目录（不用停容器）',
		keywords: ['备份卷', '备份数据', '导出卷', 'tar', 'volume backup'],
		variants: [
			{
				label: '还原',
				template:
					'docker run --rm -v {{volume}}:/data -v "$(pwd)":/backup {{image}} tar xzf /backup/{{volume}}.tar.gz -C /data'
			}
		],
		note: 'Windows 的 PowerShell 里 `$(pwd)` 要换成 `${PWD}`'
	},
	{
		id: 'v-rm',
		group: 'volume',
		template: 'docker volume rm {{volume}}',
		desc: '删除一个数据卷',
		keywords: ['删除卷', 'volume rm', '删数据'],
		danger: 'destructive',
		note: '**卷里的数据一起消失且无法恢复**；有容器（含已停止的）在用就删不掉'
	},

	// ------------------------------------------------------------------ 日志与排查
	{
		id: 'l-logs',
		group: 'log',
		template: 'docker logs {{container}}',
		desc: '打印容器的主进程输出（stdout / stderr）',
		keywords: ['日志', 'logs', '看日志', '排错', '报错'],
		featured: true,
		variants: [
			{ label: '实时跟踪', template: 'docker logs -f --tail 100 {{container}}' },
			{ label: '带时间戳', template: 'docker logs -t --tail 100 {{container}}' }
		],
		note: '容器日志落在宿主磁盘上，一天几千行也不奇怪 —— 排查时先 `--tail 100` 再看要不要全量'
	},
	{
		id: 'l-logs-since',
		group: 'log',
		template: 'docker logs --since 10m {{container}}',
		desc: '只看最近一段时间的日志（`10m` / `2h` / `2026-09-21T10:00:00`）',
		keywords: ['日志时间', 'since', '最近日志', '时间段']
	},
	{
		id: 'l-events',
		group: 'log',
		template: 'docker events --filter container={{container}}',
		desc: '实时看这个容器的生命周期事件（start / die / health_status）',
		keywords: ['事件', 'events', '重启原因', '什么时候挂的', 'die'],
		variants: [{ label: '全部事件', template: 'docker events' }],
		note: '排查「容器为什么反复重启」最有用的一条：能看到 die 与 exitCode'
	},
	{
		id: 'l-exit-code',
		group: 'log',
		template: "docker inspect -f '{{.State.ExitCode}}' {{container}}",
		desc: '查容器的退出码（137 = 被 kill，多半是 OOM 或超时）',
		keywords: ['退出码', 'exitcode', '137', 'oom', '为什么退出'],
		variants: [
			{ label: '看状态', template: "docker inspect -f '{{.State.Status}}' {{container}}" },
			{ label: '看重启次数', template: "docker inspect -f '{{.RestartCount}}' {{container}}" }
		],
		note: '外面那层单引号是必须的：里面的 `{{…}}` 是 Go 模板，交给 docker 解析而不是 shell'
	},
	{
		id: 'l-health',
		group: 'log',
		template: "docker inspect -f '{{json .State.Health}}' {{container}}",
		desc: '看健康检查的最新结果与失败次数',
		keywords: ['健康检查', 'healthcheck', 'healthy', 'unhealthy']
	},
	{
		id: 'l-exec-net',
		group: 'log',
		template: 'docker exec {{container}} cat /etc/os-release',
		desc: '确认容器里到底是什么系统（排查镜像基底用）',
		keywords: ['容器系统', 'os-release', '镜像基底', 'alpine', 'debian'],
		variants: [{ label: '看 hosts', template: 'docker exec {{container}} cat /etc/hosts' }]
	},

	// ------------------------------------------------------------------ 资源与状态
	{
		id: 'r-stats',
		group: 'resource',
		template: 'docker stats --no-stream',
		desc: '各容器的 CPU、内存、网络与磁盘 IO 实时占用',
		keywords: ['资源占用', 'stats', 'cpu', '内存', '占用高'],
		featured: true,
		variants: [{ label: '只看一个（实时）', template: 'docker stats {{container}}' }],
		note: '`--no-stream` 只取一次快照（适合贴给别人看）；不加它是持续刷新的面板'
	},
	{
		id: 'r-system-df',
		group: 'resource',
		template: 'docker system df',
		desc: '看镜像、容器、卷、构建缓存各占了多少磁盘',
		keywords: ['磁盘占用', 'system df', '空间', '硬盘满了', '占了多大'],
		featured: true,
		variants: [{ label: '展开明细', template: 'docker system df -v' }],
		note: '「RECLAIMABLE」那一列就是清理能回收的额度；先看这里再决定要不要 prune'
	},
	{
		id: 'r-update',
		group: 'resource',
		template: 'docker update --memory 512m --cpus 1 {{container}}',
		desc: '给运行中的容器改资源上限（不用重建容器）',
		keywords: ['限制内存', '限制cpu', 'update', '资源限制', 'oom'],
		note: '同时给 memory 与 memory-swap 才能设死上限；只给 memory 时 swap 会自动补一份'
	},
	{
		id: 'r-info',
		group: 'resource',
		template: 'docker info',
		desc: '看 Docker 引擎的整体状态：容器数、存储驱动、镜像加速器、资源总量',
		keywords: ['docker信息', 'info', '引擎', '存储驱动', '加速器']
	},
	{
		id: 'r-version',
		group: 'resource',
		template: 'docker version',
		desc: '分别看客户端与服务端的版本（两者不一致常是连接问题的根因）',
		keywords: ['版本', 'version', '客户端', '服务端', 'api版本']
	},

	// ------------------------------------------------------------------ 清理（危险操作集中在这里）
	{
		id: 'k-stop-all',
		group: 'clean',
		template: 'docker stop $(docker ps -q)',
		desc: '停止所有正在运行的容器',
		keywords: ['停止全部', '全部停掉', '批量停止', 'stop all'],
		danger: 'warn',
		note: '`docker ps -q` 只输出 ID 列；这条会一次性停掉本机所有容器，共用机器上先确认'
	},
	{
		id: 'k-container-prune',
		group: 'clean',
		template: 'docker container prune -f',
		desc: '删掉所有已停止的容器',
		keywords: ['清理容器', 'prune', '删掉已停止', '批量删除'],
		danger: 'warn',
		note: '已停止的容器删掉就找不回来；没挂到卷 / 宿主目录上的数据一起没'
	},
	{
		id: 'k-image-prune',
		group: 'clean',
		template: 'docker image prune -a -f',
		desc: '删掉所有没被容器使用的镜像（不止悬空的那些）',
		keywords: ['清理镜像', '删除无用镜像', '悬空镜像', 'dangling', '释放空间'],
		danger: 'destructive',
		variants: [{ label: '只删悬空', template: 'docker image prune -f' }],
		note: '不带 `-a` 只删 `<none>` 的悬空镜像；带 `-a` 会把「现在没容器用」的镜像全删，下次要重新 pull'
	},
	{
		id: 'k-builder-prune',
		group: 'clean',
		template: 'docker builder prune -f',
		desc: '清掉构建缓存',
		keywords: ['清理构建缓存', 'builder prune', 'build cache', '缓存占空间'],
		danger: 'warn',
		note: '构建缓存动辄几个 G；清掉之后下一次构建会明显变慢'
	},
	{
		id: 'k-system-prune',
		group: 'clean',
		template: 'docker system prune -f',
		desc: '一次清掉已停止的容器、悬空镜像、未使用的网络与构建缓存',
		keywords: ['一键清理', 'system prune', '释放空间', '磁盘满了'],
		danger: 'warn',
		variants: [{ label: '连未用镜像与卷一起删', template: 'docker system prune -a --volumes -f' }],
		note: '**默认不动卷**（数据安全）；加了 `--volumes` 才会删未使用的卷，那条要格外确认'
	},
	{
		id: 'k-rm-all',
		group: 'clean',
		template: 'docker rm -f $(docker ps -aq)',
		desc: '强制删除本机所有容器（运行中的也删）',
		keywords: ['删除全部容器', '清空', 'rm all', '重置'],
		danger: 'destructive',
		note: '`-a -q` 是「全部容器只看 ID」；没挂出来的数据会一起消失'
	},

	// ------------------------------------------------------------------ Compose 与仓库
	{
		id: 'p-compose-up',
		group: 'compose',
		template: 'docker compose up -d',
		desc: '按 compose.yaml 起（或更新）整套服务，后台运行',
		keywords: ['compose启动', 'up', '编排', '一键启动', 'compose up'],
		featured: true,
		variants: [
			{ label: '重新构建再起', template: 'docker compose up -d --build' },
			{ label: '只看要做什么', template: 'docker compose up -d --dry-run' }
		],
		note: '改过镜像相关配置就得加 `--build`；`--dry-run` 只打印将要做的动作，不动容器'
	},
	{
		id: 'p-compose-down',
		group: 'compose',
		template: 'docker compose down',
		desc: '停止并删除这套编排起的容器与网络（镜像保留）',
		keywords: ['compose停止', 'down', '拆掉', '编排停止'],
		danger: 'warn',
		variants: [{ label: '连卷一起删', template: 'docker compose down -v' }],
		note: '`down` 默认保留命名卷；`-v` 会把卷一起删，**数据不可恢复**'
	},
	{
		id: 'p-compose-ps',
		group: 'compose',
		template: 'docker compose ps',
		desc: '看这套编排里各服务的状态与端口',
		keywords: ['compose状态', 'ps', '服务列表', '哪个没起来']
	},
	{
		id: 'p-compose-logs',
		group: 'compose',
		template: 'docker compose logs -f --tail 100',
		desc: '实时跟踪整套服务的日志（各服务前缀区分）',
		keywords: ['compose日志', 'logs', '看日志', '跟着看'],
		variants: [
			{ label: '只看某个服务', template: 'docker compose logs -f --tail 100 {{name}}' },
			{ label: '按时间取', template: 'docker compose logs --since 10m' }
		]
	},
	{
		id: 'p-compose-exec',
		group: 'compose',
		template: 'docker compose exec {{name}} /bin/sh',
		desc: '进到某个服务的容器里（服务名而不是容器名）',
		keywords: ['compose进入', 'exec', '进容器', 'shell'],
		note: '`docker compose exec` 的参数是 **compose.yaml 里的服务名**，跟容器名不一定相同'
	},
	{
		id: 'p-compose-config',
		group: 'compose',
		template: 'docker compose config',
		desc: '把 compose.yaml（含 .env 插值、多文件合并）渲染成最终生效的配置',
		keywords: ['compose配置', 'config', '变量插值', '环境变量没生效', '校验'],
		variants: [{ label: '只看服务名', template: 'docker compose config --services' }],
		note: '「环境变量没替换进去」这类问题，先在这条命令的输出里确认最终值'
	},
	{
		id: 'p-login',
		group: 'compose',
		template: 'docker login registry.example.com',
		desc: '登录镜像仓库（凭据存到 ~/.docker/config.json）',
		keywords: ['登录仓库', 'login', '认证', '私有仓库'],
		variants: [{ label: '退出登录', template: 'docker logout registry.example.com' }],
		note: '密码建议用访问令牌；凭据是**明文存在本机**的，共用机器上留意'
	},
	{
		id: 'p-push',
		group: 'compose',
		template: 'docker push {{repo}}:v1',
		desc: '把本地镜像推到仓库（要先 tag 成带仓库前缀的名字）',
		keywords: ['推送镜像', 'push', '上传镜像', '发布'],
		variants: [{ label: '拉回来', template: 'docker pull {{repo}}:v1' }],
		note: '镜像名不带仓库前缀时会推到 Docker Hub 的默认账号下，推错地方很难删'
	}
];
