// 窗口投放：两种形态，取舍不同，**都保留**。
//
//   ① 画中画（Document Picture-in-Picture，Chrome / Edge 116+）—— openPipWindow
//      把时钟舞台那个 DOM 节点**整体搬进**一个始终置顶、可自由拖拽缩放的小窗口。
//      搬的是同一个节点，所以 Svelte 的响应式更新照旧作用在它身上：在这页改颜色，小窗立刻跟着变，
//      一行同步代码都不用写（重新渲染一份就得再造一条状态同步通道）。
//      **代价是寿命绑在打开它的那个窗口上** —— 关掉工具页，小窗也跟着没了。这是浏览器的规定，改不了。
//
//   ② 独立窗口 /clock/display —— openStandaloneWindow
//      一个真正独立的页面：有自己的地址、能刷新、能收藏、能拖到副屏，**关掉工具页也照样活着**。
//      配置**写在地址参数里**（`buildDisplayQuery` 生成），所以一份地址自带一份配置：
//      可以同时开好几个窗口各显示各的，地址也能收藏、能发给别人、能丢进 OBS 的浏览器源。
//      地址里没写的项才回落到与工具页共享的 localStorage（逐项覆盖，口径见 core/params.ts）。
//
// ⚠️ 画中画那条路要求时钟舞台的样式全部内联（见 ClockStage.svelte 顶部注释）：
// 新窗口里没有本站的样式表，用 Tailwind class 写的地方会整块失灵。

import { resolve } from '$app/paths';
import { STANDALONE_PATH, WINDOW_NAME } from '../config.ts';

// Document Picture-in-Picture 目前还没进 lib.dom，自己补一个最小的声明。
// 只声明用得到的那个方法，别的都不需要，所以不引 @types 包。
declare global {
	interface Window {
		documentPictureInPicture?: {
			requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
		};
	}
}

export type WindowKind = 'pip' | 'standalone';

export type OpenResult = { ok: true; kind: WindowKind; close: () => void } | { ok: false; reason: string };

/** 浏览器是否支持置顶的画中画；不支持就只剩独立窗口这条路 */
export function supportsPip(): boolean {
	return typeof window !== 'undefined' && window.documentPictureInPicture !== undefined;
}

/**
 * 独立窗口的完整地址：路径 + 查询串。
 * 「打开独立窗口」与「复制地址」共用这一处拼接，免得两处各拼一遍拼出两种样子。
 */
export function standaloneUrl(query: string): string {
	const path = resolve(STANDALONE_PATH);
	const url = query === '' ? path : `${path}?${query}`;
	return typeof location === 'undefined' ? url : `${location.origin}${url}`;
}

/**
 * 备好画中画窗口的文档：去掉浏览器默认的 8px 外边距、撑满视口，返回可挂内容的 body。
 * 背景留 transparent —— 时钟自己的背景色画在舞台上，窗口这层不该再垫一层底色。
 *
 * 两处细节：
 *   · **只走 `doc.body`，不再自己 createElement 兜底**：那段兜底是给早先 `window.open('')` 的空白窗口
 *     写的，独立窗口改成 `/clock/display` 之后那条路已经没了；画中画给的是完整文档，必有 body。
 *   · **挂节点用 `appendChild` 而不是 `append`**：本仓库 tsconfig 把 `./worker-configuration.d.ts`
 *     列为唯一 `types`，其中 workerd 的 `Element` 声明会与 lib.dom 的合并，而它那个
 *     `append(content: string | ReadableStream | Response)` 会盖掉 DOM 的 `append(...nodes)` ——
 *     传一个元素进去必报类型错。`appendChild` 来自 `Node`，不受影响。
 */
function prepareDocument(doc: Document): HTMLElement | null {
	doc.documentElement.style.cssText = 'height: 100%; background: transparent;';
	const body = doc.body;
	if (!body) return null;
	body.style.cssText = 'margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent;';
	doc.title = '时钟';
	return body;
}

/**
 * 打开置顶的画中画，把舞台节点搬过去。`onClose` 在窗口关掉时回调一次（节点已搬回原位）。
 *
 * 不支持、或被用户拒绝时返回失败 —— **降级交给调用方**（那边才知道要不要改开独立窗口）。
 * 注意：`requestWindow` 必须落在用户手势的同一个 tick 里，所以本函数 await 之前不做别的事。
 */
export async function openPipWindow(
	stage: HTMLElement,
	size: { width: number; height: number },
	onClose: () => void
): Promise<OpenResult> {
	const pip = window.documentPictureInPicture;
	if (!pip) return { ok: false, reason: '当前浏览器不支持置顶的画中画窗口' };

	const home = stage.parentElement;
	if (!home) return { ok: false, reason: '找不到舞台所在的位置' };

	// 留一个注释节点占住原位，关窗时把舞台插回它前面
	const anchor = document.createComment('clock-stage-home');
	home.insertBefore(anchor, stage);

	let restored = false;
	const restore = (): void => {
		if (restored) return;
		restored = true;
		anchor.parentNode?.insertBefore(stage, anchor);
		onClose();
	};

	try {
		const win = await pip.requestWindow({ width: size.width, height: size.height });
		const container = prepareDocument(win.document);
		if (!container) throw new Error('画中画窗口的文档还没准备好');
		container.appendChild(stage);
		win.addEventListener('pagehide', restore);
		return { ok: true, kind: 'pip', close: () => win.close() };
	} catch {
		// 用户拒绝、或这个文档已经在画中画里了 —— 把占位节点收干净，别留下垃圾
		anchor.parentNode?.removeChild(anchor);
		return { ok: false, reason: '没能打开画中画窗口（可能被拒绝，或已经开过一个了）' };
	}
}

export interface StandaloneOptions {
	/** 地址参数（`buildDisplayQuery` 生成，不含前导 `?`） */
	query: string;
	width: number;
	height: number;
	/**
	 * 窗口名后缀。**按模式区分是必要的** —— 浏览器对同名窗口是复用而不是新开，
	 * 不给后缀的话「再开一个倒计时窗口」会把已经在放时钟的那个窗口顶掉，
	 * 那就正好毁掉了「多个配置各显示各的」这个用法。
	 */
	key: string;
}

/**
 * 打开独立窗口：一个普通的 `window.open`，指向本工具自己的展示页，配置全在地址里。
 *
 * 与画中画的关键差别是**它不搬 DOM**：那页会自己渲染一份时钟。
 */
export function openStandaloneWindow(options: StandaloneOptions, onClose: () => void): OpenResult {
	const { query, width, height, key } = options;
	const win = window.open(standaloneUrl(query), `${WINDOW_NAME}-${key}`, `popup=yes,width=${width},height=${height}`);
	if (!win) return { ok: false, reason: '浏览器拦截了弹出窗口，请在地址栏允许本页弹出窗口后重试' };

	let notified = false;
	win.addEventListener('pagehide', () => {
		if (notified) return;
		notified = true;
		onClose();
	});
	return { ok: true, kind: 'standalone', close: () => win.close() };
}
