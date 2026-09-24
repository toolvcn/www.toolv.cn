// 一条连接自己的一切：socket、连接状态机、定时任务定时器。
// 以前这些都散在 WebSocketStore 里，socket 挂在 $state 上、定时器挂在模块级 WeakMap 里，
// 结果就是「删除连接后冒幽灵日志」和「快速重连产生孤儿 socket」这两个 Bug。
//
// 注意：Svelte 的 $state 只代理 plain object / array，class 实例原样返回。
// 所以这个类的每个需要渲染的字段都必须显式标 $state，漏标会静默失去响应性
// （不报错、类型检查也过）。私有字段（#socket / #taskTimers）反而不能被代理 —— 那正是我们要的，
// socket 与定时器句柄都不该被响应式追踪。
/* eslint-disable svelte/prefer-svelte-reactivity --
 * 这个文件的定时器容器刻意用原生 Map / Set：里面装的是 setInterval 句柄，
 * 不是要渲染的数据。换成 SvelteMap / SvelteSet 会让读写它的 $effect 把自己注册成依赖，
 * 每次变更都要多跑一轮才收敛。planTimers 里的 Set 同样只是中间计算结果。 */
import { withCurrentTime } from './json.ts';
import type { ConnectionStatus, LogDirection, ScheduledTask, SocketFactory, SocketLike } from './types.ts';
// 建连超时与定时任务默认间隔在根层的 config.ts
import { CONNECT_TIMEOUT_MS, DEFAULT_SCHEDULED_INTERVAL } from '../config.ts';

/**
 * 启停定时任务的结果。Connection 不认识 toast，所以只回答「卡在哪」，
 * 提示语由调用方（组件）决定。
 */
export type TaskToggleResult = 'ok' | 'need-interval' | 'need-message' | 'not-found';

/** Connection 需要store 提供的两个出口，避免反向依赖 WebSocketStore */
export interface ConnectionHooks {
	log(connection: Connection, direction: LogDirection, content: string): void;
	/** 收到原始消息：解码、记日志、必要时算延迟 */
	receive(connection: Connection, data: unknown): void;
}

export interface ConnectionOptions {
	id: number;
	url: string;
	autoSendEnabled: boolean;
	autoSendMsg: string;
	/** 建连时自带的定时任务模板：id 与 enabled 由本连接定（自带任务直接是启用的） */
	scheduled: Array<Omit<ScheduledTask, 'id' | 'enabled'>>;
	socketFactory: SocketFactory;
	hooks: ConnectionHooks;
}

/** 定时任务的调度决策：哪些保留、哪些新建、哪些撤销 */
export interface TimerPlan {
	/** 已有且间隔未变的任务 id，保持原定时器不动（不重置发送相位） */
	keep: Set<number>;
	/** 需要新建定时器的任务 */
	create: ScheduledTask[];
	/** 已删除 / 已停用 / 已断开，需要撤销的定时器 id */
	remove: number[];
}

/**
 * 纯函数：按「当前在跑的定时器 + 任务列表 + 连没连上」算出这一轮要做什么。
 * 不碰定时器、不碰时间，node 里可直接单测。
 */
export function planTimers(
	running: ReadonlyMap<number, { interval: number }>,
	tasks: readonly ScheduledTask[],
	connected: boolean
): TimerPlan {
	const keep = new Set<number>();
	const create: ScheduledTask[] = [];
	const live = new Set<number>();

	for (const task of tasks) {
		// 用 !(x > 0) 而不是 x <= 0，顺带挡住 NaN
		if (!task.enabled || !(task.interval > 0) || !connected) continue;
		live.add(task.id);
		const current = running.get(task.id);
		if (current && current.interval === task.interval) keep.add(task.id);
		else create.push(task);
	}

	const remove: number[] = [];
	for (const taskId of running.keys()) {
		if (!live.has(taskId)) remove.push(taskId);
	}
	return { keep, create, remove };
}

export class Connection {
	readonly id: number;
	readonly url: string;

	// ---- 下面几个都是渲染要读的，必须显式 $state ----
	status = $state<ConnectionStatus>('disconnected');
	latency = $state<number | null>(null);
	/** 建连成功后是否自动发一条；关着也保留内容，下次开启不用重填 */
	autoSendEnabled = $state(false);
	/** 建连成功后自动发送的那条消息 */
	autoSendMsg = $state('');
	connectedAt = $state<number | null>(null);
	scheduled = $state<ScheduledTask[]>([]);

	// ---- 下面这些刻意不进 $state：socket 与定时器句柄都不该被响应式追踪 ----
	#socket: SocketLike | null = null;
	#connectTimer: ReturnType<typeof setTimeout> | null = null;
	#taskTimers = new Map<number, { timer: ReturnType<typeof setInterval>; interval: number }>();
	/** 每次 connect 递增，用来判断迟到的回调属于哪一代 socket */
	#generation = 0;
	/** 连接已被移除；置位后所有回调与定时器都不再生效 */
	#disposed = false;
	/** 定时任务 id 的自增序列。任务 id 只需在本连接内唯一（each 的 key 就是它），
	 *  所以没必要全站统一分配 —— 自己管一份，加任务时不用去问集合要号 */
	#taskSeq = 0;

	readonly #socketFactory: SocketFactory;
	readonly #hooks: ConnectionHooks;

	constructor(options: ConnectionOptions) {
		this.id = options.id;
		this.url = options.url;
		this.autoSendEnabled = options.autoSendEnabled;
		this.autoSendMsg = options.autoSendMsg;
		// 自带的任务一律按「已启用」建，id 由本连接自己分配
		this.scheduled = options.scheduled.map((task) => ({ ...task, id: ++this.#taskSeq, enabled: true }));
		this.#socketFactory = options.socketFactory;
		this.#hooks = options.hooks;
	}

	/** 连接已从列表移除，之后不该再产生任何日志或状态变更 */
	get disposed(): boolean {
		return this.#disposed;
	}

	/** 正在跑的定时任务定时器数量，测试用来断言清理是否彻底 */
	get timerCount(): number {
		return this.#taskTimers.size;
	}

	// ---------------- 连接生命周期 ----------------

	connect(): void {
		if (this.#disposed || this.status !== 'disconnected') return;

		let socket: SocketLike;
		try {
			socket = this.#socketFactory(this.url);
		} catch (error) {
			this.#log('system', `连接失败：${error instanceof Error ? error.message : '未知错误'}`);
			return;
		}

		// 递增世代号：旧 socket 迟到的回调会因为代次不符被丢弃
		const generation = ++this.#generation;
		this.#socket = socket;
		this.status = 'connecting';

		// 旧 socket 迟到的回调一律无视：
		// 不判的话，断开后立刻重连时旧 socket 的 onclose 会把新 socket 置空、状态打回 disconnected，
		// 但 TCP 其实还活着 —— 之后发送一律报「连接未就绪」
		const stale = () => this.#disposed || this.#socket !== socket || generation !== this.#generation;

		this.#connectTimer = setTimeout(() => {
			this.#connectTimer = null;
			if (stale()) return;
			this.#log('system', '连接超时');
			socket.close();
			this.#handleClose();
		}, CONNECT_TIMEOUT_MS);

		socket.onopen = () => {
			if (stale()) return;
			this.#clearConnectTimer();
			this.status = 'connected';
			this.latency = null;
			this.connectedAt = Date.now();
			this.#log('system', '连接已建立');
			// 两个条件都要判：内容允许在开启后被清成空白，那种情况下不发空消息
			if (this.autoSendEnabled && this.autoSendMsg.trim()) this.send(this.autoSendMsg);
		};

		socket.onmessage = (event) => {
			if (stale()) return;
			this.#hooks.receive(this, event.data);
		};

		socket.onerror = () => {
			if (stale()) return;
			this.#handleClose('连接错误');
		};

		socket.onclose = () => {
			if (stale()) return;
			this.#handleClose('连接已关闭');
		};
	}

	/** 用户主动断开：不记「连接已关闭」日志 */
	disconnect(): void {
		if (this.status === 'disconnected') return;
		this.#generation++;
		this.#clearConnectTimer();
		this.#detachSocket();
		this.status = 'disconnected';
		this.connectedAt = null;
		// 用户主动断开也记一条，日志里才看得出是自己关的还是断的。
		// dispose（连接被移除）走的是 #detachSocket，不会记 —— 否则删除连接后会冒幽灵日志
		this.#log('system', '已断开连接');
	}

	/** 摘掉 socket 的回调并 close，不产生任何日志 */
	#detachSocket(): void {
		const socket = this.#socket;
		this.#socket = null;
		if (!socket) return;
		socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
		try {
			socket.close();
		} catch {
			/* 已关闭的 socket 再 close 会抛，忽略 */
		}
	}

	/**
	 * 连接被从列表移除时调用：置 disposed 标记、摘掉所有回调、清掉所有定时器。
	 * 少了这一步，close() 的异步 onclose 会把日志 push 回已清空的数组（幽灵日志），
	 * 处于 connecting 的连接还会被 10 秒超时路径补一条「连接超时」。
	 */
	dispose(): void {
		this.#disposed = true;
		this.#generation++;
		this.#clearConnectTimer();
		for (const entry of this.#taskTimers.values()) clearInterval(entry.timer);
		this.#taskTimers.clear();
		// 用 #detachSocket 而不是 disconnect()：这里不记日志，
		// 否则删除连接后日志里会冒出引用已删除连接的幽灵条目
		this.#detachSocket();
		this.status = 'disconnected';
		this.connectedAt = null;
	}

	/** 非用户主动的收尾；note 为空表示不记日志 */
	#handleClose(note?: string): void {
		this.#clearConnectTimer();
		if (note && this.status !== 'disconnected') this.#log('system', note);
		this.#socket = null;
		this.status = 'disconnected';
		this.connectedAt = null;
	}

	#clearConnectTimer(): void {
		if (this.#connectTimer === null) return;
		clearTimeout(this.#connectTimer);
		this.#connectTimer = null;
	}

	// ---------------- 收发 ----------------

	send(content: string): boolean {
		const socket = this.#socket;
		if (this.status !== 'connected' || !socket) {
			this.#log('system', '发送失败：连接未就绪');
			return false;
		}
		try {
			socket.send(content);
			this.#log('sent', content);
			return true;
		} catch (error) {
			this.#log('system', `发送失败：${error instanceof Error ? error.message : '未知错误'}`);
			return false;
		}
	}

	// ---------------- 定时任务 ----------------

	/**
	 * 按当前状态同步本连接上所有定时任务的定时器。
	 * 决策由纯函数 planTimers 给出，这里只负责按计划建 / 撤 interval。
	 */
	syncScheduled(): void {
		const plan = planTimers(this.#taskTimers, this.scheduled, this.status === 'connected');

		for (const taskId of plan.remove) {
			const entry = this.#taskTimers.get(taskId);
			if (entry) clearInterval(entry.timer);
			this.#taskTimers.delete(taskId);
		}

		for (const task of plan.create) {
			const timer = setInterval(() => {
				if (this.status !== 'connected') return;
				// 消息是带 time 字段的 JSON 时把 time 刷成当前时间戳，收到 pong 才能算出往返延迟；
				// 没有 time 字段的任务原样发送，所以不需要单独一类「心跳」任务
				this.send(withCurrentTime(task.message));
			}, task.interval * 1000);
			this.#taskTimers.set(task.id, { timer, interval: task.interval });
		}
	}

	// ---------------- 定时任务：增删改都归本连接自己 ----------------

	/** 新增一条定时发送任务，默认关闭 —— 填好间隔与消息后再启用 */
	addTask(): ScheduledTask {
		const task: ScheduledTask = {
			id: ++this.#taskSeq,
			interval: DEFAULT_SCHEDULED_INTERVAL,
			message: '',
			enabled: false
		};
		this.scheduled.push(task);
		return task;
	}

	removeTask(id: number): boolean {
		const index = this.scheduled.findIndex((task) => task.id === id);
		if (index === -1) return false;
		this.scheduled.splice(index, 1);
		return true;
	}

	/**
	 * 启停某一条任务；间隔或消息不合法时拒绝启用，把原因交回调用方 ——
	 * 「间隔必须大于 0 秒」这类话归 UI 说。
	 */
	toggleTask(id: number): TaskToggleResult {
		const task = this.scheduled.find((item) => item.id === id);
		if (!task) return 'not-found';
		// 用 !(x > 0) 而不是 x <= 0，顺带挡住 NaN
		if (!task.enabled && !(task.interval > 0)) return 'need-interval';
		if (!task.enabled && !task.message.trim()) return 'need-message';
		task.enabled = !task.enabled;
		return 'ok';
	}

	/** 启用着的定时任务数（按「已配置」算，不看连没连上） */
	get enabledTaskCount(): number {
		return this.scheduled.filter((task) => task.enabled).length;
	}

	/**
	 * 启停「连接成功后自动发送一次」。内容为空时拒绝开启并返回 false：
	 * 内容只在添加连接时设定，事后改不了，得由调用方把原因说清楚。
	 */
	toggleAutoSend(): boolean {
		if (this.autoSendEnabled) {
			this.autoSendEnabled = false;
			return true;
		}
		if (!this.autoSendMsg.trim()) return false;
		this.autoSendEnabled = true;
		return true;
	}

	#log(direction: LogDirection, content: string): void {
		if (this.#disposed) return;
		this.#hooks.log(this, direction, content);
	}
}
