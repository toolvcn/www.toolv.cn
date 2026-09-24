# 颜色转换 · /color-converter

> 在线使用：<https://www.toolv.cn/color-converter> ・ 数据全部本地处理，不上传、不落库

- **三种格式互转**：HEX / RGB / HSL 一处输入逐行列出，点行尾按钮复制；短写法 `#f53`、`rgb(255 87 51 / 0.5)` 现代语法、百分比分量、`deg` 单位都认。
- **透明度贯穿**：8 位 HEX、`rgba()` / `hsla()`、百分比透明度可解析，输出按 alpha 自动切 `rgb()` / `rgba()` 形态；预览块按白色打底并注明。
- **WCAG 对比度检查**：背景白 / 黑 / 自定义三选，给出比值与 AA 正文 / AA 大字 / AAA 正文 / AAA 大字四档判定；半透明前景先按 alpha 混进背景再算——看到的才是算的。
- **真实渲染示例**：正文 14px 与大字 24px 粗体两段样张用前景色画在背景色上，达标与否直观可见。
- **原生色板**：`<input type="color">` 选色即时回填输入框；非法输入红字提示并给出格式示例。

## 参数在哪调

初始示例色、对比度卡的预设背景与自定义初始色、WCAG 四档阈值都在根目录 `config.ts`（`EXAMPLE_INPUT` / `WHITE` / `BLACK` / `DEFAULT_CUSTOM_BG` / `WCAG_THRESHOLDS`）。卡面上的「≥ 4.5」这类提示数字从 `WCAG_THRESHOLDS` 拼出来，改达标线时判定与提示一起变。颜色类型与比值的显示精度不在里面——分别在 `core/types.ts` 与 `core/color.ts` 的 `formatRatio`。

## 档位

L2。编排在 `core/store.svelte.ts`（输入、解析结果、`$derived` 三行格式、对比度计算），解析 / 互转 / WCAG 在 `core/color.ts`（纯函数），类型与常量在 `core/types.ts`；面板拆成 `ui/Converter.svelte`（总装）+ `ui/InputCard.svelte` / `ui/FormatsCard.svelte` / `ui/ContrastCard.svelte`，重复样式收进 `ui/styles.ts`。无服务端。

## 实现口径

- 解析只认三种写法：HEX（3 / 4 / 6 / 8 位，可省 `#`）、`rgb()` / `rgba()`、`hsl()` / `hsla()`；逗号与现代空格分隔都支持，alpha 用 `/` 斜杠写法；其余一律判非法返回 null 交界面提示。短写法 `#abc` / `#abcd` 按 CSS 规则每位重复展开。
- 半透明前景先 `blend` 进背景再算对比度（WCAG 看的是屏幕上实际呈现的颜色，不是带 alpha 的前景本身）。
- WCAG 阈值的唯一真值在 `core/color.ts` 的 `wcagPass`，对比度卡徽章提示的数字从 `config.ts` 的 `WCAG_THRESHOLDS` 拼——阈值只在一处定义。
- 不引第三方颜色库：相对亮度按 sRGB 线性化加权（0.2126 / 0.7152 / 0.0722）自算。

## 已知取舍 / 暂不支持

- 不做 CMYK / HSV / 命名色（如 `rebeccapurple`）解析：只认 HEX 与 rgb() / hsl() 函数形式。
- 不做调色板生成 / 色阶衍生 / 屏幕取色：色板用原生 `<input type="color">`，只能取不透明 `#rrggbb`。
- 不做颜色格式「美化」或自动规范化：输入什么格式就解析什么，输出按 alpha 自动选 `rgb()` / `rgba()`，不强行统一。
- 不落库、无历史、无预设：刷新即空（除默认示例）。

## 验证过什么

- `core/color.test.ts`（server project，node 环境）覆盖：解析（HEX 三 / 四 / 六 / 八位、rgb / rgba / hsl / hsla、百分比分量与 `deg`、非法返回 null）、互转（RGB↔HEX、RGB↔HSL 往返一致）、WCAG 对比度与四档判定、半透明 `blend` 后再算。
- 未做浏览器实测（无 axe / 几何量测条目）。
