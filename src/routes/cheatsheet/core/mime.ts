// MIME 类型静态数据与搜索。纯数据 + 纯函数，可单测。
//
// 「扩展名 ↔ MIME 双向搜索」的实现就一条：把扩展名、别名、MIME、说明拼成一串小写文本，
// 再对查询串做包含匹配 —— 输入 `png`、`image/png`、`图片` 都能命中同一条。

export type MimeGroup = 'text' | 'image' | 'audio' | 'video' | 'font' | 'archive' | 'app' | 'web';

export interface MimeEntry {
	/** 主扩展名（带点）；表单这类没有扩展名的条目为空串 */
	ext: string;
	/** 同一 MIME 的其它常见扩展名（带点） */
	alias?: string[];
	mime: string;
	group: MimeGroup;
	/** 一句话用途 / 备注 */
	note: string;
}

/** 分组顺序即渲染顺序 */
export const MIME_GROUPS: { id: MimeGroup; name: string }[] = [
	{ id: 'text', name: '文本与文档' },
	{ id: 'image', name: '图片' },
	{ id: 'audio', name: '音频' },
	{ id: 'video', name: '视频' },
	{ id: 'font', name: '字体' },
	{ id: 'archive', name: '压缩与包' },
	{ id: 'app', name: '程序与二进制' },
	{ id: 'web', name: 'Web 与数据格式' }
];

export const MIME_ENTRIES: MimeEntry[] = [
	// ------------------------------------------------------------- 文本与文档
	{ ext: '.txt', mime: 'text/plain', group: 'text', note: '纯文本，浏览器直接显示' },
	{ ext: '.html', alias: ['.htm'], mime: 'text/html', group: 'text', note: 'HTML 文档' },
	{ ext: '.css', mime: 'text/css', group: 'text', note: '样式表' },
	{
		ext: '.js',
		alias: ['.mjs'],
		mime: 'text/javascript',
		group: 'text',
		note: 'JavaScript 脚本（旧写法 application/javascript）'
	},
	{ ext: '.json', mime: 'application/json', group: 'text', note: 'JSON 数据，接口最常用的响应类型' },
	{ ext: '.xml', mime: 'application/xml', group: 'text', note: 'XML 文档（旧写法 text/xml）' },
	{ ext: '.md', mime: 'text/markdown', group: 'text', note: 'Markdown 文档' },
	{ ext: '.csv', mime: 'text/csv', group: 'text', note: 'CSV 表格，导出常用' },
	{ ext: '.yaml', alias: ['.yml'], mime: 'application/yaml', group: 'text', note: 'YAML 配置' },
	{ ext: '.pdf', mime: 'application/pdf', group: 'text', note: 'PDF 文档' },
	{ ext: '.doc', mime: 'application/msword', group: 'text', note: 'Word 97-2003 文档' },
	{
		ext: '.docx',
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		group: 'text',
		note: 'Word 文档（OOXML）'
	},
	{ ext: '.xls', mime: 'application/vnd.ms-excel', group: 'text', note: 'Excel 97-2003 工作簿' },
	{
		ext: '.xlsx',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		group: 'text',
		note: 'Excel 工作簿（OOXML）'
	},
	{ ext: '.ppt', mime: 'application/vnd.ms-powerpoint', group: 'text', note: 'PowerPoint 97-2003 演示' },
	{
		ext: '.pptx',
		mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		group: 'text',
		note: 'PowerPoint 演示（OOXML）'
	},
	{ ext: '.rtf', mime: 'application/rtf', group: 'text', note: '富文本' },
	{ ext: '.epub', mime: 'application/epub+zip', group: 'text', note: '电子书' },
	{ ext: '.ics', mime: 'text/calendar', group: 'text', note: '日历订阅' },
	{ ext: '.vcf', mime: 'text/vcard', group: 'text', note: '电子名片' },

	// ------------------------------------------------------------- 图片
	{ ext: '.png', mime: 'image/png', group: 'image', note: '无损位图，支持透明' },
	{ ext: '.jpg', alias: ['.jpeg'], mime: 'image/jpeg', group: 'image', note: '有损压缩照片' },
	{ ext: '.gif', mime: 'image/gif', group: 'image', note: '动图，最多 256 色' },
	{ ext: '.webp', mime: 'image/webp', group: 'image', note: '体积比 JPEG 小，支持透明与动图' },
	{ ext: '.avif', mime: 'image/avif', group: 'image', note: '新一代压缩格式，体积最小' },
	{ ext: '.svg', mime: 'image/svg+xml', group: 'image', note: '矢量图，本质是 XML 文本' },
	{ ext: '.ico', mime: 'image/x-icon', group: 'image', note: '网站 favicon' },
	{ ext: '.bmp', mime: 'image/bmp', group: 'image', note: '未压缩位图' },
	{ ext: '.tif', alias: ['.tiff'], mime: 'image/tiff', group: 'image', note: '印刷与扫描常用' },
	{ ext: '.heic', mime: 'image/heic', group: 'image', note: 'iPhone 默认照片格式' },

	// ------------------------------------------------------------- 音频
	{ ext: '.mp3', mime: 'audio/mpeg', group: 'audio', note: '最通用的有损音频' },
	{ ext: '.wav', mime: 'audio/wav', group: 'audio', note: '未压缩音频，体积大' },
	{ ext: '.ogg', alias: ['.oga'], mime: 'audio/ogg', group: 'audio', note: '开源容器格式' },
	{ ext: '.flac', mime: 'audio/flac', group: 'audio', note: '无损压缩音频' },
	{ ext: '.aac', mime: 'audio/aac', group: 'audio', note: 'MP3 的继任者，同码率音质更好' },
	{ ext: '.m4a', mime: 'audio/mp4', group: 'audio', note: 'iTunes / Apple 音乐常用' },
	{ ext: '.weba', mime: 'audio/webm', group: 'audio', note: 'WebM 容器里的纯音频' },
	{ ext: '.mid', alias: ['.midi'], mime: 'audio/midi', group: 'audio', note: 'MIDI 乐谱数据' },

	// ------------------------------------------------------------- 视频
	{ ext: '.mp4', mime: 'video/mp4', group: 'video', note: '兼容性最好的视频格式' },
	{ ext: '.webm', mime: 'video/webm', group: 'video', note: '开源免专利，网页端常用' },
	{ ext: '.ogv', mime: 'video/ogg', group: 'video', note: 'Ogg 容器视频' },
	{ ext: '.mov', mime: 'video/quicktime', group: 'video', note: 'QuickTime，剪辑软件常用' },
	{ ext: '.avi', mime: 'video/x-msvideo', group: 'video', note: 'Windows 老格式' },
	{ ext: '.mkv', mime: 'video/x-matroska', group: 'video', note: '开源容器，可封装多音轨字幕' },
	{ ext: '.flv', mime: 'video/x-flv', group: 'video', note: 'Flash 时代的老格式' },
	{ ext: '.m3u8', mime: 'application/vnd.apple.mpegurl', group: 'video', note: 'HLS 直播 / 点播播放列表' },
	{ ext: '.ts', mime: 'video/mp2t', group: 'video', note: 'MPEG 传输流切片；注意与 TypeScript 源文件同名' },

	// ------------------------------------------------------------- 字体
	{ ext: '.woff2', mime: 'font/woff2', group: 'font', note: '网页字体首选，压缩率最高' },
	{ ext: '.woff', mime: 'font/woff', group: 'font', note: '网页字体的上一代格式' },
	{ ext: '.ttf', mime: 'font/ttf', group: 'font', note: 'TrueType 字体' },
	{ ext: '.otf', mime: 'font/otf', group: 'font', note: 'OpenType 字体' },
	{ ext: '.eot', mime: 'application/vnd.ms-fontobject', group: 'font', note: 'IE 专用，已淘汰' },

	// ------------------------------------------------------------- 压缩与包
	{ ext: '.zip', mime: 'application/zip', group: 'archive', note: '最常见的压缩包' },
	{ ext: '.gz', alias: ['.tgz'], mime: 'application/gzip', group: 'archive', note: 'gzip 压缩，也用作 HTTP 内容编码' },
	{ ext: '.tar', mime: 'application/x-tar', group: 'archive', note: '只打包不压缩，常配合 gz' },
	{ ext: '.bz2', mime: 'application/x-bzip2', group: 'archive', note: 'bzip2 压缩' },
	{ ext: '.xz', mime: 'application/x-xz', group: 'archive', note: 'xz 压缩，率高但慢' },
	{ ext: '.7z', mime: 'application/x-7z-compressed', group: 'archive', note: '7-Zip 格式' },
	{ ext: '.rar', mime: 'application/vnd.rar', group: 'archive', note: 'RAR 压缩包' },
	{ ext: '.zst', mime: 'application/zstd', group: 'archive', note: 'Zstandard，速度快' },
	{ ext: '.br', mime: 'application/x-brotli', group: 'archive', note: 'Brotli，HTTP 内容编码常用' },
	{ ext: '.jar', mime: 'application/java-archive', group: 'archive', note: 'Java 归档包' },
	{ ext: '.iso', mime: 'application/x-iso9660-image', group: 'archive', note: '光盘镜像' },

	// ------------------------------------------------------------- 程序与二进制
	{ ext: '.bin', mime: 'application/octet-stream', group: 'app', note: '未知二进制的兜底类型' },
	{ ext: '.exe', mime: 'application/vnd.microsoft.portable-executable', group: 'app', note: 'Windows 可执行程序' },
	{ ext: '.apk', mime: 'application/vnd.android.package-archive', group: 'app', note: 'Android 安装包' },
	{ ext: '.dmg', mime: 'application/x-apple-diskimage', group: 'app', note: 'macOS 磁盘镜像' },
	{ ext: '.deb', mime: 'application/x-debian-package', group: 'app', note: 'Debian / Ubuntu 安装包' },
	{ ext: '.rpm', mime: 'application/x-rpm', group: 'app', note: 'Red Hat 系安装包' },
	{ ext: '.wasm', mime: 'application/wasm', group: 'app', note: 'WebAssembly 模块' },

	// ------------------------------------------------------------- Web 与数据格式
	{ ext: '', mime: 'multipart/form-data', group: 'web', note: '文件上传表单；表单 enctype 用这个' },
	{ ext: '', mime: 'application/x-www-form-urlencoded', group: 'web', note: '表单默认的提交编码' },
	{ ext: '', mime: 'text/event-stream', group: 'web', note: 'SSE 服务端推送（流式输出）' },
	{ ext: '.webmanifest', mime: 'application/manifest+json', group: 'web', note: 'PWA 应用清单' },
	{ ext: '.ndjson', mime: 'application/x-ndjson', group: 'web', note: '换行分隔的 JSON，日志流常用' },
	{ ext: '.map', mime: 'application/json', group: 'web', note: 'Source Map，本质是 JSON' },
	{ ext: '.sql', mime: 'application/sql', group: 'web', note: 'SQL 脚本' }
];

/** 拼检索串：扩展名、别名、MIME、说明都参与匹配 */
function haystack(item: MimeEntry): string {
	return [item.ext, ...(item.alias ?? []), item.mime, item.note].join(' ').toLowerCase();
}

/** 小写包含匹配，空查询返回全量；查询里带的前导点会被去掉（`png` 与 `.png` 等价） */
export function searchMimeEntries(query: string): MimeEntry[] {
	const q = query.trim().toLowerCase().replace(/^\.+/, '');
	if (q === '') return MIME_ENTRIES;
	return MIME_ENTRIES.filter((item) => haystack(item).includes(q));
}

/** 按分组顺序切成若干段，空段不返回（搜索后某些组会整组落空） */
export function groupMimeEntries(items: MimeEntry[]): { group: MimeGroup; name: string; items: MimeEntry[] }[] {
	return MIME_GROUPS.map((group) => ({
		group: group.id,
		name: group.name,
		items: items.filter((item) => item.group === group.id)
	})).filter((section) => section.items.length > 0);
}
