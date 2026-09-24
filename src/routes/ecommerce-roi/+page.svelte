<script lang="ts">
	import { onMount } from 'svelte';
	import { TrendingUp } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import { PRESETS_STORAGE_KEY, SESSION_STORAGE_KEY, SESSION_WRITE_DELAY_MS } from './config.ts';
	import { parsePresets, parseSession } from './core/presets.ts';
	import { roiStore } from './core/store.svelte.ts';
	import Converter from './ui/Converter.svelte';

	// 本地持久化两份东西：参数预设（用户显式保存的）与**当前输入**（自动存、刷新后接着算）。
	// 两个键与当前输入的防抖时长在 `config.ts`，要换存储位置或调节奏改那里。
	// restored 开关不能省：首帧两份都还是空的，没有它就会先写一次空值，
	// 把上次存的数据在恢复回来之前覆盖掉。
	// 隐私模式下 localStorage 不可用，整个读写都包 try/catch 静默忽略。
	let restored = $state(false);

	onMount(() => {
		try {
			const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
			if (raw) {
				const parsed = parsePresets(raw);
				if (parsed.ok) roiStore.restorePresets(parsed.presets);
			}
			// 当前输入放在预设之后恢复：它会连口径一起回填，是「用户上次看到的那个状态」
			const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
			if (sessionRaw) {
				const session = parseSession(sessionRaw);
				if (session !== null) roiStore.restoreSession(session);
			}
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			localStorage.setItem(PRESETS_STORAGE_KEY, roiStore.presetsText);
		} catch {
			/* 隐私模式 / 配额不足，忽略 */
		}
	});

	// 当前输入的写回：**跟着每一次击键变**（不像预设只在保存 / 删除时才动），所以加防抖
	// （时长在 `config.ts` 的 `SESSION_WRITE_DELAY_MS`）。
	// 示例态不写 —— 用户只是打开看一眼、没动过任何参数时，不该把上次存的覆盖成示例。
	// （Svelte 在重跑 effect 前会先调用上一次返回的清理函数，所以这里提前 return 也不会漏掉旧定时器。）
	$effect(() => {
		if (!restored) return;
		const text = roiStore.sessionText;
		if (roiStore.isExample) return;
		const timer = setTimeout(() => {
			try {
				localStorage.setItem(SESSION_STORAGE_KEY, text);
			} catch {
				/* 隐私模式 / 配额不足，忽略 */
			}
		}, SESSION_WRITE_DELAY_MS);
		return () => clearTimeout(timer);
	});
</script>

<ToolShell
	icon={TrendingUp}
	name="电商 ROI 计算"
	tagline="四种 ROI 口径 · 保本线 · 退货损耗 · 参数预设"
	description="在线电商 ROI 计算器：一次算出广告 ROAS、扣退货 ROAS、广告 ROI、生意 ROI 与保本 ROAS，并反推广告费上限。退货按能收回的货款、残损、逆向物流三段拆开，含佣金是否退还的开关，公式与口径全部公开可核对，纯本地运行。"
	keywords="电商ROI计算,广告ROAS,保本ROAS,投产比计算,退货率计算,电商利润计算,广告费上限,ACOS,ROI计算器,电商运营"
	path="/ecommerce-roi"
	ogDescription="一次算出四种 ROI 与保本线，含退货能收回货款的完整成本模型，公式公开可核对，纯本地运行。"
	width="full"
	fill="fill"
	fillFrom="lg"
>
	<Converter />
</ToolShell>
