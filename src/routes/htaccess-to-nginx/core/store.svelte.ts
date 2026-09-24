// htaccess ↔ Nginx 的编排层：状态极少，结果与统计都是派生值，模块级单例。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import { cheatsheetFor, filterCheatsheet, insertCheatsheetEntry, type CheatsheetEntry } from './cheatsheet.ts';
import { HEADER_PREFIXES, convertHtaccess } from './convert-htaccess.ts';
import { NGINX_HEADER_PREFIXES, convertNginx } from './convert-nginx.ts';
import {
	DEFAULT_INDENT,
	EXAMPLE_HTACCESS,
	EXAMPLE_NGINX,
	type Direction,
	type IndentStyle,
	type WarningLevel
} from './types.ts';

/** 两侧生成结果顶部那段说明的所有前缀（互换时要把它们摘掉） */
const ALL_HEADER_PREFIXES = [...HEADER_PREFIXES, ...NGINX_HEADER_PREFIXES];

class HtaccessStore {
	/** 转换方向：决定用哪边的转换器，也决定两侧卡片显示什么 */
	direction = $state<Direction>('toNginx');
	input = $state(EXAMPLE_HTACCESS);
	/** 输出缩进档 */
	indent = $state<IndentStyle>(DEFAULT_INDENT);
	/** 参数速查表的搜索词 */
	query = $state('');

	readonly result = $derived(
		this.direction === 'toNginx' ? convertHtaccess(this.input, this.indent) : convertNginx(this.input, this.indent)
	);

	get isEmpty(): boolean {
		return this.input.trim() === '';
	}

	get output(): string {
		return this.result.text;
	}

	/** 提示按级别分个数：状态栏只报数字，明细在输出里就地标着 */
	count(level: WarningLevel): number {
		return this.result.warnings.filter((warning) => warning.level === level).length;
	}

	get statusTone(): StatusTone {
		if (this.isEmpty) return 'neutral';
		// 一条都没转出来（全是不支持的指令，或规则都被对方「不生效」的开关注释了）——那是失败，不是提醒
		if (this.result.converted === 0) return 'error';
		return this.result.warnings.length > 0 ? 'warn' : 'ok';
	}

	get statusText(): string {
		if (this.isEmpty) return '等待输入';
		const manual = this.count('manual');
		const unsupported = this.count('unsupported');
		if (manual === 0 && unsupported === 0) return `已转换 ${this.result.converted} 条 · 没有需要人工处理的地方`;
		const parts = [`已转换 ${this.result.converted} 条`];
		if (manual > 0) parts.push(`需人工确认 ${manual} 处`);
		if (unsupported > 0) parts.push(`未支持 ${unsupported} 处`);
		return parts.join(' · ');
	}

	// ---------------------------------------------------------------- 参数速查表

	/**
	 * 速查表内容跟着**方向**走，没有独立的格式开关：速查表列的就是输入框当前该写的那种格式。
	 * 之所以不给「查另一侧」的开关 —— 插入必须和输入框同格式，把 nginx 写法插进 .htaccess 只会得到废配置。
	 */
	readonly cheatsheet = $derived(cheatsheetFor(this.direction));

	/** 筛选后的分组（空组不渲染；筛选只影响渲染，不动数据） */
	readonly cheatsheetSections = $derived(filterCheatsheet(this.cheatsheet, this.query));

	clearQuery(): void {
		this.query = '';
	}

	/**
	 * 点速查表一行 → 按条目自己的插入方式落进输入框，返回插入后的光标位置。
	 * 光标从 DOM 读、插完再写回去由组件层做（同 `/morse`、`/regex`）—— 这里不碰 DOM，插法才能跟着纯函数一起单测。
	 */
	insertEntry(entry: CheatsheetEntry, start: number, end: number): number {
		const result = insertCheatsheetEntry(this.input, entry.snippet, start, end, entry.insert);
		this.input = result.value;
		return result.caret;
	}

	// ---------------------------------------------------------------- 操作

	loadExample(): void {
		this.input = this.direction === 'toNginx' ? EXAMPLE_HTACCESS : EXAMPLE_NGINX;
		this.indent = DEFAULT_INDENT;
		toast.show(`已填入示例 ${this.direction === 'toNginx' ? '.htaccess' : 'nginx 配置'}`);
	}

	clearInput(): void {
		this.input = '';
	}

	/** 把输出搬进输入框并换向：来回验证不用手动复制粘贴 */
	swapDirection(): void {
		// 先把输出抓在手里：result 是派生值，换向之后再读 this.output 拿到的就是「新方向 + 旧输入」算出来的东西
		const produced = this.output;
		if (produced === '') {
			toast.show('输出为空，没有可互换的内容');
			return;
		}
		this.direction = this.direction === 'toNginx' ? 'toHtaccess' : 'toNginx';
		this.input = stripGeneratedHeader(produced);
		toast.show(`已换成 ${this.direction === 'toNginx' ? 'htaccess → nginx' : 'nginx → htaccess'}，输出搬进了输入框`);
	}

	async copyOutput(): Promise<void> {
		if (this.output === '') {
			toast.show('输出为空，没有可复制的内容');
			return;
		}
		await copyToClipboard(this.output, {
			ok: `已复制 ${this.direction === 'toNginx' ? 'nginx 配置' : '.htaccess'}`,
			fail: '复制失败，请手动选中复制'
		});
	}
}

/**
 * 互换时摘掉上一次生成的顶部说明。
 * 只认「第一行是 `# 由 … 转换而来`」的那种块 —— 用户自己写的 `# 注意：` 注释不会被误伤。
 */
function stripGeneratedHeader(text: string): string {
	const lines = text.split('\n');
	if (!lines[0]?.startsWith('# 由 ')) return text;
	let start = 0;
	while (start < lines.length && ALL_HEADER_PREFIXES.some((prefix) => lines[start].startsWith(prefix))) start += 1;
	return lines.slice(start).join('\n');
}

export const htaccessStore = new HtaccessStore();
