<script lang="ts">
	// 匹配详情标签页：一行一个匹配，带捕获组的行点箭头展开，列表默认收起、扫读更快。
	import { ChevronRight, Copy } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { MAX_MATCHES } from '../config.ts';
	import { GROUP_CHIP, MATCH_BADGE } from './styles.ts';
	import { TAB_TOOLBAR } from '$lib/ui/styles';

	const hasError = $derived(regexStore.result.error !== null);
	// 空态与「没匹配上」是两个状态，文案要分开给
	const emptyText = $derived(
		hasError
			? '正则非法，修正后这里列出每个匹配。'
			: regexStore.input === ''
				? '输入测试文本，这里列出每个匹配与捕获组。'
				: '没有匹配：换个正则或检查文本。'
	);
	const showList = $derived(!hasError && regexStore.input !== '' && regexStore.matchCount > 0);
	const summaryText = $derived(
		!showList ? '尚无匹配' : `${regexStore.matchCount} 个匹配${regexStore.result.truncated ? '（已达上限）' : ''}`
	);
	// 没开 g / y 时只吐第一个匹配，不说明一句容易被当成「正则写错了」
	const globalHint = $derived(
		showList && !regexStore.globalEnabled ? '未开启全局（g / y 旗标），只找第一个匹配。' : ''
	);
	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	function chevronClass(open: boolean): string {
		return `size-4 transition-transform${open ? ' rotate-90' : ''}`;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class={TAB_TOOLBAR}>
		<span class="text-xs text-gray-600" role="status" aria-live="polite">{summaryText}</span>
		<div class="flex shrink-0 items-center gap-1.5">
			{#if showList && regexStore.hasGroups}
				<!-- 面板标题行的批量操作走 Button 的 xs 档（h-7 / gray-300 描边），
				     与 SEG_BTN_QUIET、HEADER_BTN 同高（UI-STYLE §9）——
				     从前这里是手写的一串类名，跟 Button xs 逐字同款却不受组件的焦点环 / 禁用态管 -->
				<Button
					size="xs"
					label={regexStore.allExpanded ? '收起全部匹配' : '展开全部匹配'}
					onclick={() => regexStore.toggleAllMatches()}
				>
					{regexStore.allExpanded ? '收起全部' : '展开全部'}
				</Button>
			{/if}
			{#if showList}
				<Button
					icon
					label="复制全部匹配文本，一行一个"
					title="复制全部"
					onclick={() => void regexStore.copyAllMatches()}
				>
					<Copy class="size-3.5" />
				</Button>
			{/if}
		</div>
	</div>

	<!-- 移动端封顶滚动，桌面交回栅格行；播报交给工具条的 status，列表本身不必整块朗读 -->
	{#if globalHint !== ''}
		<p class="px-4 py-2 text-xs text-gray-600">{globalHint}</p>
	{/if}

	<div class="min-h-0 overflow-y-auto max-lg:max-h-[60vh] lg:flex-1">
		{#if !showList}
			<div class="p-4">
				<EmptyState>{emptyText}</EmptyState>
			</div>
		{:else}
			<ul class="divide-y divide-gray-100">
				{#each regexStore.result.matches as match, i (i)}
					{@const open = regexStore.isExpanded(i)}
					<li class="px-4 py-2">
						<div class="flex items-center gap-2">
							{#if match.groups.length > 0}
								<Button
									icon
									label="{open ? '收起' : '展开'}第 {i + 1} 个匹配的 {match.groups.length} 个捕获组"
									title="捕获组"
									aria-expanded={open}
									aria-controls="regex-match-{i}"
									onclick={() => regexStore.toggleMatch(i)}
								>
									<ChevronRight class={chevronClass(open)} />
								</Button>
							{:else}
								<!-- 没有捕获组的行留个同宽占位，编号才对得齐 -->
								<span class="size-6 shrink-0"></span>
							{/if}
							<span class={MATCH_BADGE}>{i + 1}</span>
							<span class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900" title={match.text}>
								{match.text === '' ? '（空匹配）' : match.text}
							</span>
							<span class="shrink-0 text-xs text-gray-600 tabular-nums" title="匹配位置">
								@{match.index}
							</span>
							<Button
								icon
								label="复制第 {i + 1} 个匹配文本"
								title="复制"
								onclick={() => void regexStore.copyMatchText(match.text)}
							>
								<Copy class="size-3.5" />
							</Button>
						</div>
						{#if open && match.groups.length > 0}
							<div id="regex-match-{i}" class="mt-1.5 flex flex-wrap gap-1.5 pl-8">
								{#each match.groups as group (group.name)}
									<span
										class={GROUP_CHIP}
										title={group.empty ? '这个组本次未参与匹配' : `${group.name} = ${group.value}`}
									>
										<span class="shrink-0 text-gray-600">{group.name}:</span>
										<span class="min-w-0 truncate text-gray-900">
											{group.empty ? '未参与' : group.value === '' ? '空串' : group.value}
										</span>
									</span>
								{/each}
							</div>
						{/if}
					</li>
				{/each}
				{#if regexStore.result.truncated}
					<li class="px-4 py-2 text-xs text-gray-600">
						已达 {MAX_MATCHES} 个上限，后面的没有继续匹配。
					</li>
				{/if}
			</ul>
		{/if}
	</div>
</div>
