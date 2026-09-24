// 展示用的格式化与文案映射，以及预设的解析。
// 不含 runes、不碰 DOM、不碰 localStorage，node 里可直接单测。
// JSON 的判定 / 分词 / 时间戳处理在 json.ts。
//
// statusText 是连接状态的唯一文案映射源（三个面板共用、单测也要断言），
// 放这里比散在组件里更不容易走样。对应的状态点颜色是样式，在 ui/styles.ts。
import { isJson, tokenizeJson, type JsonToken } from '$lib/utils/json';
import type { ConnectionStatus, LogDirection, LogEntry, PresetMessage } from './types.ts';

export function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒`;
}

export function formatTime(timestamp: number): string {
	// 用原生 Date：日志每一行都会调它，SvelteDate 每次都会建 signal + derived，纯浪费
	const date = new Date(timestamp);
	const time = date.toTimeString().slice(0, 8);
	return `${time}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function formatSize(text: string): string {
	const bytes = new Blob([text]).size;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 造一条日志。size 与 tokens 是惰性 getter 并且只算一次：
 * 一条日志从入库到被渲染可能经历好几次读取，而绝大多数日志其实永远不会被展开。
 */
export function createLogEntry(params: {
	id: number;
	connectionId: number | null;
	direction: LogDirection;
	content: string;
}): LogEntry {
	const type = isJson(params.content) ? 'JSON' : 'Text';
	// undefined 表示还没算过；null 是 JSON 分词失败时的合法结果，不能用它当哨兵
	let size: string | undefined;
	let tokens: JsonToken[] | null | undefined;

	return {
		id: params.id,
		connectionId: params.connectionId,
		direction: params.direction,
		content: params.content,
		timestamp: Date.now(),
		type,
		get size(): string {
			if (size === undefined) size = formatSize(params.content);
			return size;
		},
		get tokens(): JsonToken[] | null {
			if (tokens === undefined) tokens = type === 'JSON' ? tokenizeJson(params.content) : null;
			return tokens;
		}
	};
}

/** 连接状态的文案映射，三个面板共用 */
export function statusText(status: ConnectionStatus): string {
	if (status === 'connected') return '已连接';
	if (status === 'connecting') return '连接中';
	return '已断开';
}

/**
 * 日志内容类型的显示文案。站点文案是中文，只有 JSON 作为专有名词保留原文；
 * 导出的 JSON 里仍然写原始的 JSON / Text，这里只管界面上怎么显示。
 */
export function typeText(type: LogEntry['type']): string {
	return type === 'JSON' ? 'JSON' : '文本';
}

/**
 * 解析本地存的预设。返回 null 表示「没存过或整份不可用」，此时才回退到内置预设；
 * 返回空数组表示用户确实把预设都删光了，不能再把内置的塞回去。
 * 坏条目直接丢掉，不让一条脏数据毁掉整份。
 */
export function parsePresets(raw: string | null): PresetMessage[] | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return null;
		const presets: PresetMessage[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const { id, label, data } = item as Record<string, unknown>;
			if (typeof id !== 'number' || !Number.isFinite(id)) continue;
			if (typeof label !== 'string' || typeof data !== 'string') continue;
			presets.push({ id, label, data });
		}
		return presets;
	} catch {
		return null;
	}
}

/**
 * 内置的两条常用预设。恢复默认时按这份重建，所以每次都返回新数组，
 * 免得改动预设时把这份常量一起改掉。
 */
export function defaultPresets(): PresetMessage[] {
	return [
		{ id: 1, label: 'ping 消息', data: '{"type":"ping","time":1704067200000}' },
		{ id: 2, label: '认证请求', data: '{"type":"auth","token":"eyJhbGciOiJIUzI1NiIs..."}' }
	];
}
