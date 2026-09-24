// WebSocket 调试工具的类型。
// 单独成文件是为了让 connection.svelte.ts 与 websocket.svelte.ts 之间不出现循环依赖，
// 也方便单测只引类型。
//
// 可配置的业务参数（预设存储键 / 定时任务默认间隔 / 建连超时 / 日志上限）在**根层的 `config.ts`**，
// 不在这里 —— 本文件只留类型。

// 高亮 token 的类型是全站共用的（$lib/utils/json）——本工具的日志面板另有一套配色，
// 但 token 的 kind 必须跟分词器一致，否则 punct 会在 Record 里查不到。
import type { JsonToken } from '$lib/utils/json';

export type { JsonToken };

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type LogDirection = 'sent' | 'received' | 'system';

/** 定时任务，每条连接可以有多条；each 的 key 必须用 id */
export interface ScheduledTask {
	id: number;
	/** 发送间隔（秒） */
	interval: number;
	message: string;
	enabled: boolean;
}

/** 新建连接时自动带上的定时任务模板，就是少一个 id */
export type ScheduledDefault = Omit<ScheduledTask, 'id'>;

export interface PresetMessage {
	/** each 的 key 必须用 id：label 允许重复，用 label 当 key 会触发 each_key_duplicate */
	id: number;
	label: string;
	data: string;
}

export interface LogEntry {
	id: number;
	connectionId: number | null;
	direction: LogDirection;
	content: string;
	timestamp: number;
	type: 'JSON' | 'Text';
	/**
	 * size / tokens 改成惰性：入库时就算好看着省事，但每条都要 new Blob + parse +
	 * 缩进序列化 + 正则分词，而导出、筛选、计数全都用不到 tokens，纯属白干。
	 * 折叠起来的日志也永远读不到它们。
	 */
	get size(): string;
	/** JSON 日志的分词结果，渲染时按类型上色；Text 日志为 null */
	get tokens(): JsonToken[] | null;
}

/**
 * WebSocket 的最小接口，Connection 只依赖这个而不是全局 WebSocket。
 * 生产环境传 `new WebSocket(url)`，单测传 FakeSocket。
 */
export interface SocketLike {
	send(data: string): void;
	close(): void;
	// 回调签名与原生 WebSocket 逐个对齐（onclose 是 CloseEvent、onmessage 是 MessageEvent），
	// 这样 `new WebSocket(url)` 可以直接当 SocketLike 用，不需要适配器
	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	onclose: ((event: CloseEvent) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;
