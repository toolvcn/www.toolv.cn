# Base64 编解码 · /base64

> 在线使用：<https://www.toolv.cn/base64> ・ 数据全部本地处理，不上传、不落库

- **实时双向转换**：编码（原文 → Base64）与解码（Base64 → 原文）实时计算，改一字即重算，不用点按钮。
- **URL-safe 开关**：开启后 `+` → `-`、`/` → `_`、去掉末尾 `=`；解码时反向替换并补齐 padding 再算，两套字母表都能吃。
- **图片转 Data URL**：选图片自动读成 `data:URL` 填进输入框并拨到编码方向，下方显示缩略图与文件体积；上限 2 MB，纯 `FileReader`，不上传。
- **中文与 emoji 安全**：统一走 `TextEncoder` / `TextDecoder`，不会像 `btoa('你好')` 那样因码点超 0xFF 抛 `InvalidCharacterError`。
- **方向一键互换**：把当前结果搬回输入框并切换方向，来回验数据不用手动复制；结果为空时只换方向、不抹掉已输入内容。
- **一键复制 / 清空**：复制输出结果（空时给「没有可复制的内容」提示），清空重置输入、输出与缩略图。
- **实时计数**：输入字符数、输出字符数、Base64 长度常驻面板头部；方向切换时跟着换口径——编码取输出、解码取输入（均不含排版空白）。
- **解码容错**：解码先忽略换行 / 空格等排版空白；非法字符只给红色文案、不抛异常；「只有空白」的解码输入不算失败、不报错。
- **错误与提示**：解码失败在输出区给红色文案（高度固定不跳动）；复制失败 / 文件不合法弹红色 toast。
- **面板全屏**：输入 / 输出卡片标题行各有一枚全屏按钮（原生全屏，Esc 退出），长 Base64 单独铺满屏幕看。

## 参数在哪调

没有 `config.ts`——可调参数少，未到建它的门槛。上限与字母表直接写在 `core/types.ts` 与 `core/base64.ts` 的常量里：

- `MAX_FILE_SIZE`（2 MB）：图片转 Data URL 的体积极限，超限被拒并提示。
- `CHUNK_SIZE`（`0x8000`）：大文本分块编码的块大小，改它要同步确认 `String.fromCharCode` 参数上限。
- `BASE64_PATTERN` / `DECODE_ERROR`：校验用的字母表与统一错误文案（界面与单测共用一份，避免文案漂移）。

## 档位

L2。共享状态与编排收在 `core/store.svelte.ts`（输入态、`$derived` 结果、`swapMode` / `copyOutput` 等操作），纯函数放 `core/base64.ts`（编解码、URL-safe 转换、文件读取），类型与常量放 `core/types.ts`；面板拆成 `ui/Panel.svelte`（双栏编辑区 + 工具条），重复出现的样式收进 `ui/styles.ts`。无服务端、无跨工具共享层。

## 实现口径

- 编码先过 `TextEncoder` 拿 UTF-8 字节再 `btoa`：中文、emoji 按字节而非码点处理，这是「中文 / emoji 安全」的根因，不是简单封装 `btoa`。
- 大文本按 `CHUNK_SIZE` 分块喂给 `String.fromCharCode`，避免一次摊太多参数爆栈（`微工具`.repeat(20000) 这类长串也能编）。
- URL-safe 归一化后再校验：`fromUrlSafe` 在长度为 `4n+1` 时补不出合法 padding，原样返回交给 `isValidBase64` 判非法，而不是自己兜底。
- 编码保留原文所有空白（那是内容的一部分）；解码先 `stripWhitespace` 归一化再算，所以「忽略排版空白」只在解码侧生效。
- 输出与错误同源、一次算出（`result = $derived(convert(...))`），避免两个派生值各算一遍大文本。

## 已知取舍 / 暂不支持

- 转 Data URL 只接受图片文件（非图片被拒）；图片只转成 `data:URL` 填进输入框，**不**把 Base64 反向解码回图片文件下载。
- 不做 Base64 之外的编码（Base32 / Base85 / hex 各有独立工具），也不做 MIME / 编码自动探测——输入是否合法 Base64 只靠字母表 + padding 规则判定。
- 不落库、无预设、无历史：刷新即清空，不记忆上次输入。

## 验证过什么

- `core/base64.test.ts`（server project，node 环境）覆盖：编码（ASCII 与标准表一致、中文按 UTF-8、`emoji` 多字节、大文本分块结果与整体一致）、解码（往返一致、忽略空白、URL-safe 缺 padding 也能解、非法字符抛错）、`isValidBase64` 边界（空串 / 非法字符 / `4n+1` / padding 超两个）、URL-safe 互换、`convert` 空白保留与解码失败只给文案、`formatFileSize` 分档、`fileToDataURL`（桩）、store 状态 / 切换方向 / 图片转换 / 复制 / 清空。
- 未做浏览器实测（无 axe / 几何量测条目）。
