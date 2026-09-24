// labels.ts 的单测：界面文案的拼装规则。
// 这些规则以前散在组件里没法测；改成纯函数后，断言直接到字符串。
import { describe, expect, it } from 'vitest';
import {
	autoSendLabel,
	batchActionLabel,
	batchActionText,
	batchRemoveConfirm,
	connectionBadge,
	connectionStatusText,
	logCountText,
	scheduledLabel,
	scheduledStatusText
} from './labels.ts';
import type { ScheduledTask } from './types.ts';

describe('连接编号', () => {
	it('各处统一的 #id 格式', () => {
		expect(connectionBadge(3)).toBe('#3');
	});
});

describe('批量操作文案', () => {
	it('没连接时说「没有连接可X」，有连接但被筛光了说「当前筛选下没有」', () => {
		expect(batchActionLabel('删除', 0, 0)).toBe('没有连接可删除');
		expect(batchActionLabel('删除', 0, 3)).toBe('当前筛选下没有连接');
	});

	it('没筛选叫「X全部 N 条」，筛掉一部分就只说筛选出来的那些', () => {
		expect(batchActionLabel('删除', 3, 3)).toBe('删除全部 3 条连接');
		expect(batchActionLabel('删除', 2, 3)).toBe('删除筛选出来的 2 条连接');
	});

	it('按钮文字两个档位都控制在两个字，切换筛选时宽度不跳', () => {
		expect(batchActionText('连接', 3, 3)).toBe('全连');
		expect(batchActionText('断开', 3, 3)).toBe('全断');
		expect(batchActionText('删除', 3, 3)).toBe('全删');
		expect(batchActionText('删除', 2, 3)).toBe('删除');
	});

	it('删除确认框的范围跟按钮的 aria-label 同一套规则', () => {
		expect(batchRemoveConfirm(3, false)).toBe('确定要删除全部 3 条连接及它们的日志吗？');
		expect(batchRemoveConfirm(2, true)).toBe('确定要删除筛选出来的 2 条连接及它们的日志吗？');
	});
});

describe('日志条数文案', () => {
	it('没筛选时只报一个数，筛选生效时两个都报', () => {
		expect(logCountText(5, 5)).toBe('共 5 条日志');
		expect(logCountText(5, 2)).toBe('共 5 条日志 · 筛选出 2 条');
	});
});

describe('选中连接的状态栏', () => {
	it('状态、时长与延迟用「·」连接', () => {
		const text = connectionStatusText({ status: 'connected', connectedAt: 1_000, latency: 12 }, 61_000);
		expect(text).toBe('已连接 · 1分0秒 · 12ms');
	});

	it('没连上时不补「未连接」，免得出现「连接中 · 未连接」这种自相矛盾的话', () => {
		expect(connectionStatusText({ status: 'connecting', connectedAt: null, latency: null }, 0)).toBe('连接中');
		expect(connectionStatusText({ status: 'disconnected', connectedAt: null, latency: null }, 0)).toBe('已断开');
	});

	it('有状态没摘要时不会多出一个孤零零的分隔点', () => {
		expect(connectionStatusText({ status: 'connected', connectedAt: null, latency: null }, 0)).toBe('已连接');
	});
});

describe('定时任务文案', () => {
	it('未选中、无任务、全停用、在跑四种状态各有各的话', () => {
		expect(scheduledStatusText(null, 0, 0, 0)).toBe('请选择连接后设置定时任务');
		expect(scheduledStatusText(1, 0, 0, 0)).toBe('#1 暂无定时任务，点「添加任务」新建');
		expect(scheduledStatusText(1, 2, 0, 0)).toBe('#1 有 2 个任务，均未启用');
		expect(scheduledStatusText(1, 3, 2, 1)).toBe('#1 有 2 个任务在定时发送（另有 1 个任务在其他连接上）');
	});

	it('指示器标签带启用数与每条任务的明细', () => {
		const task = (enabled: boolean): ScheduledTask => ({ id: 1, interval: 5, message: 'ping', enabled });
		expect(scheduledLabel({ id: 2, scheduled: [task(true), task(false)] })).toBe('#2 定时任务 1 个：每 5 秒发 ping');
		expect(scheduledLabel({ id: 2, scheduled: [] })).toBe('#2 定时任务 0 个');
	});
});

describe('自动发送标签', () => {
	it('开着报内容，停用报可开启，没内容报原因', () => {
		expect(autoSendLabel({ id: 1, autoSendEnabled: true, autoSendMsg: 'hi' })).toBe('#1 连接成功后发送：hi，点击停用');
		expect(autoSendLabel({ id: 1, autoSendEnabled: false, autoSendMsg: 'hi' })).toBe(
			'#1 已停用连接成功后发送，点击开启'
		);
		expect(autoSendLabel({ id: 1, autoSendEnabled: false, autoSendMsg: '' })).toBe(
			'#1 没有自动发送内容：要在添加连接时开启「连接成功后发送一次」'
		);
	});
});
