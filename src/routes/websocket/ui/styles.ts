// websocket 工具专属的 UI 样式常量。通用的焦点环 / 输入框片段在 $lib/ui/styles.ts。
import type { ConnectionStatus } from '../core/types.ts';

/** 连接状态点的颜色，三个面板共用 */
export function statusDotClass(status: ConnectionStatus): string {
	if (status === 'connected') return 'bg-emerald-500';
	if (status === 'connecting') return 'bg-amber-500 animate-pulse';
	return 'bg-gray-300';
}
