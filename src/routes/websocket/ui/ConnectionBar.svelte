<script lang="ts">
	import { Check, ChevronDown, Link, Plus } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Switch from '$lib/ui/Switch/Switch.svelte';
	import { FOCUS_RING, INPUT_BASE, INPUT_FOCUS } from '$lib/ui/styles';
	import { ws } from '../core/websocket.svelte.ts';
	import { toast } from '$lib/ui/toast.svelte';

	/**
	 * 公共的 WebSocket 回显服务，点一下就把地址换掉。
	 * feature 是这个地址的特性，会同时写进 title / aria-label 和菜单里，
	 * 光看一串 URL 是看不出它会不会回显的。
	 */
	const TEST_URLS = [
		{ url: 'wss://echo.websocket.org', feature: '经典公共回显服务，发什么就原样回什么' },
		{
			url: 'wss://ws.postman-echo.com/raw',
			feature: 'Postman 的 raw 通道，原样回显，不做额外包装'
		},
		{ url: 'wss://ws.ifelse.io', feature: '公共回显服务，发什么就原样回什么' }
	] as const;

	let testUrlOpen = $state(false);

	// 菜单展开时按钮要有可见的激活态，否则点了只有菜单弹出、按钮本身毫无反应。
	// 换行的 class 串一律放脚本里算（class 属性里的三元会被 prettier 拆断而静默失效）
	const testUrlButtonClass = $derived(
		testUrlOpen
			? `inline-flex h-9 items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 ${FOCUS_RING}`
			: `inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS_RING}`
	);
	const chevronClass = $derived(testUrlOpen ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform');

	function useTestUrl(url: string): void {
		ws.urlInput = url;
		testUrlOpen = false;
		toast.show(`地址已换成 ${url}`);
	}

	/** 点到下拉外面或按 Esc 就收起 */
	function onWindowPointerDown(event: Event): void {
		if (!testUrlOpen) return;
		if ((event.target as HTMLElement | null)?.closest('[data-test-url-box]')) return;
		testUrlOpen = false;
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (testUrlOpen && event.key === 'Escape') testUrlOpen = false;
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<section id="connection-bar" class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
	<!-- 开关卡片：整块按开关状态上色，右上角是共享的 <Switch>。
	     on / onToggle 由调用处传进来（两处：自动重连、定时发送） -->
	{#snippet toggleCard(on: boolean, label: string, description: string, onToggle: () => void, body: Snippet)}
		<div
			class={on
				? 'rounded-lg border border-blue-500 bg-blue-50 p-2.5'
				: 'rounded-lg border border-gray-200 bg-gray-50 p-2.5'}
		>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="text-sm font-medium text-gray-900">{label}</div>
					<div class="mt-0.5 truncate text-xs text-gray-600">{description}</div>
				</div>
				<Switch checked={on} {label} title={description} onclick={onToggle} />
			</div>
			{#if on}
				<div class="mt-2">{@render body()}</div>
			{/if}
		</div>
	{/snippet}

	<div class="flex flex-wrap items-center gap-3">
		<!-- relative 不能省：里面的 sr-only 是 absolute，没有定位上下文会逃出裁剪并撑高文档 -->
		<div class="relative min-w-64 flex-1">
			<label for="url-input" class="sr-only">WebSocket 地址</label>
			<div class="relative">
				<input
					id="url-input"
					type="text"
					placeholder="ws://localhost:8080/ws 或 wss://example.com/socket"
					spellcheck="false"
					autocapitalize="off"
					autocomplete="off"
					bind:value={ws.urlInput}
					onkeydown={(event) => event.key === 'Enter' && ws.addConnection()}
					class="h-9 w-full {INPUT_BASE} pr-10 pl-3 text-sm text-gray-900 placeholder:text-gray-500 {INPUT_FOCUS}"
				/>
				<Link class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400" />
			</div>
		</div>
		<div class="flex items-center gap-2">
			<!-- 换测试地址放在「添加连接」之前：它是填充输入框的辅助动作，
			     放主操作右边会显得和「+10」同类，容易被当成又一个批量操作 -->
			<div class="relative" data-test-url-box>
				<!-- 这个不套 Button：它有展开态配色，而 className 覆盖不了 variant
				     （Tailwind 同类名冲突看 CSS 顺序，不是 class 属性的书写顺序） -->
				<button
					type="button"
					aria-label="换一个公共测试地址"
					aria-haspopup="menu"
					aria-expanded={testUrlOpen}
					title="换一个公共测试地址，替换输入框里的地址"
					onclick={() => (testUrlOpen = !testUrlOpen)}
					class={testUrlButtonClass}
				>
					测试地址<ChevronDown class={chevronClass} />
				</button>
				{#if testUrlOpen}
					<!-- 窄屏锚左边、桌面锚右边：按钮在手机上靠左，若一直用 right-0，
					     320px 宽的菜单会跑出屏幕左边（实测 left = -189px）。
					     宽度也用 min() 兜住，别超过视口 -->
					<ul
						role="menu"
						aria-label="公共测试地址"
						class="absolute top-full left-0 z-10 mt-1 w-[min(20rem,calc(100vw-3rem))] divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white p-1 shadow-lg sm:right-0 sm:left-auto"
					>
						{#each TEST_URLS as item (item.url)}
							{@const inUse = ws.urlInput.trim() === item.url}
							<li role="none">
								<button
									type="button"
									role="menuitem"
									onclick={() => useTestUrl(item.url)}
									aria-label="把地址换成 {item.url}，{item.feature}{inUse ? '（正在使用）' : ''}"
									title={inUse ? '正在使用这个地址' : `${item.feature}（点击把地址换成 ${item.url}）`}
									class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-100 {FOCUS_RING}"
								>
									<span class="min-w-0 flex-1">
										<span class="block truncate font-mono text-xs text-gray-800">{item.url}</span>
										<span class="mt-0.5 block text-xs text-gray-600">{item.feature}</span>
									</span>
									<!-- 当前输入框里就是这个地址：给个勾，省得打开菜单还得自己比对 -->
									{#if inUse}
										<Check class="mt-0.5 size-3.5 shrink-0 text-blue-600" />
										<span class="sr-only">（正在使用）</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<Button
				label="按输入框里的地址新建一条连接"
				title="新建一条连接并立即开始连接"
				variant="primary"
				size="md"
				onclick={() => ws.addConnection()}
			>
				<Plus class="size-4" />添加连接
			</Button>
			<Button
				label="批量添加 10 条相同地址的连接"
				title="批量添加 10 条相同地址的连接"
				size="md"
				onclick={() => ws.addTenConnections()}
			>
				<Plus class="size-4" />10
			</Button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
		{#snippet autoSendBody()}
			<label for="auto-send-message" class="mb-0.5 block text-xs text-gray-600">发送内容</label>
			<input
				id="auto-send-message"
				type="text"
				spellcheck="false"
				bind:value={ws.autoSendMsg}
				class="h-8 w-full {INPUT_BASE} px-2.5 font-mono text-xs text-gray-900 {INPUT_FOCUS}"
			/>
		{/snippet}

		{#snippet scheduledBody()}
			<div class="flex items-end gap-2">
				<div class="w-24 shrink-0">
					<label for="scheduled-default-interval" class="mb-0.5 block text-xs text-gray-600">间隔（秒）</label>
					<input
						id="scheduled-default-interval"
						type="number"
						min="1"
						bind:value={ws.scheduledDefault.interval}
						class="h-8 w-full {INPUT_BASE} px-2 text-center text-xs text-gray-900 {INPUT_FOCUS}"
					/>
				</div>
				<div class="min-w-0 flex-1">
					<label for="scheduled-default-message" class="mb-0.5 block text-xs text-gray-600">发送内容</label>
					<input
						id="scheduled-default-message"
						type="text"
						bind:value={ws.scheduledDefault.message}
						class="h-8 w-full {INPUT_BASE} px-2.5 font-mono text-xs text-gray-900 {INPUT_FOCUS}"
					/>
				</div>
			</div>
		{/snippet}

		{@render toggleCard(
			ws.autoSend,
			'连接成功后发送一次',
			'开启后新建的连接会带上这条消息，建连成功时立即发送一次；已有连接用列表里的发送图标开关',
			() => (ws.autoSend = !ws.autoSend),
			autoSendBody
		)}

		{@render toggleCard(
			ws.scheduledDefault.enabled,
			'定时发送消息',
			'开启后新建的连接自动带一条定时发送任务，可在消息面板里开关或删除',
			() => (ws.scheduledDefault.enabled = !ws.scheduledDefault.enabled),
			scheduledBody
		)}
	</div>
</section>
