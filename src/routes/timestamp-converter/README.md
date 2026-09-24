# 时间戳转换 · /timestamp-converter

> 在线使用：<https://www.toolv.cn/timestamp-converter> ・ 数据全部本地处理，不上传、不落库

- **双向换算**：数字时间戳（自动识别秒 / 毫秒，可手动指定；负数即 1970 年前）→ 本地与 UTC 时间；`datetime-local` 选时间 → 毫秒与秒时间戳，逐项一键复制
- **默认当前时间**：页面打开就把此刻的时间戳填进输入框（毫秒单位就填毫秒），本地时间 / UTC / 世界时钟同时出结果；值是挂载后才换的 —— 页面预渲染，此刻的时间戳只能到浏览器里取，不然构建时刻的值会被烘进 HTML
- **世界时钟**：同一时刻在北京 / 东京 / 新加坡 / 伦敦 / 纽约 / 洛杉矶 / UTC 的对照，参考时刻随有效输入切换，改哪边都即时生效
- **双时间戳对比**：A / B 两个输入框各自给出本地时间与 UTC，底部给差值（天 / 小时 / 分 / 秒 / 毫秒余数），方向一律按 **B − A**，负数表示 B 早于 A；两边共用一个单位选择器（默认 auto，混合单位也能读对）；任一侧为空或非法时差值显示占位线，脚注点明是哪一侧读不出来
- 全部走本地 `Date` / `Intl`，纯浏览器计算，不引时区库

## 参数在哪调

没有 `config.ts`，可调常量在 `core/types.ts` 与 `core/format.ts`：

- `WORLD_ZONES`：世界时钟的预设时区（北京 / 东京 / 新加坡 / 伦敦 / 纽约 / 洛杉矶 / UTC），顺序即显示顺序
- `TsUnit`：`'auto' | 's' | 'ms'`，auto 按量级猜（`|值| < 1e11` 当秒）
- `MS_LIMIT = 8.64e15`：`Date` 可表示范围的毫秒边界，越界给统一错误文案 `TS_ERROR`

## 档位

**L2**（+page.svelte + core/ 纯函数 + ui/ 面板）：`core/format.ts`（parseNumber / resolveTimestampMs / formatLocal / formatUtc / dateFromLocalText / formatInZone / diffTimestamps）+ `core/store.svelte.ts` + `core/types.ts`。

## 实现口径

- **auto 按量级猜单位**：`|值| < 1e11` 当秒、否则当毫秒（约公元 5138 年前都成立）；手动指定 s / ms 时直接乘 1000 或原样
- **展示一律手动拼串**：本地与 UTC 时间都用 `Date` 方法自己拼 `YYYY-MM-DD HH:mm:ss`，不用 `toLocaleString`，输出在单测里可预测；UTC 取 `toISOString` 去 T 与毫秒尾巴
- **差值方向只看 negative**：B − A 的分量（天 / 时 / 分 / 秒 / 毫秒余数）全取绝对值，方向只用 `negative` 一个布尔表达，避免算出「−1 天 + 23 小时」这种读不懂的结果
- **当前时间只挂载后取**：`nowStampText` 在浏览器交互里调 `Date.now()`，不在模块初始化时算，防止预渲染把构建时刻烘进 HTML
- **世界时钟用 Intl 时区**：同一 `Date` 按各 IANA 时区 `formatInZone`，不维护时差表

## 已知取舍 / 暂不支持

- 不做时区手动换算 / 夏令时推算，只给固定预设时区的对照（要看别的时区加一条 `WORLD_ZONES` 即可）
- 不解析「3 天前」「下周一」这类相对时间，只认数字时间戳与 `datetime-local`
- 不处理纳秒精度，时间戳最小到毫秒
- 不连 NTP / 不校验本机时钟是否被改过，结果以浏览器当前时间为准

## 验证过什么

- `core/format.test.ts`：秒 / 毫秒 / auto 识别、负数（1970 前）、越界报错、formatLocal / formatUtc 固定格式、datetime-local 解析、世界时钟各时区、diffTimestamps 方向（B 早于 A 的 negative）与分量
- 浏览器实测：默认当前时间、双向换算、世界时钟切换、双时间戳对比差值、预渲染首屏
