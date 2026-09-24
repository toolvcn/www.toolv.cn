<script lang="ts">
	// 键值表格：每行 = 启用勾选 + 键 + 值 + 删除，底部一行「添加」。
	// 查询参数（与 URL 双向同步）与表单字段（拼成 `a=1&b=2`）共用这一件 —— 两者行形状相同，
	// 所以类型也只有一种 `KeyValueRow`。
	//
	// 停用的行留在表里只是不发送：勾掉比「删掉再重填」省事，这是 Hoppscotch 同款交互。
	// 组件不认识 store，回调由调用方接（同 PresetPanel 的做法）。
	import { Plus, Trash } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import type { KeyValueRow } from '../core/types.ts';

	interface Props {
		/** 行内控件 id 的前缀，保证同一页里唯一 */
		idPrefix: string;
		rows: readonly KeyValueRow[];
		onchange: (id: number, patch: Partial<Omit<KeyValueRow, 'id'>>) => void;
		onremove: (id: number) => void;
		onadd: () => void;
		namePlaceholder: string;
		valuePlaceholder: string;
		emptyHint: string;
		addLabel: string;
	}

	let { idPrefix, rows, onchange, onremove, onadd, namePlaceholder, valuePlaceholder, emptyHint, addLabel }: Props =
		$props();
</script>

{#if rows.length === 0}
	<p class="text-xs leading-5 text-gray-600">{emptyHint}</p>
{:else}
	<ul class="flex flex-col gap-1.5">
		{#each rows as row, index (row.id)}
			{@const rowNo = index + 1}
			<li class="flex items-center gap-1.5">
				<!-- 只有勾选框、没有可见文字，所以无障碍名走 aria-label（传 label 会渲染成可见文字） -->
				<Checkbox
					checked={row.enabled}
					aria-label="第 {rowNo} 行是否发送"
					title={row.enabled ? '不发送这一行' : '发送这一行'}
					onchange={(event) => onchange(row.id, { enabled: event.currentTarget.checked })}
				/>
				<Input
					id="{idPrefix}-name-{row.id}"
					size="sm"
					mono
					class="min-w-0 flex-1"
					value={row.name}
					placeholder={namePlaceholder}
					aria-label="第 {rowNo} 行的键"
					autocomplete="off"
					oninput={(event) => onchange(row.id, { name: event.currentTarget.value })}
				/>
				<Input
					id="{idPrefix}-value-{row.id}"
					size="sm"
					mono
					class="min-w-0 flex-1"
					value={row.value}
					placeholder={valuePlaceholder}
					aria-label="第 {rowNo} 行的值"
					autocomplete="off"
					oninput={(event) => onchange(row.id, { value: event.currentTarget.value })}
				/>
				<Button icon variant="danger" label="删除第 {rowNo} 行" onclick={() => onremove(row.id)}>
					<Trash class="size-3.5" aria-hidden="true" />
				</Button>
			</li>
		{/each}
	</ul>
{/if}

<div class="flex pt-3">
	<Button size="sm" label={addLabel} onclick={onadd}>
		<Plus class="size-3.5" aria-hidden="true" />添加
	</Button>
</div>
