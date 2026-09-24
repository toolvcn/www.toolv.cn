<script lang="ts">
	// 快捷消息预设。状态来自模块级单例 ws，不用传参。
	import { RotateCcw, Save, SendHorizontal, Trash } from '@lucide/svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
	import Input from '$lib/ui/Input/Input.svelte';
	import EditorBox from '$lib/components/EditorBox/EditorBox.svelte';
	import Textarea from '$lib/ui/Textarea/Textarea.svelte';
	import { FOCUS_RING } from '$lib/ui/styles';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { ws } from '../core/websocket.svelte.ts';
	import { toast } from '$lib/ui/toast.svelte';

	const selected = $derived(ws.connections.selected);

	function fillPreset(data: string, event: MouseEvent): void {
		// Shift + 点击直接发送，普通点击只填入输入框
		if (event.shiftKey && selected) ws.sendTo(selected.id, data);
		else ws.msgInput = data;
	}

	/** 卡片上的发送图标：不经过输入框，直接发出去 */
	function sendPreset(data: string): void {
		if (!selected) {
			toast.show('请先选择一个连接');
			return;
		}
		ws.sendTo(selected.id, data);
	}

	// 恢复默认会丢掉本机存的预设，先问一句
	async function restoreDefaultPresets(): Promise<void> {
		if (await confirm.ask('确定要清空本机保存的预设，恢复成内置的两条吗？')) ws.restoreDefaultPresets();
	}
</script>

<div class="flex flex-col gap-3 border-t border-gray-200 p-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h3 class="text-sm font-semibold text-gray-900">
			快捷消息预设 <span class="text-xs font-normal text-gray-600">（点击填充，或点右侧箭头直接发送）</span>
		</h3>
		<div class="flex shrink-0 items-center gap-1.5">
			<Button
				label="把当前这些预设存到本机浏览器"
				title="把当前这些预设存到本机浏览器，下次打开自动恢复"
				onclick={() => ws.savePresets()}
			>
				<Save class="size-3.5" />保存到本地
			</Button>
			<Button
				label="清掉本机存的预设，恢复成内置的两条"
				title={ws.presetsStored ? '清掉本机存的预设，恢复成内置的两条' : '本机还没有存过预设'}
				disabled={!ws.presetsStored}
				onclick={() => void restoreDefaultPresets()}
			>
				<RotateCcw class="size-3.5" />恢复默认
			</Button>
			<Button
				label={ws.showPresetForm ? '收起新增预设表单' : '新增一条快捷消息预设'}
				title={ws.showPresetForm ? '收起表单' : '新增一条快捷消息预设'}
				variant="ghost"
				onclick={() => (ws.showPresetForm = !ws.showPresetForm)}
			>
				{ws.showPresetForm ? '收起表单' : '添加预设'}
			</Button>
		</div>
	</div>

	{#if ws.showPresetForm}
		<!-- relative 不能省：表单里的 sr-only 是 absolute，没有定位上下文会逃出裁剪并撑高文档 -->
		<form
			class="relative flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
			onsubmit={(event) => {
				event.preventDefault();
				ws.addPreset();
			}}
		>
			<Input id="preset-label" label="预设名称" placeholder="预设名称" bind:value={ws.newPresetLabel} />
			<!-- 用 textarea：预设里经常是整段 JSON，单行输入框既写不下也看不全 -->
			<EditorBox>
				<Textarea
					id="preset-data"
					rows={3}
					mono
					resize="y"
					textSize="text-xs"
					label="预设消息内容"
					placeholder="预设消息内容，支持多行，例如：{`{\n  "type": "ping"\n}`}"
					bind:value={ws.newPresetData}
				/>
			</EditorBox>
			<div class="flex items-center gap-2">
				<Button label="保存这条预设" variant="primary" size="md" type="submit">保存</Button>
				<Button label="取消，不保存这条预设" title="取消，不保存" size="md" onclick={() => (ws.showPresetForm = false)}
					>取消</Button
				>
			</div>
		</form>
	{/if}

	<!-- grid-cols-1 + min-w-0：隐式列默认按 max-content 撑开，会被 preset 里的长 JSON 顶出去 -->
	{#if ws.presetMessages.length === 0}
		<EmptyState>还没有预设，点右上角「添加预设」新建；想留到下次用就点「保存到本地」</EmptyState>
	{:else}
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each ws.presetMessages as preset (preset.id)}
				<!-- relative 不能省：删除按钮的 after 热区是 absolute，没有定位上下文会溢出卡片 -->
				<div
					class="relative flex min-w-0 items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-gray-50"
				>
					<button
						type="button"
						onclick={(event) => fillPreset(preset.data, event)}
						aria-label="把预设「{preset.label}」填入输入框"
						title="点击填入输入框，Shift + 点击直接发送"
						class="min-w-0 flex-1 rounded text-left {FOCUS_RING}"
					>
						<span class="mb-1 block text-sm font-semibold text-gray-900">{preset.label}</span>
						<!-- truncate 之后鼠标悬浮要能看全：预设里经常是整段 JSON -->
						<code class="block truncate font-mono text-xs text-gray-500" title={preset.data}>{preset.data}</code>
					</button>
					<!-- 两个图标上下排：之前并排时各自的 after:-inset-3 热区互相重叠近 20px，
				     极易误点。改成上下排列，按钮本身就是 size-6（24px），
				     达到触控目标下限，不再需要伪元素撑热区 -->
					<div class="flex shrink-0 flex-col items-center gap-1">
						<Button
							icon
							label="直接发送预设 {preset.label}"
							title={selected ? '直接发送' : '先选中一个连接'}
							disabled={!selected}
							onclick={() => sendPreset(preset.data)}
							class="relative rounded after:absolute after:-inset-x-2 after:content-['']"
						>
							<SendHorizontal class="size-3.5" />
						</Button>
						<Button
							icon
							label="删除预设 {preset.label}"
							title="删除预设 {preset.label}"
							variant="danger"
							onclick={() => ws.removePreset(preset.id)}
							class="relative rounded after:absolute after:-inset-x-2 after:content-['']"
						>
							<Trash class="size-3.5" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
