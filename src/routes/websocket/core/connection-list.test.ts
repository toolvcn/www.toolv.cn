// ConnectionList 的单测：集合、选中、状态筛选、批量操作。
// 通过 ws 单例测 —— hooks 的接线（删除联动日志）本来就在 store 里，
// 单例也最接近组件的真实用法。
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeSocketFactory, type FakeSocket } from './fake-socket.ts';
import { ws } from './websocket.svelte.ts';

beforeEach(() => {
	ws.connections.all = [];
	ws.connections.selectedId = null;
	ws.connections.statusFilter = { connected: true, disconnected: true };
	ws.logs.all = [];
	ws.urlInput = '';
});

/** 建一条连不上、但确实进了列表的连接，返回它的 id */
function connectOne(): number {
	ws.urlInput = 'ws://127.0.0.1:1/none';
	ws.addConnection();
	return ws.connections.all.at(-1)?.id ?? 0;
}

describe('状态筛选', () => {
	it('默认两个状态都勾选，全部显示', () => {
		connectOne();
		connectOne();
		expect(ws.connections.visible).toHaveLength(2);
	});

	it('取消勾选已连接后只剩未连接的', () => {
		const id = connectOne();
		const connection = ws.connections.connection(id);
		if (!connection) throw new Error('连接未创建');
		connection.status = 'connected';

		ws.connections.statusFilter.connected = false;
		expect(ws.connections.visible).toHaveLength(0);

		connection.status = 'disconnected';
		expect(ws.connections.visible).toHaveLength(1);
	});

	it('两个都不勾选就一条都不显示', () => {
		connectOne();
		ws.connections.statusFilter.connected = false;
		ws.connections.statusFilter.disconnected = false;
		expect(ws.connections.visible).toHaveLength(0);
	});

	it('筛选不影响连接总数与选中项', () => {
		const id = connectOne();
		ws.connections.statusFilter.disconnected = false;
		expect(ws.connections.all).toHaveLength(1);
		expect(ws.connections.visible).toHaveLength(0);
		expect(ws.connections.selectedId).toBe(id);
	});
});

describe('批量操作（假 socket）', () => {
	let sockets: FakeSocket[];

	function installFakes(): void {
		const created = fakeSocketFactory();
		ws.connections.socketFactory = created.factory;
		sockets = created.sockets;
	}

	it('按筛选连接：只连筛选出来的，已连上的不会重建 socket', () => {
		installFakes();
		const first = connectOne();
		const second = connectOne();
		sockets[0].emitOpen();
		ws.connections.disconnect(second);
		const socketsBefore = sockets.length;

		// 只勾「未连接」→ 只有 second 可见
		ws.connections.statusFilter = { connected: false, disconnected: true };
		expect(ws.connections.visible.map((connection) => connection.id)).toEqual([second]);

		ws.connections.connectVisible();

		// second 被重新连上（多建一个 socket），first 不在筛选集里，不该被碰
		expect(sockets.length).toBe(socketsBefore + 1);
		expect(ws.connections.connection(second)?.status).toBe('connecting');
		expect(ws.connections.connection(first)?.status).toBe('connected');
	});

	it('按筛选断开：只断筛选出来的，不在筛选集里的不重复记日志', () => {
		installFakes();
		const first = connectOne();
		const second = connectOne();
		sockets[0].emitOpen();
		sockets[1].emitOpen();
		ws.connections.disconnect(second);

		// 只勾「已连接」→ 只有 first 可见，second 已经断开了
		ws.connections.statusFilter = { connected: true, disconnected: false };
		ws.connections.disconnectVisible();

		expect(ws.connections.connection(first)?.status).toBe('disconnected');
		// second 主动断开时记过一条；它不在筛选集里，不该再多一条
		expect(ws.logs.all.filter((log) => log.content === '已断开连接' && log.connectionId === second)).toHaveLength(1);
	});

	it('按筛选删除连接：只删筛选出来的，系统日志都留着', () => {
		installFakes();
		const first = connectOne();
		const second = connectOne();
		sockets[0].emitOpen();
		ws.logs.add(null, 'system', '一条系统日志');

		// 只勾「已连接」：只有 first 可见
		ws.connections.statusFilter = { connected: true, disconnected: false };
		expect(ws.connections.visible.map((connection) => connection.id)).toEqual([first]);

		ws.removeVisibleConnections();

		expect(ws.connections.all.map((connection) => connection.id)).toEqual([second]);
		expect(ws.logs.all.some((log) => log.content === '一条系统日志')).toBe(true);
		expect(ws.logs.all.some((log) => log.connectionId === first)).toBe(false);
	});

	it('删筛选删掉了当前选中的连接时，选中项回落到剩下那条', () => {
		installFakes();
		const first = connectOne();
		const second = connectOne();
		sockets[1].emitOpen();
		ws.connections.statusFilter = { connected: true, disconnected: false };
		ws.connections.select(second);

		ws.removeVisibleConnections();

		expect(ws.connections.all.map((connection) => connection.id)).toEqual([first]);
		expect(ws.connections.selectedId).toBe(first);
	});
});
