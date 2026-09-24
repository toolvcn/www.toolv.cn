# 云原生开发环境初始化脚本 —— 由 .cnb.yml 的「环境初始化」stage 调用
#
# 原先这些命令内联在 .cnb.yml 的 stages 里，集中到本文件后便于写注释、也便于本地复现：
#   sh .ide/init.sh
# 前提：容器内已有 apt-get / npm / git（基础镜像 cnbcool/default-dev-env 已带 Node.js v24）
# 可选依赖（/root/.cnb/*、.vscode/extensions.json、.codebuddy/mcp.json）缺失时自动跳过，不会中断

echo "==> 安装 libatomic1"
# pnpm 11+ 的单文件二进制（@pnpm/exe）动态链接 libatomic.so.1，精简镜像里没有。
# 缺了会报 "libatomic.so.1: cannot open shared object file"，pnpm 完全跑不起来
apt-get update -qq && apt-get install -y libatomic1

echo "==> 安装 pnpm"
npm install -g pnpm
echo "pnpm $(pnpm -v) 安装完成"

echo "==> 配置 pnpm 镜像源"
# 国内直连 npmjs 慢，统一走 npmmirror；必须在 pnpm install 之前设置
pnpm config set registry https://registry.npmmirror.com/
echo "镜像源: $(pnpm config get registry)"

echo "==> 安装 VS Code 推荐扩展"
sleep 5 # 等待 VS Code Server 启动
if [ -f ".vscode/extensions.json" ]; then
	apt-get update -qq && apt-get install -y -qq jq
	# 逐个安装 recommendations 列表；--force 让重复执行时也能覆盖更新
	jq -r '.recommendations[]?' .vscode/extensions.json | while read -r ext; do
		[ -n "$ext" ] && {
			printf "安装 %s ... " "$ext"
			code-server --install-extension "$ext" --force && echo "成功" || echo "失败"
		}
	done
	rm -rf /var/lib/apt/lists/*
else
	echo "未找到 .vscode/extensions.json，跳过扩展安装"
fi

# 可选：把 VS Code 界面切到中文（默认关闭，需要时取消注释）
# printf '{"locale":"zh-cn"}\n' > /root/.local/share/code-server/User/argv.json

echo "==> 配置 CodeBuddy MCP"
# CodeBuddy 只读容器用户目录下的 ~/.codebuddy/mcp.json，仓库里的那份要复制过去
mkdir -p /root/.codebuddy
[ -f ".codebuddy/mcp.json" ] && cp .codebuddy/mcp.json /root/.codebuddy/mcp.json && echo "CodeBuddy 配置已复制" || echo "未找到 .codebuddy/mcp.json"

echo "==> 链接 CodeBuddy 模型配置"
# models.json 由 CNB 平台注入到 /root/.cnb，用软链而非复制，平台更新后自动生效
mkdir -p /root/.codebuddy
[ -e "/root/.cnb/models.json" ] && ln -sf /root/.cnb/models.json /root/.codebuddy/models.json && echo "models.json 已链接" || echo "未找到 /root/.cnb/models.json"

echo "==> 链接环境变量文件"
# .env 不入库（已在 .gitignore），由平台挂载到 /root/.cnb 后软链到项目根，供 wrangler 读取
mkdir -p /root/.cnb
[ -e "/root/.cnb/.env" ] && ln -sf /root/.cnb/.env .env && echo ".env 已链接" || echo "未找到 /root/.cnb/.env"

echo "==> 安装项目依赖"
[ -f "package.json" ] && pnpm install && echo "依赖安装完成" || echo "无 package.json，跳过依赖安装"

# 以下只打印环境信息，方便在 CNB 构建日志里排查，不影响环境本身
echo "=========================================="
echo "📋 云原生开发环境信息"
echo "=========================================="
echo "⏰ 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "👤 用户信息:"
echo "   用户: ${CNB_BUILD_USER}"
echo "   事件: ${CNB_EVENT}"
echo "   工作空间: ${CNB_BUILD_WORKSPACE}"
echo ""

echo "🌐 网络信息:"
echo "   Web IDE: ${CNB_VSCODE_WEB_URL}"
echo "   代理: ${CNB_VSCODE_PROXY_URI}"
echo ""

echo "📁 目录信息:"
echo "   当前路径: $(pwd)"
echo ""

echo "🔧 开发工具版本:"
echo "   Node.js: $(node -v 2>/dev/null || echo '未安装')"
echo "   npm: $(npm -v 2>/dev/null || echo '未安装')"
echo "   pnpm: $(pnpm -v 2>/dev/null || echo '未安装')"
echo "   Git: $(git --version 2>/dev/null || echo '未安装')"
echo "   Docker: $(docker --version 2>/dev/null || echo '未安装')"
echo ""

echo "⚙️  系统信息:"
echo "   📋 操作系统:"
echo "     版本: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "     ID: $(cat /etc/os-release | grep '^ID=' | cut -d'=' -f2)"
echo "     版本号: $(cat /etc/os-release | grep VERSION_ID | cut -d'"' -f2)"
echo "     内核: $(uname -r)"
echo "     架构: $(uname -m)"
echo ""
echo "   💾 硬件资源:"
echo "     CPU 架构: $(uname -p)"
echo "     CPU 核心数: $(nproc)"
echo "     CPU 型号: $(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d':' -f2 | xargs)"
echo "     总内存: $(free -h | grep Mem | awk '{print $2}')"
echo "     可用内存: $(free -h | grep Mem | awk '{print $7}')"
echo "     总磁盘: $(df -h / | tail -1 | awk '{print $2}')"
echo "     可用磁盘: $(df -h / | tail -1 | awk '{print $4}')"
echo "     磁盘使用率: $(df -h / | tail -1 | awk '{print $5}')"
echo ""
echo "   🌐 网络配置:"
echo "     主机名: $(hostname)"
echo "     域名: $(hostname -d 2>/dev/null || echo '未设置')"
echo "     IP 地址: $(hostname -I 2>/dev/null || echo '获取失败')"
echo "     DNS 服务器: $(cat /etc/resolv.conf | grep nameserver | head -2 | awk '{print $2}' | tr '\n' ' ')"
echo ""

echo "🔗 Git 信息:"
if [ -d ".git" ]; then
	echo "   当前分支: $(git branch --show-current 2>/dev/null || echo '获取失败')"
	echo "   最新提交: $(git log -1 --oneline 2>/dev/null || echo '无提交记录')"
	echo "   远程仓库: $(git remote get-url origin 2>/dev/null || echo '未设置远程仓库')"
else
	echo "   非 Git 仓库"
fi
echo ""

echo "🌍 环境变量:"
echo "   CNB_BUILD_ID: ${CNB_BUILD_ID}"
echo "   CNB_BUILD_JOB_ID: ${CNB_BUILD_JOB_ID}"
echo "   CNB_BUILD_USER: ${CNB_BUILD_USER}"
echo "   CNB_EVENT: ${CNB_EVENT}"
echo ""

echo "✅ 环境初始化完成！"
echo "=========================================="
