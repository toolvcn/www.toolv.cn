// 单位换算的类型、单位表与分类定义。全部纯数据，换算逻辑在 convert.ts。
// 线性单位只记 factor（1 单位 = 多少基准单位）；温度用仿射对；CSS 的 rem 依赖根字号，运行时算。

/** 一条单位的定义 */
export interface UnitDef {
	id: string;
	label: string;
	/** 线性单位：1 个该单位 = factor 个基准单位 */
	factor?: number;
	/** 仿射单位（温度）：与基准摄氏互转 */
	affine?: { toBase(value: number): number; fromBase(value: number): number };
}

/** 一个分类（页面上的一个标签） */
export interface Category {
	id: CategoryId;
	label: string;
	/** 基准单位在换算表里没什么存在感，仅用于组织 factor */
	baseLabel: string;
	units: ReadonlyArray<UnitDef>;
}

export type CategoryId =
	| 'length'
	| 'area'
	| 'volume'
	| 'weight'
	| 'temperature'
	| 'speed'
	| 'time'
	| 'angle'
	| 'force'
	| 'pressure'
	| 'power'
	| 'density'
	| 'energy'
	| 'data'
	| 'css';

/** 长度：基准米 */
const LENGTH_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'km', label: '千米 km', factor: 1000 },
	{ id: 'm', label: '米 m', factor: 1 },
	{ id: 'dm', label: '分米 dm', factor: 0.1 },
	{ id: 'cm', label: '厘米 cm', factor: 0.01 },
	{ id: 'mm', label: '毫米 mm', factor: 0.001 },
	{ id: 'um', label: '微米 μm', factor: 1e-6 },
	{ id: 'nmi', label: '海里 nmi', factor: 1852 },
	{ id: 'mi', label: '英里 mi', factor: 1609.344 },
	{ id: 'yd', label: '码 yd', factor: 0.9144 },
	{ id: 'ft', label: '英尺 ft', factor: 0.3048 },
	{ id: 'in', label: '英寸 in', factor: 0.0254 }
];

/** 重量：基准千克。斤 / 两是中文场景常客，一并给全 */
const WEIGHT_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 't', label: '吨 t', factor: 1000 },
	{ id: 'kg', label: '千克 kg', factor: 1 },
	{ id: 'g', label: '克 g', factor: 0.001 },
	{ id: 'mg', label: '毫克 mg', factor: 1e-6 },
	{ id: 'jin', label: '斤', factor: 0.5 },
	{ id: 'liang', label: '两', factor: 0.05 },
	{ id: 'lb', label: '磅 lb', factor: 0.45359237 },
	{ id: 'oz', label: '盎司 oz', factor: 0.028349523125 }
];

/** 温度：基准摄氏，华氏 / 开尔文走仿射 */
const TEMPERATURE_UNITS: ReadonlyArray<UnitDef> = [
	{
		id: 'c',
		label: '摄氏度 °C',
		affine: { toBase: (v) => v, fromBase: (v) => v }
	},
	{
		id: 'f',
		label: '华氏度 °F',
		affine: { toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 }
	},
	{
		id: 'k',
		label: '开尔文 K',
		affine: { toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 }
	}
];

/** 数据大小：基准字节。十进制（KB=1000）与二进制（KiB=1024）并列，各有各的口径 */
const DATA_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'tb', label: 'TB（10¹²）', factor: 1e12 },
	{ id: 'gb', label: 'GB（10⁹）', factor: 1e9 },
	{ id: 'mb', label: 'MB（10⁶）', factor: 1e6 },
	{ id: 'kb', label: 'KB（10³）', factor: 1e3 },
	{ id: 'b', label: '字节 B', factor: 1 },
	{ id: 'tib', label: 'TiB（1024⁴）', factor: 1024 ** 4 },
	{ id: 'gib', label: 'GiB（1024³）', factor: 1024 ** 3 },
	{ id: 'mib', label: 'MiB（1024²）', factor: 1024 ** 2 },
	{ id: 'kib', label: 'KiB（1024）', factor: 1024 }
];

/** CSS 长度：基准 px。rem 的 factor 是根字号，换算时由根字号参数决定 */
const CSS_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'px', label: '像素 px', factor: 1 },
	{ id: 'rem', label: 'rem', factor: 16 }, // 占位：实际 factor = cssRootSize，见 factorOf()
	{ id: 'pt', label: '点 pt', factor: 4 / 3 }
];

// ---------------------------------------------------------------- 2026-09-22 扩展的十类
// 分类顺序按「几何 → 力学与热 → 数字」排：长度 / 面积 / 体积挨着，压力 / 功率 / 力 / 密度 / 能量挨着，
// 数据大小与 CSS 长度（IT 口径）压在最后。全部按国际定义取值，注释里点明有歧义的那几个。

/** 面积：基准平方米。亩取 2000/3（1 亩 = 666.666… m²），英亩与平方英里都按国际英尺定义推 */
const AREA_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'km2', label: '平方千米 km²', factor: 1e6 },
	{ id: 'ha', label: '公顷 ha', factor: 1e4 },
	{ id: 'mu', label: '亩', factor: 2000 / 3 },
	{ id: 'm2', label: '平方米 m²', factor: 1 },
	{ id: 'cm2', label: '平方厘米 cm²', factor: 1e-4 },
	{ id: 'mm2', label: '平方毫米 mm²', factor: 1e-6 },
	{ id: 'mi2', label: '平方英里 mi²', factor: 2589988.110336 },
	{ id: 'acre', label: '英亩 acre', factor: 4046.8564224 },
	{ id: 'yd2', label: '平方码 yd²', factor: 0.83612736 },
	{ id: 'ft2', label: '平方英尺 ft²', factor: 0.09290304 },
	{ id: 'in2', label: '平方英寸 in²', factor: 0.00064516 }
];

/** 体积：基准升。美制与英制加仑差 20%，必须分开列；石油桶按 42 美制加仑 */
const VOLUME_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'm3', label: '立方米 m³', factor: 1000 },
	{ id: 'l', label: '升 L', factor: 1 },
	{ id: 'ml', label: '毫升 mL', factor: 0.001 },
	{ id: 'cm3', label: '立方厘米 cm³', factor: 0.001 },
	{ id: 'gal', label: '加仑 gal（美）', factor: 3.785411784 },
	{ id: 'galuk', label: '加仑 gal（英）', factor: 4.54609 },
	{ id: 'bbl', label: '石油桶 bbl', factor: 158.987294928 },
	{ id: 'pt', label: '品脱 pt（美）', factor: 0.473176473 },
	{ id: 'floz', label: '液量盎司 fl oz（美）', factor: 0.0295735295625 },
	{ id: 'ft3', label: '立方英尺 ft³', factor: 28.316846592 },
	{ id: 'in3', label: '立方英寸 in³', factor: 0.016387064 }
];

/** 速度：基准米每秒。节 = 海里/小时；马赫随气温变，按 15℃ 海平面 340.29 m/s 折算，只作参考 */
const SPEED_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'kmh', label: '千米每小时 km/h', factor: 1000 / 3600 },
	{ id: 'mps', label: '米每秒 m/s', factor: 1 },
	{ id: 'kmps', label: '千米每秒 km/s', factor: 1000 },
	{ id: 'mph', label: '英里每小时 mph', factor: 0.44704 },
	{ id: 'fps', label: '英尺每秒 ft/s', factor: 0.3048 },
	{ id: 'kn', label: '节 kn', factor: 1852 / 3600 },
	{ id: 'mach', label: '马赫 Ma（15℃）', factor: 340.29 }
];

/** 时间：基准秒。月 / 年按 30 天与 365 天固定折算 —— 日历月要查表，不该给一个假装精确的数 */
const TIME_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'yr', label: '年（365 天）', factor: 31536000 },
	{ id: 'mo', label: '月（30 天）', factor: 2592000 },
	{ id: 'wk', label: '周', factor: 604800 },
	{ id: 'd', label: '天', factor: 86400 },
	{ id: 'h', label: '小时', factor: 3600 },
	{ id: 'min', label: '分钟', factor: 60 },
	{ id: 's', label: '秒', factor: 1 },
	{ id: 'ms', label: '毫秒 ms', factor: 0.001 },
	{ id: 'us', label: '微秒 μs', factor: 1e-6 },
	{ id: 'ns', label: '纳秒 ns', factor: 1e-9 }
];

/** 角度：基准度。弧度 = 180/π 度；百分度整圈 400；角分 / 角秒按 1/60 逐级 */
const ANGLE_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'deg', label: '度 °', factor: 1 },
	{ id: 'rad', label: '弧度 rad', factor: 180 / Math.PI },
	{ id: 'grad', label: '百分度 grad', factor: 0.9 },
	{ id: 'turn', label: '圈 turn', factor: 360 },
	{ id: 'arcmin', label: '角分 ′', factor: 1 / 60 },
	{ id: 'arcsec', label: '角秒 ″', factor: 1 / 3600 }
];

/** 力：基准牛顿。千克力按标准重力 9.80665，磅力由 0.45359237 kg × 9.80665 得 */
const FORCE_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'n', label: '牛顿 N', factor: 1 },
	{ id: 'kn', label: '千牛 kN', factor: 1000 },
	{ id: 'dyn', label: '达因 dyn', factor: 1e-5 },
	{ id: 'kgf', label: '千克力 kgf', factor: 9.80665 },
	{ id: 'gf', label: '克力 gf', factor: 0.00980665 },
	{ id: 'lbf', label: '磅力 lbf', factor: 4.4482216152605 }
];

/** 压力：基准帕斯卡。标准大气压 = 101325 Pa，mmHg 按 1 atm = 760 mmHg 的常规值 */
const PRESSURE_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'pa', label: '帕斯卡 Pa', factor: 1 },
	{ id: 'hpa', label: '百帕 hPa', factor: 100 },
	{ id: 'kpa', label: '千帕 kPa', factor: 1000 },
	{ id: 'mpa', label: '兆帕 MPa', factor: 1e6 },
	{ id: 'bar', label: '巴 bar', factor: 1e5 },
	{ id: 'mbar', label: '毫巴 mbar', factor: 100 },
	{ id: 'atm', label: '标准大气压 atm', factor: 101325 },
	{ id: 'mmhg', label: '毫米汞柱 mmHg', factor: 133.322387415 },
	{ id: 'psi', label: '磅力每平方英寸 psi', factor: 6894.757293168 },
	{ id: 'kgfcm2', label: '千克力每平方厘米', factor: 98066.5 }
];

/** 功率：基准瓦特。公制 / 英制马力相差 1.4%，两个都列；kcal/h 与 BTU/h 由热量除以 3600 得 */
const POWER_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'w', label: '瓦特 W', factor: 1 },
	{ id: 'kw', label: '千瓦 kW', factor: 1000 },
	{ id: 'mw', label: '兆瓦 MW', factor: 1e6 },
	{ id: 'ps', label: '公制马力 PS', factor: 735.49875 },
	{ id: 'hp', label: '英制马力 hp', factor: 745.6998715823 },
	{ id: 'kcalh', label: '千卡每小时 kcal/h', factor: 4184 / 3600 },
	{ id: 'btuh', label: '英热单位每小时 BTU/h', factor: 1055.05585262 / 3600 }
];

/** 密度：基准千克每立方米。g/cm³ 与 kg/L 数值相同（都是 1000），两个都留是因为两边都常见 */
const DENSITY_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'kgm3', label: '千克每立方米 kg/m³', factor: 1 },
	{ id: 'gcm3', label: '克每立方厘米 g/cm³', factor: 1000 },
	{ id: 'kgl', label: '千克每升 kg/L', factor: 1000 },
	{ id: 'gl', label: '克每升 g/L', factor: 1 },
	// 英制那两条写成算式而不是小数：位数超过 double 精度既会丢精度、也会被 eslint 的 no-loss-of-precision 拦下
	{ id: 'lbft3', label: '磅每立方英尺 lb/ft³', factor: 0.45359237 / 0.028316846592 },
	{ id: 'lbin3', label: '磅每立方英寸 lb/in³', factor: 0.45359237 / 0.0254 ** 3 }
];

/** 能量：基准焦耳。卡取热化学卡 4.184 J，电子伏按 2019 国际定义值 */
const ENERGY_UNITS: ReadonlyArray<UnitDef> = [
	{ id: 'kj', label: '千焦 kJ', factor: 1000 },
	{ id: 'j', label: '焦耳 J', factor: 1 },
	{ id: 'kcal', label: '千卡 kcal（大卡）', factor: 4184 },
	{ id: 'cal', label: '卡 cal', factor: 4.184 },
	{ id: 'kwh', label: '千瓦时 kWh（度）', factor: 3.6e6 },
	{ id: 'wh', label: '瓦时 Wh', factor: 3600 },
	{ id: 'btu', label: '英热单位 BTU', factor: 1055.05585262 },
	// 英尺磅 = 1 ft × 1 lbf，写成算式（小数写到 17 位会被 eslint 的 no-loss-of-precision 拦下）
	{ id: 'ftlb', label: '英尺磅 ft·lb', factor: 0.3048 * 4.4482216152605 },
	{ id: 'ev', label: '电子伏 eV', factor: 1.602176634e-19 }
];

export const CATEGORY_LIST: ReadonlyArray<Category> = [
	{ id: 'length', label: '长度', baseLabel: '米', units: LENGTH_UNITS },
	{ id: 'area', label: '面积', baseLabel: '平方米', units: AREA_UNITS },
	{ id: 'volume', label: '体积', baseLabel: '升', units: VOLUME_UNITS },
	{ id: 'weight', label: '重量', baseLabel: '千克', units: WEIGHT_UNITS },
	{ id: 'temperature', label: '温度', baseLabel: '摄氏度', units: TEMPERATURE_UNITS },
	{ id: 'speed', label: '速度', baseLabel: '米每秒', units: SPEED_UNITS },
	{ id: 'time', label: '时间', baseLabel: '秒', units: TIME_UNITS },
	{ id: 'angle', label: '角度', baseLabel: '度', units: ANGLE_UNITS },
	{ id: 'force', label: '力', baseLabel: '牛顿', units: FORCE_UNITS },
	{ id: 'pressure', label: '压力', baseLabel: '帕斯卡', units: PRESSURE_UNITS },
	{ id: 'power', label: '功率', baseLabel: '瓦特', units: POWER_UNITS },
	{ id: 'density', label: '密度', baseLabel: '千克每立方米', units: DENSITY_UNITS },
	{ id: 'energy', label: '能量', baseLabel: '焦耳', units: ENERGY_UNITS },
	{ id: 'data', label: '数据大小', baseLabel: '字节', units: DATA_UNITS },
	{ id: 'css', label: 'CSS 长度', baseLabel: 'px', units: CSS_UNITS }
];

/** 每个分类的初始输入值与初始源单位（SSR 首屏即有换算结果） */
export const DEFAULT_INPUT: Record<CategoryId, string> = {
	length: '1',
	area: '1',
	volume: '1',
	weight: '1',
	temperature: '25',
	speed: '1',
	time: '1',
	angle: '90',
	force: '1',
	pressure: '1',
	power: '1',
	density: '1',
	energy: '1',
	data: '1',
	css: '16'
};

/** 初始源单位：挑每个分类里最常当起点的那个 */
export const DEFAULT_FROM: Record<CategoryId, string> = {
	length: 'm',
	area: 'm2',
	volume: 'l',
	weight: 'kg',
	temperature: 'c',
	speed: 'mps',
	time: 'h',
	angle: 'deg',
	force: 'n',
	pressure: 'bar',
	power: 'kw',
	density: 'gcm3',
	energy: 'kwh',
	data: 'mb',
	css: 'px'
};

/** CSS 换算的默认根字号（浏览器出厂值） */
export const DEFAULT_ROOT_FONT_SIZE = 16;
