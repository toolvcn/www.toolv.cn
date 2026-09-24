// json.ts 的单测：时间戳处理。
// isJson / tokenizeJson 已收到 $lib/utils/json，判定与分词统一测在 src/lib/utils/json.test.ts。
import { describe, expect, it } from 'vitest';
import { insertTimestamp, withCurrentTime } from './json.ts';

describe('withCurrentTime', () => {
	it('覆盖 JSON 里的 time 字段', () => {
		const result = JSON.parse(withCurrentTime('{"type":"ping","time":1}'));
		expect(result.type).toBe('ping');
		expect(result.time).toBeGreaterThan(1);
	});

	it('非 JSON 或没有 time 字段时原样返回', () => {
		expect(withCurrentTime('plain')).toBe('plain');
		expect(withCurrentTime('{"type":"ping"}')).toBe('{"type":"ping"}');
	});
});

// 纯文本处理，不经过 store：now 由测试给定，断言才能精确到字符。
// 以前这段逻辑住在 store 里，只能靠读写 ws.msgInput 间接验证。
describe('insertTimestamp（纯函数）', () => {
	const NOW = 1_704_067_200_000;

	it('空输入直接给一个时间戳', () => {
		expect(insertTimestamp('', NOW)).toBe(String(NOW));
	});

	it('非 JSON 时原内容保留，时间戳另起一行追加', () => {
		expect(insertTimestamp('not json', NOW)).toBe(`not json\n${NOW}`);
	});

	it('尾部空白原样保留', () => {
		expect(insertTimestamp('{"a":1}\n\n  ', NOW)).toBe(`{"a":1,"time":${NOW}}\n\n  `);
	});

	it('单行 JSON 在收尾的 } 前补一个 time', () => {
		expect(insertTimestamp('{"type":"ping"}', NOW)).toBe(`{"type":"ping","time":${NOW}}`);
	});

	it('多行 JSON 另起一行并对齐两格，原有缩进不动', () => {
		const source = '{\n  "type": "ping",\n  "seq": 3\n}';
		expect(insertTimestamp(source, NOW)).toBe(`{\n  "type": "ping",\n  "seq": 3,\n  "time":${NOW}\n}`);
	});

	it('已有 time 时只替换它的值', () => {
		const source = '{\n  "type": "ping",\n  "time": 1\n}';
		expect(insertTimestamp(source, NOW)).toBe(`{\n  "type": "ping",\n  "time": ${NOW}\n}`);
	});

	it('只替换顶层的 time，不动嵌套对象里的', () => {
		const parsed = JSON.parse(insertTimestamp('{\n  "data": {\n    "time": 1\n  },\n  "time": 2\n}', NOW));
		expect(parsed.time).toBe(NOW);
		expect(parsed.data.time).toBe(1);
	});
});
