<script lang="ts">
	// 利率计算器主界面：顶部一条工具条（模式 + 三个数值 + 方式），下面并排两块 —— 计算结果与明细表。
	// lg 起并排、各自内部滚动；lg 以下上下堆叠、由页面自己滚（明细表封顶 60vh）。
	//
	// 贷款与存款两组方式控件**都常驻渲染**：不生效的那组整体 `opacity-60` + `aria-disabled`，
	// 不用 `{#if}` 摘掉 —— 切模式时工具条高度不能跳一下（UI-STYLE §8.2）。
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
	import { TOOLBAR, TOOLBAR_ACTIONS, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import {
		DEPOSIT_MODE_OPTIONS,
		FREQ_OPTIONS,
		INTEREST_EXAMPLES,
		REPAY_OPTIONS,
		type RepayMethod
	} from '../core/interest.ts';
	import { interestStore, type Mode } from '../core/store.svelte.ts';
	import ResultPanel from './ResultPanel.svelte';
	import SchedulePanel from './SchedulePanel.svelte';

	const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string }> = [
		{ value: 'loan', label: '贷款' },
		{ value: 'deposit', label: '存款' }
	];

	const EXAMPLE_OPTIONS = INTEREST_EXAMPLES.map((example) => ({
		value: example.id,
		label: example.label,
		description: example.description
	}));

	const loanGroupClass = $derived(
		interestStore.mode === 'loan' ? 'flex shrink-0 flex-col gap-1' : 'flex shrink-0 flex-col gap-1 opacity-60'
	);
	const depositGroupClass = $derived(
		interestStore.mode === 'deposit' ? 'flex shrink-0 flex-col gap-1' : 'flex shrink-0 flex-col gap-1 opacity-60'
	);

	const isLoan = $derived(interestStore.mode === 'loan');
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div id="interest-toolbar" role="group" aria-label="利率计算输入" class={TOOLBAR}>
		<div class={TOOLBAR_GROUP}>
			<span class={TOOLBAR_LABEL} id="interest-mode-label">算什么</span>
			<SegmentedControl
				aria-labelledby="interest-mode-label"
				options={MODE_OPTIONS}
				value={interestStore.mode}
				onchange={(value) => interestStore.setMode(value)}
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<!-- 可见 label 用 for 关联；Input 不再传 label，否则读屏会念两遍 -->
			<label class={TOOLBAR_LABEL} for="interest-amount">金额（元）</label>
			<Input
				id="interest-amount"
				size="sm"
				inputmode="decimal"
				bind:value={interestStore.amountText}
				invalid={interestStore.errorField === 'amount'}
				autocomplete="off"
				spellcheck="false"
				placeholder="1000000"
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="interest-rate">年利率（%）</label>
			<Input
				id="interest-rate"
				size="sm"
				inputmode="decimal"
				bind:value={interestStore.rateText}
				invalid={interestStore.errorField === 'rate'}
				autocomplete="off"
				spellcheck="false"
				placeholder="4.2"
			/>
		</div>

		<div class={TOOLBAR_GROUP}>
			<label class={TOOLBAR_LABEL} for="interest-years">期限（年）</label>
			<Input
				id="interest-years"
				size="sm"
				inputmode="numeric"
				bind:value={interestStore.yearsText}
				invalid={interestStore.errorField === 'years'}
				autocomplete="off"
				spellcheck="false"
				placeholder="30"
			/>
		</div>

		<div class={loanGroupClass} aria-disabled={!isLoan}>
			<span class={TOOLBAR_LABEL} id="interest-method-label">还款方式</span>
			<SegmentedControl
				aria-labelledby="interest-method-label"
				options={REPAY_OPTIONS}
				value={interestStore.method}
				onchange={(value: RepayMethod) => interestStore.setMethod(value)}
			/>
		</div>

		<div class={depositGroupClass} aria-disabled={isLoan}>
			<span class={TOOLBAR_LABEL} id="interest-deposit-label">计息方式</span>
			<div class="flex items-center gap-2">
				<SegmentedControl
					aria-labelledby="interest-deposit-label"
					options={DEPOSIT_MODE_OPTIONS}
					value={interestStore.depositMode}
					onchange={(value) => interestStore.setDepositMode(value)}
				/>
				<Dropdown
					label="复利的计息频率"
					size="sm"
					options={FREQ_OPTIONS}
					value={interestStore.freqText}
					disabled={interestStore.depositMode === 'simple'}
					disabledTitle="单利不按频率滚，这一项不生效"
					onSelect={(value) => interestStore.setFreq(value)}
				/>
			</div>
		</div>

		<div class={TOOLBAR_ACTIONS}>
			<Dropdown
				label="填入示例"
				triggerLabel="示例"
				size="sm"
				options={EXAMPLE_OPTIONS}
				value=""
				onSelect={(value) => interestStore.loadExample(value)}
			/>
			<Button label="清空输入" title="清空金额、年利率与期限" onclick={() => interestStore.clearAll()}>清空</Button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
		<ResultPanel />
		<SchedulePanel />
	</div>
</div>

<Toast />
