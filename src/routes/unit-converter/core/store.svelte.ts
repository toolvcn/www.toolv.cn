// 单位换算的编排层：五个分类各留各的输入与源单位，切标签不丢状态，模块级单例。
import { convert, formatNumber, parseAmount } from './convert.ts';
import {
	CATEGORY_LIST,
	DEFAULT_FROM,
	DEFAULT_INPUT,
	DEFAULT_ROOT_FONT_SIZE,
	type Category,
	type CategoryId
} from './types.ts';

/** 结果列表的一行 */
export interface UnitRow {
	unitId: string;
	label: string;
	valueText: string;
	/** 这一行就是输入的源单位（值原样回显） */
	source: boolean;
}

/** 单位的下拉描述：一句话说清它多大 */
function unitDescription(category: Category, unitId: string, rootFontSize: number): string {
	const unit = category.units.find((u) => u.id === unitId);
	if (!unit) return '';
	if (unit.id === 'rem') return `1 rem = ${formatNumber(rootFontSize)} px（按根字号）`;
	if (unit.affine) return `与${category.baseLabel}仿射互转`;
	if (unit.factor !== undefined) return `1 ${unit.label} = ${formatNumber(unit.factor)} ${category.baseLabel}`;
	return '';
}

class UnitStore {
	category = $state<CategoryId>('length');
	/** 每类独立的输入文本与源单位，切标签互不干扰 */
	inputs = $state<Record<CategoryId, string>>({ ...DEFAULT_INPUT });
	fromIds = $state<Record<CategoryId, string>>({ ...DEFAULT_FROM });

	/** CSS 根字号：非法时回退 16 并标红提示 */
	cssRootText = $state(String(DEFAULT_ROOT_FONT_SIZE));
	readonly cssRootValue = $derived(parseAmount(this.cssRootText));
	readonly cssRoot = $derived(this.cssRootValue ?? DEFAULT_ROOT_FONT_SIZE);
	readonly cssRootInvalid = $derived(this.cssRootValue === null);

	readonly categoryDef = $derived(CATEGORY_LIST.find((c) => c.id === this.category)!);
	readonly amount = $derived(parseAmount(this.inputs[this.category]));
	/** 输入框当前是否非法（非空但解析不出数） */
	readonly invalid = $derived(this.inputs[this.category].trim() !== '' && this.amount === null);
	readonly fromUnit = $derived(
		this.categoryDef.units.find((u) => u.id === this.fromIds[this.category]) ?? this.categoryDef.units[0]!
	);

	/** 全部单位换一遍：源单位行原样回显，其余按基准两步换算 */
	readonly rows = $derived<UnitRow[]>(
		this.categoryDef.units.map((unitDef) => {
			const source = unitDef.id === this.fromUnit.id;
			const value =
				this.amount === null ? null : source ? this.amount : convert(this.amount, this.fromUnit, unitDef, this.cssRoot);
			return {
				unitId: unitDef.id,
				label: unitDef.label,
				valueText: value === null ? '' : formatNumber(value),
				source
			};
		})
	);

	readonly unitOptions = $derived(
		this.categoryDef.units.map((unitDef) => ({
			value: unitDef.id,
			label: unitDef.label,
			description: unitDescription(this.categoryDef, unitDef.id, this.cssRoot)
		}))
	);

	// ---------------------------------------------------------------- 操作

	setCategory(id: CategoryId): void {
		this.category = id;
	}

	setFrom(id: string): void {
		this.fromIds[this.category] = id;
	}

	clearInput(): void {
		this.inputs[this.category] = '';
	}

	resetRoot(): void {
		this.cssRootText = String(DEFAULT_ROOT_FONT_SIZE);
	}
}

export const unitStore = new UnitStore();
