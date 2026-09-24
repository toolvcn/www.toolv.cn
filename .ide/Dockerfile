# CodeBuddy 开发容器镜像：Node 24 + CodeBuddy CLI + pnpm + Playwright
# 端口与启动参数由 .ide/setup.sh 的 docker run 给出，故本文件不设 EXPOSE / CMD
FROM node:24

# 官方镜像不带 locale 与 tzdata，需自行生成，否则中文输入/显示乱码、时间与宿主机差 8 小时
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata locales \
    && sed -i 's/^# *\(zh_CN.UTF-8\)/\1/' /etc/locale.gen \
    && sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen \
    && locale-gen \
    && ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# 使用国内 npm 镜像源加速
RUN npm config set registry https://registry.npmmirror.com

# 安装 CodeBuddy CLI、pnpm 和 Playwright
RUN npm install -g @tencent-ai/codebuddy-code pnpm playwright @playwright/test \
    && pnpm config set registry https://registry.npmmirror.com

# 将 Playwright 浏览器安装到全局路径，便于非 root 用户使用
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# 安装 Playwright 浏览器及系统依赖
# 如需只安装 Chromium，可改为：playwright install --with-deps chromium
RUN mkdir -p /ms-playwright \
    && playwright install --with-deps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 指定字符集为 zh_CN.UTF-8，使 CMD+SSH / VSCode Remote-SSH 集成终端默认即可输入中文
# LANGUAGE 同时包含 en_US，确保 en_US.UTF-8 locale 数据存在后不会有 setlocale 告警
ENV LANG=zh_CN.UTF-8
ENV LC_ALL=zh_CN.UTF-8
ENV LANGUAGE=zh_CN:en_US

ENV TZ=Asia/Shanghai