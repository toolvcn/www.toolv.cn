// 行级 diff 的纯函数：LCS 对齐 → 差异行 → 并排配对。不碰 DOM、不读 store，可在 node 环境单测。
//
// 算法是「公共前后缀直接对齐 + 中间一段跑 LCS」：日常改动的文本大多只在中间差几行，
// 前后缀先砍掉能把 DP 的规模压下来一个量级。剩余规模超 MAX_CELLS 时不再追求最优对齐，
// 退化成「整段删除 + 整段新增」并置 degraded，由 UI 明说，而不是让用户等一个卡死的长循环。

/** 一行的归属：未变 / 新增（右侧独有）/ 删除（左侧独有） */
export type DiffKind = 'equal' | 'add' | 'del';

export interface DiffOptions {
	/** 比较时忽略大小写 */
	ignoreCase: boolean;
	/** 比较时忽略行首尾空白（缩进不同的同一行仍算相同） */
	ignoreWhitespace: boolean;
	/** 空行不参与比较（也不显示） */
	ignoreBlank: boolean;
}

export interface DiffLine {
	kind: DiffKind;
	/** 该行在左栏的原文行号（1 起）；新增行为 null */
	leftNo: number | null;
	/** 该行在右栏的原文行号（1 起）；删除行为 null */
	rightNo: number | null;
	/** 显示文本：未变行取左栏原文 */
	text: string;
	/** 未变行在右栏的原文；开启忽略项后可能与 text 不同（如只差大小写） */
	rightText?: string;
}

export interface DiffStats {
	added: number;
	removed: number;
	equal: number;
}

export interface DiffResult {
	lines: DiffLine[];
	stats: DiffStats;
	/** 中间那段因规模超限没做最优对齐 */
	degraded: boolean;
}

/** 并排视图的一行：左右各一格，改动行的删除与新增配成一对 */
export interface SplitRow {
	kind: 'equal' | 'change' | 'add' | 'del';
	left: DiffLine | null;
	right: DiffLine | null;
}

/** LCS 表超过这个格数就降级（2M 格 ≈ 8MB Uint32Array） */
const MAX_CELLS = 2_000_000;

/** 对齐结果的一步操作：下标都是各自数组内的下标 */
type Op = { kind: 'equal'; a: number; b: number } | { kind: 'del'; a: number } | { kind: 'add'; b: number };

/** 参与比较的一行：原文行号 + 显示文本 + 比较用的键 */
interface Item {
	no: number;
	text: string;
	key: string;
}

/** 按 \n 切行：统一 CRLF，末尾那个换行不产生一个空行 */
export function splitLines(text: string): string[] {
	if (text === '') return [];
	const parts = text.replace(/\r\n?/g, '\n').split('\n');
	if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
	return parts;
}

function toItems(text: string, options: DiffOptions): Item[] {
	const lines = splitLines(text);
	const items: Item[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (options.ignoreBlank && line.trim() === '') continue;
		let key = options.ignoreWhitespace ? line.trim() : line;
		if (options.ignoreCase) key = key.toLowerCase();
		items.push({ no: i + 1, text: line, key });
	}
	return items;
}

function align(a: string[], b: string[]): { ops: Op[]; degraded: boolean } {
	const ops: Op[] = [];
	// 公共前缀：逐字相等才前进，key 已按忽略项归一化过
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) {
		ops.push({ kind: 'equal', a: start, b: start });
		start++;
	}
	// 公共后缀：从尾巴往回收，最后 reverse 一次排回行序（逐条 unshift 是 O(n²)）
	const tail: Op[] = [];
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
		tail.push({ kind: 'equal', a: endA, b: endB });
	}
	tail.reverse();
	// 前缀是两侧共有的，所以左右起点都是 start
	const mid = alignMiddle(a, b, start, endA, start, endB);
	return { ops: [...ops, ...mid.ops, ...tail], degraded: mid.degraded };
}

/** 只对齐 [aStart, aEnd) 与 [bStart, bEnd) 这两段：LCS 表 + 回溯 */
function alignMiddle(
	a: string[],
	b: string[],
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number
): { ops: Op[]; degraded: boolean } {
	const ops: Op[] = [];
	const n = aEnd - aStart;
	const m = bEnd - bStart;
	if (n === 0) {
		for (let j = bStart; j < bEnd; j++) ops.push({ kind: 'add', b: j });
		return { ops, degraded: false };
	}
	if (m === 0) {
		for (let i = aStart; i < aEnd; i++) ops.push({ kind: 'del', a: i });
		return { ops, degraded: false };
	}
	if (n * m > MAX_CELLS) {
		for (let i = aStart; i < aEnd; i++) ops.push({ kind: 'del', a: i });
		for (let j = bStart; j < bEnd; j++) ops.push({ kind: 'add', b: j });
		return { ops, degraded: true };
	}

	// 从右下角往左上角填：dp[i][j] = a[i..] 与 b[j..] 的最长公共子序列长度
	const width = m + 1;
	const dp = new Uint32Array((n + 1) * width);
	for (let i = n - 1; i >= 0; i--) {
		const ai = a[aStart + i];
		for (let j = m - 1; j >= 0; j--) {
			dp[i * width + j] =
				ai === b[bStart + j]
					? dp[(i + 1) * width + j + 1] + 1
					: Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
		}
	}
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[aStart + i] === b[bStart + j]) {
			ops.push({ kind: 'equal', a: aStart + i, b: bStart + j });
			i++;
			j++;
		} else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
			ops.push({ kind: 'del', a: aStart + i });
			i++;
		} else {
			ops.push({ kind: 'add', b: bStart + j });
			j++;
		}
	}
	while (i < n) {
		ops.push({ kind: 'del', a: aStart + i });
		i++;
	}
	while (j < m) {
		ops.push({ kind: 'add', b: bStart + j });
		j++;
	}
	return { ops, degraded: false };
}

/** 两栏文本的行级 diff：结果按行序排列，可直接渲染合并视图 */
export function diffLines(left: string, right: string, options: DiffOptions): DiffResult {
	const leftItems = toItems(left, options);
	const rightItems = toItems(right, options);
	const { ops, degraded } = align(
		leftItems.map((item) => item.key),
		rightItems.map((item) => item.key)
	);
	const lines: DiffLine[] = [];
	const stats: DiffStats = { added: 0, removed: 0, equal: 0 };
	for (const op of ops) {
		if (op.kind === 'equal') {
			const item = leftItems[op.a];
			lines.push({
				kind: 'equal',
				leftNo: item.no,
				rightNo: rightItems[op.b].no,
				text: item.text,
				rightText: rightItems[op.b].text
			});
			stats.equal++;
		} else if (op.kind === 'del') {
			const item = leftItems[op.a];
			lines.push({ kind: 'del', leftNo: item.no, rightNo: null, text: item.text });
			stats.removed++;
		} else {
			const item = rightItems[op.b];
			lines.push({ kind: 'add', leftNo: null, rightNo: item.no, text: item.text });
			stats.added++;
		}
	}
	return { lines, stats, degraded };
}

/** 把差异行配成并排视图的行：一段连续的删除 + 新增按下标两两配对，多出来的一侧独占一行 */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
	const rows: SplitRow[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.kind === 'equal') {
			// 右格换成右栏原文：开启忽略项后两侧可能只是「看着一样」
			rows.push({ kind: 'equal', left: line, right: { ...line, leftNo: null, text: line.rightText ?? line.text } });
			i++;
			continue;
		}
		const dels: DiffLine[] = [];
		const adds: DiffLine[] = [];
		while (i < lines.length && lines[i].kind !== 'equal') {
			const current = lines[i];
			if (current.kind === 'del') dels.push(current);
			else adds.push(current);
			i++;
		}
		const pairs = Math.min(dels.length, adds.length);
		for (let k = 0; k < pairs; k++) rows.push({ kind: 'change', left: dels[k], right: adds[k] });
		for (let k = pairs; k < dels.length; k++) rows.push({ kind: 'del', left: dels[k], right: null });
		for (let k = pairs; k < adds.length; k++) rows.push({ kind: 'add', left: null, right: adds[k] });
	}
	return rows;
}

/** 合并视图的纯文本：加 `-` / `+` / 空格 前缀，供「复制结果」用 */
export function toUnifiedText(lines: DiffLine[]): string {
	return lines.map((line) => (line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ') + line.text).join('\n');
}
