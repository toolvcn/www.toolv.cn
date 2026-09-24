# JWT 解码 · /jwt-decoder

> 在线使用：<https://www.toolv.cn/jwt-decoder> ・ 密钥与内容全程只在浏览器内存里，不上传、不落库

- **三段一次解出**：Header / Payload 美化 JSON + 语法高亮（分词渲染不经过 `{@html}`），Signature 原样展示；header 里的 `alg` 提成标签
- **注册声明表**：iss / sub / aud / exp / nbf / iat / jti 中英对照；Unix 秒时间戳转本地时间，`exp` 实时标注「有效中 / 已过期」
- **解码严谨**：base64url 查表解码（不依赖 `atob`），UTF-8 非法字节、段内空白、段数不对、签名坏掉分别给出中文原因；`alg=none` 的空签名也认
- **本地验签**：按 header 的 `alg` 自动选 HS256/384/512（共享密钥，可选 Base64 口径）或 RS256/384/512（RSA 公钥，SPKI / PKCS#1 两种 PEM 都收），结论给「有效 / 无效 / 算法不支持 / 出错」四态并附一条过期结论
- **密钥不落盘**：密钥只在页面内存里参与计算，不写 localStorage、刷新即失，也不随 token 上传

## 参数在哪调

没有 `config.ts`，可调常量都在 `core/types.ts`：

- `CLAIMS`：注册声明表（RFC 7519）的中文标签与是否按时间戳格式化
- `EXAMPLE_TOKEN`：首屏示例（HS256，payload 带时间戳与数组，签名为 RFC 7515 示例值）
- 验签支持的算法档 `SUPPORTED_ALGS = ['HS256','HS384','HS512','RS256','RS384','RS512']` 在 `core/verify.ts`

## 档位

**L2**（+page.svelte + core/ 纯函数 + ui/ 面板）：`core/jwt.ts`（base64url 解码 / 三段拆分 / 声明表）+ `core/verify.ts`（算法映射 / 密钥解析 / 唯一一处 `crypto.subtle` 验签）+ `core/types.ts`，高亮分词复用全站共用的 `$lib/utils/json`。

## 版式

**满屏版式（`fill="fill" fillFrom="lg"`），lg 起「输入 + 验签」并排、结果区吃剩余高度**：

- 上段一轮定高（`shrink-0`）：左边粘 token、右边填密钥，两块等高（`grid lg:grid-cols-2`）；
  JWT 原文的 textarea 在 lg 起改吃满卡片高度（`lg:h-auto lg:flex-1`），不再留一块空卡片底。
- 下段结果区 `min-h-0 flex-1`：Header / Payload / 右列（注册声明 + Signature）按栅格分到剩余高度，
  **卡片随视口拉伸**，页面在 lg 起一屏放完 —— 改版前是「输入卡 + 验签卡 + 结果」三张通栏卡纵向堆叠，
  内容总高固定 910px，1280×800 / 1366×768 要滚一段、1920×1080 底部反而空 170px。
- **窄屏仍是自然流**（`fillFrom="lg"`，768 及以下不钉视口）：输入 → 验签 → 结果依次堆叠、页面可滚。
- 两块 JSON 展示区的封顶跟着断点走：移动端 45vh、lg 起 60vh（与 `PANEL_SCROLL` 同档）。
  封顶是给「超长 payload」准备的 —— 短内容时这块跟着卡片长，超长时块内滚、不把页面撑到几千 px；
  `lg:min-h-0` 则是矮窗口（实测 1024×600）下宁可把这区压小，也不要撑破卡片被 `overflow-hidden` 裁掉。

## 实现口径

- **验签两条铁律**：待签原文必须是 `${header}.${payload}` 的**原始子串**，绝不重新 JSON 序列化（键序 / 空格不一致会静默验签失败）；算法只按 header 的 `alg` 选，不从密钥反推（那是 alg 混淆攻击入口），不在六档内的 `alg` 一律不进 WebCrypto
- **解码是纯结构操作**：相对时间（是否过期）不在解码步算，`claimRows` 按调用方传入的 `now` 判定；SSR / 未 hydration 时 `now=0`，不轻易下「已过期」结论
- **密钥口径不嗅探**：HS 共享密钥默认按 UTF-8 明文取，勾了 Base64 才先解；自动猜错会让「abc123」这类既是明文又是合法 Base64 的串验签失败且难排查，故交给用户显式开关
- **公钥两种 PEM 都收**：SPKI 直用，PKCS#1 现场手写包成 SPKI（不引 DER 库），浏览器只认 SPKI

## 已知取舍 / 暂不支持

- `ES256/384/512` 与 `PS*` 系列 —— 目前只验 HS 与 RS 六档，其余算法给「暂不支持」提示，不进 WebCrypto
- `alg=none` 的无签名 token —— 没有签名段就无从验签，页面明确说明
- JWK / 证书链 / 从 JWKS 地址拉公钥 —— 只收 PEM 文本；手里是 PKCS#1 之外的格式时，可 `openssl rsa -RSAPublicKey_in -pubout` 转成 `BEGIN PUBLIC KEY` 再贴
- 验签只回答「这段签名对不对」，**不做**证书有效期、签发方白名单、密钥轮换这类策略判断
- **极矮窗口下结果区会被压扁**（实测 1024×600：卡片内滚动区只剩 51px）—— 满屏版式的固有取舍：
  钉住视口就必然要把所有内容塞进一屏，宁可让 JSON 块自己滚，也不让页面整体溢出后被 `overflow-hidden` 裁掉
  （`JSON_BOX` 的 `lg:min-h-0` 就是为此）

## 验证过什么

- `core/jwt.test.ts`：base64url 边界（含 `=` / 长度对 4 取模 1 / 段内 `=`）、三段拆分各错误态、`claimRows` 时间戳与过期结论、`formatUnixSeconds` 固定格式
- `core/verify.test.ts`：六档算法映射、HS / RS 验签有效与无效、PEM 解析与 PKCS#1→SPKI 包裹、不支持算法的 `unsupported` 态
- 浏览器实测：示例载入即解出、过期标注、HS/RS 验签、密钥不落盘（刷新即失）
- 版式几何（Playwright，示例 token）：375×812 / 768×1024 自然流可滚（文档高 1602 / 1486）；
  1366×768 / 1440×900 / 1920×1080 **文档高 = 视口高、卡片后只剩 16px 的页面内边距**；
  超长 payload（7.5 KB）在 lg 起块内滚、页面不撑长；大屏空态仍在卡片内居中
