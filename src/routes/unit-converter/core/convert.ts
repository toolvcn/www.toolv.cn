// 单位换算的纯函数：统一「源单位 → 基准 → 目标单位」两步走。
// 线性单位乘 factor；温度走仿射；rem 的 factor 由根字号决定，运行时给出。
import type { UnitDef } from './types.ts';

/** 取单位的换算因数。css 的 rem 占位 factor 不作数，按根字号给真值 */
export function factorOf(unit: UnitDef, rootFontSize: number): number {
	return unit.id === 'rem' ? rootFontSize : (unit.factor ?? 1);
}

/** 源单位的值 → 基准单位的值 */
export function toBase(value: number, unit: UnitDef, rootFontSize: number): number {
	if (unit.affine) return unit.affine.toBase(value);
	return value * factorOf(unit, rootFontSize);
}

/** 基准单位的值 → 目标单位的值 */
export function fromBase(value: number, unit: UnitDef, rootFontSize: number): number {
	if (unit.affine) return unit.affine.fromBase(value);
	return value / factorOf(unit, rootFontSize);
}

/** 任意两单位互转 */
export function convert(value: number, from: UnitDef, to: UnitDef, rootFontSize: number): number {
	return fromBase(toBase(value, from, rootFontSize), to, rootFontSize);
}

/**
 * 结果格式化：最多 6 位有效数字并去掉尾零与多余的点。
 * 先 toPrecision 再 Number 回串，避免 1e6 这类整数被写成科学计数。
 */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return '—';
	if (value === 0) return '0';
	return String(Number(value.toPrecision(6)));
}

/** 输入文本 → 数值：空串或非有限数返回 null，交给界面提示 */
export function parseAmount(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return null;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}
