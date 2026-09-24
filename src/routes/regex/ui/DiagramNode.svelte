<script lang="ts">
	// 正则图解的递归渲染：一个 AST 节点一块。
	// 自上而下约定：sequence 横排、alternation 竖排分支、group 圆角盒（按捕获 / 环视着色）、
	// quantified 在子节点右上角挂量词角标，其余叶子（字面量 / 转义 / 字符类 / 锚点 / 引用 / 点号）各成一个 chip。
	// 全部文本插值渲染，不用 {@html}；窄屏靠 flex-wrap 换行，不横向溢出。
	import type { GroupKind, RegexNode } from '../core/parse.ts';
	import DiagramNode from './DiagramNode.svelte';
	import {
		DIAG_ANCHOR,
		DIAG_BACKREF,
		DIAG_CLASS,
		DIAG_DOT,
		DIAG_ESCAPE,
		DIAG_GROUP_CAPTURE,
		DIAG_GROUP_LABEL,
		DIAG_GROUP_LOOK,
		DIAG_GROUP_LOOK_NEG,
		DIAG_GROUP_NONCAPTURE,
		DIAG_LITERAL,
		DIAG_NOTE,
		DIAG_QUANT
	} from './styles.ts';

	let { node }: { node: RegexNode } = $props();

	/** 转义节点里「转义字符 / 转义」这类兜底说明不值得占地方，跳过不显示 */
	const GENERIC_LABELS = new Set(['转义字符', '转义']);

	/** 量词角标文本：* / + / ? / {n} / {n,} / {n,m}，惰性再补个 ? */
	function quantLabel(n: Extract<RegexNode, { type: 'quantified' }>): string {
		const { min, max, lazy } = n;
		let base: string;
		if (min === 0 && max === Infinity) base = '*';
		else if (min === 1 && max === Infinity) base = '+';
		else if (min === 0 && max === 1) base = '?';
		else if (max === Infinity) base = `{${min},}`;
		else if (min === max) base = `{${min}}`;
		else base = `{${min},${max}}`;
		return lazy ? `${base}?` : base;
	}

	/** 组角标文案：捕获 / 命名组显示「组 n / name」，环视显示 ?= 这类记号 */
	function groupLabel(n: Extract<RegexNode, { type: 'group' }>): string {
		if (n.kind === 'capture') return `组 ${n.number}`;
		if (n.kind === 'named') return `组 ${n.name}`;
		const MARK: Record<Exclude<GroupKind, 'capture' | 'named'>, string> = {
			nonCapture: '?:',
			lookahead: '?=',
			negativeLookahead: '?!',
			lookbehind: '?<=',
			negativeLookbehind: '?<!'
		};
		return MARK[n.kind];
	}

	function groupBox(n: Extract<RegexNode, { type: 'group' }>): string {
		if (n.kind === 'capture' || n.kind === 'named') return DIAG_GROUP_CAPTURE;
		if (n.kind === 'nonCapture') return DIAG_GROUP_NONCAPTURE;
		if (n.kind === 'lookahead' || n.kind === 'lookbehind') return DIAG_GROUP_LOOK;
		return DIAG_GROUP_LOOK_NEG;
	}

	function groupLabelClass(n: Extract<RegexNode, { type: 'group' }>): string {
		if (n.kind === 'capture' || n.kind === 'named') return 'text-emerald-700';
		if (n.kind === 'nonCapture') return 'text-gray-600';
		if (n.kind === 'lookahead' || n.kind === 'lookbehind') return 'text-blue-700';
		return 'text-red-700';
	}
</script>

{#if node.type === 'sequence'}
	<div class="flex flex-wrap items-center gap-1">
		{#each node.items as item, i (i)}
			<DiagramNode node={item} />
		{/each}
	</div>
{:else if node.type === 'alternation'}
	<div class="flex flex-col gap-1 border-l-2 border-gray-200 pl-2">
		{#each node.branches as branch, i (i)}
			<div class="flex items-center gap-1">
				<span class="shrink-0 font-mono text-[10px] text-gray-600" aria-hidden="true">[{i}]</span>
				<DiagramNode node={branch} />
			</div>
		{/each}
	</div>
{:else if node.type === 'group'}
	<div class={groupBox(node)}>
		<span class="{DIAG_GROUP_LABEL} {groupLabelClass(node)}">{groupLabel(node)}</span>
		<DiagramNode node={node.child} />
	</div>
{:else if node.type === 'quantified'}
	<div class="relative inline-flex">
		<DiagramNode node={node.child} />
		<span class={DIAG_QUANT} aria-hidden="true">{quantLabel(node)}</span>
	</div>
{:else if node.type === 'literal'}
	<span class={DIAG_LITERAL}>{node.value}</span>
{:else if node.type === 'escape'}
	<span class={DIAG_ESCAPE}>
		<span class="shrink-0">{node.token}</span>
		{#if !GENERIC_LABELS.has(node.label)}
			<span class={DIAG_NOTE}>{node.label}</span>
		{/if}
	</span>
{:else if node.type === 'charClass'}
	<span class={DIAG_CLASS}>
		<span class="shrink-0">{node.token}</span>
		{#if node.negated}
			<span class={DIAG_NOTE}>排除</span>
		{/if}
	</span>
{:else if node.type === 'dot'}
	<span class={DIAG_DOT} aria-hidden="true">·</span>
{:else if node.type === 'anchor'}
	<span class={DIAG_ANCHOR}>{node.token}</span>
{:else}
	<!-- 剩下只有 backref -->
	<span class={DIAG_BACKREF}>
		<span class="shrink-0">{node.token}</span>
		<span class={DIAG_NOTE}>{node.label}</span>
	</span>
{/if}
