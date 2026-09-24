# JSON 格式化 · /json-formatter

> 在线使用：<https://www.toolv.cn/json-formatter> ・ 数据全部本地处理，不上传、不落库

- **格式化 / 压缩**：缩进可选 2 / 4 空格或 Tab，一个输入框两种模式，压缩结果没有多余换行
- **实时校验与错误定位**：输入即校验；解析失败给出人类可读原因 + 行 / 列（V8 不同版本只报位置时自动换算行列）
- **语法高亮**：键 / 字符串 / 数字 / 字面量分色，超长 JSON 只渲染前 2 万 token、复制仍取完整内容
- **示例与清空**：空态一键填示例 JSON；错误与空态文案区分，不写笼统的「暂无数据」
- **面板全屏**：输入 / 输出卡片标题行各有一枚全屏按钮，长 JSON 不用再挤在半屏里（原生全屏，Esc 退出）

## 参数在哪调

没有 `config.ts`，可调常量都在 `core/types.ts`：

- `INDENT_VALUE`：缩进选项到 `JSON.stringify` 第三参数的映射，`'2' | '4' | 'tab'`
- `RENDER_TOKEN_LIMIT = 20_000`：高亮渲染的 token 上限，只卡显示不卡数据
- 示例内容 `SAMPLE_JSON` 在 `core/json.ts`（对象 / 数组 / 数字 / 布尔 / null 五种类型俱全）

## 档位

**L2**（+page.svelte + core/ 纯函数 + ui/ 面板）：`core/json.ts`（transformJson / 错误定位 / 独立语法扫描器）+ `core/types.ts`，高亮分词复用全站共用的 `$lib/utils/json`。

## 实现口径

- **只 parse 一遍**：成功就序列化（顺带分词），失败才把错误翻译成行列，不做「先校验再转」的两遍解析，大文本不白跑一次
- **V8 文案变体兜底**：新版（带位置 / 带上下文摘录）、旧版（只带 position）三种报错格式逐一识别；拿不到数字位置时用自己的 RFC 8259 扫描器 `findFirstJsonError` 定位第一个错误，嵌套深度上限 512，避免爆调用栈
- **只卡显示不卡数据**：高亮是一个 token 一个 `<span>`，几百 KB 的 JSON 会炸出几十万节点，故渲染截到前 2 万 token，复制拿到的仍是完整输出

## 已知取舍 / 暂不支持

- 不做 JSON5 / 带注释 / 尾逗号等非标准方言，只认标准 JSON
- 不提供「比较两份 JSON」或 schema 校验，那是 /text-diff、专用校验工具的事
- 错误定位是「第一个」问题点，修完可能还有下一个，不会一次列出全部

## 验证过什么

- `core/json.test.ts`（或 `src/lib/utils/json.test.ts` 共用的高亮分词单测）：覆盖正常格式化 / 压缩、三类 V8 报错文案的位置换算、`findFirstJsonError` 各分支
- 浏览器实测：示例载入、超大 JSON 高亮不卡死、复制内容完整
