<script lang="ts">
	// 正则速查表：所有分组一次性铺开滚动浏览，不需要额外点击切换分类。
	// 语法条目点一下插到正则栏光标处，修饰符条目点一下直接切换修饰符。
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { CHEAT_GROUPS, type CheatItem } from '../core/types.ts';
	import {
		CHEAT_COUNT,
		CHEAT_DESC,
		CHEAT_GROUP,
		CHEAT_ITEM,
		CHEAT_TITLE,
		CHEAT_TOKEN,
		CHEAT_TOKEN_ON
	} from './styles.ts';
	import { toast } from '$lib/ui/toast.svelte';

	const PATTERN_INPUT_ID = 'regex-pattern-input';

	let { class: className = '' }: { class?: string } = $props();

	/** 语法：插到光标处（拿不到光标就追加到末尾），并把光标移到插入内容之后 */
	function insertToken(item: CheatItem): void {
		const token = item.insert ?? item.token;
		const el = document.getElementById(PATTERN_INPUT_ID);
		const input = el instanceof HTMLInputElement ? el : null;
		const start = input?.selectionStart ?? regexStore.pattern.length;
		const end = input?.selectionEnd ?? start;
		regexStore.pattern = regexStore.pattern.slice(0, start) + token + regexStore.pattern.slice(end);
		const caret = start + token.length;
		if (input) {
			// 值由 Svelte 更新，等这一帧渲染完再把光标放回插入点
			requestAnimationFrame(() => input.setSelectionRange(caret, caret));
		}
		toast.show(`已插入 ${token}`);
	}

	function activate(item: CheatItem): void {
		if (!item.flag) {
			insertToken(item);
			return;
		}
		regexStore.toggleFlag(item.flag);
		toast.show(regexStore.hasFlag(item.flag) ? `已开启 ${item.flag} 修饰符` : `已关闭 ${item.flag} 修饰符`);
	}

	function tokenClass(item: CheatItem): string {
		return item.flag && regexStore.hasFlag(item.flag) ? CHEAT_TOKEN_ON : CHEAT_TOKEN;
	}
</script>

<!-- min-h-40 的理由同 PatternCard：这块也是 overflow-hidden 的滚动容器，
     lg 三行布局在矮视口下会被压到只剩标题行，可视区只剩几十像素（1024×600 实测 62px）。
     原来那条 `lg:min-h-0` 正是压扁它的元凶，已删。 -->
<Panel
	id="regex-cheatsheet"
	headingId="regex-cheatsheet-heading"
	heading="正则速查表"
	tag="aside"
	class="max-h-[60vh] min-h-40 lg:max-h-[30vh] {className}"
>
	{#snippet headingExtra()}
		<span class="hidden truncate text-xs text-gray-600 sm:inline">点语法插入，点修饰符切换</span>
	{/snippet}

	<div
		class="grid min-h-0 grid-cols-1 gap-x-4 gap-y-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1"
	>
		{#each CHEAT_GROUPS as group (group.title)}
			<div class={CHEAT_GROUP}>
				<h3 class={CHEAT_TITLE}>
					{group.title}<span class={CHEAT_COUNT}>{group.items.length} 条</span>
				</h3>
				<!-- 一行两条：两列网格。li 必须 min-w-0，否则 grid item 的 min-width:auto
				     会被长 token 撑开，truncate 失效、两列也不再等宽 -->
				<ul class="grid grid-cols-2 gap-1.5">
					{#each group.items as item (item.token)}
						<li class="min-w-0">
							<button
								type="button"
								class={CHEAT_ITEM}
								aria-label="{item.flag ? '切换修饰符' : '插入'} {item.token}：{item.desc}"
								title="{item.token} —— {item.desc}"
								aria-pressed={item.flag ? regexStore.hasFlag(item.flag) : undefined}
								onclick={() => activate(item)}
							>
								<span class={tokenClass(item)}>{item.token}</span>
								<span class={CHEAT_DESC}>{item.desc}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</Panel>
