<script lang="ts">
	// 结果卡 ②「试算与下一步」（**整盘口径专用**）：回答「按什么假设、那我该投到多少」。
	//
	// 广告费上限 + 目标那条线（按净利 / 按投产比二选一）。
	// 这几样原先压在结果卡最底下那个琥珀块里，滚过十一块才看得到；它们跟单件的
	//「卖多少赚多少」是同一个问题的两半（该投到多少 / 一共能赚多少），所以提到 ② 段。
	//
	// 单件口径的那半边（前提条 + 四个反解 + 卖多少赚多少）不在这个文件里 ——
	// 它跟 ⑤「定价反推」合并成了 ResultUnit 一段，两个口径的 ② 段因此不同构
	//（理由见 ResultUnit 与 ResultPanel 的文件头）。
	import Input from '$lib/ui/Input/Input.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { roiStore } from '../core/store.svelte.ts';
	import { formatMoney, formatTimes } from '../core/format.ts';
	import { NOTE_TEXT, SECTION_HEADING, TRIAL_BAR } from './styles.ts';

	const m = $derived(roiStore.metrics);
	const period = $derived(roiStore.period);
	const gmv = $derived(roiStore.parsed?.gmv ?? 0);
	const adCost = $derived(roiStore.parsed?.adCost ?? 0);

	/**
	 * 目标的两种填法：按净利（元）还是按投产比。
	 *
	 * 两者是**同一条线的两种说法** —— 广告费 = 成交额 ÷ 投产比 = 净利天花板 − 净利，
	 * 给定任一个另外两个就定了。所以跟成本 / 广告 / 退款那三处同构：
	 * 一个开关、二选一，切换时数字跟着换算。
	 */
	const TARGET_MODES = [
		{ value: 'profit', label: '按净利', title: '填想赚多少钱（元），反推需要的投产比与广告费' },
		{ value: 'roas', label: '按投产比', title: '填投产比（ROAS），看要投入多少广告费、能赚多少' }
	] as const;
	const isRoasTarget = $derived(roiStore.targetMode === 'roas');

	/** 广告费上限那行：上限为正是「还能加投」、差额为负是「已超投」—— 都套「还能加投」会读成反的 */
	const adBudgetNote = $derived.by(() => {
		if (m === null) return '';
		if (m.maxAdCost <= 0) {
			return `${period}的贡献利润已经不为正，广告费上限是 ${formatMoney(m.maxAdCost)} 元 —— 再投就是净亏。`;
		}
		const headroom = m.maxAdCost - adCost;
		return headroom >= 0
			? `${period}花了 ${formatMoney(adCost)} 元，还能加投 ${formatMoney(headroom)} 元。`
			: `${period}花了 ${formatMoney(adCost)} 元，已超过上限 ${formatMoney(-headroom)} 元 —— 超出即净亏。`;
	});

	/** 目标那行的旁注：够不够得到、差多少。按投产比填时用户填的就是投产比，读数行已经说完，不再补注 */
	const targetRoasNote = $derived.by(() => {
		const target = roiStore.targetRoas;
		if (target === null) return '';
		if (target.error !== '') return target.error;
		if (isRoasTarget) {
			// 留空取保本线（净利归零那条线），说一句免得用户以为这个数没生效
			return roiStore.targetProfit.trim() === '' ? `留空按保本线 ${formatTimes(target.roas)}` : '';
		}
		if (m === null || !Number.isFinite(m.adRoas)) return '';
		const gap = m.adRoas - target.roas;
		return gap >= 0
			? `现在是 ${formatTimes(m.adRoas)}，还有 ${formatTimes(gap)} 余量`
			: `现在是 ${formatTimes(m.adRoas)}，还差 ${formatTimes(-gap)}`;
	});

	/**
	 * 这条线要投入多少广告费 = 成交额 ÷ 投产比（= 净利天花板 − 净利）。
	 *
	 * 投产比是个比例，真正要掏出去的是钱 —— 所以「按投产比试算」给出的第一个数就是它。
	 * 按净利填时这个投产比是反推出来的；按投产比填时它就是用户填的那个数。
	 * 算不出来时给 NaN，`formatMoney` 出「—」—— 与同行那个投产比的「—」对齐，行高不跳。
	 */
	const targetAdCost = $derived.by(() => {
		const target = roiStore.targetRoas;
		if (target === null || target.error !== '' || !(target.roas > 0)) return Number.NaN;
		return gmv / target.roas;
	});

	/** 这条线能赚多少 = 净利天花板 − 广告费（按净利填时它正好等于用户填的目标） */
	const targetNetProfit = $derived.by(() => {
		const target = roiStore.targetRoas;
		if (target === null || !Number.isFinite(targetAdCost)) return Number.NaN;
		return target.ceiling - targetAdCost;
	});

	/** 输入框的占位符：按投产比填时留空取保本线，把它写出来（按净利填时空串就是 0 元） */
	const targetPlaceholder = $derived(
		isRoasTarget && m !== null && Number.isFinite(m.breakEvenRoas) ? formatTimes(m.breakEvenRoas) : '0'
	);
</script>

<section class="flex flex-col gap-3 border-t border-gray-200 pt-3">
	<h3 class={SECTION_HEADING}>试算与下一步</h3>

	<div class="{TRIAL_BAR} flex flex-col gap-2">
		<p class="text-xs leading-5 text-gray-600">
			广告费上限
			<span class="font-mono font-semibold text-gray-900 tabular-nums">{formatMoney(m?.maxAdCost ?? 0)}</span>
			元。{adBudgetNote}
		</p>
		<!-- 目标的两种填法：跟成本 / 广告 / 退货那三处同构（二选一 + 切换时换算），
		     但**开关与输入框摆在同一行** —— 它们说的是同一件事，开关另占一行会在左边留一大截空白。
		     这行只有 270px 宽，放不下「开关 + 文字标签 + 输入框」，所以**不另写标签**：
		     开关选中的那一项就是这一格的标签（读屏的名字挂在输入框的 aria-label 上）。
		     `[&>button]:flex-none`：轻档默认在移动端 `flex-1` 均分整行，两个标签不等长时
		     长的那个会被挤到折字（「按投产/比」）—— 这里要的是贴着文字的窄控件，按自然宽度排。 -->
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-200 pt-2">
			<SegmentedControl
				options={TARGET_MODES}
				value={roiStore.targetMode}
				tone="quiet"
				class="w-fit shrink-0 [&>button]:flex-none"
				aria-label="目标的填法"
				onchange={(mode) => roiStore.setTargetMode(mode)}
			/>
			<div class="w-24">
				<Input
					id="roi-target-value"
					size="sm"
					mono
					inputmode="decimal"
					placeholder={targetPlaceholder}
					aria-label={isRoasTarget ? '假设投产比' : '目标净利'}
					bind:value={roiStore.targetProfit}
				/>
			</div>
			<span class="text-xs text-gray-600">
				{#if !isRoasTarget}元{/if}
				→ 投产比
				<span class="font-mono font-semibold text-gray-900 tabular-nums">
					{formatTimes(roiStore.targetRoas?.roas ?? Number.NaN)}
				</span>
				· 要投入
				<span class="font-mono font-semibold text-gray-900 tabular-nums">{formatMoney(targetAdCost)}</span>
				元 · 赚
				<span class="font-mono font-semibold text-gray-900 tabular-nums">{formatMoney(targetNetProfit)}</span>
				元
			</span>
			{#if targetRoasNote !== ''}
				<span class={NOTE_TEXT}>{targetRoasNote}</span>
			{/if}
		</div>
	</div>
</section>
