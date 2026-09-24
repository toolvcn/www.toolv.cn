// UA 解析的单测：全部是真实 UA 串（各版本略有出入不影响判定）。
// 这一层不碰浏览器 API，所以在 node 环境里跑。
import { describe, expect, it } from 'vitest';
import { formatNameVersion, parseUserAgent, uaRows } from './ua.ts';

/** 常用的几条真实 UA，改解析规则时先过一遍 */
const UA = {
	chromeWin:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
	edgeWin:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
	safariIphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
	safariMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
	chromeIos:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
	firefoxWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
	wechatAndroid:
		'Mozilla/5.0 (Linux; Android 13; SM-S9080 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 MMWEBID/1234 MicroMessenger/8.0.49.2600(0x28004951) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
	webviewAndroid:
		'Mozilla/5.0 (Linux; Android 11; SM-A125F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36',
	harmonyHuawei:
		'Mozilla/5.0 (Linux; Android 12; HarmonyOS; JEF-AN00; HMSCore 6.13.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/13.0.5.303 Mobile Safari/537.36',
	qqIphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/8.9.68.618 V1_IPH_SQ_8.9.68_1_APP_A Pixel/1170 MiniAppEnable WKType/1',
	ipadDesktopMode:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
	curl: 'curl/8.4.0'
};

describe('parseUserAgent · 浏览器', () => {
	it('认出 Chrome 与 Blink', () => {
		const info = parseUserAgent(UA.chromeWin);
		expect(info.browser).toEqual({ name: 'Chrome', version: '138.0.0.0' });
		expect(info.engine.name).toBe('Blink');
	});

	it('Edge 不会被当成 Chrome（两者 UA 里都有 Chrome）', () => {
		const info = parseUserAgent(UA.edgeWin);
		expect(info.browser.name).toBe('Edge');
		expect(info.browser.version).toBe('138.0.0.0');
	});

	it('iOS 上的 Safari 版本取 Version/ 而不是 WebKit 版本', () => {
		const info = parseUserAgent(UA.safariIphone);
		expect(info.browser).toEqual({ name: 'Safari', version: '17.5' });
		expect(info.engine.name).toBe('WebKit');
	});

	it('iOS 上的 Chrome 走 CriOS，引擎仍是 Blink', () => {
		const info = parseUserAgent(UA.chromeIos);
		expect(info.browser.name).toBe('Chrome');
		expect(info.browser.version).toBe('125.0.6422.80');
		expect(info.engine.name).toBe('Blink');
	});

	it('Firefox 用 rv: 上的版本号，引擎是 Gecko', () => {
		const info = parseUserAgent(UA.firefoxWin);
		expect(info.browser).toEqual({ name: 'Firefox', version: '128.0' });
		expect(info.engine).toEqual({ name: 'Gecko', version: '128.0' });
	});

	it('国产浏览器优先于它内嵌的 Chrome', () => {
		expect(parseUserAgent(UA.harmonyHuawei).browser.name).toBe('华为浏览器');
	});

	it('爬虫与 curl 单列一类，设备类型不再判成桌面', () => {
		const info = parseUserAgent(UA.curl);
		expect(info.browser.name).toBe('爬虫 / 机器人');
		expect(info.device.type).toBe('unknown');
	});
});

describe('parseUserAgent · 系统与设备', () => {
	it('Windows NT 10.0 是 10 / 11（UA 里分不出来）', () => {
		expect(parseUserAgent(UA.chromeWin).os).toEqual({ name: 'Windows', version: '10 / 11' });
		expect(parseUserAgent(UA.chromeWin).device.label).toBe('桌面');
	});

	it('iOS 的下划线版本换回点', () => {
		expect(parseUserAgent(UA.safariIphone).os).toEqual({ name: 'iOS', version: '17.5' });
		expect(parseUserAgent(UA.safariIphone).device.label).toBe('手机');
	});

	it('macOS 的版本同样换回点', () => {
		expect(parseUserAgent(UA.safariMac).os).toEqual({ name: 'macOS', version: '10.15.7' });
	});

	it('HarmonyOS 不会被 Android 规则吃掉', () => {
		expect(parseUserAgent(UA.harmonyHuawei).os.name).toBe('HarmonyOS');
	});

	it('Android 不带 Mobile 判平板', () => {
		const info = parseUserAgent(
			'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
		);
		expect(info.os).toEqual({ name: 'Android', version: '13' });
		expect(info.device.label).toBe('平板');
	});

	it('iPad 请求桌面网站时靠触摸点数识破', () => {
		// UA 与 Mac Safari 一模一样：不给触摸点数只能判桌面
		expect(parseUserAgent(UA.ipadDesktopMode).device.label).toBe('桌面');
		expect(parseUserAgent(UA.ipadDesktopMode, 5).device.label).toBe('平板');
		// 真 Mac 接了触摸屏（1 点）不该被判成平板
		expect(parseUserAgent(UA.ipadDesktopMode, 1).device.label).toBe('桌面');
	});
});

describe('parseUserAgent · 宿主 App', () => {
	it('微信内置带版本号', () => {
		const info = parseUserAgent(UA.wechatAndroid);
		expect(info.app).toBe('微信内置 8.0.49.2600');
		expect(info.browser.name).toBe('Chrome');
	});

	it('Android WebView 单独认出来', () => {
		expect(parseUserAgent(UA.webviewAndroid).app).toBe('Android WebView');
	});

	it('QQ 内置不会被当成 QQ 浏览器', () => {
		expect(parseUserAgent(UA.qqIphone).app).toBe('QQ 内置 8.9.68.618');
	});

	it('独立浏览器时宿主为空串', () => {
		expect(parseUserAgent(UA.chromeWin).app).toBe('');
	});
});

describe('parseUserAgent · 边界', () => {
	it('空串全是未知，不抛错', () => {
		const info = parseUserAgent('   ');
		expect(info.browser.name).toBe('未知');
		expect(info.os.name).toBe('未知');
		expect(info.device.type).toBe('unknown');
		expect(info.raw).toBe('');
	});

	it('认不出来的 UA 不冒充已知浏览器', () => {
		const info = parseUserAgent('SomeCustomClient/1.0');
		expect(info.browser.name).toBe('未知');
		expect(info.engine.name).toBe('未知');
	});
});

describe('展示拼装', () => {
	it('没有版本时只出名字', () => {
		expect(formatNameVersion('Chrome', '')).toBe('Chrome');
		expect(formatNameVersion('Chrome', '138.0.0.0')).toBe('Chrome 138.0.0.0');
		expect(formatNameVersion('未知', '')).toBe('未知');
	});

	it('没有解析结果时五行全是未知', () => {
		expect(uaRows(null)).toHaveLength(5);
		expect(uaRows(null).every((row) => row.value === '未知')).toBe(true);
	});

	it('独立浏览器显示「独立浏览器」而不是空', () => {
		const rows = uaRows(parseUserAgent(UA.chromeWin));
		expect(rows.at(-1)).toEqual({ label: '内置 App', value: '独立浏览器' });
	});
});
