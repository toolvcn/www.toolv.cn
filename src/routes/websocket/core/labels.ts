// 界面文案的拼装规则。
//
// 这些不是渲染逻辑，是产品规则：什么状态下说什么话、数字怎么呈现、按钮文字怎么随筛选变。
// 以前散在各个组件的 <script> 里，既没法单测，同一条规则（比如 #id 的格式）还要写好几遍。
// 这里全部是纯函数，组件只管把结果放进 DOM。
import type { Connection } from './connection.svelte.ts';
import { formatDuration, statusText } from './format.ts';

/** 连接编号在各处的统一显示格式 */
export function connectionBadge(id: number): string {
	return `#${id}`;
}

/**
 * 批量操作按钮的无障碍名称与悬浮提示：作用范围要写清楚，
 * 光看「全部删除」四个字，不知道会不会动到被筛掉的那部分。
 */
export function batchActionLabel(verb: string, visible: number, total: number): string {
	if (visible === 0) {
		return total === 0 ? `没有连接可${verb}` : '当前筛选下没有连接';
	}
	const filtered = visible < total;
	return filtered ? `${verb}筛选出来的 ${visible} 条连接` : `${verb}全部 ${visible} 条连接`;
}

/**
 * 批量按钮上的文字。没筛选叫「全X」，筛掉一部分就只说动作 ——
 * 两个档位都控制在两个字，切换筛选时按钮宽度不跳。
 */
export function batchActionText(verb: string, visible: number, total: number): string {
	return visible < total ? verb : `全${verb[0]}`;
}

/** 删除确认框的文案，范围跟按钮的 aria-label 同一套规则 */
export function batchRemoveConfirm(count: number, filtered: boolean): string {
	return filtered
		? `确定要删除筛选出来的 ${count} 条连接及它们的日志吗？`
		: `确定要删除全部 ${count} 条连接及它们的日志吗？`;
}

/**
 * 日志面板底部的条数。只看全量不知道当前筛出多少，
 * 只看筛选后的又不知道总共攒了多少；没筛选时两者相等，不重复。
 */
export function logCountText(total: number, filtered: number): string {
	return total === filtered ? `共 ${total} 条日志` : `共 ${total} 条日志 · 筛选出 ${filtered} 条`;
}

/**
 * 选中连接的摘要：时长 · 延迟。
 * 没连上时 connectedAt 是 null，此时前面已经用状态说了「连接中 / 已断开」，
 * 这里再补一句「未连接」就会变成「连接中 · 未连接」这种自相矛盾的文案。
 */
export function connectionSummary(connection: Pick<Connection, 'connectedAt' | 'latency'>, now: number): string {
	const parts: string[] = [];
	if (connection.connectedAt) parts.push(formatDuration(now - connection.connectedAt));
	if (connection.latency !== null) parts.push(connection.latency + 'ms');
	return parts.join(' · ');
}

/**
 * 状态 + 摘要拼好再渲染。写在模板里的 {#if} 会把「 · 」前面的空格吃掉，
 * 渲染出来就成了「已连接· 0分0秒」。
 */
export function connectionStatusText(
	connection: Pick<Connection, 'status' | 'connectedAt' | 'latency'>,
	now: number
): string {
	const status = statusText(connection.status);
	const summary = connectionSummary(connection, now);
	return summary ? `${status} · ${summary}` : status;
}

/**
 * 定时任务区的状态播报。othersCount 是其它连接上启用着的任务数，
 * 大于 0 时补一句，让用户知道别的连接也还在跑。
 */
export function scheduledStatusText(
	connectionId: number | null,
	taskCount: number,
	enabledCount: number,
	othersCount: number
): string {
	if (connectionId === null) return '请选择连接后设置定时任务';
	let self: string;
	if (taskCount === 0) self = `${connectionBadge(connectionId)} 暂无定时任务，点「添加任务」新建`;
	else if (enabledCount === 0) self = `${connectionBadge(connectionId)} 有 ${taskCount} 个任务，均未启用`;
	else self = `${connectionBadge(connectionId)} 有 ${enabledCount} 个任务在定时发送`;
	return othersCount > 0 ? `${self}（另有 ${othersCount} 个任务在其他连接上）` : self;
}

/**
 * 自动发送图标的无障碍名称，同时兼作悬浮提示。
 * 开关与内容是两回事：开着就报内容；关着要看是「有内容待开启」还是「压根没内容」。
 * 内容只在添加连接时设定，没有内容的连接这个图标会直接禁用，所以第三种要写清原因。
 */
export function autoSendLabel(connection: Pick<Connection, 'id' | 'autoSendEnabled' | 'autoSendMsg'>): string {
	const badge = connectionBadge(connection.id);
	if (connection.autoSendEnabled) {
		return `${badge} 连接成功后发送：${connection.autoSendMsg}，点击停用`;
	}
	if (connection.autoSendMsg.trim()) {
		return `${badge} 已停用连接成功后发送，点击开启`;
	}
	return `${badge} 没有自动发送内容：要在添加连接时开启「连接成功后发送一次」`;
}

/** 定时任务指示器的无障碍名称：数字是启用着的任务数，明细写给读屏 */
export function scheduledLabel(connection: Pick<Connection, 'id' | 'scheduled'>): string {
	const parts: string[] = [];
	for (const task of connection.scheduled) {
		if (task.enabled) parts.push(`每 ${task.interval} 秒发 ${task.message}`);
	}
	const detail = parts.length > 0 ? `：${parts.join('；')}` : '';
	const count = connection.scheduled.filter((task) => task.enabled).length;
	return `${connectionBadge(connection.id)} 定时任务 ${count} 个${detail}`;
}
