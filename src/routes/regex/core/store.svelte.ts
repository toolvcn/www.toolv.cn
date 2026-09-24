// 正则测试的编排层：pattern / flags / 测试文本三份状态，结果实时派生，模块级单例。
import { SvelteSet } from 'svelte/reactivity';
import {
	EXAMPLE_FLAGS,
	EXAMPLE_INPUT,
	EXAMPLE_PATTERN,
	MAX_SAVED,
	MAX_SAVED_NAME,
	SAVED_WITH_INPUT_DEFAULT
} from '../config.ts';
import { generateCode, type CodeLang } from './codegen.ts';
import { parsePattern } from './parse.ts';
import { replaceAll } from './replace.ts';
import { testRegex } from './regex.ts';
import { fallbackName, serializeSaved, type SavedEntry } from './saved.ts';
import { FLAG_OPTIONS, type SavedPreset, type TestResult, type WorkspaceTab } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

class RegexStore {
	pattern = $state(EXAMPLE_PATTERN);
	input = $state(EXAMPLE_INPUT);
	/** 用 string 存 flag 集合，直接喂给 RegExp */
	flags = $state(EXAMPLE_FLAGS);

	/** 中央工作区的当前标签：测试文本 / 匹配详情 / 文本替换 / 代码生成 / 正则图解 */
	tab = $state<WorkspaceTab>('text');
	/** 文本替换的替换串，支持 $1 / $<name> / $& / $` / $' */
	replacement = $state('$1');
	/** 代码生成当前选择的语言 */
	codeLang = $state<CodeLang>('javascript');

	/** 实时测试结果：非法时 error 非 null；空正则视为「没有匹配」而不是匹配一堆空串 */
	readonly result = $derived<TestResult>(
		this.pattern === ''
			? { error: null, matches: [], tokens: [{ text: this.input, matchIndex: null }], truncated: false }
			: testRegex(this.pattern, this.flags, this.input)
	);
	readonly matchCount = $derived(this.result.matches.length);
	/** 实时替换结果：空正则时原样返回输入 */
	readonly replaceResult = $derived(
		this.pattern === ''
			? { error: null, output: this.input, count: 0 }
			: replaceAll(this.pattern, this.flags, this.input, this.replacement)
	);
	/** 正则解析结果：非法或暂不支持的写法给出 reason，图解 tab 用 */
	readonly parsed = $derived(parsePattern(this.pattern));
	/** 代码生成结果：纯字符串，切换语言时即时重算 */
	readonly code = $derived(generateCode(this.pattern, this.flags, this.codeLang));

	// ------------------------------------------------------- 本地保存的表达式

	/** 点「保存」存下来的表达式，最新的在最后；恢复与落盘由 +page.svelte 负责 */
	saved = $state<SavedPreset[]>([]);
	/** 保存框里的名称；留空则用表达式本体兜底 */
	savedName = $state('');
	/** 保存框里的「同时保存当前测试文本」勾选状态；只在本次会话里记住上一次的选择 */
	saveWithInput = $state(SAVED_WITH_INPUT_DEFAULT);
	#savedSeq = 0;

	/** 当前这条是否已经存过（表达式 + 修饰符都相同就算同一条） */
	readonly currentSaved = $derived(
		this.saved.find((item) => item.pattern === this.pattern && item.flags === this.flags) ?? null
	);
	readonly canSave = $derived(
		this.pattern !== '' && this.result.error === null && this.saved.length < MAX_SAVED && this.currentSaved === null
	);

	/** 保存当前表达式；名称留空用表达式本体，是否连带测试文本看 saveWithInput。不合法 / 重复 / 超上限都不存，各自给一句提示 */
	saveCurrent(): void {
		if (this.pattern === '') {
			toast.show('正则为空，没有可保存的表达式', true);
			return;
		}
		if (this.result.error !== null) {
			toast.show('当前正则不合法，改对再保存', true);
			return;
		}
		if (this.saved.length >= MAX_SAVED) {
			toast.show(`最多保存 ${MAX_SAVED} 条，先删掉几条`, true);
			return;
		}
		if (this.currentSaved !== null) {
			toast.show(`已经存过「${this.currentSaved.name}」了`, true);
			return;
		}
		const name = (this.savedName.trim() || fallbackName(this.pattern)).slice(0, MAX_SAVED_NAME);
		// 勾选了但测试文本为空时照样不写 input：没有文本可还原，存空串还会误导列表标成「含文本」
		const entry: SavedPreset = { id: ++this.#savedSeq, name, pattern: this.pattern, flags: this.flags };
		if (this.saveWithInput && this.input !== '') entry.input = this.input;
		this.saved = [...this.saved, entry];
		this.savedName = '';
		toast.show(entry.input === undefined ? `已保存「${name}」` : `已保存「${name}」，含测试文本`);
	}

	/**
	 * 点「我的保存」里的一条：表达式与修饰符**总是**填回正则栏。
	 * 条目存了测试文本时，只有当前文本「为空 / 未编辑过（仍是首屏示例）/ 与之相同」才直接还原；
	 * 会盖掉用户改过的文本时不自作主张 —— 由 UI 先弹确认，再把 overwriteText 传进来
	 * （`needsTextConfirm` 就是给 UI 判断要不要弹的）。没存文本的条目（含旧本地配置）保持当前文本。
	 */
	applySaved(id: number, { overwriteText = false }: { overwriteText?: boolean } = {}): void {
		const item = this.saved.find((entry) => entry.id === id);
		if (!item) return;
		this.pattern = item.pattern;
		this.flags = item.flags;
		if (item.input === undefined) {
			toast.show(`已加载本地配置「${item.name}」`);
			return;
		}
		if (overwriteText || this.#canReplaceText(item.input)) {
			this.input = item.input;
			toast.show(`已加载本地配置「${item.name}」，已还原测试文本`);
			return;
		}
		toast.show(`已加载本地配置「${item.name}」，保留当前测试文本`);
	}

	/** 点这条会不会盖掉用户已编辑的测试文本（会则需要 UI 先弹确认） */
	needsTextConfirm(id: number): boolean {
		const item = this.saved.find((entry) => entry.id === id);
		if (!item || item.input === undefined) return false;
		return !this.#canReplaceText(item.input);
	}

	/** 当前测试文本能否被直接替换：为空、未编辑过（仍是首屏示例），或已经与目标相同 */
	#canReplaceText(next: string): boolean {
		return this.input === next || this.input === '' || this.input === EXAMPLE_INPUT;
	}

	deleteSaved(id: number): void {
		const item = this.saved.find((entry) => entry.id === id);
		this.saved = this.saved.filter((entry) => entry.id !== id);
		if (item) toast.show(`已删除「${item.name}」`);
	}

	/** 从 localStorage 恢复（+page.svelte 在挂载时调用）；id 重新分配 */
	restoreSaved(list: readonly SavedEntry[]): void {
		this.saved = list.map((entry) => ({ ...entry, id: ++this.#savedSeq }));
	}

	/** 落盘文本（JSON），不掺运行期的 id */
	get savedText(): string {
		return serializeSaved(this.saved);
	}

	// ---------------------------------------------------------------- 操作

	hasFlag(flag: string): boolean {
		return this.flags.includes(flag);
	}

	/** 勾选 / 取消一个 flag。g 与 y 都会走全量循环（见 core/regex.ts），语义保持诚实 */
	toggleFlag(flag: string): void {
		this.flags = this.hasFlag(flag) ? this.flags.replace(flag, '') : this.flags + flag;
	}

	/** 常用正则：填 pattern；给了 flags 就一并套上，没给则保留当前修饰符 */
	applyPreset(pattern: string, label?: string, flags?: string): void {
		this.pattern = pattern;
		if (flags !== undefined) this.flags = flags;
		const suffix = flags ? `（修饰符 ${flags}）` : '';
		toast.show(label ? `已填入「${label}」${suffix}` : '已填入片段');
	}

	/** 清空正则栏（pattern 置空）；测试文本与修饰符保持不动 */
	clearPattern(): void {
		this.pattern = '';
	}

	loadExample(): void {
		this.pattern = EXAMPLE_PATTERN;
		this.input = EXAMPLE_INPUT;
		this.flags = EXAMPLE_FLAGS;
	}

	clearInput(): void {
		this.input = '';
	}

	/** g / y 缺席时 exec 只吐第一个匹配，列表上的「全局」提示由这里判定 */
	readonly globalEnabled = $derived(this.flags.includes('g') || this.flags.includes('y'));

	// ------------------------------------------------------------ 捕获组展开

	/** 展开的行下标。存下标而不是行对象：结果每次输入都重算，行没有稳定身份 */
	expanded = new SvelteSet<number>();
	/** 结果里存在捕获组时才显示展开控件与「全部展开」 */
	readonly hasGroups = $derived(this.result.matches.some((match) => match.groups.length > 0));
	readonly allExpanded = $derived(
		this.hasGroups && this.result.matches.every((match, i) => match.groups.length === 0 || this.expanded.has(i))
	);

	isExpanded(index: number): boolean {
		return this.expanded.has(index);
	}

	/** 展开 / 收起一行。没有捕获组的行点了也没东西看，这里直接忽略 */
	toggleMatch(index: number): void {
		if (this.result.matches[index]?.groups.length === 0) return;
		if (!this.expanded.delete(index)) this.expanded.add(index);
	}

	/** 一次展开 / 收起所有带捕获组的行 */
	toggleAllMatches(): void {
		// 先取一次：clear() 之后 allExpanded 会立刻重算成 false，再读就永远收不回去了
		const collapse = this.allExpanded;
		this.expanded.clear();
		if (collapse) return;
		for (const [i, match] of this.result.matches.entries()) {
			if (match.groups.length > 0) this.expanded.add(i);
		}
	}

	/** 复制 /表达式/旗标 整体，方便贴到代码或聊天里 */
	async copyPattern(): Promise<void> {
		await this.copy(`/${this.pattern}/${this.flags}`, '已复制正则表达式');
	}

	/** 一次复制全部匹配文本，一行一个 */
	async copyAllMatches(): Promise<void> {
		const text = this.result.matches.map((match) => match.text).join('\n');
		await this.copy(text, `已复制 ${this.matchCount} 个匹配`);
	}

	async copyMatchText(text: string): Promise<void> {
		await this.copy(text, '已复制匹配文本');
	}

	/** 复制替换后的整段结果 */
	async copyReplaced(): Promise<void> {
		await this.copy(this.replaceResult.output, `已复制替换结果（${this.replaceResult.count} 处）`);
	}

	/** 复制当前语言的生成代码 */
	async copyCode(): Promise<void> {
		await this.copy(this.code, '已复制生成代码');
	}

	private async copy(text: string, okMessage: string): Promise<void> {
		await copyToClipboard(text, { ok: okMessage, fail: '复制失败，请手动选中复制' });
	}
}

export const regexStore = new RegexStore();

// FLAG_OPTIONS 仅供 UI 展示，这里 re-export 一手让组件少一处导入路径
export { FLAG_OPTIONS };
