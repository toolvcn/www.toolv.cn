<script lang="ts">
	// 授权标签页：类型下拉 + 该类型要填的字段 + 一条「实际会附加什么」的预览。
	//
	// 注入规则（手写的同名请求头优先）由 store 的 requestHeaders 负责，这里只把规则写清楚 ——
	// 说不清「到底附上了没有」是这类面板最常见的困惑，所以预览那一条是常驻的，不是可选装饰。
	// 预览**不回显密钥明文**，只写形状（见 core/auth.ts 的 authPreview）。
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { AUTH_TYPE_OPTIONS, authPreview } from '../core/auth.ts';
	import { httpStore } from '../core/store.svelte.ts';
	import type { ApiKeyIn, AuthType } from '../core/types.ts';

	/** 一行字段：左标签右输入。**relative 不能省** —— Input 的 sr-only label 是 absolute，
	    没有定位上下文会逃出裁剪把文档撑高（UI-STYLE §18） */
	const FIELD = 'relative flex items-center gap-3';
	const FIELD_LABEL = 'w-16 shrink-0 text-xs font-medium text-gray-600';

	const KEY_IN_OPTIONS = [
		{ value: 'header', label: '请求头' },
		{ value: 'query', label: '查询参数' }
	] as const;

	const auth = $derived(httpStore.auth);
	const preview = $derived(authPreview(httpStore.auth));
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- 「认证方式」这一行**必须留在滚动区之外**：它是 Dropdown，菜单 absolute 挂在卡内，
	     只要外面套一层 overflow-y-auto（哪怕卡片本身已经 clip={false}）就会被裁掉 ——
	     滚动容器一样是裁剪上下文，Panel 的 clip 只管它自己那一层。
	     它同时又是个下拉、属于「换个模式」的控件，钉在顶部不跟着字段滚也更顺手。 -->
	<div class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
		<span class="text-xs font-medium text-gray-600">认证方式</span>
		<Dropdown
			size="sm"
			label="认证方式"
			options={AUTH_TYPE_OPTIONS}
			value={auth.type}
			onSelect={(value) => httpStore.setAuth({ type: value as AuthType })}
		/>
	</div>

	<!-- 字段 / 注入预览 / 说明：这三块长起来只让它们自己滚，不会把下拉菜单推出可视区 -->
	<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
		{#if auth.type === 'bearer'}
			<div class={FIELD}>
				<span class={FIELD_LABEL}>Token</span>
				<Input
					id="http-auth-token"
					size="sm"
					mono
					class="min-w-0 flex-1"
					label="Bearer Token"
					value={auth.token}
					placeholder="粘贴 token，发送时自动拼成 Authorization: Bearer &lt;token&gt;"
					autocomplete="off"
					oninput={(event) => httpStore.setAuth({ token: event.currentTarget.value })}
				/>
			</div>
		{:else if auth.type === 'basic'}
			<div class={FIELD}>
				<span class={FIELD_LABEL}>用户名</span>
				<Input
					id="http-auth-username"
					size="sm"
					mono
					class="min-w-0 flex-1"
					label="Basic 用户名"
					value={auth.username}
					autocomplete="off"
					oninput={(event) => httpStore.setAuth({ username: event.currentTarget.value })}
				/>
			</div>
			<div class={FIELD}>
				<span class={FIELD_LABEL}>密码</span>
				<Input
					id="http-auth-password"
					size="sm"
					mono
					class="min-w-0 flex-1"
					label="Basic 密码"
					value={auth.password}
					autocomplete="off"
					oninput={(event) => httpStore.setAuth({ password: event.currentTarget.value })}
				/>
			</div>
		{:else if auth.type === 'apikey'}
			<div class={FIELD}>
				<span class={FIELD_LABEL}>键名</span>
				<Input
					id="http-auth-key-name"
					size="sm"
					mono
					class="min-w-0 flex-1"
					label="API Key 键名"
					value={auth.keyName}
					placeholder="X-API-Key"
					autocomplete="off"
					oninput={(event) => httpStore.setAuth({ keyName: event.currentTarget.value })}
				/>
			</div>
			<div class={FIELD}>
				<span class={FIELD_LABEL}>值</span>
				<Input
					id="http-auth-key-value"
					size="sm"
					mono
					class="min-w-0 flex-1"
					label="API Key 值"
					value={auth.keyValue}
					autocomplete="off"
					oninput={(event) => httpStore.setAuth({ keyValue: event.currentTarget.value })}
				/>
			</div>
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs font-medium text-gray-600">放在</span>
				<SegmentedControl
					tone="quiet"
					aria-label="API Key 放在哪里"
					options={KEY_IN_OPTIONS}
					value={auth.keyIn}
					onchange={(value) => httpStore.setAuth({ keyIn: value as ApiKeyIn })}
				/>
			</div>
		{:else}
			<p class="text-xs leading-5 text-gray-600">
				不自动附加认证信息。需要的话切到「请求头」标签手写一条，或在上面选一种认证方式。
			</p>
		{/if}

		{#if preview.length > 0}
			<div class="rounded-lg bg-gray-50 p-3">
				<p class="text-[11px] font-medium text-gray-700">这条请求实际会附加：</p>
				<ul class="mt-1 flex flex-col gap-0.5">
					{#each preview as line (line)}
						<li class="font-mono text-[11px] leading-4 text-gray-700">{line}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<p class="text-[11px] leading-4 text-gray-600">
			在「请求头」里手写的同名头优先于这里注入的值。存成预设时认证信息会一起写进浏览器本地存储 —— 共用电脑上留意。
		</p>
	</div>
</div>
