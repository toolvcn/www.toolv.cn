# WebSocket 在线调试 · /websocket

> 在线使用：<https://www.toolv.cn/websocket> ・ 数据全部本地处理，不上传、不落库

- **多连接并行管理**：可批量 +10，每条连接独立开关、独立收发统计
- **实时收发**：JSON 自动高亮（键 / 字符串 / 数字 / 字面量分别上色），发送、接收、系统三类消息用不同底色区分
- **延迟检测**：消息体是带 `time` 字段的 JSON 时，用 ping/pong 往返时间算延迟
- **定时发送**：每条连接可配多条定时任务，各自独立开关；也能设成「新建连接自带一条」
- **双向筛选**：按连接状态筛选连接，按消息方向筛选日志；都不勾时给明确空态，而不是静默显示全部
- **日志管理**：单条折叠 / 一键全部折叠展开、复制单条、导出为 JSON（带筛选条件与结构化字段）
- **快捷消息预设**：点一下填入输入框，或点图标直接发送；可存到浏览器本地，也能一键恢复默认
- **内置公共回显地址**：`wss://echo.websocket.org`、`wss://ws.postman-echo.com/raw`、`wss://ws.ifelse.io`，点选即替换输入框地址，菜单里标注了各自特性

## 参数在哪调

预设的 localStorage 键、定时任务的两个默认间隔、建连超时、日志的软上限 / 裁剪步长 / 渲染窗口
都在根目录 `config.ts`（是从 `core/types.ts` 里分出来的）。连接与日志的类型**不在**里面，仍在
`core/types.ts` —— 那个文件现在只留类型。默认预设的内容是数据不是参数，留在 `core/format.ts` 的 `defaultPresets()`。

## 档位

**L2**（+page.svelte + config.ts + core/ 纯逻辑 + ui/ 面板）：`core/websocket.svelte.ts`（连接编排）/ `core/connection.svelte.ts`（单连接）/ `core/connection-list.svelte.ts` / `core/log-book.svelte.ts`（日志）+ `core/types.ts`（类型）+ `core/format.ts`（格式化与 `defaultPresets()`）/ `core/json.ts`（高亮）/ `core/labels.ts`（状态文案）+ `core/fake-socket.ts`（单测用的 `SocketLike` 实现）。

## 实现口径

- **连接只依赖最小接口 `SocketLike`**：生产环境传 `new WebSocket(url)`、单测传 `FakeSocket`，两者回调签名对齐原生 WebSocket，不需要适配器 —— 多连接并行、收发统计、定时任务都能在 node 里跑单测
- **延迟走 ping/pong 往返**：消息体是带 `time` 字段的 JSON 时，用收到回显的 `time` 算往返时间，不是靠心跳协议
- **日志字段惰性计算**：`LogEntry` 的 `size` / `tokens` 是 getter，入库不算（导出 / 筛选 / 计数用不到 `tokens`，折叠的日志也读不到），避免每条都 new Blob + parse + 分词白干
- **日志三档上限**：软上限 `LOG_LIMIT=5000` 超了丢最早，触顶时一次多丢 `LOG_TRIM_STEP=500` 而非每条搬一次；渲染只出最近 `RENDER_STEP=300` 条，否则整页被撑到几万 px
- **建连超时主动兜底**：浏览器自身超时可能拖很久，`CONNECT_TIMEOUT_MS=10000` 主动截断不可达地址
- **预设只落盘、且用户触发**：只有消息预设写 `localStorage`（`PRESET_STORAGE_KEY`），连接与定时任务一律不持久化

## 已知取舍 / 暂不支持

- 只做文本 / JSON 帧，不处理二进制帧（Blob / ArrayBuffer）的内容展示
- 不持久化连接与定时任务（刷新即失），只存消息预设
- 不做「按内容搜索日志」「日志里跳转某条」这类检索，只按连接状态 / 消息方向两个维度筛选
- 不做自动重连策略配置（断线后是否重连留给用户手动），内置公共回显地址只是方便试连

## 验证过什么

- `core/connection.test.ts` / `core/connection-list.test.ts` / `core/log-book.test.ts` / `core/websocket.test.ts`：用 `FakeSocket` 跑多连接开关、收发统计、定时任务、日志裁剪与渲染窗口、筛选空态
- `core/json.test.ts` / `core/labels.test.ts`：高亮分词与状态文案
- `core/format.test.ts`：时间与体积格式化、`defaultPresets()` 往返
- 浏览器实测：内置公共地址试连、JSON 高亮、定时发送、预设保存 / 恢复默认、导出 JSON
