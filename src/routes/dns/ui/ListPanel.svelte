<script lang="ts">
	// 公共 DNS 列表面板（左栏）：按服务分组的可复制地址列表。
	//
	// 为什么自绘列表而不复用 `$lib/components/CommandCheatsheet` 那套通用速查表：
	// 速查表的行尾按钮**只复制最左边那一列**，而这里每个服务有 IPv4 / IPv6 / DoH / DoT 四类地址、
	// 要能分别复制，套通用表就得给「复制哪一列」开新口子，不如自己排一行。
	import { ArrowUpRight, Check } from '@lucide/svelte';
	import Badge from '$lib/components/Badge/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import { FOCUS_RING, FOOTER_BAR, PANEL_HINT, PANEL_SCROLL } from '$lib/ui/styles';
	import { addressEntries, groupAddresses, REGION_LABEL, siteHost, type DnsRegion } from '../core/dns.ts';
	import { dnsStore } from '../core/store.svelte.ts';

	/** 把「服务 + 配置页域名 + 按类型并好的地址组」一次算好：都不进 `{#each}` 里现算（UI-STYLE §12 重复计算） */
	const rows = $derived(
		dnsStore.results.map((provider) => ({
			provider,
			site: siteHost(provider.site),
			groups: groupAddresses(addressEntries(provider))
		}))
	);

	/** 国内用信息蓝、国外用中性灰 —— 只是区分，不暗示优劣 */
	function regionTone(region: DnsRegion): 'info' | 'neutral' {
		return region === 'cn' ? 'info' : 'neutral';
	}

	/**
	 * 选中态的行与名字样式。
	 * **必须在这里拼好**：class 属性里写三元会被 prettier 拆断、静默失效（AGENTS §6）。
	 * 顺序按 Tailwind 的规范序手写（这两串在函数返回值里，prettier 的 class 排序插件看不到）。
	 */
	function rowClass(selected: boolean): string {
		return selected ? 'px-4 py-2 bg-blue-50' : 'px-4 py-2';
	}

	/** 选中的服务名变蓝，其余保持灰黑 */
	function nameClass(selected: boolean): string {
		return selected ? 'text-blue-700' : 'text-gray-900';
	}
</script>

<Panel id="dns-list-panel" headingId="dns-list-heading" heading="公共 DNS 服务" class="min-h-0 flex-1">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>点行任意处 → 出换 DNS 命令；地址后的按钮复制单条</span>
	{/snippet}
	{#snippet actions()}
		<span class="shrink-0 text-xs text-gray-600" role="status" aria-live="polite">{dnsStore.countText}</span>
	{/snippet}

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable）；
	     小屏封顶，桌面交给栅格：md 起外壳钉住视口，这里 flex-1 自己滚 -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div id="dns-list" class={PANEL_SCROLL} tabindex="0" role="region" aria-label="公共 DNS 服务列表">
		{#if rows.length === 0}
			<div class="p-4">
				<EmptyState>没有匹配的服务：换个关键词，或把地区切回「全部」。</EmptyState>
			</div>
		{:else}
			<ul class="divide-y divide-gray-200">
				{#each rows as row (row.provider.id)}
					{@const selected = dnsStore.commandTargetId === row.provider.id}
					<!-- 整行可点：用一个**铺满整行的透明按钮**当背景层来承载「选中」，内容层整体 pointer-events-none，
					     只有真正要单独点的（地址、复制按钮、配置页链接）才抬回 pointer-events-auto ——
					     这样「点行内任何地方都选中」，又没有可点元素嵌套（行内本来就有复制按钮）。
					     `group` 挂在 li 上（hover 判定靠它，铺满的按钮也是 li 的后代），
					     触屏没有 hover，复制按钮走 [@media(hover:none)] 常显。 -->
					<li class="group relative {rowClass(selected)}">
						<button
							type="button"
							aria-current={selected ? 'true' : undefined}
							aria-label={`选中 ${row.provider.name}，在右侧生成换 DNS 命令`}
							onclick={() => dnsStore.setCommandTarget(row.provider.id)}
							class="absolute inset-0 rounded {FOCUS_RING}"
						></button>

						<div class="pointer-events-none relative flex flex-col">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
								<h3 class="text-xs font-semibold {nameClass(selected)}">{row.provider.name}</h3>
								<Badge tone={regionTone(row.provider.region)} size="sm">{REGION_LABEL[row.provider.region]}</Badge>
								{#if row.site !== ''}
									<!-- 站外链接要在 rel 里带 external：svelte/no-navigation-without-resolve 靠它放行，不走 resolve()。
									     链接进的是厂商**自己的配置说明页**（列出服务地址与怎么配那一页），不是泛泛的产品首页；
									     标签只显示域名，一眼看出指向谁。sr-only 补上服务名做无障碍名称，
									     父级因此必须带 relative（UI-STYLE §18）。
									     内容层是 pointer-events-none，所以这一条要自己抬回来。 -->
									<a
										href={row.provider.site}
										target="_blank"
										rel="external noopener noreferrer"
										title="在新标签打开官方的配置说明页"
										class="pointer-events-auto relative inline-flex h-6 shrink-0 items-center gap-0.5 rounded px-1 font-mono text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 hover:underline {FOCUS_RING}"
									>
										{row.site}<span class="sr-only">（{row.provider.name} 官方配置说明）</span><ArrowUpRight
											class="size-3 shrink-0"
											aria-hidden="true"
										/>
									</a>
								{:else}
									<!-- 没确认到官方产品页的就直说「未知」：纯状态文字，不用 <button> 假装可点（UI-STYLE §18） -->
									<span class="text-xs text-gray-600" title="未能确认官方产品页，故未收录链接">配置页未知</span>
								{/if}
								{#if selected}
									<span class="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-blue-700">
										<Check class="size-3" aria-hidden="true" />已选
									</span>
								{/if}
							</div>
							<p class="mt-0.5 text-xs leading-4 text-gray-600">{row.provider.note}</p>

							<!-- 紧凑版式：**一类地址一行**，主备并在同一行（省掉「一个值一行」的近一半高度）。
							     复制按钮平时透明、鼠标停到这一行（或键盘聚焦）才现形：用 opacity 而不是 display，
							     元素始终占位与可聚焦，不会因为显隐把地址挤一下（UI-STYLE §17 状态切换不跳高）。 -->
							<div class="mt-1 flex flex-col gap-y-0.5">
								{#each row.groups as group (group.kind)}
									<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
										<span class="w-8 shrink-0 text-[11px] font-medium text-gray-600">{group.kind}</span>
										{#each group.values as value (value)}
											<span class="flex min-w-0 items-center gap-0.5">
												<!-- 地址抬回 pointer-events-auto：一是它自己带 title（截断时要能看到全文），
												     二是文字要能拖选；空白处点的仍是那层铺满的按钮 -->
												<code class="pointer-events-auto min-w-0 truncate font-mono text-xs text-gray-900" title={value}
													>{value}</code
												>
												<CopyButton
													icon
													class="pointer-events-auto opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
													text={value}
													label={`复制 ${row.provider.name} 的 ${group.kind} 地址 ${value}`}
													ok={`已复制 ${value}`}
												/>
											</span>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">
				地址来自厂商公开资料；点域名可开官方的配置说明页核对。本页只查不测速，全程不联网。
			</p>
		</div>
	{/snippet}
</Panel>
