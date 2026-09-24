<script lang="ts">
	// 「为什么要换 DNS」说明面板（右栏下）：好处与代价都写，只讲好处等于劝人乱改。
	//
	// 这里是**纯文案**，所以按 STRUCTURE §2 B 留在 ui/ 组件里，不进 core/（core 不掺文案）。
	// 桌面端这一栏单独滚（`lg:min-h-0 lg:flex-1` + 内部 overflow-y-auto）：
	// 整栏都不滚是为了不裁上面命令面板的下拉浮层，见 CommandPanel 的注释。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { FOOTER_BAR, PANEL_HINT } from '$lib/ui/styles';

	/** 一条说明：标题给一句结论，正文补一句为什么。不用 markdown 的 `**`，Svelte 里那是字面量星号 */
	interface Point {
		title: string;
		body: string;
	}

	/** 好处 */
	const BENEFITS: readonly Point[] = [
		{
			title: '不吃运营商的「解析插广告」',
			body: '部分运营商的默认 DNS 会把不存在的域名指到自己的广告页（NXDOMAIN 重定向），换成公共 DNS 就没有这一层。'
		},
		{
			title: '调度通常更稳、更准',
			body: '公共 DNS 走 Anycast，国内几家还做了 ECS（把你的网段带上去），跨网访问 CDN 时更容易解析到合适的节点。'
		},
		{
			title: '带过滤的能拦东西',
			body: 'Quad9、114DNS 安全版 / 家庭版、AdGuard、OpenDNS 家庭版会拦已知的恶意域名或成人内容，给家里网络多一层，不用装软件。'
		},
		{
			title: '加密查询，中间链路看不到你查了什么',
			body: 'DoH / DoT 把解析请求放进 TLS 里。公共 Wi-Fi 或不可信链路上，这一点比「快一点」重要得多。'
		},
		{
			title: '本地 DNS 抽风时的应急手段',
			body: '自家宽带或单位的 DNS 解析不了、结果被污染时，换一组公共 DNS 往往立刻能通，是最快的排查手段之一。'
		}
	];

	/** 代价：换了不等于更好，这几条真会踩到 */
	const COSTS: readonly Point[] = [
		{
			title: '换了不保证更快',
			body: '多数情况下运营商本地 DNS 离你最近、CDN 调度最准，换公共 DNS 反而可能解析到较远的节点。'
		},
		{
			title: '内网域名会解析不到',
			body: '公司 / 学校的内部域名只存在于内部 DNS 里，换掉之后就查不到了。这种情况别整机换，按需临时切。'
		},
		{
			title: '过滤类会误杀',
			body: '被拦的站点需要换回，或改用不带过滤的那一档（同一家通常都有「纯净版」）。'
		},
		{
			title: '加密 DNS 在部分网络下会被阻断',
			body: '尤其在公司网络和部分运营商；连不上就退回普通 DNS。'
		}
	];
</script>

<Panel id="dns-why-panel" headingId="dns-why-heading" heading="为什么要更换 DNS" class="lg:min-h-0 lg:flex-1">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>好处与代价都列了</span>
	{/snippet}

	<!-- 可滚动区需可聚焦才能用键盘滚动（axe scrollable-region-focusable） -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		id="dns-why"
		class="flex flex-col gap-4 overflow-y-auto p-4 lg:min-h-0 lg:flex-1"
		tabindex="0"
		role="region"
		aria-label="为什么要更换 DNS 的说明"
	>
		<p class="text-xs leading-5 text-gray-600">
			DNS 是「域名 → IP」的翻译员，换 DNS 换的是<span class="font-medium text-gray-900">问谁去要这份答案</span>。
			换掉之后解析可能更快更准、能过滤、能加密，但也可能更慢、内网域名查不到 —— 所以是按需换，
			而且要先知道怎么还原（右上那栏的 ③）。
		</p>

		<section class="flex flex-col gap-2">
			<h3 class="text-xs font-semibold text-gray-900">换掉能得到什么</h3>
			<ul class="flex flex-col gap-2">
				{#each BENEFITS as point (point.title)}
					<li class="text-xs leading-5 text-gray-600">
						<span class="font-medium text-gray-900">{point.title}</span>：{point.body}
					</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-2">
			<h3 class="text-xs font-semibold text-gray-900">代价与坑</h3>
			<ul class="flex flex-col gap-2">
				{#each COSTS as point (point.title)}
					<li class="text-xs leading-5 text-gray-600">
						<span class="font-medium text-gray-900">{point.title}</span>：{point.body}
					</li>
				{/each}
			</ul>
		</section>

		<p class="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700">
			一句话：先用着运营商给的那组，遇到插广告、解析被污染、或者需要过滤和加密时再换；换完测几天，不行就 ③ 还原。
		</p>
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">只讲怎么换、不替你决定换不换；本页不发任何网络请求。</p>
		</div>
	{/snippet}
</Panel>
