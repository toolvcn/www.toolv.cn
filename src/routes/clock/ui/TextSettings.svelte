<script lang="ts">
	// 文字模式的专属设置：内容与对齐。
	//
	// 这个面板刻意很短 —— 文字模式**没有任何专属外观**，颜色、字体、描边、透明背景
	// 全部沿用「外观」面板那一份，所以它几乎是白拿的（当电子告示牌用：
	// 「会议中，请勿打扰」这类场景，调好样式一次，以后只改这行字）。
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Panel from '$lib/components/Panel/Panel.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl/SegmentedControl.svelte';
	import { TEXT_MAX_LENGTH } from '../config.ts';
	import { clockStore } from '../core/store.svelte.ts';

	const ALIGN_OPTIONS = [
		{ value: 'center', label: '居中' },
		{ value: 'left', label: '左对齐' }
	] as const;
</script>

<Panel id="clock-text" heading="文字" class="shrink-0">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-col gap-1.5">
			<label for="clock-text-content" class="text-xs font-medium text-gray-600">内容</label>
			<EditorBox>
				<Textarea
					id="clock-text-content"
					rows={4}
					maxlength={TEXT_MAX_LENGTH}
					placeholder="想显示什么就写什么，回车换行"
					label="要显示的文字"
					bind:value={clockStore.textOptions.content}
				/>
			</EditorBox>
			<p class="text-[11px] leading-4 text-gray-600">
				回车换行。字号用「自动填满」时按**最长那一行**缩放，中文按整字宽算、英文数字按半字宽算。
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-gray-600">对齐</span>
			<SegmentedControl
				aria-label="文字对齐"
				options={ALIGN_OPTIONS}
				value={clockStore.textOptions.align}
				onchange={(value) => (clockStore.textOptions.align = value)}
			/>
			<p class="text-[11px] leading-4 text-gray-600">多行时长句靠左更好读；单行标语居中更稳。</p>
		</div>
	</div>
</Panel>
