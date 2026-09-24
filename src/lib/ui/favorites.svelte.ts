// 工具收藏：全站唯一实例 + localStorage 持久化。
//
// 放在 $lib/ui 根层而不是某个工具目录：收藏是站点级的（入口在 ToolMenu 抽屉里，
// 首页与所有工具页共用同一份），跟 theme.svelte.ts / toast.svelte.ts 同层同口径
// —— 一页只跑一个工具，不需要按工具隔离。
//
// 解析与切换是纯函数（parseStoredFavorites / toggleFavorite），不碰 DOM，好在 node 里单测；
// 类里只负责读写存储。
//
// **只有本机**：不做登录、不往后端同步，也不校验路径是否还是有效工具 —— 那件事由渲染方
// （ToolMenu 拿路径回查 TOOL_CATEGORIES）负责，因为只有它知道当前有哪些工具。

/** localStorage 键名 */
export const FAVORITES_STORAGE_KEY = 'toolv:favorites';

/**
 * 存储值 → 路径列表。宽容解析：坏 JSON、不是数组、混进非字符串都当作没收藏过；
 * 重复项只留第一次出现的位置。顺序就是抽屉里「我的收藏」那一组的顺序（先收藏的在前）。
 */
export function parseStoredFavorites(stored: string | null): string[] {
	if (!stored) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(stored);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	// 用 includes 去重而不是 Set：这里是个纯函数，Set 会被 eslint 的
	// svelte/prefer-svelte-reactivity 当成响应式状态要求换成 SvelteSet；
	// 工具总数只有几十个，O(n²) 在这个量级不成立为问题。
	const paths: string[] = [];
	for (const item of parsed) {
		if (typeof item !== 'string' || item === '' || paths.includes(item)) continue;
		paths.push(item);
	}
	return paths;
}

/** 切换一个路径的收藏状态：已在列表里就移除，不在就追加到末尾。返回新数组，不改原数组 */
export function toggleFavorite(paths: readonly string[], path: string): string[] {
	return paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path];
}

export class FavoritesState {
	/** 已收藏的工具路径；SSR 与首帧是空数组，客户端 init() 之后才有值 */
	paths = $state<string[]>([]);

	has(path: string): boolean {
		return this.paths.includes(path);
	}

	/**
	 * 读存储。**只在浏览器里调一次**（+layout.svelte 的 onMount）。
	 * 隐私模式下读写会抛，整个读写都包 try/catch：存不下就只在本次会话生效，页面照常能用。
	 */
	init(): void {
		try {
			this.paths = parseStoredFavorites(localStorage.getItem(FAVORITES_STORAGE_KEY));
		} catch {
			/* 读不到就当作没收藏过 */
		}
	}

	/** 收藏 / 取消收藏。抽屉里每行的星标、以及「我的收藏」里那行的星标都走它 */
	toggle(path: string): void {
		this.#commit(toggleFavorite(this.paths, path));
	}

	#commit(paths: string[]): void {
		this.paths = paths;
		try {
			// 空列表不留空数组：跟主题的「跟随系统 = 键不存在」同一个口径，
			// 少一个看起来像有数据、其实什么都没存的键
			if (paths.length === 0) localStorage.removeItem(FAVORITES_STORAGE_KEY);
			else localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(paths));
		} catch {
			/* 存不下就只在本次会话生效 */
		}
	}
}

/** 全站唯一实例 */
export const favorites = new FavoritesState();
