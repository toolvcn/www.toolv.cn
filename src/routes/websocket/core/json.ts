// JSON 相关的纯函数：解析、时间戳处理。
//
// 从 format.ts 分出来的理由：那一组彼此相关（都要用 isJson），
// 而 format.ts 里混着时间格式化、日志工厂、预设解析等不相干的东西，
// 找「JSON 能不能解析」要在四组函数里翻。
//
// isJson / tokenizeJson 原先也在这里，已连同另外三份副本收到 `$lib/utils/json`。
import { isJson } from '$lib/utils/json';

/**
 * 解析 JSON，失败返回 undefined。
 * 跟 isJson 收在一处：两者都是「try/catch 包 JSON.parse」，
 * 以前 store 里另有一份私有的，改一处容易漏掉另一处。
 */
export function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** 若消息是带 time 字段的 JSON，把 time 换成当前时间戳（用于 ping/pong 测延迟） */
export function withCurrentTime(message: string): string {
	try {
		const parsed = JSON.parse(message);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'time' in parsed) {
			parsed.time = Date.now();
			return JSON.stringify(parsed);
		}
	} catch {
		/* 非 JSON 就原样发送 */
	}
	return message;
}

/**
 * 在一段文本的**尾部**加一个 time 字段，返回新文本，不改入参。
 *
 * 早先这个逻辑住在 store 里，40 行纯文本处理跟编排混在一起，只能靠读写
 * `ws.msgInput` 间接测。抽成纯函数后可以直接断言各种排版。
 *
 * 为什么不 parse 再 stringify：那会把用户手打的缩进、换行、字段顺序全冲掉，
 * 看起来就像输入框被重置了。这里保持纯文本操作，其余部分原样保留：
 * 已有 time 就只替换它的值，没有就在收尾的 } 前补一个。
 */
export function insertTimestamp(source: string, now: number): string {
	// 先切出正文与尾部空白，改完把尾部空白还回去
	const body = source.trimEnd();
	const tail = source.slice(body.length);

	if (body === '') return String(now) + tail;

	const isObject = isJson(body) && body.trimStart().startsWith('{');
	if (!isObject) {
		// 不是 JSON 对象就直接在末尾追加一行，不动原内容
		return body + '\n' + now + tail;
	}

	// 只替换顶层的 time：取缩进最浅的那一处。
	// 直接 replace 第一个匹配会命中嵌套对象里的 time（比如 {"data":{"time":1},"time":2}）。
	// 单行 JSON 没有缩进可区分，那种情况消息基本是扁平的，取第一处即可
	const lines = body.split('\n');
	let target = -1;
	let shallowest = Number.POSITIVE_INFINITY;
	for (let i = 0; i < lines.length; i++) {
		const match = /^(\s*)"time"\s*:/.exec(lines[i]);
		if (match && match[1].length < shallowest) {
			shallowest = match[1].length;
			target = i;
		}
	}
	if (target >= 0) {
		lines[target] = lines[target].replace(/("time"\s*:\s*)(-?\d+(?:\.\d+)?)/, `$1${now}`);
		return lines.join('\n') + tail;
	}
	// 多行时另起一行并对齐两格，单行时直接跟在后面
	const injected = body.includes('\n') ? `,\n  "time":${now}` : `,"time":${now}`;
	return body.replace(/(\s*)\}$/, `${injected}$1}`) + tail;
}
