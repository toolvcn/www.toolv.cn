// 单位换算核心的单测：线性换算、温度仿射、十进 / 二进制数据口径、CSS 根字号、数值格式化，
// 外加十五个分类的**结构完整性**（默认源单位必须在表里、单位 id 不重复、每个单位都有换算依据）。
import { describe, expect, it } from 'vitest';
import { convert, factorOf, formatNumber, parseAmount } from './convert.ts';
import {
	CATEGORY_LIST,
	DEFAULT_FROM,
	DEFAULT_INPUT,
	DEFAULT_ROOT_FONT_SIZE,
	type CategoryId,
	type UnitDef
} from './types.ts';

/** 按 id 取分类，测试里的取件工具 */
function category(id: CategoryId) {
	const found = CATEGORY_LIST.find((c) => c.id === id);
	expect(found).toBeDefined();
	return found!;
}

function unit(categoryId: CategoryId, unitId: string): UnitDef {
	const found = category(categoryId).units.find((u) => u.id === unitId);
	expect(found).toBeDefined();
	return found!;
}

describe('长度换算', () => {
	it('1 英里 = 1609.344 米', () => {
		expect(convert(1, unit('length', 'mi'), unit('length', 'm'), 16)).toBeCloseTo(1609.344, 6);
	});

	it('1 英寸 = 2.54 厘米', () => {
		expect(convert(1, unit('length', 'in'), unit('length', 'cm'), 16)).toBeCloseTo(2.54, 10);
	});

	it('1 海里 = 1852 米', () => {
		expect(convert(1, unit('length', 'nmi'), unit('length', 'm'), 16)).toBe(1852);
	});
});

describe('重量换算', () => {
	it('1 斤 = 500 克，1 磅 ≈ 453.59 克', () => {
		expect(convert(1, unit('weight', 'jin'), unit('weight', 'g'), 16)).toBeCloseTo(500, 10);
		expect(convert(1, unit('weight', 'lb'), unit('weight', 'g'), 16)).toBeCloseTo(453.59237, 6);
	});

	it('1 吨 = 1000 千克 = 2000 斤', () => {
		expect(convert(1, unit('weight', 't'), unit('weight', 'kg'), 16)).toBe(1000);
		expect(convert(1, unit('weight', 't'), unit('weight', 'jin'), 16)).toBe(2000);
	});
});

describe('温度换算（仿射）', () => {
	it('100°C = 212°F，0°C = 273.15 K', () => {
		expect(convert(100, unit('temperature', 'c'), unit('temperature', 'f'), 16)).toBeCloseTo(212, 10);
		expect(convert(0, unit('temperature', 'c'), unit('temperature', 'k'), 16)).toBeCloseTo(273.15, 10);
	});

	it('-40°C = -40°F（两刻度交点）', () => {
		expect(convert(-40, unit('temperature', 'c'), unit('temperature', 'f'), 16)).toBeCloseTo(-40, 10);
	});

	it('华氏 → 开尔文直转', () => {
		expect(convert(32, unit('temperature', 'f'), unit('temperature', 'k'), 16)).toBeCloseTo(273.15, 10);
	});
});

describe('数据大小换算', () => {
	it('十进制口径：1 KB = 1000 B', () => {
		expect(convert(1, unit('data', 'kb'), unit('data', 'b'), 16)).toBe(1000);
	});

	it('二进制口径：1 KiB = 1024 B，1 MiB = 1024 KiB', () => {
		expect(convert(1, unit('data', 'kib'), unit('data', 'b'), 16)).toBe(1024);
		expect(convert(1, unit('data', 'mib'), unit('data', 'kib'), 16)).toBe(1024);
	});

	it('两套口径不混算：1 MB ≈ 0.9537 MiB', () => {
		expect(convert(1, unit('data', 'mb'), unit('data', 'mib'), 16)).toBeCloseTo(0.953674, 5);
	});
});

describe('CSS 长度换算', () => {
	it('根字号 16：16 px = 1 rem，12 pt = 16 px', () => {
		expect(convert(16, unit('css', 'px'), unit('css', 'rem'), 16)).toBe(1);
		expect(convert(12, unit('css', 'pt'), unit('css', 'px'), 16)).toBeCloseTo(16, 10);
	});

	it('根字号可调：14 px 根字号下 1 rem = 14 px', () => {
		expect(convert(1, unit('css', 'rem'), unit('css', 'px'), 14)).toBe(14);
	});

	it('rem 的 factor 跟着根字号走', () => {
		expect(factorOf(unit('css', 'rem'), DEFAULT_ROOT_FONT_SIZE)).toBe(16);
		expect(factorOf(unit('css', 'rem'), 20)).toBe(20);
	});
});

describe('面积换算（基准平方米）', () => {
	it('1 公顷 = 10000 m²，1 亩 = 666.67 m²', () => {
		expect(convert(1, unit('area', 'ha'), unit('area', 'm2'), 16)).toBe(1e4);
		expect(convert(1, unit('area', 'mu'), unit('area', 'm2'), 16)).toBeCloseTo(666.667, 3);
	});

	it('1 英亩 ≈ 4046.86 m²，1 平方英里 ≈ 2.58999 km²', () => {
		expect(convert(1, unit('area', 'acre'), unit('area', 'm2'), 16)).toBeCloseTo(4046.8564, 4);
		expect(convert(1, unit('area', 'mi2'), unit('area', 'km2'), 16)).toBeCloseTo(2.589988, 6);
	});

	it('1 m² = 10000 cm² = 1000000 mm²', () => {
		expect(convert(1, unit('area', 'm2'), unit('area', 'cm2'), 16)).toBeCloseTo(1e4, 6);
		expect(convert(1, unit('area', 'm2'), unit('area', 'mm2'), 16)).toBeCloseTo(1e6, 4);
	});
});

describe('体积换算（基准升）', () => {
	it('1 m³ = 1000 L，1 L = 1000 mL', () => {
		expect(convert(1, unit('volume', 'm3'), unit('volume', 'l'), 16)).toBe(1000);
		expect(convert(1, unit('volume', 'l'), unit('volume', 'ml'), 16)).toBe(1000);
	});

	it('美制加仑 ≈ 3.78541 L，英制加仑 = 4.54609 L（两制必须分开）', () => {
		expect(convert(1, unit('volume', 'gal'), unit('volume', 'l'), 16)).toBeCloseTo(3.785412, 6);
		expect(convert(1, unit('volume', 'galuk'), unit('volume', 'l'), 16)).toBeCloseTo(4.54609, 10);
	});

	it('1 石油桶 = 42 美制加仑 ≈ 158.987 L', () => {
		expect(convert(1, unit('volume', 'bbl'), unit('volume', 'l'), 16)).toBeCloseTo(158.98729, 5);
		expect(convert(42, unit('volume', 'gal'), unit('volume', 'l'), 16)).toBeCloseTo(158.98729, 5);
	});
});

describe('速度换算（基准米每秒）', () => {
	it('36 km/h = 10 m/s，1 km/h ≈ 0.27778 m/s', () => {
		expect(convert(36, unit('speed', 'kmh'), unit('speed', 'mps'), 16)).toBeCloseTo(10, 10);
		expect(convert(1, unit('speed', 'kmh'), unit('speed', 'mps'), 16)).toBeCloseTo(0.277778, 6);
	});

	it('1 节 = 1.852 km/h，1 马赫 = 340.29 m/s', () => {
		expect(convert(1, unit('speed', 'kn'), unit('speed', 'kmh'), 16)).toBeCloseTo(1.852, 10);
		expect(convert(1, unit('speed', 'mach'), unit('speed', 'mps'), 16)).toBeCloseTo(340.29, 10);
	});
});

describe('时间换算（基准秒）', () => {
	it('1 天 = 24 小时 = 1440 分钟 = 86400 秒', () => {
		expect(convert(1, unit('time', 'd'), unit('time', 'h'), 16)).toBe(24);
		expect(convert(1, unit('time', 'd'), unit('time', 'min'), 16)).toBe(1440);
		expect(convert(1, unit('time', 'd'), unit('time', 's'), 16)).toBe(86400);
	});

	it('月 / 年按固定天数折算：1 年 = 365 天 = 12 个「30 天的月」再加 5 天', () => {
		expect(convert(1, unit('time', 'yr'), unit('time', 'd'), 16)).toBe(365);
		expect(convert(12, unit('time', 'mo'), unit('time', 'd'), 16)).toBe(360);
	});

	it('毫秒 / 微秒 / 纳秒逐级差 1000', () => {
		expect(convert(1, unit('time', 's'), unit('time', 'ms'), 16)).toBe(1000);
		// 0.001 / 1e-6 落在浮点上会差最后一位，用 closeTo 而不是 toBe
		expect(convert(1, unit('time', 'ms'), unit('time', 'us'), 16)).toBeCloseTo(1000, 6);
		expect(convert(1, unit('time', 'us'), unit('time', 'ns'), 16)).toBeCloseTo(1000, 6);
	});
});

describe('角度换算（基准度）', () => {
	it('180° = π rad', () => {
		expect(convert(180, unit('angle', 'deg'), unit('angle', 'rad'), 16)).toBeCloseTo(Math.PI, 10);
	});

	it('1 圈 = 360° = 400 百分度', () => {
		expect(convert(1, unit('angle', 'turn'), unit('angle', 'deg'), 16)).toBe(360);
		expect(convert(1, unit('angle', 'turn'), unit('angle', 'grad'), 16)).toBe(400);
	});

	it('1° = 60 角分 = 3600 角秒', () => {
		expect(convert(1, unit('angle', 'deg'), unit('angle', 'arcmin'), 16)).toBe(60);
		expect(convert(1, unit('angle', 'deg'), unit('angle', 'arcsec'), 16)).toBeCloseTo(3600, 6);
	});
});

describe('力换算（基准牛顿）', () => {
	it('1 千克力 = 9.80665 N，1 N = 100000 达因', () => {
		expect(convert(1, unit('force', 'kgf'), unit('force', 'n'), 16)).toBeCloseTo(9.80665, 10);
		expect(convert(1, unit('force', 'n'), unit('force', 'dyn'), 16)).toBeCloseTo(1e5, 6);
	});

	it('1 磅力 ≈ 4.44822 N', () => {
		expect(convert(1, unit('force', 'lbf'), unit('force', 'n'), 16)).toBeCloseTo(4.448222, 6);
	});
});

describe('压力换算（基准帕斯卡）', () => {
	it('1 标准大气压 = 101325 Pa，1 bar = 100 kPa', () => {
		expect(convert(1, unit('pressure', 'atm'), unit('pressure', 'pa'), 16)).toBe(101325);
		expect(convert(1, unit('pressure', 'bar'), unit('pressure', 'kpa'), 16)).toBe(100);
	});

	it('1 atm ≈ 1.01325 bar；换算成 mmHg 是 759.99989（两个常规定义本就差 1.1e-4）', () => {
		expect(convert(1, unit('pressure', 'atm'), unit('pressure', 'bar'), 16)).toBeCloseTo(1.01325, 6);

		// mmHg 取常规定义值 133.322387415 Pa（13.5951 g/cm³ × 9.80665 × 1 mm），
		// 而 atm 是 1954 年定死的 101325 Pa —— 两者不可能同时满足「760 mmHg = 1 atm」，
		// 差 1.1e-4 mmHg。界面按 6 位有效数字展示，用户看到的仍是 760。
		const mmhg = convert(1, unit('pressure', 'atm'), unit('pressure', 'mmhg'), 16);
		expect(mmhg).toBeCloseTo(760, 3);
		expect(formatNumber(mmhg)).toBe('760');
	});

	it('1 psi ≈ 6.89476 kPa，1 千克力每平方厘米 ≈ 0.980665 bar', () => {
		expect(convert(1, unit('pressure', 'psi'), unit('pressure', 'kpa'), 16)).toBeCloseTo(6.894757, 6);
		expect(convert(1, unit('pressure', 'kgfcm2'), unit('pressure', 'bar'), 16)).toBeCloseTo(0.980665, 6);
	});
});

describe('功率换算（基准瓦特）', () => {
	it('1 公制马力 = 735.49875 W，1 kW ≈ 1.34102 英制马力', () => {
		expect(convert(1, unit('power', 'ps'), unit('power', 'w'), 16)).toBeCloseTo(735.49875, 6);
		expect(convert(1, unit('power', 'kw'), unit('power', 'hp'), 16)).toBeCloseTo(1.341022, 6);
	});

	it('1 kcal/h ≈ 1.16222 W（热量 ÷ 3600）', () => {
		expect(convert(1, unit('power', 'kcalh'), unit('power', 'w'), 16)).toBeCloseTo(1.162222, 6);
	});
});

describe('密度换算（基准千克每立方米）', () => {
	it('1 g/cm³ = 1000 kg/m³ = 1 kg/L（水的密度）', () => {
		expect(convert(1, unit('density', 'gcm3'), unit('density', 'kgm3'), 16)).toBe(1000);
		expect(convert(1, unit('density', 'kgl'), unit('density', 'gcm3'), 16)).toBe(1);
	});

	it('1 磅每立方英尺 ≈ 16.0185 kg/m³', () => {
		expect(convert(1, unit('density', 'lbft3'), unit('density', 'kgm3'), 16)).toBeCloseTo(16.018463, 6);
	});
});

describe('能量换算（基准焦耳）', () => {
	it('1 kWh = 3.6e6 J = 3600 kJ', () => {
		expect(convert(1, unit('energy', 'kwh'), unit('energy', 'j'), 16)).toBe(3.6e6);
		expect(convert(1, unit('energy', 'kwh'), unit('energy', 'kj'), 16)).toBe(3600);
	});

	it('1 kcal = 4184 J，1 BTU ≈ 1055.06 J', () => {
		expect(convert(1, unit('energy', 'kcal'), unit('energy', 'j'), 16)).toBe(4184);
		expect(convert(1, unit('energy', 'btu'), unit('energy', 'j'), 16)).toBeCloseTo(1055.0559, 4);
	});

	it('1 度电 ≈ 860 大卡（3.6e6 ÷ 4184）', () => {
		expect(convert(1, unit('energy', 'kwh'), unit('energy', 'kcal'), 16)).toBeCloseTo(860.4207, 4);
	});
});

describe('十五个分类的结构完整性', () => {
	it('分类 id 不重复，每个分类都有默认输入与默认源单位', () => {
		const ids = CATEGORY_LIST.map((category) => category.id);
		expect(ids).toHaveLength(15);
		expect(new Set(ids).size).toBe(ids.length);

		const missing = CATEGORY_LIST.filter(
			(category) => DEFAULT_INPUT[category.id] === undefined || DEFAULT_FROM[category.id] === undefined
		).map((category) => category.id);
		expect(missing).toEqual([]);
	});

	it('每个分类的单位 id 不重复，且默认源单位一定在自己的单位表里', () => {
		for (const category of CATEGORY_LIST) {
			const ids = category.units.map((item) => item.id);
			expect(new Set(ids).size, `${category.id} 的单位 id 有重复`).toBe(ids.length);
			expect(ids, `${category.id} 的默认源单位 ${DEFAULT_FROM[category.id]} 不在单位表里`).toContain(
				DEFAULT_FROM[category.id]
			);
		}
	});

	it('每个单位都有换算依据（factor 或 affine），factor 是有限非零数', () => {
		for (const category of CATEGORY_LIST) {
			const broken = category.units
				.filter((item) => {
					if (item.affine) return false;
					return item.factor === undefined || !Number.isFinite(item.factor) || item.factor === 0;
				})
				.map((item) => `${category.id}/${item.id}`);
			expect(broken).toEqual([]);
		}
	});
});

describe('formatNumber', () => {
	it('最多 6 位有效数字并去尾零', () => {
		expect(formatNumber(1609.344)).toBe('1609.34');
		expect(formatNumber(1 / 3)).toBe('0.333333');
		expect(formatNumber(0.1 + 0.2)).toBe('0.3');
	});

	it('整数不写科学计数，非有限数给占位符', () => {
		expect(formatNumber(1e6)).toBe('1000000');
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(Number.NaN)).toBe('—');
		expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
	});
});

describe('parseAmount', () => {
	it('接受负数与科学计数，拒绝空串与非数字', () => {
		expect(parseAmount(' -40 ')).toBe(-40);
		expect(parseAmount('1e3')).toBe(1000);
		expect(parseAmount('')).toBeNull();
		expect(parseAmount('abc')).toBeNull();
	});
});
