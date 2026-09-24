/* eslint-disable svelte/prefer-svelte-reactivity --
 * 本文件里的 Set 只是 filter 用的查找表、Date 只是导出时的一次性快照，
 * 都不是要渲染的数据。换成 SvelteSet / SvelteDate 只会白建 signal：
 * 读写它们的 getter 会把日志本自己注册成依赖，每次变更都要多跑一轮才收敛。
 * 跟 connection.svelte.ts 里装定时器句柄的 Map / Set 同理。 */
// 日志本：日志的集合、方向筛选、折叠、渲染窗口与导出。
//
// 从 WebSocketStore 里分出来的理由：这一块有自己要守住的不变式 ——
// 软上限裁剪、清空时把触顶丢弃计数一起归零、只清某条连接自己的日志但要留系统日志、
// 切筛选后把渲染窗口收回默认。它们散落在 store 的各个方法里时，每一处都得靠注释提醒，
// 改动时很容易漏掉其中一条。
//
// 它不认识「连接」：需要当前选中的连接 id 与连接地址时走构造注入的两个回调，
// 这样就不必反向 import store（那会形成循环依赖）。
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { createLogEntry, formatTime } from './format.ts';
import type { LogDirection, LogEntry } from './types.ts';
// 日志的软上限 / 裁剪步长 / 渲染窗口都在根层的 config.ts
import { LOG_LIMIT, LOG_TRIM_STEP, RENDER_STEP } from '../config.ts';

/** LogBook 对外部世界的依赖，全部是只读查询，不反向依赖 store */
export interface LogBookDeps {
	/** 当前选中的连接 id，为 null 时「仅看当前连接」不生效 */
	selectedId(): number | null;
	/** 连接 id → 地址，写进导出的每条日志 */
	urlOf(id: number | null): string | null;
}

export class LogBook {
	all = $state<LogEntry[]>([]);
	/** 三个方向各自独立，全都不勾就是一条都不显示 */
	filters = $state({ sent: true, received: true, system: true });
	filterCurrent = $state(false);

	/** 被折叠的日志 id，默认全部展开；日志 id 全局自增，清掉日志后残留的 id 不会撞车 */
	collapsed = new SvelteSet<number>();

	/** 日志渲染窗口：一次只渲染最近 renderCount 条，点「加载更早」再加 */
	renderCount = $state(RENDER_STEP);
	/** 因为触顶被丢掉的日志条数，累计数，用来提示用户「更早的已经没了」 */
	droppedCount = $state(0);

	readonly #deps: LogBookDeps;
	#seq = 0;

	constructor(deps: LogBookDeps) {
		this.#deps = deps;
	}

	// ---------------- 派生值 ----------------

	get visible(): LogEntry[] {
		const enabled: LogDirection[] = [];
		if (this.filters.sent) enabled.push('sent');
		if (this.filters.received) enabled.push('received');
		if (this.filters.system) enabled.push('system');

		// 一个方向都不勾就是一条都不显示，跟连接列表的筛选口径保持一致，
		// 也符合「全都不勾时给明确空态」而不是静默显示全部
		const byDirection = this.all.filter((log) => enabled.includes(log.direction));

		const selectedId = this.filterCurrent ? this.#deps.selectedId() : null;
		// 未选中连接时勾了也不生效。与其静默失效，界面上直接把这个勾选框禁用（见日志面板）
		if (selectedId === null) return byDirection;
		return byDirection.filter((log) => log.connectionId === selectedId);
	}

	/** 渲染窗口内要显示的日志 */
	get shown(): LogEntry[] {
		const visible = this.visible;
		// 取 min：筛选后总量变少时不会渲染出比实际更多的条目
		const count = Math.min(this.renderCount, visible.length);
		return visible.slice(visible.length - count);
	}

	/** 还有多少条没渲染出来 */
	get hiddenCount(): number {
		return this.visible.length - this.shown.length;
	}

	get stats(): { all: number; sent: number; received: number; system: number } {
		const stats = { all: 0, sent: 0, received: 0, system: 0 };
		for (const log of this.all) {
			stats.all += 1;
			stats[log.direction] += 1;
		}
		return stats;
	}

	/** 当前筛选出来的日志是不是全折叠了，决定头部按钮显示「展开全部」还是「折叠全部」 */
	get allVisibleCollapsed(): boolean {
		const visible = this.visible;
		return visible.length > 0 && visible.every((log) => this.collapsed.has(log.id));
	}

	/** 每个连接的收发条数，键为连接 id */
	get countsByConnection(): Map<number, { sent: number; received: number }> {
		const counts = new SvelteMap<number, { sent: number; received: number }>();
		for (const log of this.all) {
			if (log.connectionId === null || log.direction === 'system') continue;
			const entry = counts.get(log.connectionId) ?? { sent: 0, received: 0 };
			entry[log.direction] += 1;
			counts.set(log.connectionId, entry);
		}
		return counts;
	}

	/**
	 * 单条连接的收发条数。日志面板底部只关心当前选中那一条，
	 * 不必为它把全量 Map 建出来（countsByConnection 是给连接列表逐行查的）。
	 */
	countsOf(id: number | null | undefined): { sent: number; received: number } {
		const counts = { sent: 0, received: 0 };
		if (id == null) return counts;
		for (const log of this.all) {
			if (log.connectionId !== id || log.direction === 'system') continue;
			counts[log.direction] += 1;
		}
		return counts;
	}

	// ---------------- 写入 ----------------

	add(connectionId: number | null, direction: LogDirection, content: string): void {
		this.all.push(createLogEntry({ id: ++this.#seq, connectionId, direction, content }));
		// 软上限：超了丢最早的。不封顶的话长时间调试会一直吃内存
		// （每条 JSON 日志入库就 parse + 分词，1KB 实际占 4-5KB）
		const excess = this.all.length - LOG_LIMIT;
		if (excess > 0) {
			const dropped = excess + LOG_TRIM_STEP;
			this.all.splice(0, dropped);
			this.droppedCount += dropped;
		}
	}

	/**
	 * 清空全部日志。触顶丢弃的计数跟着归零 —— 它描述的是「当前这批日志」，
	 * 清空后不该再提示，那些丢掉的跟新日志无关。
	 */
	clear(): void {
		this.all = [];
		this.collapsed.clear();
		this.resetRenderWindow();
		this.droppedCount = 0;
	}

	/**
	 * 只清某条连接自己的日志，系统日志（connectionId 为 null）留着：
	 * 清光了日志面板会一片空白，而系统日志本来就不属于任何连接。
	 */
	clearOf(id: number): void {
		this.clearOfMany([id]);
	}

	/** 批量清掉若干连接的日志，系统日志同样保留 */
	clearOfMany(ids: Iterable<number>): void {
		const removed = new Set(ids);
		if (removed.size === 0) return;
		// 只清被删日志的折叠记录，不能整个 clear()：
		// 那会把其它连接上用户折叠好的日志一起展开
		for (const log of this.all) {
			if (log.connectionId !== null && removed.has(log.connectionId)) this.collapsed.delete(log.id);
		}
		this.all = this.all.filter((log) => log.connectionId === null || !removed.has(log.connectionId));
		// 渲染窗口也要收回默认，否则点过「加载更早」之后剩下的日志会一次全渲染出来
		this.resetRenderWindow();
	}

	// ---------------- 折叠与渲染窗口 ----------------

	isCollapsed(id: number): boolean {
		return this.collapsed.has(id);
	}

	/** 折叠 / 展开单条日志的消息内容 */
	toggleCollapsed(id: number): void {
		if (this.collapsed.has(id)) this.collapsed.delete(id);
		else this.collapsed.add(id);
	}

	/** 一键折叠 / 展开：只作用于当前筛选出来的日志 */
	toggleAllCollapsed(): void {
		const collapse = !this.allVisibleCollapsed;
		for (const log of this.visible) {
			if (collapse) this.collapsed.add(log.id);
			else this.collapsed.delete(log.id);
		}
	}

	/** 切方向筛选。换了筛选条件就把渲染窗口收回默认，免得残留上一次的 600 / 900 */
	toggleFilter(direction: LogDirection): void {
		this.filters[direction] = !this.filters[direction];
		this.resetRenderWindow();
	}

	resetRenderWindow(): void {
		this.renderCount = RENDER_STEP;
	}

	loadEarlier(): void {
		this.renderCount += RENDER_STEP;
	}

	// ---------------- 导出 ----------------

	/**
	 * 拼出导出的 JSON。只负责拼字符串，落盘由 ui/browser.ts 做 ——
	 * 以前这里直接 createElement('a') 再 click()，node 环境里根本没法测。
	 * 带上导出时间、当前筛选条件和每条日志的结构化字段，方便拿去二次处理。
	 */
	buildExportText(): string {
		const payload = {
			exportedAt: new Date().toISOString(),
			tool: 'www.toolv.cn/websocket',
			filters: {
				...this.filters,
				onlySelectedConnection: this.filterCurrent ? this.#deps.selectedId() : null
			},
			logs: this.visible.map((log) => ({
				id: log.id,
				connectionId: log.connectionId,
				connectionUrl: this.#deps.urlOf(log.connectionId),
				direction: log.direction,
				type: log.type,
				size: log.size,
				timestamp: log.timestamp,
				time: formatTime(log.timestamp),
				content: log.content
			}))
		};
		return JSON.stringify(payload, null, 2);
	}
}
