# 浏览器信息 & UA 解析 · /device-info

> 在线使用：<https://www.toolv.cn/device-info> ・ 数据全部本地读取，不上传、不落库

- **十组一屏看完**：浏览器、系统与设备、屏幕与显示、网络与地区、存储、硬件与传感器、设备方向与运动、多媒体设备、性能与渲染、权限状态共 66 项，逐行可复制
- **UA 解析**：当前浏览器的 UA 原文与解析结果（浏览器 / 版本 / 渲染引擎 / 系统 / 设备类型 / 宿主 App）
- **解析任意 UA**：粘贴别人日志里的一段 UA，立刻解出对应环境 —— 这页真正会被反复用的地方
- **能力探测**：WebP / AVIF / WebAssembly / Service Worker / 剪贴板 / WebGL / Web Bluetooth / WebUSB / WebAuthn 等 18 项，绿色支持、灰色没有
- **硬件与性能**：电池状态与电量、已连接手柄、键盘布局、摄像头与麦克风数量、TTFB / FCP / LCP 等指标
- **跟随环境变化**：转屏、改窗口、系统切深色、断网都会重采，不用手动刷新
- **一键带走**：复制全部（JSON）或导出 `.json`，贴 issue 里不用再翻译一遍

## 采集了什么

| 分组           | 字段                                                                             | 主要来源                                                        |
| -------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 浏览器         | 浏览器与版本、渲染引擎、UA 品牌、界面语言与优先顺序、Cookie 开关、联网状态       | `navigator.userAgent` / `userAgentData` / `language`            |
| 系统与设备     | 操作系统与版本、设备类型、逻辑处理器、设备内存、最大触摸点数、指针精度、悬浮支持 | UA 解析 + `hardwareConcurrency` / `deviceMemory` / `matchMedia` |
| 屏幕与显示     | 视口、屏幕分辨率、可用区域、DPR、色深、屏幕方向、主题偏好、减少动效、根字号      | `screen` / `window.innerWidth` / `matchMedia`                   |
| 网络与地区     | 时区、UTC 偏移、连接类型、下行带宽、往返时延、省流量模式                         | `Intl.DateTimeFormat` / `navigator.connection`                  |
| 存储           | localStorage / sessionStorage 可用性与条目数、存储配额与已用                     | `navigator.storage.estimate()`                                  |
| 硬件与传感器   | 电池状态 / 电量 / 充满与可用时间、已连接手柄与型号、键盘布局、Canvas 指纹        | `getBattery()` / `getGamepads()` / `keyboard.getLayoutMap()`    |
| 设备方向与运动 | 设备方向（α / β / γ）、含重力的加速度、旋转速率、环境光                          | `deviceorientation` / `devicemotion` / `AmbientLightSensor`     |
| 多媒体设备     | 摄像头 / 麦克风 / 扬声器数量、设备名称                                           | `mediaDevices.enumerateDevices()`                               |
| 性能与渲染     | TTFB、DOM 就绪、加载完成、FP、FCP、LCP、已加载资源数与体积                       | `performance` 导航与绘制条目 + `PerformanceObserver`            |
| 权限状态       | 地理位置 / 通知 / 摄像头 / 麦克风 / 剪贴板读取的三态                             | `navigator.permissions.query()`                                 |

浏览器不支持的字段显示占位符 `—`，复制按钮同时禁用 —— 不拿「0」或「未知」冒充结果。

## 大部分自动，五项点了才读

**随刷新自己补的**是绝大多数分组：要么同步读（浏览器 / 系统 / 屏幕 / 网络 / 性能），
要么是不弹框的异步调用（存储配额、设备数量、权限状态）。`resize` 与转屏只触发这一批。

**点了才读的五项**，理由只有两个：会弹权限框，或属于设备指纹信息。

放在工具条上（两处开关 / 按钮）：

- **WebGL 渲染器默认不读**：能指到具体显卡，属于硬件指纹信息；要看得先打开工具条上的开关。
- **高精度版本点了才取**：`userAgentData.getHighEntropyValues()` 是异步的、且只有 Chromium 系有，
  不进首屏；不支持的浏览器点了会明说不支持，而不是假装成功。

放在分组卡标题行右侧（三处按钮）：

- **Canvas 指纹**：同样是指纹信息，按钮「读取指纹」，不随刷新自己补。
- **设备名称**：没授权前浏览器只给数量不给名字。点了会申请一次摄像头与麦克风权限，
  **拿到授权立刻 `stop()` 掉所有轨道**，不采画面也不采声音；被拒绝就只显示数量。
- **传感器**：iOS 13+ 的 `requestPermission()` 必须在用户手势里调用，所以只能由按钮触发。
  等 1.5 秒收不到数据（桌面端多数没有传感器）就明说没等到，不留常驻监听。

这三张卡的标题行左侧有一行状态字（`role="status"`，读屏会播报）：未读取 / 读取中 / 已读取快照 /
权限被拒 / 这台浏览器没有。**失败会在页面上留痕** —— 否则用户只会看到 toast 一闪，然后反复点同一个按钮。

传感器读的是**单次快照**，不是实时仪表：转一下手机不会自动刷新，要重新点按钮。

标了「〔实验〕」的两个字段（键盘布局、环境光）属于实验性规范，只有个别浏览器实现 ——
光靠空值 `—` 分不清「这台设备没有」还是「规范没人实现」，所以直接写在行名上。

## UA 解析的口径

UA 没有标准格式，各家为了兼容还会往里塞别人的标识，所以解析是**顺序敏感**的：

1. 先认宿主 App（微信 / QQ / 支付宝 / 钉钉 / 微博 / Android WebView）—— 内置浏览器的 UA 里也有 Chrome；
2. 再认浏览器（Edge → Opera → 各家国产 → Chrome → Firefox → Chromium → Safari），
   iOS 上的 Chrome / Firefox 走 `CriOS` / `FxiOS`，引擎仍是 Blink / Gecko，不是 WebKit；
3. 最后认系统与设备：`HarmonyOS` 要先于 `Android` 判断，iPad「请求桌面网站」时 UA 与 Mac 一模一样，
   只有 `maxTouchPoints` 能把它认出来（真 Mac 接触摸屏不会被误判成平板）。

结果是启发式的：UA 可以随便改，也可能被浏览器冻结（UA reduction）。页面底部如实写了这一点。

## 参数在哪调

**没有 `config.ts`** —— 这一页要用的是**领域数据**（一条规则对应一个名字），不是「可调数值」；
同一条数也不会同时被 `core/` 与 `ui/` 读，没到建它的门槛（`STRUCTURE §2 B`）。要改的东西就三处：

- **字段与分组定义**在 `core/types.ts`（`GROUP_DEFS` 十组 66 项、占位符 `PLACEHOLDER`）——
  首屏骨架与采集都读它，加一项要采的东西先改这里
- **UA 规则表**在 `core/ua.ts`（`BROWSER_RULES` / `APP_RULES` / `WINDOWS_VERSIONS` / `DEVICE_LABEL` / `BOT_RE`）——
  数组顺序就是识别顺序，认错浏览器先看这个顺序
- **权限字段清单**在 `core/collect.ts`（`PERMISSION_FIELDS`）；唯一的数值参数是传感器等待时长，
  就写在 `waitForMotion(timeoutMs = 1500)` 的形参上

## 档位

**L1**：`+page.svelte`（外壳 + 采集与监听）+ `core/store.svelte.ts`（编排）+ `ui/` 下四个组件
（`InfoBoard` 工具条与栅格 / `InfoGroup` 分组卡 / `UaPanel` 当前 UA 与解析 / `CapabilityPanel` 能力徽章）——
几块并列的卡片，不是多标签面板，不升 L2。**没有 `ui/styles.ts`**。

`core/` 里的分工：`types.ts` 字段与分组定义（预渲染靠它出骨架）、`ua.ts` 纯字符串 UA 解析、
`collect.ts` 读浏览器 API 并格式化成字符串（导出 JSON 也在这）、`store.svelte.ts` 编排。
逐文件与前缀缩进不在这里复述 —— `ls` 看得到。

## 实现口径

- **同步与异步分开**是这页唯一值得留意的设计：`resize` / 转屏这类高频事件只触发同步重采
  （`store.refresh()`），电池、设备枚举、权限查询这些异步调用由 `refreshAsync()` 走，
  只在挂载与点「刷新」时跑一次 —— 否则拖一次窗口就会打出一串 `enumerateDevices()`。
- **传感器只等一次就走**（`waitForMotion(1500)`）：1.5 秒收不到数据就收摊、不留常驻监听 ——
  桌面端多数没有传感器，留着监听只会空耗。
- **拿到授权立刻 `stop()`**：设备名称那一次申请在拿到名字后把所有轨道停掉，不采画面也不采声音。
- 首屏由预渲染输出骨架（分组标题 + 行名 + `—`），客户端 hydration 后填满 ——
  `curl` 回来的 HTML 里就能看到主要区块，SEO 与首屏速度都不牺牲。

## 已知取舍 / 暂不支持

- **不采集** IP、地理位置与公网出口 —— 那都要服务端或第三方接口，与本站「数据本地处理」的承诺冲突。
  本页也**没有**用 `RTCPeerConnection` 做本地 / 公网 IP 探测，理由同上：那要走 STUN 服务器，等于向外网发请求。
- **权限那一组只查询状态**，不会触发任何权限请求（`navigator.permissions.query()`）。
- **不做实时仪表**：方向 / 加速度 / 光照读的是单次快照，不是持续采样（见「大部分自动，五项点了才读」）。

## 验证过什么

- `core/ua.test.ts` **22 例**：一批真实 UA 串的表驱动断言 —— 宿主 App、各家浏览器（含 iOS 上的 `CriOS` / `FxiOS`）、
  HarmonyOS 与 iPad 桌面模式、爬虫。
- `core/collect.test.ts` **13 例**：采集层里的纯函数 —— 时长与电池时间格式化、FNV-1a 指纹、设备计数。

读取浏览器 API 与渲染那两层依赖真实环境，不进单测。
