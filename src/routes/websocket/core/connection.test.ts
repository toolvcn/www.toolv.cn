// Connection 的单测：定时任务的增删改、自动发送开关、socket 生命周期。
//
// node 里没有 WebSocket，用 FakeSocket 驱动 —— 「删除连接后冒幽灵日志」和
// 「旧 socket 迟到回调」这两个 Bug 正是由 close() 的异步性产生的，
// 假 socket 的 close() 同样走 queueMicrotask，行为对得上。
import { describe, expect, it, vi } from 'vitest';
import { Connection, planTimers, type ConnectionOptions } from './connection.svelte.ts';
import { fakeSocketFactory } from './fake-socket.ts';
import type { ScheduledTask } from './types.ts';
import { DEFAULT_SCHEDULED_INTERVAL } from '../config.ts';

/** 等微任务队列排空，让 close() 里 queueMicrotask 的 onclose 触发 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 建一条带日志收集的连接。socketFactory 用 fakeSocketFactory，
 * 这样断连重连时能拿到第二个 socket。
 */
function setup(overrides: Partial<ConnectionOptions> = {}) {
	const created = fakeSocketFactory();
	const logs: Array<{ direction: string; content: string }> = [];
	const connection = new Connection({
		id: 1,
		url: 'ws://127.0.0.1:1/none',
		autoSendEnabled: false,
		autoSendMsg: '',
		scheduled: [],
		hooks: {
			log: (_conn, direction, content) => logs.push({ direction, content }),
			receive: () => {}
		},
		socketFactory: created.factory,
		...overrides
	});
	return { connection, logs, sockets: created.sockets };
}

describe('planTimers', () => {
	const task = (id: number, interval: number, enabled = true): ScheduledTask => ({
		id,
		interval,
		message: 'm',
		enabled
	});

	it('间隔没变的保留，改了的重建，停用或删掉的撤销', () => {
		const running = new Map([
			[1, { interval: 5 }],
			[2, { interval: 5 }],
			[3, { interval: 5 }]
		]);
		const plan = planTimers(running, [task(1, 5), task(2, 9), task(3, 5, false)], true);
		expect([...plan.keep]).toEqual([1]);
		expect(plan.create.map((item) => item.id)).toEqual([2]);
		expect(plan.remove).toEqual([3]);
	});

	it('断开时全部撤销，一个都不建', () => {
		const running = new Map([[1, { interval: 5 }]]);
		const plan = planTimers(running, [task(1, 5)], false);
		expect(plan.keep.size).toBe(0);
		expect(plan.create).toHaveLength(0);
		expect(plan.remove).toEqual([1]);
	});

	it('间隔非法（0 / NaN）的任务不建定时器', () => {
		const plan = planTimers(new Map(), [task(1, 0), task(2, Number.NaN)], true);
		expect(plan.create).toHaveLength(0);
	});
});

describe('定时任务', () => {
	it('新添加的任务默认关闭，间隔取默认值', () => {
		const { connection } = setup();
		const task = connection.addTask();
		expect(task.enabled).toBe(false);
		expect(task.interval).toBe(DEFAULT_SCHEDULED_INTERVAL);
		expect(task.message).toBe('');
		expect(connection.enabledTaskCount).toBe(0);
	});

	it('一条连接可以有多条任务，id 互不重复', () => {
		const { connection } = setup();
		const first = connection.addTask();
		const second = connection.addTask();
		expect(first.id).not.toBe(second.id);

		first.message = 'a';
		first.enabled = true;
		expect(second.enabled).toBe(false);
		expect(connection.enabledTaskCount).toBe(1);
	});

	it('启用任务时校验间隔与消息', () => {
		const { connection } = setup();
		const task = connection.addTask();

		task.interval = 0;
		expect(connection.toggleTask(task.id)).toBe('need-interval');

		task.interval = Number.NaN;
		expect(connection.toggleTask(task.id)).toBe('need-interval');

		task.interval = 5;
		task.message = '   ';
		expect(connection.toggleTask(task.id)).toBe('need-message');

		task.message = 'ping';
		expect(connection.toggleTask(task.id)).toBe('ok');
		expect(task.enabled).toBe(true);
		// 已启用的任务再点就是停用，不再走校验
		expect(connection.toggleTask(task.id)).toBe('ok');
		expect(task.enabled).toBe(false);
	});

	it('删除任务只删掉指定的那一条', () => {
		const { connection } = setup();
		const first = connection.addTask();
		const second = connection.addTask();

		expect(connection.removeTask(first.id)).toBe(true);
		expect(connection.scheduled).toEqual([second]);
		expect(connection.removeTask(999)).toBe(false);
	});

	it('构造时自带的任务直接启用，id 与后加的不撞车', () => {
		const { connection } = setup({ scheduled: [{ interval: 7, message: '{"type":"ping"}' }] });
		const builtin = connection.scheduled[0];
		expect(builtin?.enabled).toBe(true);
		expect(builtin?.interval).toBe(7);

		const added = connection.addTask();
		expect(added.enabled).toBe(false);
		expect(new Set(connection.scheduled.map((task) => task.id)).size).toBe(2);
	});
});

describe('自动发送开关', () => {
	it('停用只是关开关，内容要留着，否则再开还得重填', () => {
		const { connection } = setup({ autoSendMsg: 'hello' });
		expect(connection.toggleAutoSend()).toBe(true);
		expect(connection.autoSendEnabled).toBe(true);

		expect(connection.toggleAutoSend()).toBe(true);
		expect(connection.autoSendEnabled).toBe(false);
		expect(connection.autoSendMsg).toBe('hello');
	});

	it('内容为空时开启被拒绝', () => {
		const { connection } = setup({ autoSendMsg: '   ' });
		expect(connection.toggleAutoSend()).toBe(false);
		expect(connection.autoSendEnabled).toBe(false);
	});
});

describe('连接生命周期（假 socket）', () => {
	it('建连成功时自动发送的内容发出去一条', () => {
		const { connection, logs, sockets } = setup({ autoSendEnabled: true, autoSendMsg: 'hello' });
		connection.connect();
		sockets[0].emitOpen();

		const sent = logs.filter((log) => log.direction === 'sent');
		expect(sent).toHaveLength(1);
		expect(sent[0]?.content).toBe('hello');
	});

	it('没连上就发送会失败，并记一条系统日志', () => {
		const { connection, logs } = setup();
		expect(connection.send('hi')).toBe(false);
		expect(logs.some((log) => log.content === '发送失败：连接未就绪')).toBe(true);
	});

	it('dispose 之后异步 onclose 不会再塞回幽灵日志', async () => {
		const { connection, logs, sockets } = setup();
		connection.connect();
		sockets[0].emitOpen();
		expect(logs.length).toBeGreaterThan(0);
		const before = logs.length;

		connection.dispose();
		await flush();
		expect(logs.length).toBe(before);
		expect(sockets[0].closed).toBe(true);
	});

	it('删掉还在连接中的连接，超时定时器不会再补一条「连接超时」', () => {
		vi.useFakeTimers();
		try {
			const { connection, logs } = setup();
			connection.connect();
			expect(connection.status).toBe('connecting');

			connection.dispose();
			vi.advanceTimersByTime(20_000);

			expect(logs.filter((log) => log.content === '连接超时')).toHaveLength(0);
			expect(logs).toHaveLength(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('旧 socket 迟到的 close 不会把新连接打回断开', () => {
		const { connection, sockets } = setup();
		connection.connect();
		sockets[0].emitOpen();
		expect(connection.status).toBe('connected');

		// 出错断开（回调还挂在旧 socket 上），然后重新建连
		sockets[0].emitError();
		expect(connection.status).toBe('disconnected');
		connection.connect();
		sockets[1].emitOpen();
		expect(connection.status).toBe('connected');

		// 旧 socket 的 close 这时才到；没有 stale 校验的话这里会把新连接置空
		sockets[0].emitClose();
		expect(connection.status).toBe('connected');
		expect(connection.send('hi')).toBe(true);
		expect(sockets[1].sent).toEqual(['hi']);
	});

	it('断开与 dispose 后定时任务定时器归零', () => {
		const { connection, sockets } = setup();
		connection.connect();
		sockets[0].emitOpen();

		const task = connection.addTask();
		task.message = 'x';
		expect(connection.toggleTask(task.id)).toBe('ok');
		connection.syncScheduled();
		expect(connection.timerCount).toBe(1);

		connection.disconnect();
		connection.syncScheduled();
		expect(connection.timerCount).toBe(0);

		connection.connect();
		sockets[1].emitOpen();
		connection.syncScheduled();
		expect(connection.timerCount).toBe(1);

		connection.dispose();
		expect(connection.timerCount).toBe(0);
	});
});
