#!/usr/bin/env bash
set -euo pipefail

IMG="${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}/codebuddy"

docker build -f .ide/Dockerfile -t "$IMG:latest" .
docker push "$IMG:latest"

echo "🎉 推送完成"
echo "📦 镜像: ${IMG}:latest"
echo "🔗 查看: https://${IMG}"