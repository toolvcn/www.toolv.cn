// 系统「减少动态效果」偏好（prefers-reduced-motion: reduce）的**唯一读取处**。
//
// 为什么不能只靠 CSS：仓库里两处位移动画是 Svelte 的 `transition:fly`（抽屉横移 320px、
// Toast 上浮 8px）。Svelte 5 的过渡走 **Web Animations API**（`element.animate()`）而不是
// CSS animation —— 于是 `layout.css` 里那条 `@media (prefers-reduced-motion: reduce)`
// 压 `animation-duration` 的写法对它们**无效**（实测：开了 reduce，抽屉的 computed
// animation-duration 变了，但 60ms 后抽屉仍停在 x=-95 的半路上）。
// 所以时长这一档要在 JS 侧给：偏好「减少动态」时直接传 0，动画瞬间到达终态。
//
// 纯 CSS 的动效（`animate-pulse` / `animate-spin` / 各处的 `transition-*`）仍由
// layout.css 那条媒体查询管，不必在这里重复处理。
import { MediaQuery } from 'svelte/reactivity';

// fallback=false：SSR 阶段拿不到 matchMedia，按「不减少」算（首帧还没动效，无影响）
const reduced = new MediaQuery('prefers-reduced-motion: reduce', false);

/**
 * 动效时长：系统开了「减少动态效果」就给 0。
 *
 * 传 0 而不是跳过 transition：走 Svelte 的过渡仍会把元素挂上 / 摘下的时序保持一致，
 * 只是位移在一帧内完成 —— 抽屉照常出现、Toast 照常可读。
 */
export function motionDuration(ms: number): number {
	return reduced.current ? 0 : ms;
}
