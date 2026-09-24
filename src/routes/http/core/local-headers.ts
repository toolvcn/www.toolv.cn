// 「本机请求头」：把本机浏览器**会带上的那几个头**拼成请求头输入框认得的文本（每行一条「名称: 值」）。
//
// 两个函数分开是有意的：
//   · `formatLocalHeaders` 是纯函数，吃一份「浏览器信息」吐文本 —— 单测里能直接断言；
//   · `readBrowserHeaders` 读 `navigator`，只能在浏览器侧的点击回调里调用（SSR / node 里 navigator 不存在）。
//
// 为什么要手动拼一份：浏览器不允许 JS 读取自己即将发出的请求头，也**改不掉** UA / Accept-* 这些
// 由浏览器接管的头。这里拼出来的那份是给你「照着填、照着改」用的底稿，不是真实抓包结果。
// Sec-CH-UA 那三项来自 `navigator.userAgentData`（Client Hints），只有 Chromium 系才给，
// 拿不到就整项不写 —— 写个空值进去反而更像抓包失败。

/** 拼请求头要用的那几个浏览器信息 */
export interface BrowserHeaders {
	userAgent: string;
	/** 界面语言偏好，按优先级从高到低；空数组时退回 `*` */
	languages: readonly string[];
	/** Client Hints 的浏览器品牌列表；没有就空数组 */
	brands: readonly { brand: string; version: string }[];
	/** 是否移动端；拿不到给 null（那就不写这一项） */
	mobile: boolean | null;
	/** 系统平台名；空串表示拿不到 */
	platform: string;
}

/** Accept 用 Chrome 桌面版那串，涵盖性最好；也是多数接口文档里默认的那一串 */
const ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';

/**
 * 语言偏好 → `zh-CN,zh;q=0.9,en;q=0.8`：第一项权重 1（不写 q），之后每项递减 0.1，最低 0.1。
 * 一条都没有时给 `*`，跟浏览器「不挑语言」时的写法一致。
 */
function formatLanguages(languages: readonly string[]): string {
	const list = languages.filter((lang) => lang !== '');
	if (list.length === 0) return '*';
	// 浏览器实际发的那串不带空格，照着写（服务端解析没问题，但对照抓包结果时会多一处不一致）
	return list
		.map((lang, index) => (index === 0 ? lang : `${lang};q=${Math.max(0.1, 1 - index * 0.1).toFixed(1)}`))
		.join(',');
}

/** 拼成本机请求头文本。拿不到的项整条不写，绝不写空值 */
export function formatLocalHeaders(info: BrowserHeaders): string {
	const headers: { name: string; value: string }[] = [];
	if (info.userAgent !== '') headers.push({ name: 'User-Agent', value: info.userAgent });
	headers.push({ name: 'Accept', value: ACCEPT });
	headers.push({ name: 'Accept-Language', value: formatLanguages(info.languages) });
	headers.push({ name: 'Accept-Encoding', value: 'gzip, deflate, br' });
	headers.push({ name: 'Upgrade-Insecure-Requests', value: '1' });
	if (info.brands.length > 0) {
		const value = info.brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
		headers.push({ name: 'Sec-CH-UA', value });
	}
	if (info.mobile !== null) headers.push({ name: 'Sec-CH-UA-Mobile', value: info.mobile ? '?1' : '?0' });
	if (info.platform !== '') headers.push({ name: 'Sec-CH-UA-Platform', value: `"${info.platform}"` });
	return headers.map((header) => `${header.name}: ${header.value}`).join('\n');
}

/** navigator.userAgentData 的形状（只有 Chromium 系有，类型库里不一定带） */
interface UserAgentData {
	brands?: { brand: string; version: string }[];
	mobile?: boolean;
	platform?: string;
}

/**
 * 读本机浏览器的那几个信息。**只能在浏览器侧的点击回调里调用**（SSR 不跑交互，node 里没有浏览器）。
 * 单测靠 `vi.stubGlobal('navigator', …)` 造一份假数据，不为 SSR 额外写兜底分支。
 */
export function readBrowserHeaders(): BrowserHeaders {
	const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
	const languages = navigator.languages ?? (navigator.language ? [navigator.language] : []);
	return {
		userAgent: navigator.userAgent,
		languages: [...languages],
		brands: data?.brands ?? [],
		mobile: data?.mobile ?? null,
		platform: data?.platform ?? ''
	};
}
