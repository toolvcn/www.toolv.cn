// LogBook 的单测。它不认识连接、不碰浏览器，两个依赖直接给桩，node 里可跑。
//
// 这里测的是 LogBook 自己承诺的那几条不变式：软上限裁剪、清空时归零丢弃计数、
// 只清某条连接的日志但要留系统日志与别人的折叠记录、切筛选复位渲染窗口。
// 通过 ws 门面间接测也能覆盖，但那是集成路径，坏了不好定位。
import { describe, expect, it } from 'vitest';
import { LogBook } from './log-book.svelte.ts';
import { LOG_LIMIT, RENDER_STEP } from '../config.ts';

/**
 * selectedId 用可变对象包一层，测试里改它就跟界面上切换选中连接一样。
 * urlOf 给个能一眼看出是哪条连接的假地址。
 */
function setup() {
	const state: { selectedId: number | null } = { selectedId: 1 };
	const logBook = new LogBook({
		selectedId: () => state.selectedId,
		urlOf: (id) => (id === null ? null : `ws://example.com/${id}`)
	});
	return { logBook, state };
}

describe('LogBook', () => {
	it('按方向过滤，三个方向都不勾时一条都不显示', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(1, 'received', 'b');
		logBook.add(2, 'system', 'c');
		expect(logBook.visible).toHaveLength(3);

		logBook.toggleFilter('received');
		expect(logBook.visible.map((log) => log.content)).toEqual(['a', 'c']);

		logBook.toggleFilter('sent');
		logBook.toggleFilter('system');
		expect(logBook.visible).toHaveLength(0);
	});

	it('仅看当前连接：没选中连接时不生效，选中后只留它的', () => {
		const { logBook, state } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(2, 'sent', 'b');

		state.selectedId = null;
		logBook.filterCurrent = true;
		expect(logBook.visible).toHaveLength(2);

		state.selectedId = 1;
		expect(logBook.visible.map((log) => log.content)).toEqual(['a']);
	});

	it('超过软上限丢最早的，并累计丢弃条数', () => {
		const { logBook } = setup();
		for (let i = 0; i < LOG_LIMIT; i++) logBook.add(1, 'system', 'm' + i);
		expect(logBook.all).toHaveLength(LOG_LIMIT);
		expect(logBook.all[0].content).toBe('m0');
		expect(logBook.droppedCount).toBe(0);

		logBook.add(1, 'system', 'newest');
		// 触顶后一次性多丢一些，免得每来一条都要搬数组
		expect(logBook.all.length).toBeLessThan(LOG_LIMIT);
		expect(logBook.droppedCount).toBeGreaterThan(0);
		expect(logBook.all.at(-1)?.content).toBe('newest');
		expect(logBook.all[0].content).not.toBe('m0');
	});

	it('清空日志把触顶丢弃计数一起归零', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'x');
		logBook.droppedCount = 42;
		logBook.clear();
		expect(logBook.droppedCount).toBe(0);
		expect(logBook.all).toHaveLength(0);
	});

	it('只清某条连接的日志：系统日志与其它连接的折叠记录都留着', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(2, 'sent', 'b');
		logBook.add(null, 'system', 'c');
		const [a, b, c] = logBook.all;
		logBook.toggleCollapsed(a.id);
		logBook.toggleCollapsed(c.id);

		logBook.clearOf(1);

		expect(logBook.all.map((log) => log.content)).toEqual(['b', 'c']);
		// 被删日志的折叠记录清掉，没被删的留着
		expect(logBook.isCollapsed(a.id)).toBe(false);
		expect(logBook.isCollapsed(b.id)).toBe(false);
		expect(logBook.isCollapsed(c.id)).toBe(true);
	});

	it('批量清掉若干连接的日志，系统日志同样保留', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(2, 'sent', 'b');
		logBook.add(3, 'sent', 'c');
		logBook.add(null, 'system', 'sys');

		logBook.clearOfMany([1, 3]);

		expect(logBook.all.map((log) => log.content)).toEqual(['b', 'sys']);
	});

	it('清空与切筛选都会收回渲染窗口，免得残留上一次的条数', () => {
		const { logBook } = setup();
		logBook.loadEarlier();
		expect(logBook.renderCount).toBeGreaterThan(RENDER_STEP);

		logBook.clear();
		expect(logBook.renderCount).toBe(RENDER_STEP);

		logBook.loadEarlier();
		logBook.toggleFilter('sent');
		expect(logBook.renderCount).toBe(RENDER_STEP);
	});

	it('渲染窗口只取最近的一批，加载更早后补齐', () => {
		const { logBook } = setup();
		for (let i = 0; i < RENDER_STEP + 10; i++) logBook.add(1, 'system', 'm' + i);

		expect(logBook.shown).toHaveLength(RENDER_STEP);
		expect(logBook.hiddenCount).toBe(10);

		logBook.loadEarlier();
		expect(logBook.shown).toHaveLength(RENDER_STEP + 10);
		expect(logBook.hiddenCount).toBe(0);
	});

	it('一键折叠只作用于当前筛选出来的日志', () => {
		const { logBook, state } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(1, 'received', 'b');
		logBook.add(2, 'sent', 'c');

		logBook.toggleAllCollapsed();
		expect(logBook.allVisibleCollapsed).toBe(true);
		expect(logBook.collapsed.size).toBe(3);

		logBook.toggleAllCollapsed();
		expect(logBook.allVisibleCollapsed).toBe(false);

		// 只筛出 #1 的日志时，折叠全部只动这两条
		state.selectedId = 1;
		logBook.filterCurrent = true;
		logBook.toggleAllCollapsed();
		expect(logBook.collapsed.size).toBe(2);
	});

	it('没有日志时一键折叠不报错，全折叠判定为 false', () => {
		const { logBook } = setup();
		expect(logBook.allVisibleCollapsed).toBe(false);
		logBook.toggleAllCollapsed();
		expect(logBook.collapsed.size).toBe(0);
	});

	it('统计各方向条数', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(1, 'received', 'b');
		logBook.add(1, 'system', 'c');
		expect(logBook.stats).toEqual({ all: 3, sent: 1, received: 1, system: 1 });
	});

	it('size 与 tokens 是惰性的，没被读到就不算', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', '{"a":1}');
		const log = logBook.all[0];
		if (!log) throw new Error('日志未创建');
		expect(log.size).toBe('7 B');
		expect(log.tokens?.length).toBeGreaterThan(0);
		// 再读一次应返回同一个数组，不重新分词
		expect(log.tokens).toBe(log.tokens);
	});

	it('每个连接分别统计收发，系统日志不计入', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', 'a');
		logBook.add(1, 'received', 'b');
		logBook.add(2, 'sent', 'c');
		logBook.add(null, 'system', 'd');

		expect(logBook.countsByConnection.get(1)).toEqual({ sent: 1, received: 1 });
		expect(logBook.countsByConnection.get(2)).toEqual({ sent: 1, received: 0 });
		expect(logBook.countsOf(1)).toEqual({ sent: 1, received: 1 });
		expect(logBook.countsOf(null)).toEqual({ sent: 0, received: 0 });
	});

	it('导出带筛选条件、连接地址与结构化字段', () => {
		const { logBook } = setup();
		logBook.add(1, 'sent', '{"a":1}');
		logBook.add(1, 'received', 'hi');

		const parsed = JSON.parse(logBook.buildExportText());
		expect(parsed.logs).toHaveLength(2);
		expect(parsed.logs[0]).toMatchObject({
			connectionId: 1,
			connectionUrl: 'ws://example.com/1',
			direction: 'sent',
			type: 'JSON',
			content: '{"a":1}'
		});
		expect(parsed.filters.received).toBe(true);
		expect(typeof parsed.exportedAt).toBe('string');
	});
});
