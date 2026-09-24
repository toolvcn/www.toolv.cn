<script lang="ts">
	// 常用正则表达式：最左侧一栏，按场景分组，点一下填进正则栏（需要修饰符的一并带上）。
	// 自己存过的表达式排在最前面（本地有才出现这一组），桌面把删除收进条目右下角；
	// 顶部「名称 + 保存」把当前表达式存到 localStorage，名称留空就用表达式本体；
	// 勾了「同时保存当前测试文本」时连测试文本一起存；点条目时测试文本未改过才直接还原，改过则先弹确认。
	// 桌面竖排（标签 + 一行说明），移动端收成 chips 并封顶滚动，别把正则栏挤到屏幕外。
	import { FileText, Save, Trash } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox/Checkbox.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { regexStore } from '../core/store.svelte.ts';
	import { PRESET_GROUPS, type Preset, type SavedPreset } from '../core/types.ts';
	import {
		PRESET_ITEM,
		PRESET_ITEM_CURRENT,
		PRESET_LABEL,
		PRESET_NOTE,
		SAVED_ITEM,
		SAVED_ITEM_CURRENT,
		SAVED_LABEL,
		SAVED_NOTE
	} from './styles.ts';

	let { class: className = '' }: { class?: string } = $props();

	function itemClass(pattern: string): string {
		return regexStore.pattern === pattern ? PRESET_ITEM_CURRENT : PRESET_ITEM;
	}

	function titleOf(preset: Preset): string {
		return preset.flags ? `${preset.note}（修饰符 ${preset.flags}）` : preset.note;
	}

	/** 已保存条目：表达式与修饰符都对上才高亮（同一表达式两种修饰符是两条） */
	function isCurrent(pattern: string, flags: string): boolean {
		return regexStore.pattern === pattern && regexStore.flags === flags;
	}

	/** 存了测试文本的条目在悬浮提示里标明，列表图标之外再给一处文字说明 */
	function savedTitle(item: SavedPreset): string {
		const base = `/${item.pattern}/${item.flags}`;
		return item.input === undefined ? base : `${base} · 含测试文本`;
	}

	/** 删除前先确认：本地存档删掉就找不回来了 */
	async function confirmDelete(item: SavedPreset): Promise<void> {
		if (!(await confirm.ask(`确定删除「${item.name}」吗？删除后无法恢复。`))) return;
		regexStore.deleteSaved(item.id);
	}

	/** 点一条本地配置：会盖掉已编辑的测试文本时先问一句，其余情况直接还原 */
	async function applySavedItem(item: SavedPreset): Promise<void> {
		const overwriteText = regexStore.needsTextConfirm(item.id)
			? await confirm.ask(`「${item.name}」里存了测试文本，会覆盖你当前编辑的文本。是否覆盖？`)
			: true;
		regexStore.applySaved(item.id, { overwriteText });
	}
</script>

<Panel
	id="regex-presets"
	headingId="regex-presets-heading"
	heading="常用正则表达式"
	tag="aside"
	class="max-lg:shrink-0 lg:min-h-0 {className}"
>
	{#snippet headingExtra()}
		<span class="hidden truncate text-xs text-gray-600 sm:inline">点击填入</span>
	{/snippet}

	<!-- 名称 + 保存 + 「带测试文本」勾选。relative 不能省：Input 的 sr-only label 是 absolute，
	     没有定位上下文会逃出裁剪把文档撑高（UI-STYLE §18） -->
	<div class="shrink-0 border-b border-gray-100 pb-3">
		<form
			class="relative flex gap-2 p-3 pb-2"
			onsubmit={(event) => {
				event.preventDefault();
				regexStore.saveCurrent();
			}}
		>
			<Input
				id="regex-saved-name"
				size="sm"
				class="min-w-0 flex-1"
				label="保存名称"
				bind:value={regexStore.savedName}
				placeholder="名称（留空用表达式）"
				autocomplete="off"
			/>
			<Button
				type="submit"
				size="sm"
				label="保存当前表达式到本地"
				title={regexStore.canSave ? '保存当前表达式' : '当前表达式为空或已保存'}
				disabled={!regexStore.canSave}
			>
				<Save class="size-3.5 shrink-0" aria-hidden="true" />保存
			</Button>
		</form>
		<div class="px-3">
			<Checkbox
				bind:checked={regexStore.saveWithInput}
				disabled={regexStore.input === ''}
				label="同时保存当前测试文本"
				title={regexStore.input === ''
					? '测试文本为空，没有可一起保存的内容'
					: '勾选后这条配置连测试文本一起存，点击时一并还原'}
			/>
		</div>
	</div>

	<div class="flex flex-col gap-3 p-4 max-lg:max-h-40 max-lg:overflow-y-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
		{#if regexStore.saved.length > 0}
			<div>
				<h3 class="mb-1 hidden text-xs font-semibold text-gray-600 lg:block">我的保存</h3>
				<ul class="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
					{#each regexStore.saved as item (item.id)}
						<li class="relative flex items-center gap-1 lg:w-full">
							<button
								type="button"
								class={isCurrent(item.pattern, item.flags) ? SAVED_ITEM_CURRENT : SAVED_ITEM}
								title={savedTitle(item)}
								onclick={() => void applySavedItem(item)}
							>
								<span class={SAVED_LABEL}>
									{item.name}
									{#if item.input !== undefined}
										<!-- 存了测试文本的标记。aria-label 参与按钮的可访问名，
										     读屏能听到「… 含测试文本」，比 sr-only 省一层定位上下文 -->
										<FileText
											class="ml-1 inline size-3 shrink-0 align-middle text-gray-500"
											role="img"
											aria-label="含测试文本"
										/>
									{/if}
								</span>
								<span class={SAVED_NOTE}>/{item.pattern}/{item.flags}</span>
							</button>
							<Button
								icon
								variant="danger"
								label={`删除已保存的「${item.name}」`}
								title="删除"
								class="lg:absolute lg:right-0.5 lg:bottom-0.5"
								onclick={() => void confirmDelete(item)}
							>
								<Trash class="size-3.5" />
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#each PRESET_GROUPS as group (group.title)}
			<div>
				<h3 class="mb-1 hidden text-xs font-semibold text-gray-600 lg:block">{group.title}</h3>
				<ul class="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
					{#each group.items as preset (preset.label)}
						<li class="lg:w-full">
							<button
								type="button"
								class={itemClass(preset.pattern)}
								title={titleOf(preset)}
								aria-current={regexStore.pattern === preset.pattern ? 'true' : undefined}
								onclick={() => regexStore.applyPreset(preset.pattern, preset.label, preset.flags)}
							>
								<span class={PRESET_LABEL}>{preset.label}</span>
								<span class={PRESET_NOTE}>{preset.note}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</Panel>
