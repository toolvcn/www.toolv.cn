<script lang="ts">
	// 正则栏：/表达式/修饰符 一体输入条 + 六个修饰符开关 + 清空按钮。非法正则整条转红。
	// 常用正则在左侧独立的 PresetCard 里，点一下把表达式填到这里。
	import { Copy, X } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { FLAG_OPTIONS } from '../core/types.ts';
	import { PATTERN_BOX_INVALID, PATTERN_BOX_OK, PATTERN_DELIMITER, PATTERN_INPUT, TOGGLE_KEY } from './styles.ts';
	import { CHIP_OFF, CHIP_ON } from '$lib/ui/styles';

	const hasError = $derived(regexStore.result.error !== null);
	// 条件类名在脚本里拼好：class 属性里的三元会被 prettier 拆断而静默失效
	const boxClass = $derived(hasError ? PATTERN_BOX_INVALID : PATTERN_BOX_OK);
	const hintClass = $derived(hasError ? 'text-xs text-red-700' : 'text-xs text-gray-600');

	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- min-h-56（14rem）是这块内容的地板价，不能省：
     Panel 是 overflow-hidden，属于 scroll container，栅格行空间不足时它的最小尺寸会被当成 0，
     于是正则栏被压成一条线（1024×600 实测只剩 112px，修饰符开关整排被裁掉）。
     有了下限，压不下去的部分就会溢出栅格容器，靠容器的 overflow-y-auto 滚出来。 -->
<Panel id="regex-pattern" headingId="regex-pattern-heading" heading="正则表达式" class="min-h-56 shrink-0 {className}">
	{#snippet headingExtra()}
		{#if !hasError && regexStore.input !== ''}
			<span class="text-xs text-gray-600">共 {regexStore.matchCount} 处匹配</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if regexStore.pattern !== ''}
			<Button icon label="清空正则表达式" title="清空" onclick={() => regexStore.clearPattern()}>
				<X class="size-3.5" />
			</Button>
		{/if}
		<Button icon label="复制当前正则（含斜杠与修饰符）" title="复制正则" onclick={() => void regexStore.copyPattern()}>
			<Copy class="size-3.5" />
		</Button>
		<Button label="恢复默认示例正则与文本" title="填入示例" size="xs" onclick={() => regexStore.loadExample()}>
			示例
		</Button>
	{/snippet}

	<!-- relative 给 sr-only 的 label 用：absolute 没有定位上下文会逃出裁剪并撑高文档 -->
	<div class="relative flex flex-col gap-3 p-4">
		<div class={boxClass}>
			<span class={PATTERN_DELIMITER} aria-hidden="true">/</span>
			<label for="regex-pattern-input" class="sr-only">正则表达式（不含斜杠分隔符）</label>
			<input
				id="regex-pattern-input"
				type="text"
				bind:value={regexStore.pattern}
				spellcheck="false"
				autocapitalize="off"
				autocomplete="off"
				placeholder="\d{4}-\d{2}-\d{2}"
				class={PATTERN_INPUT}
			/>
			<span class={PATTERN_DELIMITER}>/{regexStore.flags}</span>
		</div>

		<p class={hintClass}>
			{hasError
				? regexStore.result.error
				: regexStore.pattern === ''
					? '输入或从左侧选择常用正则。'
					: '斜杠已经画好了，直接写表达式本体。'}
		</p>

		<!-- 修饰符：说明放 title，字母 + 中文双标签，扫读先看字母 -->
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">修饰符</span>
			<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="正则修饰符">
				{#each FLAG_OPTIONS as option (option.flag)}
					<button
						type="button"
						class={regexStore.hasFlag(option.flag) ? CHIP_ON : CHIP_OFF}
						aria-pressed={regexStore.hasFlag(option.flag)}
						title={option.description}
						onclick={() => regexStore.toggleFlag(option.flag)}
					>
						<span class={TOGGLE_KEY}>{option.flag}</span>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</div>
</Panel>
