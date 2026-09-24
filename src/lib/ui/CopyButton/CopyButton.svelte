<script lang="ts">
	// 复制按钮：把「复制 + 空内容拦截 + 成败提示」这套重复动作收成一处，专供结果行 / 逐行结果用。
	//
	// 图标形态（传 icon）下**图标由本组件自备**：平时 Copy，复制成功后换成 Check、1.6s 后换回。
	// 原先十几处各传一个 <Copy> 子元素，成功与否只有 toast 一条反馈 —— 鼠标停在按钮上时看不出任何变化。
	// 文字形态（不传 icon）仍是纯文字按钮，children 可覆盖可见文字（命令速查那种显示「复制」、
	// 无障碍名另给完整句子的用法）。
	//
	// 与工具条上那个整块「复制」按钮的分工（UI-STYLE §11.3）：
	//   行内复制（结果列表每行、逐行生成结果的每一条）→ 用本组件；
	//   工具条整块复制（复制全部输出 / 复制 cURL / 复制生成代码）→ 留在 store 方法里，
	//   因为那些守卫（「请先填写 URL」「当前输入有误」）与提示是工具级文案，且已有单测覆盖。
	//
	// 组件自己不做文案兜底以外的判断：text 为空弹 empty，否则交给 copyToClipboard
	// 用真实结果决定弹成功还是失败。
	import { Check, Copy } from '@lucide/svelte';
	import { onDestroy, type ComponentProps, type Snippet } from 'svelte';
	import Button from '../Button/Button.svelte';
	import { copyToClipboard } from '../copy.ts';

	/** 对勾停留时长：够看清，又不至于下次想复制时还停在成功态 */
	const COPIED_MS = 1600;

	// children 不 Omit：文字形态下它就是按钮的可见文字
	type Props = Omit<ComponentProps<typeof Button>, 'label' | 'title' | 'onclick'> & {
		/** 要复制的内容 */
		text: string;
		/** 成功提示，默认「已复制」 */
		ok?: string;
		/** 内容为空时的提示，默认「没有可复制的内容」 */
		empty?: string;
		/** 复制失败时的提示，默认「复制失败，请手动选中复制」 */
		fail?: string;
		/** 空内容的判定，默认 trim 后为空串；用「—」占位的结果传自己的实现 */
		isEmpty?: (text: string) => boolean;
		/** 无障碍名称，默认「复制」 */
		label?: string;
		/** 悬浮提示，省略则与 label 相同 */
		title?: string;
		/** 文字形态的可见文字；图标形态由组件自备图标，不用传 */
		children?: Snippet;
	};

	let { text, ok, empty, fail, isEmpty, label = '复制', title, icon = false, children, ...rest }: Props = $props();

	/** 只有真的写进剪贴板才换成对勾：失败与空内容没有成功可言 */
	let copied = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	// 组件级短命定时器（只是这次点击的反馈），随组件卸载清掉；全局定时器才归 +page.svelte 管（§6）
	onDestroy(() => clearTimeout(resetTimer));

	async function handleClick(): Promise<void> {
		const done = await copyToClipboard(text, { ok, empty, fail, isEmpty });
		if (!done) return;
		copied = true;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copied = false), COPIED_MS);
	}
</script>

<!-- 图标形态：对勾与复制图标同尺寸，换图标不改变按钮宽度 -->
{#snippet copyIcon()}
	{#if copied}
		<Check class="size-3.5" aria-hidden="true" />
	{:else}
		<Copy class="size-3.5" aria-hidden="true" />
	{/if}
{/snippet}

<Button {...rest} {icon} {label} {title} onclick={() => void handleClick()} children={icon ? copyIcon : children} />
