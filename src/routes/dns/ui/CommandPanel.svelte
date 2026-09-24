<script lang="ts">
	// 换 DNS 命令面板（右栏上）：选平台 + 选设置成哪一家 → 给出「查名字 / 设置 / 还原」几条命令，逐条可复制。
	//
	// 四个设计取舍：
	//   1. **目标由左侧列表驱动**：列表里点那一行就切到这里（同一个 store 字段），下拉只是并行的第二个入口
	//      —— 筛掉了目标、或只想快速换一家时还能用。
	//   2. **每个平台都给「查名字」与「还原」**：接口 / 服务 / 连接名没法自动填对，不给还原没人敢动全局 DNS。
	//   3. `clip={false}`：下拉的浮层是 absolute 挂在卡片内的，`overflow-hidden` 会把它裁掉（UI-STYLE §8）。
	//      因此这一栏也**不能放进滚动容器**——滚动容器照样裁浮层（本仓库踩过），右栏只让下面的说明面板自己滚。
	//   4. 命令列表自己给上限、自己滚；它的滚动容器里**没有浮层**，所以不冲突。
	import CopyButton from '$lib/ui/CopyButton/CopyButton.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { FOOTER_BAR, PANEL_HINT, TOOLBAR_GROUP, TOOLBAR_LABEL } from '$lib/ui/styles';
	import { buildCommands, PLATFORMS, PLATFORM_META, type CommandPlatform } from '../core/commands.ts';
	import { DNS_PROVIDERS, REGION_LABEL } from '../core/dns.ts';
	import { dnsStore } from '../core/store.svelte.ts';

	/** 下拉里的候选：一家一项，描述里带上地区与会被写进命令的那条 IPv4 */
	const providerOptions = DNS_PROVIDERS.map((provider) => ({
		value: provider.id,
		label: provider.name,
		description: `${REGION_LABEL[provider.region]} · ${provider.ipv4[0] ?? '无 IPv4'}`
	}));

	const commands = $derived(buildCommands(dnsStore.commandPlatform, dnsStore.commandTarget, dnsStore.commandName));
	const platformHint = $derived(PLATFORM_META[dnsStore.commandPlatform].hint);
	// 输入框的标签与占位符跟着平台走：三个平台填的是三种不同的名字（网卡名 / 网络服务名 / 连接名）
	const nameLabel = $derived(PLATFORM_META[dnsStore.commandPlatform].nameLabel);
	const nameSample = $derived(PLATFORM_META[dnsStore.commandPlatform].sample);
	const nameTitle = $derived(`留空按 ${nameSample} 生成命令`);
	const target = $derived(dnsStore.commandTarget);

	function setPlatform(value: CommandPlatform): void {
		dnsStore.setCommandPlatform(value);
	}
</script>

<Panel id="dns-command-panel" headingId="dns-command-heading" heading="更换 DNS 命令" clip={false} class="lg:min-h-0">
	{#snippet headingExtra()}
		<span class={PANEL_HINT}>点列表任意一行即可切换</span>
	{/snippet}

	<!-- `min-h-0 flex-1` + 选择区与提示 `shrink-0`：栏里放得下时按内容高度显示，
	     放不下时**只让命令列表滚**，选择器与提示不会被压扁 -->
	<div class="flex min-h-0 flex-1 flex-col gap-3 p-3">
		<div class="flex shrink-0 flex-wrap items-end gap-3">
			<div class={TOOLBAR_GROUP}>
				<span class={TOOLBAR_LABEL} id="dns-platform-label">系统</span>
				<SegmentedControl
					aria-labelledby="dns-platform-label"
					options={PLATFORMS}
					value={dnsStore.commandPlatform}
					onchange={(value) => setPlatform(value)}
				/>
			</div>
			<div class="{TOOLBAR_GROUP} min-w-0 flex-1">
				<span class={TOOLBAR_LABEL} id="dns-target-label">设置成哪一家</span>
				<Dropdown
					label="选择要设置的公共 DNS 服务"
					aria-labelledby="dns-target-label"
					size="sm"
					class="w-full justify-between"
					options={providerOptions}
					value={dnsStore.commandTargetId}
					onSelect={(value) => dnsStore.setCommandTarget(value)}
				/>
			</div>
			<!-- 名字填一次、②③ 一起用：写死成样本值时用户得手改命令文本（引号很容易改坏），
			     而网卡名在中文 Windows 上是「WLAN / 以太网」、和各家机器都不一样，只能让用户填。
			     留空回落到样本值（见 `resolveInterfaceName`），所以不填也能复制即用。
			     size="sm" 与同排的分段控件、下拉同为 h-8（styles.ts：工具条控制同高）。 -->
			<div class={TOOLBAR_GROUP}>
				<label class={TOOLBAR_LABEL} for="dns-interface-name" title={nameTitle}>{nameLabel}</label>
				<Input
					id="dns-interface-name"
					size="sm"
					mono
					placeholder={nameSample}
					value={dnsStore.commandName}
					oninput={(event) => dnsStore.setCommandName(event.currentTarget.value)}
					class="w-44"
				/>
			</div>
		</div>

		{#if commands.length === 0}
			<p class="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-600">
				{target.name} 没有收录 IPv4 地址，生成不了命令。
			</p>
		{:else}
			<!-- 命令条数 3~4 条（Linux 最多），高度交给 flex 分配：这里的 `lg:flex-1` + 面板的
			     `lg:min-h-0` 让「栏里放得下就全显示、放不下才滚」——**不要用视口单位做上限**
			     （`max-h-[40vh]` 跟栏内实际余量无关：900px 高的屏幕上它只给 360px，明明放得下也会滚，
			     而且滚动边界会把某条命令从中间截断）。
			     下拉浮层在上面的选择区、不在这个滚动容器里，所以不会被裁（滚动容器裁浮层是本仓库踩过的坑）。
			     滚动区用外层 div、不直接给 `<ol>` 加 role：改了 ol 的 role 会抹掉列表语义，
			     里面的 li 就违反 axe 的 `list` 规则。 -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="lg:min-h-0 lg:flex-1 lg:overflow-y-auto" tabindex="0" role="region" aria-label="更换 DNS 命令列表">
				<ol class="flex flex-col gap-2.5">
					{#each commands as line (line.label)}
						<li class="flex flex-col gap-1">
							<!-- 标签 flex-1 min-w-0 承担收缩（长标签换行），按钮 shrink-0 保住宽度。
							     **`label` 是给读屏的无障碍名，可见文字必须另给 children** ——
							     Button 的规则是「有 children 就渲染 children，否则非图标档直接渲染 label」，
							     只传 label 会把那串长句子当成按钮文字显示出来。
							     size="xs"（h-7）：与 11px 标签同排更协调，逐行复制按钮在这个仓库也是这一档。 -->
							<div class="flex items-center gap-2">
								<span class="min-w-0 flex-1 text-[11px] font-medium text-gray-600">{line.label}</span>
								<CopyButton
									size="xs"
									class="shrink-0"
									text={line.command}
									label={`复制第 ${line.label} 条命令`}
									ok="已复制命令"
									title="复制这条命令"
								>
									复制
								</CopyButton>
							</div>
							<!-- 命令块：整条命令要能一眼看全（复制前得核对），所以换行显示而不是横向滚动。
							     `break-words`（overflow-wrap）不是 `break-all`：前者只在**空格处**换行、
							     整行塞不下的长词才兜底断开；后者会在任意字符处断，把 `223.5.5.5` 劈成
							     `"2` + `23.5.5.5` 这种，看着就像命令是错的（Linux 的命令最长，最明显）。 -->
							<code
								class="rounded-lg bg-gray-900 px-2.5 py-2 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-gray-100"
								>{line.command}</code
							>
						</li>
					{/each}
				</ol>
			</div>
		{/if}

		<p class="shrink-0 text-[11px] leading-4 text-gray-600">{platformHint}</p>
	</div>

	{#snippet footer()}
		<div class={FOOTER_BAR}>
			<p class="truncate text-xs text-gray-600">
				改的是整机 DNS（影响所有程序）：先跑 ① 取名字填进输入框，用完记得 ③ 还原。
			</p>
		</div>
	{/snippet}
</Panel>
