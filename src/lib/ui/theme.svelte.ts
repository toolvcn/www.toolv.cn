// 全站主题（深 / 浅）的状态机 + 唯一实例。
//
// 放在 $lib/ui 而不是某个工具目录：主题是站点级的（导航条切换、所有工具页生效），
// 跟 `toast.svelte.ts` 同层同口径 —— 一页只跑一个工具，不需要按工具隔离。
//
// 三态：跟随系统 / 浅色 / 深色。存 localStorage，跟官方 dark mode 文档的约定一致
// ——「跟随系统」= 键不存在，显式选了才写 'light' / 'dark'。
//
// 解析逻辑是纯函数（resolveTheme / parseStoredPreference / nextPreference），
// 不碰 DOM，好单测；类里只负责读写存储、监听系统变化、把结果落到 <html class="dark">。
// 真正让颜色变的是 layout.css 里的 `.dark` 变量组，这里只管加不加这个类。

/** 用户的选择；system 表示跟随系统 */
export type ThemePreference = 'system' | 'light' | 'dark';
/** 实际生效的主题 */
export type ResolvedTheme = 'light' | 'dark';

/** localStorage 键名；跟 app.html 里防闪烁脚本用的是同一个 */
export const THEME_STORAGE_KEY = 'toolv:theme';

/** 循环顺序：系统 → 浅 → 深 → 系统 */
const CYCLE: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** 偏好 + 系统是否深色 → 实际主题 */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
	return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

/** 存储值 → 偏好；空 / 认不出来的值一律当「跟随系统」（首次访问即跟随系统） */
export function parseStoredPreference(stored: string | null): ThemePreference {
	return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** 点一下切到下一档 */
export function nextPreference(current: ThemePreference): ThemePreference {
	return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
}

export class ThemeState {
	/** 用户选择，默认跟随系统 */
	preference = $state<ThemePreference>('system');
	/** 系统当前是否深色；跟随系统时它决定了实际主题 */
	systemDark = $state(false);

	#media: MediaQueryList | null = null;

	/** 实际生效的主题 */
	get resolved(): ResolvedTheme {
		return resolveTheme(this.preference, this.systemDark);
	}

	/**
	 * 读存储 + 监听系统变化。**只在浏览器里调一次**（+layout.svelte 的 onMount）。
	 * 首帧的深浅由 app.html 里的内联脚本先定好，这里负责接手后续变化。
	 */
	init(): void {
		try {
			this.preference = parseStoredPreference(localStorage.getItem(THEME_STORAGE_KEY));
			this.#media = window.matchMedia('(prefers-color-scheme: dark)');
			this.systemDark = this.#media.matches;
			this.#media.addEventListener('change', this.#onSystemChange);
		} catch {
			// 隐私模式 / 老浏览器：读写不了存储就停在「跟随系统」，页面仍可用
		}
		this.apply();
	}

	/** 切换一档（导航条按钮） */
	cycle(): void {
		this.set(nextPreference(this.preference));
	}

	/** 直接选一档 */
	set(preference: ThemePreference): void {
		this.preference = preference;
		try {
			if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
			else localStorage.setItem(THEME_STORAGE_KEY, preference);
		} catch {
			// 存不下就只在本次会话生效
		}
		this.apply();
	}

	/** 把结果落到 <html>：class 决定配色，colorScheme 决定滚动条与原生控件 */
	apply(): void {
		const dark = this.resolved === 'dark';
		const root = document.documentElement;
		root.classList.toggle('dark', dark);
		root.style.colorScheme = dark ? 'dark' : 'light';
	}

	#onSystemChange = (event: MediaQueryListEvent): void => {
		this.systemDark = event.matches;
		this.apply();
	};
}

/** 全站唯一实例 */
export const theme = new ThemeState();
