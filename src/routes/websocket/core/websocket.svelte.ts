// WebSocket 调试工具的编排层。
//
// 三个对象各管各的，组件与单测直接读写 ws.connections.* 与 ws.logs.*，没有转发门面：
// - connection.svelte.ts      Connection：一条连接的 socket、定时器、自己的定时任务
// - connection-list.svelte.ts ConnectionList：连接的集合、选中、筛选、批量操作
// - log-book.svelte.ts        LogBook：日志的集合、筛选、折叠、渲染窗口、导出
// - format.ts / json.ts / labels.ts：纯函数（格式化、JSON、界面文案）
//
// 留在这里的只有真正跨对象的编排：
// - 新建连接（默认配置 → 造连接 → 立即连）
// - 删除连接（先从列表删，再清它的日志）
// - 收发（草稿 → 某条连接 / 广播到全部已连接）
// 以及不属于任何一个对象的：消息草稿、快捷预设、toast、新建连接的默认配置。
import type { Connection } from './connection.svelte.ts';
import { ConnectionList } from './connection-list.svelte.ts';
import { defaultPresets, parsePresets } from './format.ts';
import { insertTimestamp as insertTime, parseJson } from './json.ts';
import { LogBook } from './log-book.svelte.ts';
import type { PresetMessage, ScheduledDefault } from './types.ts';
// 定时任务模板的默认间隔与预设存储键在根层的 config.ts
import { DEFAULT_TEMPLATE_INTERVAL, PRESET_STORAGE_KEY } from '../config.ts';
import { toast } from '$lib/ui/toast.svelte';

class WebSocketStore {
	// ---------------------------------------------------------------- 子对象

	/**
	 * 连接列表要在日志本之前声明：LogBook 的回调里要读 connections.selectedId，
	 * 箭头函数是延迟执行的，但字段初始化时 this.connections 必须已经存在。
	 */
	readonly connections = new ConnectionList({
		log: (conn, direction, content) => this.logs.add(conn.id, direction, content),
		receive: (conn, data) => void this.receive(conn, data)
	});

	readonly logs = new LogBook({
		selectedId: () => this.connections.selectedId,
		urlOf: (id) => this.connections.connection(id)?.url ?? null
	});

	// ---------------------------------------------------------------- 新建连接的默认配置（连接栏）

	urlInput = $state('wss://echo.websocket.org');
	// 自动发送 / 定时发送的这两个开关都是「新建连接时的默认配置」，
	// 具体某条连接开没开由连接列表里的图标单独控制
	autoSend = $state(false);
	autoSendMsg = $state('{"type":"auth","token":"eyJhbGciOiJIUzI1NiIs..."}');

	/**
	 * 新建连接时自动带上的定时任务模板：开启后添加连接会直接建一条已启用的定时任务。
	 * 改这里不会影响已存在的连接，那条任务在消息面板里照常开关、改间隔或删除。
	 */
	scheduledDefault = $state<ScheduledDefault>({
		enabled: false,
		interval: DEFAULT_TEMPLATE_INTERVAL,
		message: '{"type":"ping","time":1704067200000}'
	});

	// ---------------------------------------------------------------- 消息草稿（消息面板）

	msgInput = $state('{ "type": "ping", "time": 1704067200000 }');

	// ---------------------------------------------------------------- 快捷预设

	presetMessages = $state<PresetMessage[]>(defaultPresets());
	newPresetLabel = $state('');
	newPresetData = $state('');
	showPresetForm = $state(false);
	/** 本地是否存过预设，决定「恢复默认」按钮能不能点 */
	presetsStored = $state(false);

	/** 预设的自增 id；从本地恢复后要接着已恢复的最大 id 走，否则 each 的 key 会重复 */
	#presetSeq = defaultPresets().length;

	// ---------------------------------------------------------------- 其它 UI 状态

	/** 日志面板的「自动滚动」开关 */
	autoScroll = $state(true);
	/** 由页面的定时器每秒推进，用于显示连接时长 */
	now = $state(Date.now());
	// ---------------------------------------------------------------- 编排：连接管理

	/** 校验并规范化输入的地址，失败时弹提示并返回 null */
	private normalizeUrl(): string | null {
		const url = this.urlInput.trim();
		if (!url) {
			toast.show('请输入 WebSocket URL');
			return null;
		}
		if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
			toast.show('URL 必须以 ws:// 或 wss:// 开头');
			return null;
		}
		return url;
	}

	/** 建一条连接（不发起连接）；默认配置在这里读一次，之后改配置不影响它 */
	private createConnection(url: string): Connection {
		return this.connections.create({
			url,
			// 开关关着时连内容一起不给：否则新建的连接带着一条你在界面上没见过的消息，
			// 列表里的图标照样能用它开启（这正是「开关关着却能自动发送」那个 bug 的入口）。
			// 开关开着但消息是空的也不记成「已开启」——建连后什么都不会发，列表却显示已开启
			autoSendEnabled: this.autoSend && this.autoSendMsg.trim() !== '',
			autoSendMsg: this.autoSend ? this.autoSendMsg.trim() : '',
			scheduled: this.scheduledDefault.enabled
				? { interval: this.scheduledDefault.interval, message: this.scheduledDefault.message }
				: null
		});
	}

	addConnection(): void {
		const url = this.normalizeUrl();
		if (!url) return;
		const connection = this.createConnection(url);
		this.connections.select(connection.id);
		connection.connect();
		toast.show('连接已添加');
	}

	addTenConnections(): void {
		const url = this.normalizeUrl();
		if (!url) return;
		const created = Array.from({ length: 10 }, () => this.createConnection(url));
		this.connections.select(created[0].id);
		for (const connection of created) connection.connect();
		toast.show('已批量添加 10 条连接');
	}

	/** 删除一条连接并清掉它的日志（系统日志留着） */
	removeConnection(id: number): void {
		// 先删连接再清日志：dispose 之后 socket 的异步回调就不会再写日志了
		if (this.connections.remove(id)) this.logs.clearOf(id);
	}

	/**
	 * 删除当前筛选出来的连接。没筛选时（两个勾选框都勾着）等价于全删。
	 * 日志只清被删连接自己的，系统日志留着 —— 跟 removeConnection 同一条规则，
	 * 也免得批量删完日志面板一片空白。
	 */
	removeVisibleConnections(): void {
		const targets = this.connections.visible;
		if (targets.length === 0) return;
		const removed = this.connections.removeMany(targets.map((connection) => connection.id));
		if (removed.length > 0) this.logs.clearOfMany(removed);
	}

	// ---------------------------------------------------------------- 编排：收发消息

	/** 收到原始消息：解码、记日志，能认出 pong 就算往返延迟 */
	private async receive(connection: Connection, data: unknown): Promise<void> {
		const content = await decodeMessage(data);
		this.logs.add(connection.id, 'received', content);
		// 收到 { type: 'pong', time } 时，time 是发出 ping 的时间戳，据此算往返延迟
		const parsed = parseJson(content) as { type?: string; time?: number } | undefined;
		if (parsed?.type === 'pong' && typeof parsed.time === 'number') {
			connection.latency = Date.now() - parsed.time;
		}
	}

	sendTo(id: number, content: string): boolean {
		return this.connections.connection(id)?.send(content) ?? false;
	}

	/** 发送草稿到当前选中的连接 */
	send(): void {
		const selected = this.connections.selected;
		if (!selected) {
			toast.show('请先选择一个连接');
			return;
		}
		if (!this.msgInput.trim()) {
			toast.show('请输入消息内容');
			return;
		}
		this.sendTo(selected.id, this.msgInput);
	}

	broadcast(content: string): void {
		// 空内容要先挡掉。send() 有这个检查，广播漏了的话会真的发出一条 0 B 的消息，
		// 对端一回显又多一条垃圾日志，日志面板里还记着「已广播到 N 个连接」
		if (!content.trim()) {
			toast.show('请输入消息内容');
			return;
		}
		const targets = this.connections.all.filter((conn) => conn.status === 'connected');
		if (targets.length === 0) {
			this.logs.add(null, 'system', '广播失败：没有已连接的连接');
			return;
		}
		for (const connection of targets) connection.send(content);
		this.logs.add(null, 'system', `已广播到 ${targets.length} 个连接`);
	}

	// ---------------------------------------------------------------- 编排：消息草稿

	formatMsgInput(): void {
		const parsed = parseJson(this.msgInput);
		if (parsed === undefined) return;
		this.msgInput = JSON.stringify(parsed, null, 2);
	}

	compressMsgInput(): void {
		const parsed = parseJson(this.msgInput);
		if (parsed === undefined) return;
		this.msgInput = JSON.stringify(parsed);
	}

	/** 在草稿的尾部加一个 time 字段，排版原样保留（纯逻辑在 json.ts） */
	insertTimestamp(): void {
		this.msgInput = insertTime(this.msgInput, Date.now());
	}

	// ---------------------------------------------------------------- 快捷预设

	addPreset(): void {
		const label = this.newPresetLabel.trim();
		const data = this.newPresetData.trim();
		if (!label) {
			toast.show('请输入预设名称');
			return;
		}
		if (!data) {
			toast.show('请输入预设内容');
			return;
		}
		this.presetMessages = [...this.presetMessages, { id: ++this.#presetSeq, label, data }];
		this.newPresetLabel = '';
		this.newPresetData = '';
		this.showPresetForm = false;
		toast.show('预设已添加');
	}

	removePreset(id: number): void {
		const removed = this.presetMessages.find((preset) => preset.id === id);
		if (!removed) return;
		// 跟 addPreset 一样整体换数组，不在原数组上 splice：
		// 两种写法都能触发更新，混着用会让人犹豫哪个才是对的
		this.presetMessages = this.presetMessages.filter((preset) => preset.id !== id);
		toast.show(`已删除预设「${removed.label}」`);
	}

	/**
	 * 从本地存储恢复预设；没存过就保留内置的。
	 * 空数组是「用户把预设删光了」，不能再把内置的塞回去（parsePresets 区分了这两种）。
	 * 写回由 savePresets 做 —— 进页面只读一次，存不存由用户点「保存到本地」决定。
	 */
	loadPresets(): void {
		try {
			const saved = parsePresets(localStorage.getItem(PRESET_STORAGE_KEY));
			if (!saved) return;
			this.presetMessages = saved;
			this.presetsStored = true;
			// 自增 id 不能和已恢复的撞车，否则 each 的 key 会重复
			this.#presetSeq = saved.reduce((max, preset) => Math.max(max, preset.id), 0);
		} catch {
			/* 隐私模式下 localStorage 不可用，忽略 */
		}
	}

	savePresets(): void {
		try {
			localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(this.presetMessages));
			this.presetsStored = true;
			toast.show(`已保存 ${this.presetMessages.length} 条预设到本地`);
		} catch {
			toast.show('保存失败：当前浏览器不允许本地存储');
		}
	}

	/** 清掉本地存的预设并恢复成内置的那两条 */
	restoreDefaultPresets(): void {
		try {
			localStorage.removeItem(PRESET_STORAGE_KEY);
		} catch {
			/* 同上 */
		}
		const presets = defaultPresets();
		this.presetMessages = presets;
		this.#presetSeq = presets.length;
		this.presetsStored = false;
		toast.show('已清空本地预设，恢复默认');
	}
}

// ---------------------------------------------------------------- 模块级辅助

/** 把 socket 送来的原始数据解码成字符串；node 环境里这些类型都在，可直接测 */
async function decodeMessage(data: unknown): Promise<string> {
	if (typeof data === 'string') return data;
	if (data instanceof Blob) return data.text();
	if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
	if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
	return String(data);
}

export const ws = new WebSocketStore();
