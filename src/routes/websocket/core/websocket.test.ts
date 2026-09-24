// 编排层（WebSocketStore）的单测：只测跨对象的协作 ——
// 新建连接的默认配置、删除连接时清日志、收发、消息草稿、快捷预设。
// 单个对象自己的行为在各自文件里：connection / connection-list / log-book。
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeSocketFactory, type FakeSocket } from './fake-socket.ts';
import { DEFAULT_TEMPLATE_INTERVAL } from '../config.ts';
import { ws } from './websocket.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

// 共享 store 是模块级单例，每个用例前重置，避免相互污染
beforeEach(() => {
	ws.connections.all = [];
	ws.connections.selectedId = null;
	ws.connections.statusFilter = { connected: true, disconnected: true };
	ws.logs.all = [];
	ws.logs.filters = { sent: true, received: true, system: true };
	ws.logs.filterCurrent = false;
	ws.logs.collapsed.clear();
	ws.urlInput = '';
	ws.autoSend = false;
	ws.msgInput = '';
	ws.presetMessages = [];
	ws.newPresetLabel = '';
	ws.newPresetData = '';
	ws.showPresetForm = false;
	ws.autoSendMsg = '';
	ws.scheduledDefault = { enabled: false, interval: DEFAULT_TEMPLATE_INTERVAL, message: '' };
	toast.message = '';
});

/** 建一条连不上、但确实进了列表的连接，返回它的 id */
function connectOne(): number {
	ws.urlInput = 'ws://127.0.0.1:1/none';
	ws.addConnection();
	return ws.connections.all.at(-1)?.id ?? 0;
}

/** 换上假 socket 工厂，测试靠返回的数组拿到 connect() 内部创建的 socket */
function installFakes(): FakeSocket[] {
	const created = fakeSocketFactory();
	ws.connections.socketFactory = created.factory;
	return created.sockets;
}

describe('连接管理', () => {
	it('空地址与非 ws 协议都被拒绝', () => {
		ws.addConnection();
		expect(toast.message).toBe('请输入 WebSocket URL');
		ws.urlInput = 'http://example.com';
		ws.addConnection();
		expect(toast.message).toBe('URL 必须以 ws:// 或 wss:// 开头');
		expect(ws.connections.all).toHaveLength(0);
	});

	it('合法地址会去掉首尾空白并自动选中', () => {
		ws.urlInput = '  ws://127.0.0.1:1/none  ';
		ws.addConnection();
		expect(ws.connections.all).toHaveLength(1);
		expect(ws.connections.all[0].url).toBe('ws://127.0.0.1:1/none');
		expect(ws.connections.selectedId).toBe(ws.connections.all[0].id);
	});

	it('批量添加会创建 10 条并选中第一条', () => {
		ws.urlInput = 'ws://127.0.0.1:1/none';
		ws.addTenConnections();
		expect(ws.connections.all).toHaveLength(10);
		expect(ws.connections.selectedId).toBe(ws.connections.all[0].id);
	});

	it('删除选中连接后改选第一条，并清掉该连接的日志', () => {
		ws.urlInput = 'ws://127.0.0.1:1/none';
		ws.addConnection();
		ws.addConnection();
		const second = ws.connections.all[1];
		ws.logs.add(second.id, 'sent', 'x');
		ws.removeConnection(second.id);
		expect(ws.connections.all).toHaveLength(1);
		expect(ws.connections.selectedId).toBe(ws.connections.all[0].id);
		expect(ws.logs.all).toHaveLength(0);
	});

	it('删除连接时它的任务随之消失', () => {
		const first = connectOne();
		connectOne();
		const connection = ws.connections.connection(first);
		if (!connection) throw new Error('连接未创建');
		for (let i = 0; i < 2; i++) {
			const task = connection.addTask();
			task.message = 'x';
			expect(connection.toggleTask(task.id)).toBe('ok');
		}
		expect(ws.connections.enabledTaskCount).toBe(2);

		ws.removeConnection(first);
		expect(ws.connections.enabledTaskCount).toBe(0);

		ws.removeVisibleConnections();
		expect(ws.connections.all).toHaveLength(0);
	});
});

describe('新建连接自带的定时任务', () => {
	it('模板开着时新建连接自带一条已启用的定时任务，之后改模板不影响它', () => {
		ws.scheduledDefault = { enabled: true, interval: 7, message: '{"type":"ping"}' };
		const first = connectOne();
		const task = ws.connections.connection(first)?.scheduled[0];
		expect(task).toMatchObject({ enabled: true, interval: 7, message: '{"type":"ping"}' });

		ws.scheduledDefault = { enabled: false, interval: 99, message: 'other' };
		expect(ws.connections.connection(first)?.scheduled[0]?.interval).toBe(7);
		expect(ws.connections.connection(connectOne())?.scheduled).toHaveLength(0);
	});

	it('模板关着时新建连接不带任务', () => {
		ws.scheduledDefault = { enabled: false, interval: 7, message: '{"type":"ping"}' };
		expect(ws.connections.connection(connectOne())?.scheduled).toHaveLength(0);
	});

	it('自带的任务就是普通定时任务，开关与删除走同一套', () => {
		ws.scheduledDefault = { enabled: true, interval: 7, message: '{"type":"ping"}' };
		const id = connectOne();
		const connection = ws.connections.connection(id);
		const task = connection?.scheduled[0];
		if (!connection || !task) throw new Error('任务未创建');

		expect(connection.toggleTask(task.id)).toBe('ok');
		expect(task.enabled).toBe(false);
		expect(connection.toggleTask(task.id)).toBe('ok');
		expect(task.enabled).toBe(true);

		connection.removeTask(task.id);
		expect(connection.scheduled).toHaveLength(0);
	});

	it('enabledTaskCount 只数启用着的任务', () => {
		const first = connectOne();
		const second = connectOne();
		expect(ws.connections.enabledTaskCount).toBe(0);

		const a = ws.connections.connection(first);
		const b = ws.connections.connection(second);
		if (!a || !b) throw new Error('连接未创建');

		const taskA = a.addTask();
		taskA.message = 'ping';
		expect(a.toggleTask(taskA.id)).toBe('ok');
		expect(ws.connections.enabledTaskCount).toBe(1);

		const taskB = b.addTask();
		taskB.message = 'x';
		expect(b.toggleTask(taskB.id)).toBe('ok');
		expect(ws.connections.enabledTaskCount).toBe(2);

		// 停用后就不算数了
		expect(a.toggleTask(taskA.id)).toBe('ok');
		expect(ws.connections.enabledTaskCount).toBe(1);
	});
});

describe('连接成功后自动发送（默认配置）', () => {
	it('建连成功时只有启用了自动发送的连接会发，停用的那条内容还留着', () => {
		const sockets = installFakes();
		ws.autoSend = true;
		ws.autoSendMsg = 'hello';
		const first = connectOne();
		const second = connectOne();
		const connSecond = ws.connections.connection(second);
		if (!connSecond) throw new Error('连接未创建');
		// second 关掉自动发送（内容留着）
		expect(connSecond.toggleAutoSend()).toBe(true);

		sockets[0].emitOpen();
		sockets[1].emitOpen();

		const sent = ws.logs.all.filter((log) => log.direction === 'sent');
		expect(sent).toHaveLength(1);
		expect(sent[0]?.connectionId).toBe(first);
		expect(connSecond.autoSendMsg).toBe('hello');
	});

	it('连接栏开关开着但消息是空的，新建的连接不算已开启也不会发', () => {
		const sockets = installFakes();
		ws.autoSend = true;
		ws.autoSendMsg = '   ';
		const id = connectOne();

		expect(ws.connections.connection(id)?.autoSendEnabled).toBe(false);

		sockets[0].emitOpen();
		expect(ws.logs.all.filter((log) => log.direction === 'sent')).toHaveLength(0);
	});
});

describe('收发', () => {
	it('广播空内容会被挡掉，不会发出空消息', () => {
		installFakes();
		connectOne();
		const before = ws.logs.all.length;

		ws.broadcast('   ');

		expect(toast.message).toBe('请输入消息内容');
		expect(ws.logs.all).toHaveLength(before);
	});
});

describe('消息编辑与预设', () => {
	it('格式化与压缩互为逆操作', () => {
		ws.msgInput = '{"a":1}';
		ws.formatMsgInput();
		expect(ws.msgInput).toBe('{\n  "a": 1\n}');
		ws.compressMsgInput();
		expect(ws.msgInput).toBe('{"a":1}');
	});

	it('非 JSON 时格式化与压缩不改内容', () => {
		ws.msgInput = 'not json';
		ws.formatMsgInput();
		ws.compressMsgInput();
		expect(ws.msgInput).toBe('not json');
	});

	it('插入时间戳把结果写回输入框', () => {
		ws.msgInput = '{"type":"ping"}';
		ws.insertTimestamp();
		expect(JSON.parse(ws.msgInput).time).toBeGreaterThan(0);
	});

	it('预设缺少名称或内容时提示', () => {
		ws.addPreset();
		expect(toast.message).toBe('请输入预设名称');
		ws.newPresetLabel = 'ping';
		ws.addPreset();
		expect(toast.message).toBe('请输入预设内容');
		expect(ws.presetMessages).toHaveLength(0);
	});

	it('填写完整后追加预设并收起表单', () => {
		ws.newPresetLabel = ' ping ';
		ws.newPresetData = ' {"type":"ping"} ';
		ws.showPresetForm = true;
		ws.addPreset();
		// 预设带自增 id，用 id 当 each 的 key，label 允许重复
		expect(ws.presetMessages).toHaveLength(1);
		expect(ws.presetMessages[0]).toMatchObject({ label: 'ping', data: '{"type":"ping"}' });
		expect(ws.presetMessages[0].id).toBeGreaterThan(0);
		expect(ws.showPresetForm).toBe(false);
	});

	it('删除预设只删掉指定的那一条', () => {
		ws.presetMessages = [
			{ id: 1, label: 'a', data: '1' },
			{ id: 2, label: 'b', data: '2' }
		];
		ws.removePreset(1);
		expect(ws.presetMessages).toEqual([{ id: 2, label: 'b', data: '2' }]);
		expect(toast.message).toBe('已删除预设「a」');
	});

	it('恢复默认会清掉本地存储并回到内置的两条', () => {
		ws.presetMessages = [{ id: 99, label: '乱七八糟', data: 'x' }];
		ws.presetsStored = true;
		ws.restoreDefaultPresets();
		expect(ws.presetMessages).toHaveLength(2);
		expect(ws.presetMessages.map((preset) => preset.label)).toEqual(['ping 消息', '认证请求']);
		expect(ws.presetsStored).toBe(false);
		expect(toast.message).toBe('已清空本地预设，恢复默认');
	});

	it('恢复默认后 newPreset 的自增 id 不会和内置的撞车', () => {
		ws.restoreDefaultPresets();
		ws.newPresetLabel = 'c';
		ws.newPresetData = '3';
		ws.addPreset();
		const ids = ws.presetMessages.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('localStorage 不可用时保存提示失败而不是抛，读取也一样', () => {
		// node 里没有 localStorage，隐私模式就是这个表现：存不下可以，崩不行
		ws.savePresets();
		expect(toast.message).toBe('保存失败：当前浏览器不允许本地存储');

		expect(() => ws.loadPresets()).not.toThrow();
		// 读失败保留当前这份（beforeEach 清成了空数组），不能把它变回内置的两条
		expect(ws.presetMessages).toEqual([]);
	});
});
