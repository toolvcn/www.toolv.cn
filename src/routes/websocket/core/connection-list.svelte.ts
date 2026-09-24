/* eslint-disable svelte/prefer-svelte-reactivity --
 * removeMany 里的 Set 只是 filter 用的查找表，不是要渲染的数据。
 * 换成 SvelteSet 会让它把读写它的代码都注册成依赖，白建 signal。
 * 跟 connection.svelte.ts 里装定时器句柄的容器同理。 */
// 连接列表：增删、选中、状态筛选、批量操作，以及连接 id 的分配。
//
// 从编排层分出来的理由：
// - 「先 dispose 再从数组摘除」这条不变式只有把集合操作收在一处才守得住。
//   少这一步，socket 异步的 onclose 与建连超时定时器会把日志 push 回已清空的数组（幽灵日志）。
// - 选中项被删后回退到第一条，也归集合管。
//
// 它不认识日志：删掉连接后要清哪些日志由编排层做 —— remove / removeMany
// 把被删的 id 交回调用方，由它去通知 LogBook。
import { Connection, type ConnectionHooks } from './connection.svelte.ts';
import type { ScheduledDefault, SocketFactory } from './types.ts';

export interface NewConnectionOptions {
	url: string;
	autoSendEnabled: boolean;
	autoSendMsg: string;
	/**
	 * 新建连接自带的定时任务模板；null 表示不带任务。
	 * 刻意不含 enabled 与 id：自带任务一定是启用的（不然带上它没意义），
	 * id 由连接自己分配，两者都不该由调用方决定。
	 */
	scheduled: Omit<ScheduledDefault, 'enabled'> | null;
}

export class ConnectionList {
	all = $state<Connection[]>([]);
	selectedId = $state<number | null>(null);

	/** 列表底部按连接状态筛选，两个都不勾就一条都不显示 */
	statusFilter = $state({ connected: true, disconnected: true });

	/**
	 * 建 socket 的工厂。生产环境就是全局 WebSocket；
	 * 单测把它换成 FakeSocket 才能驱动连接生命周期（node 里没有 WebSocket）。
	 */
	socketFactory: SocketFactory = (url) => new WebSocket(url);

	readonly #hooks: ConnectionHooks;
	#connectionSeq = 0;

	constructor(hooks: ConnectionHooks) {
		this.#hooks = hooks;
	}

	// ---------------- 派生值 ----------------

	get selected(): Connection | undefined {
		if (this.selectedId === null) return undefined;
		return this.all.find((conn) => conn.id === this.selectedId);
	}

	/** 按底部勾选的状态筛选后的连接列表 */
	get visible(): Connection[] {
		return this.all.filter((conn) =>
			conn.status === 'connected' ? this.statusFilter.connected : this.statusFilter.disconnected
		);
	}

	get connectedCount(): number {
		return this.all.filter((conn) => conn.status === 'connected').length;
	}

	get disconnectedCount(): number {
		return this.all.filter((conn) => conn.status !== 'connected').length;
	}

	/** 所有连接上处于启用状态的定时任务总数（按「已配置」算，不看连没连上） */
	get enabledTaskCount(): number {
		let count = 0;
		for (const connection of this.all) count += connection.enabledTaskCount;
		return count;
	}

	// ---------------- 基础操作 ----------------

	connection(id: number | null | undefined): Connection | undefined {
		if (id == null) return undefined;
		return this.all.find((conn) => conn.id === id);
	}

	select(id: number | null): void {
		this.selectedId = id;
	}

	/**
	 * 建一条连接并加进列表，**不**自动发起连接 ——
	 * 连不连由调用方决定（添加单条要立即连，批量添加是先建完再统一连）。
	 */
	create(options: NewConnectionOptions): Connection {
		const connection = new Connection({
			id: ++this.#connectionSeq,
			url: options.url,
			autoSendEnabled: options.autoSendEnabled,
			autoSendMsg: options.autoSendMsg,
			scheduled: options.scheduled ? [options.scheduled] : [],
			// 包一层箭头：这样替换 socketFactory 后已存在的连接也用新的
			// （单测靠这个在 connect() 之后注入 FakeSocket）
			socketFactory: (target) => this.socketFactory(target),
			hooks: this.#hooks
		});
		this.all.push(connection);
		return connection;
	}

	/** 移除一条连接：先 dispose 再从数组摘。返回是否真的删掉了 */
	remove(id: number): boolean {
		const index = this.all.findIndex((conn) => conn.id === id);
		if (index === -1) return false;
		// 先 dispose 再摘：否则 socket 异步的 onclose 与建连超时定时器
		// 还会往日志里塞引用了已删除连接的条目
		this.all[index].dispose();
		this.all.splice(index, 1);
		if (this.selectedId === id) this.selectedId = this.all[0]?.id ?? null;
		return true;
	}

	/** 批量移除，返回实际被删掉的连接 id，交给调用方清理日志 */
	removeMany(ids: Iterable<number>): number[] {
		const targets = new Set(ids);
		if (targets.size === 0) return [];
		// 先 dispose 再摘：理由同 remove
		const removed: number[] = [];
		for (const connection of this.all) {
			if (!targets.has(connection.id)) continue;
			connection.dispose();
			removed.push(connection.id);
		}
		if (removed.length === 0) return removed;
		this.all = this.all.filter((connection) => !targets.has(connection.id));
		if (this.selectedId !== null && targets.has(this.selectedId)) {
			this.selectedId = this.all[0]?.id ?? null;
		}
		return removed;
	}

	// ---------------- 生命周期（转交给 Connection） ----------------

	connect(id: number): void {
		this.connection(id)?.connect();
	}

	disconnect(id: number): void {
		this.connection(id)?.disconnect();
	}

	toggle(id: number): void {
		const connection = this.connection(id);
		if (!connection) return;
		if (connection.status === 'disconnected') connection.connect();
		else connection.disconnect();
	}

	/**
	 * 连上筛选出来的连接。没筛选时等价于全连；只勾了「未连接」就只连这批断线的，
	 * 已经连上的不受影响（Connection.connect 对非 disconnected 会直接返回）。
	 */
	connectVisible(): void {
		for (const connection of this.visible) connection.connect();
	}

	/** 断开筛选出来的连接 */
	disconnectVisible(): void {
		for (const connection of this.visible) {
			if (connection.status !== 'disconnected') connection.disconnect();
		}
	}

	/**
	 * 断开所有连接。这个是全量、不看筛选的 —— 页面卸载时的清理用它，
	 * 那时不能因为用户勾了什么就漏掉几条没关的 socket。
	 */
	disconnectAll(): void {
		for (const connection of this.all) {
			if (connection.status !== 'disconnected') connection.disconnect();
		}
	}

	/** 离开页面 / 路由跳走时收掉所有连接与定时器 */
	disposeAll(): void {
		for (const connection of this.all) connection.dispose();
	}

	/** 由页面的 effect 每轮调用：逐条连接同步它的定时任务定时器 */
	syncAllScheduled(): void {
		for (const connection of this.all) connection.syncScheduled();
	}
}
