# 微工具 · Toolv.cn

[![Website](https://img.shields.io/badge/网站-www.toolv.cn-blue.svg)](https://www.toolv.cn)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-orange.svg)](https://svelte.dev)
[![SvelteKit 2](https://img.shields.io/badge/SvelteKit-2-orange.svg)](https://svelte.dev/docs/kit)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-38bdf8.svg)](https://tailwindcss.com)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f6821f.svg)](https://pages.cloudflare.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**微工具（Micro Tools）** 是一个面向中文开发者的在线小工具聚合站：<https://www.toolv.cn>

每个工具都遵守同一套承诺：

- **即开即用** —— 免注册、免安装，打开就能干活
- **数据本地处理** —— 默认纯前端运行，不上传、不落库；唯一例外是 HTTP 工具的「可选服务器代发」，手动开启才把这一次请求交给本站后端转发，用于绕过 CORS 与测速
- **原生优先** —— 只用浏览器原生 API，不为单个工具引入大型依赖
- **两端可用** —— 手机与桌面都有完整布局
- **深色 / 浅色主题** —— 跟随系统或手动固定，偏好存在本地，首帧不闪白（[UI-STYLE §1.1](./docs/UI-STYLE.md)）
- **可读的首屏** —— 页面预渲染成 HTML，SEO 与首屏速度兼得

## 目录

- [工具列表](#工具列表)
- [常用外部工具站](#常用外部工具站)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [可用脚本](#可用脚本)
- [项目结构](#项目结构)
- [部署](#部署)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 工具列表

每个工具都纯前端、即开即用、数据本地处理；**只用浏览器原生 API，不新增运行时依赖**（表中「依赖」列标「无」的），除非单独注明。下表**均为已上线工具**，按「旗舰与高频优先」排列（功能最完整的一批排在最前）；各工具的详细功能说明写在它自己的路由目录里，点名称后的 📄 直达（`src/routes/<tool>/README.md`）。

新增或合并工具后，记得同步首页工具卡片、分类侧栏、工具页菜单（同一份 `src/lib/tools.ts`）与 SEO head、本节状态。功能相近的小工具**合并成一页**（页内标签切换），被合并的条目收在下方「🔀 已并入的工具」，不单独建页。

| 类别       | 工具                                                                  | 地址                                                               | 简介                                                                                                                                       | 依赖                         |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 网络调试   | HTTP 请求调试 [📄](./src/routes/http/README.md)                       | [`/http`](https://www.toolv.cn/http)                               | 参数表与认证、构造请求看响应，cURL 互转、八语言代码生成                                                                                    | 原生 fetch（可选服务器代发） |
| 网络调试   | WebSocket 在线调试 [📄](./src/routes/websocket/README.md)             | [`/websocket`](https://www.toolv.cn/websocket)                     | 多连接并行管理、实时收发监控、定时发送、日志导出                                                                                           | 无（原生）                   |
| 格式与校验 | 正则表达式测试 [📄](./src/routes/regex/README.md)                     | [`/regex`](https://www.toolv.cn/regex)                             | 实时匹配高亮、文本替换、八语言代码生成、正则图解、存本地                                                                                   | 无                           |
| 格式与校验 | JSON 格式化 / 压缩 / 校验 [📄](./src/routes/json-formatter/README.md) | [`/json-formatter`](https://www.toolv.cn/json-formatter)           | 美化、压缩、校验三合一，语法高亮并定位错误行列                                                                                             | 无                           |
| 电商运营   | 电商 ROI 计算 [📄](./src/routes/ecommerce-roi/README.md)              | [`/ecommerce-roi`](https://www.toolv.cn/ecommerce-roi)             | 四种 ROI 口径 + 保本线，退货按可再售 / 残损 / 逆向物流拆开                                                                                 | 无                           |
| 编解码     | Base64 编解码 [📄](./src/routes/base64/README.md)                     | [`/base64`](https://www.toolv.cn/base64)                           | 文本与文件互转，URL-safe 与图片 Data URL 预览                                                                                              | 无（原生）                   |
| 编解码     | URL 编解码 & 查询字符串 [📄](./src/routes/url-encoder/README.md)      | [`/url-encoder`](https://www.toolv.cn/url-encoder)                 | 组件 / 整链两种编码，查询串与参数表双向转换                                                                                                | 无                           |
| 编解码     | HTML 实体编解码 [📄](./src/routes/html-entity/README.md)              | [`/html-entity`](https://www.toolv.cn/html-entity)                 | `&amp;` 等命名实体与数字实体互转，范围与形式可调                                                                                           | 无                           |
| 编解码     | JWT 解码 [📄](./src/routes/jwt-decoder/README.md)                     | [`/jwt-decoder`](https://www.toolv.cn/jwt-decoder)                 | 解出 header / payload 并高亮，声明时间转本地；本地验签 HS/RS 六档                                                                          | 无（WebCrypto）              |
| 编解码     | 摩斯密码速查与加解密 [📄](./src/routes/morse/README.md)               | [`/morse`](https://www.toolv.cn/morse)                             | 54 条码表速查（点行插入输入框）+ 双向实时编解码，缺分隔符的不规范摩斯自动分词，点划与分隔符可自定义                                        | 无                           |
| 转换       | 时间戳 & 时区转换 [📄](./src/routes/timestamp-converter/README.md)    | [`/timestamp-converter`](https://www.toolv.cn/timestamp-converter) | 秒 / 毫秒 ↔ 本地时间，附多时区世界时钟                                                                                                     | 无                           |
| 转换       | 进制转换 [📄](./src/routes/radix-converter/README.md)                 | [`/radix-converter`](https://www.toolv.cn/radix-converter)         | 2 / 8 / 10 / 16 / 36 互转，BigInt 保任意大整数                                                                                             | 无                           |
| 转换       | 颜色转换 [📄](./src/routes/color-converter/README.md)                 | [`/color-converter`](https://www.toolv.cn/color-converter)         | HEX / RGB / HSL 互转（含透明度），带 WCAG 对比度检查                                                                                       | 无                           |
| 转换       | 单位换算（含 px ↔ rem） [📄](./src/routes/unit-converter/README.md)   | [`/unit-converter`](https://www.toolv.cn/unit-converter)           | 十五类单位实时互转（长度 / 面积 / 体积 / 重量 / 温度 …），数据大小并列 KB 与 KiB，rem 跟随根字号                                           | 无                           |
| 转换       | 命名风格转换 [📄](./src/routes/case-converter/README.md)              | [`/case-converter`](https://www.toolv.cn/case-converter)           | camel / snake / kebab / Pascal 等七种互转，自动分词                                                                                        | 无                           |
| 转换       | CSV ↔ JSON [📄](./src/routes/csv-json/README.md)                      | [`/csv-json`](https://www.toolv.cn/csv-json)                       | 双向转换，RFC 4180 转义、分隔符可换、类型可推断                                                                                            | 无（自实现解析）             |
| 转换       | JSON → TypeScript [📄](./src/routes/json-to-ts/README.md)             | [`/json-to-ts`](https://www.toolv.cn/json-to-ts)                   | 由 JSON 样例生成 interface，数组合并与可选键推导                                                                                           | 无（自实现遍历）             |
| 转换       | 人民币大写 [📄](./src/routes/rmb-uppercase/README.md)                 | [`/rmb-uppercase`](https://www.toolv.cn/rmb-uppercase)             | 数字转中文大写金额，票据规范，支持到分                                                                                                     | 无                           |
| 文本处理   | 文本统计 & 清理 [📄](./src/routes/text-tools/README.md)               | [`/text-tools`](https://www.toolv.cn/text-tools)                   | 字符 / 字数 / 行 / 字节多口径统计，去重排序去空行                                                                                          | 无                           |
| 文本处理   | 文本对比 [📄](./src/routes/text-diff/README.md)                       | [`/text-diff`](https://www.toolv.cn/text-diff)                     | 左右两栏逐行对比，增删实时高亮，并排与合并两视图                                                                                           | 无（自实现 LCS）             |
| 生成器     | 随机 & 占位文本生成 [📄](./src/routes/generator/README.md)            | [`/generator`](https://www.toolv.cn/generator)                     | UUID / 密码 / 随机数 / Lorem 四签一页，加密级随机                                                                                          | 无（WebCrypto）              |
| 计算与查询 | 哈希计算 [📄](./src/routes/hash-calculator/README.md)                 | [`/hash-calculator`](https://www.toolv.cn/hash-calculator)         | MD5 / SHA-1 / 256 / 384 / 512，输入即算、逐条复制；MD5 为本地自实现，MD5 与 SHA-1 两行标「已不安全」                                       | 无（MD5 自实现 + WebCrypto） |
| 计算与查询 | 日期计算 [📄](./src/routes/date-calculator/README.md)                 | [`/date-calculator`](https://www.toolv.cn/date-calculator)         | 相差天数、加减天周月年、区间工作日统计                                                                                                     | 无                           |
| 计算与查询 | 科学计算器 [📄](./src/routes/calculator/README.md)                    | [`/calculator`](https://www.toolv.cn/calculator)                   | 表达式求值：括号与幂、隐式乘法，三角函数可切角度 / 弧度，结果实时算并留 20 条历史                                                          | 无                           |
| 计算与查询 | 利率计算器 [📄](./src/routes/interest-calculator/README.md)           | [`/interest-calculator`](https://www.toolv.cn/interest-calculator) | 贷款按等额本息 / 等额本金算月供与总利息，两种方式直接比出利息差；存款按单利 / 复利算到期本息与实际年化                                     | 无                           |
| 计算与查询 | 速查表 [📄](./src/routes/cheatsheet/README.md)                        | [`/cheatsheet`](https://www.toolv.cn/cheatsheet)                   | 九张表一页切换：MIME / ASCII / 请求头 / 端口 / User-Agent / 特殊符号 / Android 权限 / 世界区号 / 朝代                                      | 无                           |
| 计算与查询 | 子网掩码计算器 [📄](./src/routes/subnet-calculator/README.md)         | [`/subnet-calculator`](https://www.toolv.cn/subnet-calculator)     | CIDR 与点分掩码都能算：网络 / 广播 / 掩码 / 反掩码 / 可用范围，并按目标前缀切子网                                                          | 无                           |
| 浏览器信息 | 浏览器信息 & UA 解析 [📄](./src/routes/device-info/README.md)         | [`/device-info`](https://www.toolv.cn/device-info)                 | 浏览器 / 系统 / 屏幕 / 网络 / 存储 / 硬件 / 性能一屏看完                                                                                   | 无                           |
| 计算与查询 | 悬浮时钟 · 计时器 [📄](./src/routes/clock/README.md)                  | [`/clock`](https://www.toolv.cn/clock)                             | 大字号时钟 / 倒计时 / 秒表 / 文字牌，背景可全透明、可开独立窗口                                                                            | 无                           |
| 运维       | Docker 命令速查 [📄](./src/routes/docker/README.md)                   | [`/docker`](https://www.toolv.cn/docker)                           | 容器 / 镜像 / 构建 / 网络 / 卷 / 日志排查 / 资源 / 清理 / Compose 九类命令，填变量自动替换                                                 | 无                           |
| 运维       | Git 命令速查 [📄](./src/routes/git/README.md)                         | [`/git`](https://www.toolv.cn/git)                                 | 配置 / 提交 / 分支 / 远程 / 历史 / 撤销 / stash / 标签 / 排错九类命令，填分支自动替换，危险命令标注代价                                    | 无                           |
| 运维       | Linux 命令速查 [📄](./src/routes/linux/README.md)                     | [`/linux`](https://www.toolv.cn/linux)                             | 文件 / 查找 / 查看 / 文本 / 权限 / 进程 / 系统 / 网络 / 压缩九类命令，填路径自动替换，危险命令标注代价                                     | 无                           |
| 运维       | htaccess ↔ Nginx 互转 [📄](./src/routes/htaccess-to-nginx/README.md)  | [`/htaccess-to-nginx`](https://www.toolv.cn/htaccess-to-nginx)     | RewriteRule / RewriteCond、Redirect、Header 与 nginx 写法双向互转，正向补、反向去 RewriteBase 前缀，两边做不到的会标出                     | 无                           |
| 运维       | 公共 DNS 速查 [📄](./src/routes/dns/README.md)                        | [`/dns`](https://www.toolv.cn/dns)                                 | 国内外 21 家公共 DNS 的 IPv4 / IPv6 / DoH / DoT 地址速查，点任意一行即切换并给出 Windows / macOS / Linux 的换 DNS 命令；只查不测速、不联网 | 无（静态清单）               |
| 数据库     | SQL 速查表 [📄](./src/routes/sql/README.md)                           | [`/sql`](https://www.toolv.cn/sql)                                 | 九类常用语句速查，填表名自动替换；另带词法高亮的编辑器与本地片段存档                                                                       | 无                           |
| 加解密     | 加解密工具箱 [📄](./src/routes/crypto/README.md)                      | [`/crypto`](https://www.toolv.cn/crypto)                           | AES（CBC / GCM / CTR）、RSA 加解密与签名验签、HMAC、凯撒与维吉尼亚，密钥与内容只在浏览器本地计算                                           | 无                           |

### 🔀 已并入的工具

功能相近的小工具合并进现有页面（页内标签切换），**不单独建页**；下面按落点列出它们的名称，`→` 指向最终所在的页面。

- **HTTP 状态码速查** → [`/http`](https://www.toolv.cn/http)
- **图片转 Base64** → [`/base64`](https://www.toolv.cn/base64)
- **查询字符串解析** → [`/url-encoder`](https://www.toolv.cn/url-encoder)
- **时区转换** → [`/timestamp-converter`](https://www.toolv.cn/timestamp-converter)
- **px ↔ rem 换算**、**换算器扩展** → [`/unit-converter`](https://www.toolv.cn/unit-converter)
- **文本清理** → [`/text-tools`](https://www.toolv.cn/text-tools)
- **UUID 生成**、**密码生成器**、**随机数生成** → [`/generator`](https://www.toolv.cn/generator)
- **哈希补 MD5** → [`/hash-calculator`](https://www.toolv.cn/hash-calculator)
- **MIME 类型速查**、**速查表扩展** → [`/cheatsheet`](https://www.toolv.cn/cheatsheet)
- **User-Agent 解析** → [`/device-info`](https://www.toolv.cn/device-info)
- **RSA 加解密与密钥生成**、**HMAC 生成器**、**凯撒密码**、**维吉尼亚密码** → [`/crypto`](https://www.toolv.cn/crypto)

## 常用外部工具站

开发时常用的第三方在线工具与资源（与本站无关），单独收录在 [docs/EXTERNAL-LINKS.md](./docs/EXTERNAL-LINKS.md)。

## 技术栈

| 项     | 选型                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- |
| 框架   | [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev)（强制 runes 模式） |
| 语言   | TypeScript（`strict: true`）                                                                   |
| 样式   | [Tailwind CSS 4](https://tailwindcss.com)（`@tailwindcss/vite`）                               |
| 部署   | Cloudflare Pages（`@sveltejs/adapter-cloudflare`）                                             |
| 测试   | Vitest 4（server / client / storybook 三个 project）+ Playwright + Storybook 10                |
| 图标   | [@lucide/svelte](https://lucide.dev)                                                           |
| 包管理 | pnpm                                                                                           |

## 快速开始

环境要求：**Node `^20.19.0 || >=22.12.0`**（Vite 8 的下限），**pnpm 12.4.2**。仓库里写了 `packageManager` 字段，用 [Corepack](https://nodejs.org/api/corepack.html) 会自动切到对应版本。

```sh
git clone https://github.com/toolvcn/www.toolv.cn.git
cd www.toolv.cn
pnpm install
pnpm dev
```

开发服务器跑在 <http://localhost:8000>。

## 可用脚本

| 命令                                  | 作用                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | 开发服务器，端口 **8000**，监听 `0.0.0.0`                                                     |
| `pnpm build`                          | `wrangler types --check && vite build`（类型不过直接失败）+ 后置 `prettier` 格式化产出的 HTML |
| `pnpm preview`                        | `wrangler pages dev`，端口 4173（能拿到 `platform.env`，别用 `vite preview`）                 |
| `pnpm check`                          | `wrangler types --check` + `svelte-kit sync` + `svelte-check`                                 |
| `pnpm check:watch`                    | 同上去掉 wrangler 那步的 watch 版（**常驻不退出**，别当一次性检查跑）                         |
| `pnpm lint`                           | `prettier --check .` + `eslint .`                                                             |
| `pnpm format`                         | `prettier --write .`                                                                          |
| `pnpm test`                           | Vitest 全量跑一次（含组件与 story，不含 e2e）                                                 |
| `pnpm test:unit`                      | Vitest watch 模式                                                                             |
| `pnpm test:e2e`                       | Playwright 端到端（**当前仓库暂无 e2e 用例**，跑它只是先构建一遍）                            |
| `pnpm storybook`                      | Storybook 开发服务器，端口 6006                                                               |
| `pnpm build-storybook`                | Storybook 静态构建（CI 用，本地一般不跑）                                                     |
| `pnpm gen`                            | `wrangler types`，重新生成 `worker-configuration.d.ts`                                        |
| `pnpm deploy` / `pnpm deploy:preview` | 部署到 Cloudflare Pages                                                                       |

提交前请跑：`pnpm format && pnpm lint && pnpm check`；改了逻辑或共享状态时再补一次 `pnpm test`。

## 项目结构

一个工具的全部文件都放在它自己的路由目录里，**界面进 `ui/`、逻辑进 `core/`** —— `core/` 不含任何样式与 DOM，纯逻辑才好在 node 环境里单测。只有被两个以上工具用到的代码才上提到 `src/lib/`。

```
src/routes/
  +layout.svelte  +page.svelte  layout.css   站点级
  <tool>/                       一个工具一个目录
    +page.svelte                页面外壳 + SEO head
    +page.ts                    可选的 prerender / SSR 开关
    README.md                   该工具的功能清单（必填）
    ui/                         界面：只放渲染 DOM 的 .svelte
    core/                       逻辑：状态、模型、纯函数、类型、测试

src/lib/                        只放被两个以上工具共用的代码
  ui/                           控件原语 + 全站反馈层（styles.ts 是两层共用的样式常量）
  components/                   工具通用组装件
  utils/                        纯函数：json.ts / browser.ts / command-cheatsheet.ts / result.ts
  tools.ts                      全站工具清单（首页卡片 / 侧栏 / 工具页菜单同一份数据）
```

> 目录形态与文件摆放见 [docs/STRUCTURE.md](./docs/STRUCTURE.md) §1-2，两层通用组件的边界见 §2 C；
> 组件清单与 import 路径见 [docs/UI-STYLE.md](./docs/UI-STYLE.md) §0；
> runes 用法、UI 规范与「改完怎么验证」的分档见 [AGENTS.md](./AGENTS.md)。

## 部署

部署到 Cloudflare Pages：

```sh
pnpm deploy          # 生产
pnpm deploy:preview  # preview 分支
```

配置集中在 [`wrangler.jsonc`](./wrangler.jsonc)（`name` / `compatibility_date` / `nodejs_als` / `pages_build_output_dir`）。本地 `.env` 只放 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，**不要提交密钥**。

改动 Cloudflare 绑定后记得跑 `pnpm gen` 重新生成 `worker-configuration.d.ts` 并提交。

## 参与贡献

欢迎提 issue 和 PR。几个提醒：

1. 动手前先读一遍 [AGENTS.md](./AGENTS.md)，里面写了目录约定、runes 用法、UI / 无障碍要求，以及「改完该怎么验证」的分档表。
2. 纯文案、尺寸或间距微调：跑 `pnpm format && pnpm lint && pnpm check` 就够了。
3. 动布局、加交互元素或改共享状态：按 AGENTS.md 第 10 节的分档补上浏览器验证（几何测量 / axe / 主流程）。
4. 新增工具记得同步首页工具卡片、SEO head，以及 README 工具列表里的状态。
5. 提交信息按 [docs/COMMIT.md](./docs/COMMIT.md) 写：`type(scope): 中文描述`，一个 commit 一件事。

## 许可证

[MIT](./LICENSE) © 2026 无情
