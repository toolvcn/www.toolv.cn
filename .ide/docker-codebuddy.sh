#!/usr/bin/env bash
set -euo pipefail

IMG="${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}/codebuddy:latest"

docker pull "$IMG"
docker rm -f codebuddy 2>/dev/null || true
docker run -d \
    --name codebuddy \
    --network host \
    -v /workspace:/app \
    -w /app \
    --restart unless-stopped \
    "$IMG" \
    codebuddy --serve --host 0.0.0.0 --port 9000 --auth none

# 从环境变量推导访问地址
ACCESS_URL=""
if [[ -n "${CNB_VSCODE_PROXY_URI:-}" ]]; then
    ACCESS_URL="${CNB_VSCODE_PROXY_URI//\{\{port\}\}/9000}"
fi

echo "🎉 CodeBuddy 已启动"
echo "📦 镜像: ${IMG}"
echo "🔗 访问: ${ACCESS_URL:-请在 WebIDE 的 PORTS 面板查看 9000 地址}"