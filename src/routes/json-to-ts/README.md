# JSON 转 TypeScript · /json-to-ts

> 在线使用：<https://www.toolv.cn/json-to-ts> ・ 数据全部本地处理，不上传、不落库

- **粘贴即生成**：JSON 样例自动推导 `interface` / `type`，根类型名可改（非法字符自动净化成合法标识符），`export` 前缀可开关
- **对象数组合并**：所有元素合成一个 interface，只在部分元素出现的键自动标 `?`；同键类型不同合并成 union（`number | string`）
- **嵌套命名可读**：子接口名 = 父接口名 + 字段（`Root → RootOwner`），对象数组元素带 `Item` 后缀，冲突自动加序号
- **类型细节**：`true`/`false` 合并 boolean、`null` 参与 union、空数组 `unknown[]`、不合法键名自动加引号（`"retry-count"`）
- **输出带语法高亮**：关键字 / 类型名 / 字段名 / 内置类型 / 标点分色，深色主题自动换档；输出区是只读代码块，复制走工具条
- **错误带行列**：JSON 解析失败换算出行列与原因，修正后实时重新生成；纯本地遍历，无任何依赖
- **面板全屏**：输入 / 输出卡片标题行各有一枚全屏按钮（原生全屏，Esc 退出），长类型定义单独铺满屏幕看

## 参数在哪调

可调参数在根层 `config.ts`：

- `EXAMPLE_JSON`：首屏与「清空后恢复」用的示例，覆盖嵌套对象、对象数组（含可选键）、标量数组、混合数组、null 与需引号的键
- `DEFAULT_ROOT_NAME = 'Root'`：默认根类型名（越短，嵌套越深时子接口名越短）
- `DEFAULT_EXPORT_KEYWORD = true`：默认给声明加 `export`
- `MAX_ROOT_NAME = 40`：根类型名输入上限（字符），防止所有子接口名一起变长

生成选项 `GenOptions`（根名 / export 开关）在 `core/types.ts`。

## 档位

**L2**（+page.svelte + config.ts + core/ 纯函数 + ui/ 面板）：`core/json-to-ts.ts`（JSON.parse + 一次 DFS 收集 interface 声明）+ `core/types.ts`，错误定位复用全站共用的 `describeParseError`。

## 实现口径

- **对象数组合并**：所有对象元素合成一个 interface，缺失键（出现次数不足元素数）自动标 `?`；标量数组去重后单类型给 `T[]`、多类型给 `(A | B)[]`
- **命名可读**：子接口名 = 父接口名 + 字段 PascalCase；数组元素统一 `Item` 后缀避免深层命名爆炸；名字冲突时追加 2、3、4……
- **键名净化**：任意字符串先净化成合法标识符，空结果退回 `Value`；不是合法标识符的键用双引号包起来（TS 允许引号键）
- **根非对象时补 type 别名**：根是数组 / 标量时额外生成 `type Root = ...`，占位式 push 保证 interface 声明顺序（父在前、子在它后面追加）

## 已知取舍 / 暂不支持

- 不推断「联合对象」的判别字段，也不做 JSON Schema 反向生成
- 不读取类型提示 / 注释 / 示例值范围（如把 `"2026-01-01"` 推成 `string` 而非 `Date`）
- 生成的 `union` 类型可能因多次出现同键不同值而变长，属预期，不在内部合并成更简写法
- 不做「类型与 JSON 双向往返校验」

## 验证过什么

- `core/json-to-ts.test.ts`：覆盖嵌套对象、对象数组合并 / 可选键、混合数组、null union、空数组、引号键、根非对象别名、命名冲突加序号
- 浏览器实测：示例载入、根名非法字符净化、export 开关、复制完整代码
