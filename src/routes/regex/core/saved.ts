// 已保存表达式的序列化 / 校验纯函数：localStorage 落盘与恢复共用同一份解析。不依赖 DOM，可单测。
// 导入的 id 由 store 重新分配，这里统一给 0（即 `Omit<SavedPreset, 'id'>`）。
import { MAX_SAVED, MAX_SAVED_NAME } from '../config.ts';
import type { SavedPreset } from './types.ts';

/** 允许的修饰符。写入前滤掉不认识的字母，免得存进去一条构造不出的 RegExp */
const ALLOWED_FLAGS = 'dgimsuvy';

/** 一条保存条目落盘时的形状：没有运行期的 id */
export type SavedEntry = Omit<SavedPreset, 'id'>;

export type ParseSavedResult = { ok: true; saved: SavedEntry[] } | { ok: false; error: string };

/**
 * 修饰符归一化：滤掉非法字母、去重，顺序按 `ALLOWED_FLAGS` 稳定下来。
 * 顺序要稳 —— 否则 `gm` 与 `mg` 会被判成两条不同的表达式，去重就漏了。
 */
function normalizeFlags(raw: string): string {
	let out = '';
	for (const flag of ALLOWED_FLAGS) {
		if (raw.includes(flag) && !out.includes(flag)) out += flag;
	}
	return out;
}

/** 名称留空时的兜底：直接用表达式本体，太长截断 */
export function fallbackName(pattern: string): string {
	const text = pattern.trim();
	return text.length <= MAX_SAVED_NAME ? text : `${text.slice(0, MAX_SAVED_NAME - 1)}…`;
}

/**
 * 落盘 / 导出文本：id 是运行期序号，不进存储。
 * 没存测试文本的条目不写 input 字段 —— 旧数据本来就没有这个键，两边形状保持一致，
 * 恢复时按「没有 input = 没存文本」统一处理。
 */
export function serializeSaved(list: readonly SavedPreset[]): string {
	return JSON.stringify(
		list.map(({ name, pattern, flags, input }) =>
			input === undefined ? { name, pattern, flags } : { name, pattern, flags, input }
		)
	);
}

/**
 * 解析落盘文本。逐条校验，任一条不合法即整体失败（不给用户半套数据 —— 与 http 的预设同一口径）。
 * 名称缺失或为空时用表达式兜底，修饰符缺失按「无修饰符」处理，测试文本缺失按「这条没存文本」处理，
 * 三者都不算坏数据 —— 最后一条是兼容旧的本地配置的关键。
 */
export function parseSaved(text: string): ParseSavedResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: '保存的内容不是合法的 JSON' };
	}
	if (!Array.isArray(raw)) return { ok: false, error: '保存的内容应为数组' };

	const out: SavedEntry[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) return { ok: false, error: '存在非对象的保存条目' };
		const p = item as Partial<SavedEntry>;
		if (typeof p.pattern !== 'string' || p.pattern === '') return { ok: false, error: '存在没有表达式的保存条目' };
		const name = typeof p.name === 'string' && p.name.trim() !== '' ? p.name.trim() : fallbackName(p.pattern);
		const entry: SavedEntry = {
			name: name.slice(0, MAX_SAVED_NAME),
			pattern: p.pattern,
			flags: typeof p.flags === 'string' ? normalizeFlags(p.flags) : ''
		};
		// input 不是字符串（缺失 / 旧数据 / 坏数据）就当这条没存文本，不判坏数据
		if (typeof p.input === 'string') entry.input = p.input;
		out.push(entry);
	}
	return { ok: true, saved: out.slice(0, MAX_SAVED) };
}
