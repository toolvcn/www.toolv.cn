<script lang="ts">
	// 请求调试标签页：请求条 + 请求构造 + 响应。
	//
	// 请求条照着 Hoppscotch 排成两行：**第一行只有方法 / URL / 发送**（全页的视觉重心，也是唯一
	// 必须一眼看到的东西），超时与发送方式、示例与清空退到第二行。小屏滚动时请求条吸在导航栏下，
	// 滚到响应底部也能直接改 URL 重发。
	//
	// 排列方式（上下 / 左右）在 store 里：上下时响应拿到整宽，左右时请求与响应同时可见。
	// Ctrl / Cmd + Enter 发送（请求中则取消）—— 高频操作不该非要摸鼠标。
	import { ClipboardPaste, Eraser, LoaderCircle, Send } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown/Dropdown.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Switch from '$lib/ui/Switch/Switch.svelte';
	import { TOOLBAR_LABEL } from '$lib/ui/styles';
	import { httpStore } from '../core/store.svelte.ts';
	import { METHOD_OPTIONS, type HttpMethod } from '../core/types.ts';
	// 超时档位、代发上限与请求示例都在根层的 config.ts（跟默认值同源）
	import { MAX_PROXY_TIMEOUT_MS, REQUEST_EXAMPLES, TIMEOUT_OPTIONS } from '../config.ts';
	import RequestForm from './RequestForm.svelte';
	import ResponseView from './ResponseView.svelte';

	/**
	 * 请求条外壳：外观与 `$lib/ui/styles` 的 `TOOLBAR` 逐字对齐（rounded-xl + 边框 + 白底 + shadow-sm + p-3），
	 * 但里面是**两行**，而 TOOLBAR 带 `md:flex-row`（md 起会把两行并排）—— 所以这里自己写一遍外壳，
	 * 不再复用它。改外观时两边一起看。
	 */
	const BAR = 'flex shrink-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm';
	// 小屏吸顶：导航栏是 h-14，所以 top-14；吸住时补一档阴影跟下面的内容分开。
	// `max-md:` 那几项把工具条从「竖排容器」改成「换行流」：两个行容器在窄屏 `contents` 溶解，
	// 5 个控件组直接参与这一层的换行，靠各自的 `order` 排出三行（见下方注释）
	const barClass =
		BAR +
		' max-lg:sticky max-lg:top-14 max-lg:z-30 max-lg:shadow-md max-md:flex-row max-md:flex-wrap max-md:items-center';

	/**
	 * 「示例」菜单的选项：直接由 `config.ts` 的示例数据派生（名称与说明就写在数据里，不必再抄一份）。
	 * 这是**动作型菜单**（`value=""`，没有「当前值」的概念）—— 点一条执行一次填入，与响应面板的「复制为」同一套。
	 */
	/**
	 * 跨域凭证三档：说明里把「服务端要同时允许」讲清楚 ——
	 * 这一项最容易「改了反而更不通」（`include` 撞上 `Access-Control-Allow-Origin: *` 会被浏览器直接拒）。
	 */
	const CREDENTIALS_OPTIONS = [
		{ value: 'same-origin', label: '同源才带', description: '默认：跨域不带 Cookie（与浏览器原生行为一致）' },
		{ value: 'omit', label: '都不带', description: '任何请求都不带 Cookie，连同源也不带' },
		{
			value: 'include',
			label: '跨域也带',
			description: '跨域也带 Cookie；要求服务端返回 Allow-Credentials 且 Allow-Origin 不能是 *'
		}
	];

	const EXAMPLE_OPTIONS = REQUEST_EXAMPLES.map((example) => ({
		value: example.id,
		label: example.label,
		description: example.description
	}));

	/** 上下排列：请求构造封顶，高度让给响应 */
	const STACK_REQUEST = 'max-h-[60vh] shrink-0 md:max-h-[42vh]';
	/** 响应收起了：请求构造把高度全吃下来（不封顶，否则下面会空出一大块） */
	const STACK_REQUEST_EXPANDED = 'min-h-0 flex-1';
	/** 左右排列：请求构造与响应各占一半，两边都填满高度 */
	const SIDE_REQUEST = 'lg:max-h-none lg:min-h-0 lg:min-w-0 lg:flex-1';
	/** 收起后只剩标题行：不再封顶、也不再与响应抢高度；左右排列时把宽度让出去 */
	const STACK_REQUEST_COLLAPSED = 'shrink-0';
	const SIDE_REQUEST_COLLAPSED = 'lg:min-w-0 lg:flex-none';

	const sending = $derived(httpStore.phase === 'sending');
	const sendLabel = $derived(sending ? '取消请求' : '发送请求');
	const sendText = $derived(sending ? '取消' : '发送');
	/**
	 * 发送方式说明。代发那支要带上超时上限：选了 60 秒时直接写「按 10 秒算」，
	 * 否则用户只在 10 秒被中断，会以为工具坏了（夹短发生在 store.effectiveTimeoutMs）。
	 */
	const sendModeText = $derived.by(() => {
		if (!httpStore.serverMode) return '浏览器直发';
		return httpStore.timeoutMs > httpStore.effectiveTimeoutMs
			? `服务器代发 · 超时按 ${httpStore.effectiveTimeoutMs / 1000} 秒算`
			: `服务器代发 · 超时上限 ${MAX_PROXY_TIMEOUT_MS / 1000} 秒`;
	});
	const sendModeTextClass = $derived(httpStore.serverMode ? 'font-medium text-blue-700' : 'text-gray-600');
	const serverModeTitle = $derived(
		httpStore.serverMode
			? `请求经服务器转发，绕开 CORS 限制并返回测速指标（超时上限 ${MAX_PROXY_TIMEOUT_MS / 1000} 秒）`
			: '浏览器直发（受 CORS 限制），可切换为服务器代发（代发超时上限 10 秒）'
	);
	const requestPanelClass = $derived.by(() => {
		const side = httpStore.layout === 'side';
		if (httpStore.requestCollapsed) return side ? SIDE_REQUEST_COLLAPSED : STACK_REQUEST_COLLAPSED;
		// 响应收起时高度归请求构造；左右排列本来就各占一半，不用换
		if (httpStore.responseCollapsed && !side) return STACK_REQUEST_EXPANDED;
		return side ? SIDE_REQUEST : STACK_REQUEST;
	});
	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const panesClass = $derived(
		httpStore.layout === 'side'
			? 'flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'
			: 'flex min-h-0 flex-1 flex-col gap-4'
	);

	function toggleSend(): void {
		if (httpStore.phase === 'sending') httpStore.cancel();
		else void httpStore.send();
	}

	/**
	 * 全局快捷键：`Ctrl / Cmd + Enter` 在页面任意位置都等于点「发送」（请求中则为「取消」）。
	 * `isComposing` 是输入法正在拼字（中文输入法里回车用于确认候选词），这时不接 —— 否则会误发。
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || event.isComposing || !(event.metaKey || event.ctrlKey)) return;
		event.preventDefault();
		toggleSend();
	}

	/**
	 * URL 输入框内直接按 `Enter` 发送 —— 手不离键盘的路径，不用再往右边找按钮。
	 *
	 * 两条守卫：
	 *   1. `isComposing`：中文输入法用回车确认候选词时不发送，否则打一半就被发出去；
	 *   2. 带修饰键时让给上面的全局 `Ctrl / Cmd + Enter` 处理，否则同一次按键会发两次。
	 *
	 * 只接这个输入框 —— 请求头 / 请求体是多行文本，那里 `Enter` 必须是换行。
	 */
	function onUrlKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || event.isComposing) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		event.preventDefault();
		toggleSend();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- 直接落在工作区栅格里（外面不再套外壳面板）：留白由 ToolShell 主区的 p-4 给，
     这里只留卡片之间的间距 —— 于是三张卡的左边线与左栏的导航 / 预设对齐。
     自己再补 p-4 会把主区推得比左栏多出一层，那正是去掉外壳面板的理由 -->
<div class="flex min-h-0 min-w-0 flex-col gap-4">
	<div id="http-toolbar" role="group" aria-label="HTTP 请求操作" class={barClass}>
		<!-- 第一行：方法 + URL；第二行：超时 + 示例 + 发送。可见标签省掉，靠方法下拉的当前值与
		     URL 的占位符说明，无障碍名由 Dropdown 的 label / Input 的 aria-label / Button 的 label 给。

		     **小屏排三行**（靠根节点 `max-md:flex-wrap` + 两个行容器 `max-md:contents` +
		     各组 `max-md:order-*` 实现，宽屏全部失效）：
		       ① 方法 + URL（`w-full`，独占一行 —— 填地址这件主要动作要宽）
		       ② 超时 ▾ ………… 示例 ▾ 发送（`ml-auto` 把后两个推到右端 = 左右布局）
		       ③ ⬤ 浏览器直发 ………… 清空（同理，开关在左、清空在右）
		     前三件挤在一行会把 URL 压到 200px 上下，还要跟粘贴按钮抢位置；竖排 `flex-col` 又会让
		     按钮被拉成横贯整行的蓝条（360px 下 302px 宽）。宽屏回到「主行 + 次行」两行，与原先一致 -->
		<div class="flex flex-col gap-3 max-md:contents md:flex-row md:items-center md:gap-2">
			<!-- 方法 + URL：手机上这一对独占第一行（URL 吃掉剩余宽度）。
			     `basis-full` 而不是 `w-full`：这一层带 `flex-1`，它的 `flex-basis: 0%` 会盖过 `width`，
			     只有 `flex-basis: 100%` 才能真正独占一行 -->
			<div class="flex min-w-0 flex-1 items-center gap-2 max-md:order-1 max-md:basis-full">
				<Dropdown
					class="shrink-0"
					label="请求方法"
					options={METHOD_OPTIONS}
					value={httpStore.method}
					onSelect={(value) => httpStore.setMethod(value as HttpMethod)}
				/>
				<!-- 相对定位的包裹层：让「从剪贴板粘贴」按钮浮在 URL 框**右端内侧**（在哪儿用就贴在哪儿），
			     比在工具条上另起一个按钮省地方，也不会跟 URL / 发送抢宽度。
			     输入框补 pr-10 给按钮让位（Tailwind 的 pr-* 排在 px-* 之后，能盖住 SIZE 里的 px-3） -->
				<div class="relative min-w-0 flex-1">
					<Input
						id="http-url"
						mono
						class="pr-10"
						aria-label="请求 URL"
						aria-keyshortcuts="Enter Control+Enter"
						enterkeyhint="send"
						value={httpStore.url}
						autocomplete="off"
						placeholder="example.com/api 或 https://example.com/api"
						oninput={(event) => httpStore.setUrl(event.currentTarget.value)}
						onkeydown={onUrlKeydown}
					/>
					<Button
						icon
						class="absolute top-1/2 right-1.5 -translate-y-1/2"
						label="从剪贴板粘贴请求"
						title="从剪贴板粘贴请求（cURL / PowerShell / fetch，或一条 URL）"
						onclick={() => void httpStore.pasteFromClipboard()}
					>
						<ClipboardPaste class="size-3.5" aria-hidden="true" />
					</Button>
				</div>
			</div>
			<!-- 示例 + 发送同排（示例在左）：两者都是「往这次请求里填东西 / 把它发出去」的动作，
			     放一起比挂在下面那排次要控件里好找。
			     窄屏 `max-md:self-end` 把这一组推到右端（行高仍是内容高，不拉满 —— 满宽的蓝条
			     是早前修掉的问题）；宽屏 `md:contents` 撤掉这层包裹，两者回到主行与其它控件并排 -->
			<div class="flex shrink-0 items-center gap-2 max-md:order-3 max-md:ml-auto md:contents">
				<!-- 示例做成菜单而不是一条写死的按钮：一条示例只能演示一件事，
				     而这一页值得演示的有参数表 / JSON 请求体 / 表单 / 授权 / 非 2xx / 慢响应几种
				     （数据在 config.ts 的 REQUEST_EXAMPLES，加一条示例只改那一处）。
				     档位跟这一行齐平（md）：同一行不混高度（UI-STYLE §9） -->
				<Dropdown
					size="md"
					label="填入一条请求示例"
					triggerLabel="示例"
					options={EXAMPLE_OPTIONS}
					value=""
					onSelect={(id) => httpStore.applyExample(id)}
				/>
				<Button
					class="shrink-0"
					label={sendLabel}
					title="{sendLabel}（URL 输入框内按 Enter，或 Ctrl / Cmd + Enter）"
					variant="primary"
					size="md"
					onclick={toggleSend}
				>
					{#if sending}
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					{:else}
						<Send class="size-4" aria-hidden="true" />
					{/if}
					{sendText}
				</Button>
			</div>
		</div>

		<!-- 第二行：次要配置 + 表单操作（宽屏是独立一行人；窄屏 `contents` 溶解，见上方注释） -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:contents">
			<div class="flex items-center gap-2 max-md:order-2">
				<span class={TOOLBAR_LABEL}>超时</span>
				<!-- 窄屏它和「示例 / 发送」（md 档 h-9）同排，补一档高度对齐（同一行不混高度，UI-STYLE §9）；
				     宽屏回到次要行，与清空那些 sm 档齐平 -->
				<Dropdown
					class="max-md:h-9"
					size="sm"
					label="请求超时"
					options={TIMEOUT_OPTIONS}
					value={String(httpStore.timeoutMs)}
					onSelect={(value) => httpStore.setTimeoutMs(value)}
				/>
			</div>
			<div class="flex items-center gap-2 max-md:order-4">
				<Switch label="服务器代发开关" title={serverModeTitle} bind:checked={httpStore.serverMode} />
				<span class="text-xs {sendModeTextClass}">{sendModeText}</span>
			</div>
			<!-- 跨域凭证：默认 same-origin（与浏览器原生行为一致），改成「带上」前得知道服务端也要允许。
			     说明写在每个选项的 description 里 —— 这是最容易「改了却更不通」的一项 -->
			<div class="flex items-center gap-2 max-md:order-6">
				<span class={TOOLBAR_LABEL}>跨域凭证</span>
				<Dropdown
					class="max-md:h-9"
					size="sm"
					label="跨域是否带凭证（Cookie）"
					options={CREDENTIALS_OPTIONS}
					value={httpStore.credentials}
					onSelect={(value) => httpStore.setCredentials(value)}
				/>
			</div>
			<div class="flex flex-wrap items-center gap-2 max-md:order-5 max-md:ml-auto md:ml-auto">
				<Button size="sm" label="清空请求表单（认证信息保留）" title="清空" onclick={() => httpStore.clearForm()}>
					<Eraser class="size-3.5" aria-hidden="true" />清空
				</Button>
			</div>
		</div>
	</div>

	<div class={panesClass}>
		<RequestForm class={requestPanelClass} />
		<ResponseView />
	</div>
</div>
