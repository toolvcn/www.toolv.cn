// 供单测驱动的假 WebSocket。不引 npm 包，约 40 行够用。
// 关键点：close() 用 queueMicrotask 异步触发 onclose —— 真 WebSocket 就是异步的，
// 「删除连接后幽灵日志」这个 Bug 正是由这个异步产生的。
import type { SocketLike } from './types.ts';

export class FakeSocket implements SocketLike {
	readonly url: string;
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;

	/** 发出去的内容，测试里用来断言定时任务真的在发 */
	readonly sent: string[] = [];
	/** close() 被调用过 */
	closed = false;

	constructor(url: string) {
		this.url = url;
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		// 异步触发：复现真 socket 的行为，也是复现幽灵日志的前提
		queueMicrotask(() => this.onclose?.({ type: 'close' } as CloseEvent));
	}

	// ---- 下面几个是测试主动驱动生命周期用的 ----

	emitOpen(): void {
		this.onopen?.(new Event('open'));
	}

	emitMessage(data: unknown): void {
		// 只需要 data 字段，这里省掉构造真 MessageEvent
		this.onmessage?.({ data } as MessageEvent);
	}

	emitError(): void {
		this.onerror?.(new Event('error'));
	}

	emitClose(): void {
		this.closed = true;
		this.onclose?.({ type: 'close' } as CloseEvent);
	}
}

/** 建一个会记录所有实例的工厂，测试里靠它拿到 connect() 内部创建的 socket */
export function fakeSocketFactory(): {
	factory: (url: string) => SocketLike;
	sockets: FakeSocket[];
} {
	const sockets: FakeSocket[] = [];
	return {
		factory: (url: string) => {
			const socket = new FakeSocket(url);
			sockets.push(socket);
			return socket;
		},
		sockets
	};
}
