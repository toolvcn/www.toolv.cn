// 时间戳工具的编排层：模块级单例。字段只存输入，展示值全部走纯函数，组件里好断言。
import {
	dateFromLocalText,
	dateFromTimestamp,
	diffTimestamps,
	formatLocal,
	formatUtc,
	nowStampText,
	parseNumber,
	type TsDiff
} from './format.ts';
import type { TsUnit } from './types.ts';

/** 默认示例时间戳（秒）：世界时钟在没有有效输入时也有东西可看 */
const SAMPLE_TS_SECONDS = 1_704_067_200;

export type TsParsed = { kind: 'idle' } | { kind: 'ok'; date: Date } | { kind: 'err'; error: string };

class TimestampStore {
	// 时间戳 → 时间
	tsText = $state(String(SAMPLE_TS_SECONDS));
	tsUnit = $state<TsUnit>('auto');

	// 时间 → 时间戳（datetime-local 的值：YYYY-MM-DDTHH:mm）
	localText = $state('');

	// 双时间戳对比：A / B 两份输入共用一个单位口径
	cmpAText = $state('');
	cmpBText = $state('');
	cmpUnit = $state<TsUnit>('auto');

	/** 一份输入的解析结果：空着是 idle，填了但读不出来才是 err */
	#parsed(text: string, unit: TsUnit): TsParsed {
		const value = parseNumber(text);
		if (value === null) {
			return text.trim() === '' ? { kind: 'idle' } : { kind: 'err', error: '请输入纯数字时间戳' };
		}
		const result = dateFromTimestamp(value, unit);
		if ('error' in result) return { kind: 'err', error: result.error };
		return { kind: 'ok', date: result.date };
	}

	/** 时间戳输入当前的解析状态 */
	get tsParsed(): TsParsed {
		return this.#parsed(this.tsText, this.tsUnit);
	}

	/** 人类时间输入当前的解析状态 */
	get localParsed(): TsParsed {
		if (this.localText === '') return { kind: 'idle' };
		const date = dateFromLocalText(this.localText);
		return date === null ? { kind: 'err', error: '日期时间不合法' } : { kind: 'ok', date };
	}

	/** 世界时钟的参考时刻：时间戳输入有效用它，否则人类时间输入，最后兜底示例 */
	get clockMs(): number {
		const ts = this.tsParsed;
		if (ts.kind === 'ok') return ts.date.getTime();
		const local = this.localParsed;
		if (local.kind === 'ok') return local.date.getTime();
		return SAMPLE_TS_SECONDS * 1000;
	}

	/** 世界时钟参考来源的说明（运行态文字，界面读屏共用） */
	get clockSource(): string {
		if (this.tsParsed.kind === 'ok') return '按时间戳输入对照';
		if (this.localParsed.kind === 'ok') return '按日期时间输入对照';
		return '示例时刻（改上方输入即时生效）';
	}

	get tsLocalText(): string {
		const parsed = this.tsParsed;
		return parsed.kind === 'ok' ? formatLocal(parsed.date) : '—';
	}

	get tsUtcText(): string {
		const parsed = this.tsParsed;
		return parsed.kind === 'ok' ? formatUtc(parsed.date) : '—';
	}

	/** 时间 → 时间戳方向：人类时间 → 毫秒（无效时为 null） */
	get localEpochMs(): number | null {
		const parsed = this.localParsed;
		return parsed.kind === 'ok' ? parsed.date.getTime() : null;
	}

	/** 时间 → 时间戳的秒（无效为 null） */
	get localEpochS(): number | null {
		const ms = this.localEpochMs;
		return ms === null ? null : Math.floor(ms / 1000);
	}

	get localError(): string {
		const parsed = this.localParsed;
		return parsed.kind === 'err' ? parsed.error : '';
	}

	get tsError(): string {
		const parsed = this.tsParsed;
		return parsed.kind === 'err' ? parsed.error : '';
	}

	/** 取「现在」填入时间戳输入：**按当前单位填**（毫秒单位就填毫秒），单位选择保持不动 */
	fillNow(): void {
		this.tsText = nowStampText(this.tsUnit);
	}

	fillSample(): void {
		this.tsText = String(SAMPLE_TS_SECONDS);
		this.tsUnit = 'auto';
	}

	setTsUnit(unit: TsUnit): void {
		if (this.tsUnit === unit) return;
		this.tsUnit = unit;
	}

	// ------------------------------------------------------------ 双时间戳对比

	/**
	 * 页面加载后的默认值：A 填此刻，B 留空。
	 * B 不预填同一时刻 —— 两个都是现在的话差值恒为 0，反而是条没有信息量的结果。
	 * 只在挂载时调用（页面是预渲染的，此刻的时间戳只能到浏览器里取）。
	 */
	initCompare(): void {
		this.cmpAText = nowStampText(this.cmpUnit);
	}

	get cmpAParsed(): TsParsed {
		return this.#parsed(this.cmpAText, this.cmpUnit);
	}

	get cmpBParsed(): TsParsed {
		return this.#parsed(this.cmpBText, this.cmpUnit);
	}

	get cmpAError(): string {
		const parsed = this.cmpAParsed;
		return parsed.kind === 'err' ? parsed.error : '';
	}

	get cmpBError(): string {
		const parsed = this.cmpBParsed;
		return parsed.kind === 'err' ? parsed.error : '';
	}

	get cmpALocalText(): string {
		const parsed = this.cmpAParsed;
		return parsed.kind === 'ok' ? formatLocal(parsed.date) : '—';
	}

	get cmpAUtcText(): string {
		const parsed = this.cmpAParsed;
		return parsed.kind === 'ok' ? formatUtc(parsed.date) : '—';
	}

	get cmpBLocalText(): string {
		const parsed = this.cmpBParsed;
		return parsed.kind === 'ok' ? formatLocal(parsed.date) : '—';
	}

	get cmpBUtcText(): string {
		const parsed = this.cmpBParsed;
		return parsed.kind === 'ok' ? formatUtc(parsed.date) : '—';
	}

	/** 两侧都解析出时刻才给差值，否则 null（界面显示占位线） */
	get cmpDiff(): TsDiff | null {
		const a = this.cmpAParsed;
		const b = this.cmpBParsed;
		if (a.kind !== 'ok' || b.kind !== 'ok') return null;
		return diffTimestamps(a.date.getTime(), b.date.getTime());
	}

	/** 脚注文案：先把出错的那一侧点出来，两侧都空给引导，都有效给方向说明 */
	get cmpHint(): string {
		const a = this.cmpAParsed;
		const b = this.cmpBParsed;
		if (a.kind === 'err') return `时间戳 A 读不出来：${a.error}`;
		if (b.kind === 'err') return `时间戳 B 读不出来：${b.error}`;
		if (a.kind === 'idle' || b.kind === 'idle') return 'A / B 都填上有效时间戳后自动出差值';
		return '差值按 B − A 算，正数表示 B 晚于 A';
	}

	setCmpUnit(unit: TsUnit): void {
		if (this.cmpUnit === unit) return;
		this.cmpUnit = unit;
	}
}

export const tsStore = new TimestampStore();
