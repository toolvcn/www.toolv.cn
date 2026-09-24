<script lang="ts">
	// 单位换算主界面：标签条切十五个分类，下面是同一张换算卡 ——
	// 每个分类各留各的输入与源单位（见 store）。
	//
	// 十五个标签一行放不下（窄屏尤其），靠共享 `Tabs` 的横向滚动兜住：标签不会窄过自己的文字，
	// 放不下就滑动（`$lib/ui/styles` 的 `TAB_BAR` / `TAB_BTN` 是一对）。图标在窄屏由组件自己隐藏。
	import {
		Braces,
		CircleGauge,
		Clock3,
		Cuboid,
		Droplets,
		Flame,
		Gauge,
		HardDrive,
		Magnet,
		Ruler,
		Square,
		Thermometer,
		Triangle,
		Weight,
		Zap
	} from '@lucide/svelte';
	import ConvertCard from './ConvertCard.svelte';
	import { unitStore } from '../core/store.svelte.ts';
	import type { CategoryId } from '../core/types.ts';
	import TabShell from '$lib/components/TabShell/TabShell.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';

	/** 顺序与 `CATEGORY_LIST` 一致：几何 → 力学与热 → 数字口径 */
	const CATEGORY_TABS: ReadonlyArray<{ value: CategoryId; label: string; icon?: typeof Ruler }> = [
		{ value: 'length', label: '长度', icon: Ruler },
		{ value: 'area', label: '面积', icon: Square },
		{ value: 'volume', label: '体积', icon: Cuboid },
		{ value: 'weight', label: '重量', icon: Weight },
		{ value: 'temperature', label: '温度', icon: Thermometer },
		{ value: 'speed', label: '速度', icon: Gauge },
		{ value: 'time', label: '时间', icon: Clock3 },
		{ value: 'angle', label: '角度', icon: Triangle },
		{ value: 'force', label: '力', icon: Magnet },
		{ value: 'pressure', label: '压力', icon: CircleGauge },
		{ value: 'power', label: '功率', icon: Zap },
		{ value: 'density', label: '密度', icon: Droplets },
		{ value: 'energy', label: '能量', icon: Flame },
		{ value: 'data', label: '数据大小', icon: HardDrive },
		{ value: 'css', label: 'CSS 长度', icon: Braces }
	];
</script>

<TabShell
	aria-label="单位分类"
	options={CATEGORY_TABS}
	value={unitStore.category}
	onchange={(v) => unitStore.setCategory(v)}
>
	<ConvertCard />
</TabShell>

<Toast />
